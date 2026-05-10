'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { ImportedContact } from '@/lib/contact-import-types'
import {
  assertSafePublicUrl,
  extractContactFromHtml,
  refineContactWithLlm,
  resolveLlmMode,
  resolveOllamaClientUrl,
  type UrlEnrichMeta,
} from '@/lib/contact-url-enrich'

export type { ImportedContact } from '@/lib/contact-import-types'
export type { UrlEnrichMeta } from '@/lib/contact-url-enrich'

// ── Google Contacts CSV Import ────────────────────────────────────────────────

export type ImportResult = { ok: true; imported: number; skipped: number } | { error: string }

export async function importGoogleContacts(contacts: ImportedContact[]): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Use service client for writes — RLS INSERT policy only allows is_private=false for team,
  // but imported contacts should be private. Service client bypasses RLS.
  const svc = createServiceClient()

  if (!contacts.length) return { ok: true, imported: 0, skipped: 0 }

  // Collect all emails from the batch to check for duplicates (via service client to see all)
  const allEmails = contacts
    .flatMap(c => c.emails.map(e => e.email.toLowerCase()))
    .filter(Boolean)

  const existingEmails = new Set<string>()

  if (allEmails.length > 0) {
    const { data: existingMain } = await svc
      .from('Contact')
      .select('Email')
      .in('Email', allEmails)
    const { data: existingTable } = await svc
      .from('contact_emails')
      .select('email')
      .in('email', allEmails)
    existingMain?.forEach(r => r.Email && existingEmails.add(r.Email.toLowerCase()))
    existingTable?.forEach(r => r.email && existingEmails.add(r.email.toLowerCase()))
  }

  let imported = 0
  let skipped  = 0

  for (const c of contacts) {
    // Skip if any email already exists
    const isDupe = c.emails.some(e => existingEmails.has(e.email.toLowerCase()))
    // Also skip if no name and no institution
    const hasIdentity = c.prenom || c.nom || c.institution
    if (isDupe || !hasIdentity) { skipped++; continue }

    const primaryEmail = c.emails[0]?.email ?? null
    const primaryPhone = c.phones[0] ?? null
    const primaryWebsite = c.websites[0]?.url?.slice(0, 500) ?? null

    const { data: inserted, error: insertErr } = await svc
      .from('Contact')
      .insert({
        Prénom:          c.prenom,
        Nom:             c.nom,
        NomInstitution:  c.institution,
        Role:            c.role,
        Email:           primaryEmail,
        Téléphone1:      (primaryPhone?.phone ?? null)?.slice(0, 20) ?? null,
        IndicatifPays1:  (primaryPhone?.country_code ?? null)?.slice(0, 10) ?? null,
        Website:         primaryWebsite,
        Notes:           c.notes,
        is_private:      true,
        Actif:           true,
      })
      .select('ContactID')
      .single()

    if (insertErr || !inserted) {
      console.error('Contact insert failed:', insertErr?.message, JSON.stringify({ prenom: c.prenom, nom: c.nom }))
      skipped++; continue
    }

    const cid = inserted.ContactID

    // Emails
    if (c.emails.length > 0) {
      await svc.from('contact_emails').insert(
        c.emails.map((e, i) => ({
          contact_id: cid,
          email:      e.email,
          label:      e.label || 'Personnel',
          is_primary: i === 0,
        }))
      )
      c.emails.forEach(e => existingEmails.add(e.email.toLowerCase()))
    }

    // Phones
    if (c.phones.length > 0) {
      await svc.from('contact_phones').insert(
        c.phones.map((p, i) => ({
          contact_id:   cid,
          phone:        p.phone,
          country_code: p.country_code,
          label:        p.label || 'Mobile',
          is_primary:   i === 0,
        }))
      )
    }

    // Addresses
    if (c.addresses.length > 0) {
      await svc.from('contact_addresses').insert(
        c.addresses.map((a, i) => ({
          contact_id:  cid,
          label:       a.label || 'Principal',
          adresse:     a.adresse,
          code_postal: a.code_postal,
          ville:       a.ville,
          pays:        a.pays,
          position:    i,
        }))
      )
    }

    // Websites
    if (c.websites.length > 0) {
      await svc.from('contact_websites').insert(
        c.websites.map(w => ({
          contact_id: cid,
          url:        w.url,
          label:      w.label || 'Web',
        }))
      )
    }

    imported++
  }

  revalidatePath('/atelier')
  return { ok: true, imported, skipped }
}

export type ContactDeleteResult = { error: string } | { ok: true }

/**
 * Delete one or more contacts and their associated addresses.
 * Note: Does NOT delete works associated with the contact (sets ContactID to null in Oeuvres).
 */
export async function deleteContacts(ids: number[]): Promise<ContactDeleteResult> {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  if (!ids.length) return { ok: true }

  // 1. Delete addresses first
  const { error: addrErr } = await supabase
    .from('contact_addresses')
    .delete()
    .in('contact_id', ids)
  
  if (addrErr) return { error: addrErr.message }

  // 2. Delete contacts
  const { error: contactErr } = await supabase
    .from('Contact')
    .delete()
    .in('ContactID', ids)

  if (contactErr) return { error: contactErr.message }

  revalidatePath('/atelier')
  return { ok: true }
}

export type MergeContactsResult = { ok: true; keptId: number } | { error: string }

function isBlankScalar(v: unknown): boolean {
  return v == null || v === ''
}

/** Prefer rows already on `keep`; fill empty columns from `lose`. */
function mergeContactScalars(keep: Record<string, unknown>, lose: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...keep }
  for (const [k, v] of Object.entries(lose)) {
    if (k === 'ContactID') continue
    if (isBlankScalar(v)) continue
    if (isBlankScalar(out[k])) out[k] = v
  }
  return out
}

function normEmail(e: string): string {
  return e.trim().toLowerCase()
}

function normPhone(p: string): string {
  return p.replace(/\D/g, '')
}

function normWeb(u: string): string {
  return u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function socialKey(platform: string, handle: string): string {
  return `${platform.trim().toLowerCase()}|${handle.trim().toLowerCase()}`
}

/**
 * Merge `fromId` into `intoId`: reassign FKs, union contact_* rows (dedupe), fill blank Contact fields, delete `fromId`.
 * Uses service role for consistent FK + junction updates.
 */
export async function mergeContacts(intoId: number, fromId: number): Promise<MergeContactsResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  if (!intoId || !fromId || intoId === fromId) return { error: 'Fusion invalide' }

  const svc = createServiceClient()

  const { data: keepRow, error: ke } = await svc.from('Contact').select('*').eq('ContactID', intoId).maybeSingle()
  const { data: loseRow, error: le } = await svc.from('Contact').select('*').eq('ContactID', fromId).maybeSingle()
  if (ke || le || !keepRow || !loseRow) return { error: 'Contact introuvable' }

  const mergedScalars = mergeContactScalars(keepRow as Record<string, unknown>, loseRow as Record<string, unknown>)
  delete (mergedScalars as { ContactID?: number }).ContactID
  const { error: mergeErr } = await svc.from('Contact').update(mergedScalars).eq('ContactID', intoId)
  if (mergeErr) return { error: mergeErr.message }

  const fkRefs: { table: string; col: string }[] = [
    { table: 'Oeuvres', col: 'ContactID' },
    { table: 'Oeuvres', col: 'LocalisationID' },
    { table: 'Oeuvres', col: 'AcheteurID' },
    { table: 'exhibition', col: 'contact_id' },
    { table: 'document', col: 'contact_id' },
    { table: 'sale_order', col: 'buyer_id' },
    { table: 'consignment_order', col: 'partner_id' },
    { table: 'suivi_process', col: 'contact_id' },
    { table: 'expense', col: 'contact_id' },
    { table: 'shipment', col: 'to_contact_id' },
  ]

  for (const { table, col } of fkRefs) {
    const { error } = await (svc.from(table) as any).update({ [col]: intoId }).eq(col, fromId)
    if (error) return { error: `${table}.${col}: ${error.message}` }
  }

  const { error: addrErr } = await svc.from('contact_addresses').update({ contact_id: intoId }).eq('contact_id', fromId)
  if (addrErr) return { error: addrErr.message }

  // Emails — dedupe by normalized email
  const { data: srcEmails } = await svc.from('contact_emails').select('*').eq('contact_id', fromId)
  const { data: tgtEmails } = await svc.from('contact_emails').select('email').eq('contact_id', intoId)
  const emailSet = new Set((tgtEmails ?? []).map((r: { email: string }) => normEmail(r.email)))
  for (const row of srcEmails ?? []) {
    const ne = normEmail(row.email)
    if (emailSet.has(ne)) {
      const { error } = await svc.from('contact_emails').delete().eq('id', row.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await svc.from('contact_emails').update({ contact_id: intoId }).eq('id', row.id)
      if (error) return { error: error.message }
      emailSet.add(ne)
    }
  }

  const { data: srcPhones } = await svc.from('contact_phones').select('*').eq('contact_id', fromId)
  const { data: tgtPhones } = await svc.from('contact_phones').select('phone').eq('contact_id', intoId)
  const phoneSet = new Set((tgtPhones ?? []).map((r: { phone: string }) => normPhone(r.phone)))
  for (const row of srcPhones ?? []) {
    const np = normPhone(row.phone)
    if (phoneSet.has(np)) {
      const { error } = await svc.from('contact_phones').delete().eq('id', row.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await svc.from('contact_phones').update({ contact_id: intoId }).eq('id', row.id)
      if (error) return { error: error.message }
      phoneSet.add(np)
    }
  }

  const { data: srcWeb } = await svc.from('contact_websites').select('*').eq('contact_id', fromId)
  const { data: tgtWeb } = await svc.from('contact_websites').select('url').eq('contact_id', intoId)
  const webSet = new Set((tgtWeb ?? []).map((r: { url: string }) => normWeb(r.url)))
  for (const row of srcWeb ?? []) {
    const nw = normWeb(row.url)
    if (webSet.has(nw)) {
      const { error } = await svc.from('contact_websites').delete().eq('id', row.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await svc.from('contact_websites').update({ contact_id: intoId }).eq('id', row.id)
      if (error) return { error: error.message }
      webSet.add(nw)
    }
  }

  const { data: srcSoc } = await svc.from('contact_socials').select('*').eq('contact_id', fromId)
  const { data: tgtSoc } = await svc.from('contact_socials').select('platform, handle').eq('contact_id', intoId)
  const socSet = new Set((tgtSoc ?? []).map((r: { platform: string; handle: string }) => socialKey(r.platform, r.handle)))
  for (const row of srcSoc ?? []) {
    const sk = socialKey(row.platform, row.handle)
    if (socSet.has(sk)) {
      const { error } = await svc.from('contact_socials').delete().eq('id', row.id)
      if (error) return { error: error.message }
    } else {
      const { error } = await svc.from('contact_socials').update({ contact_id: intoId }).eq('id', row.id)
      if (error) return { error: error.message }
      socSet.add(sk)
    }
  }

  await svc.from('contact_conflicts').update({ resolved: true }).eq('public_contact_id', fromId)
  await svc.from('contact_conflicts').update({ resolved: true }).eq('private_contact_id', fromId)

  const { error: delErr } = await svc.from('Contact').delete().eq('ContactID', fromId)
  if (delErr) return { error: delErr.message }

  revalidatePath('/atelier')
  return { ok: true, keptId: intoId }
}

export type UrlEnrichPreviewResult =
  | { ok: true; contact: ImportedContact; meta: UrlEnrichMeta }
  | { error: string }

/** Fetch a public https URL, extract JSON-LD / meta / mailto / tel, optionally refine with local Ollama or OpenAI-compatible API. */
export async function previewContactFromUrl(
  rawUrl: string,
  opts?: { refineWithLlm?: boolean },
): Promise<UrlEnrichPreviewResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  let safeUrl: URL
  try {
    safeUrl = assertSafePublicUrl(rawUrl)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'URL invalide' }
  }

  let html: string
  let finalUrl: string
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15_000)
    const res = await fetch(safeUrl.toString(), {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PEM-ContactEnrich/1.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    })
    clearTimeout(timer)
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const buf = await res.arrayBuffer()
    const max = 2_000_000
    const slice = buf.byteLength > max ? buf.slice(0, max) : buf
    html = new TextDecoder('utf-8', { fatal: false }).decode(slice)
    finalUrl = res.url
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Échec réseau'
    return { error: /abort/i.test(msg) ? 'Délai dépassé (15s)' : msg }
  }

  const { draft, sources, textSample } = extractContactFromHtml(html, finalUrl)
  const meta: UrlEnrichMeta = { sources: [...sources], llm: 'none' }

  const wantLlm = opts?.refineWithLlm !== false
  const mode = resolveLlmMode()

  if (wantLlm && mode !== 'none') {
    const env = {
      mode,
      openaiBase: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
      openaiKey: process.env.OPENAI_API_KEY || '',
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      ollamaHost: resolveOllamaClientUrl(),
      ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:1b',
    }
    if (mode === 'openai' && !env.openaiKey) {
      meta.llmNote = 'OPENAI_API_KEY manquante'
    } else {
      try {
        const { merged, llm } = await refineContactWithLlm(draft, textSample, finalUrl, env)
        meta.llm = llm
        return { ok: true, contact: merged, meta }
      } catch (e) {
        meta.llmNote = e instanceof Error ? e.message.slice(0, 240) : 'IA indisponible'
      }
    }
  }

  return { ok: true, contact: draft, meta }
}

export type OllamaListenResult =
  | { ok: true; host: string }
  | { ok: false; host: string; message: string }

/** GET /api/tags on configured Ollama (same host as enrich). Runs on the Next.js server — matches local dev when Ollama is on this machine. */
export async function checkOllamaListening(): Promise<OllamaListenResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, host: '', message: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { ok: false, host: '', message: 'Accès refusé' }

  const host = resolveOllamaClientUrl().replace(/\/$/, '')
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${host}/api/tags`, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)
    if (!res.ok) return { ok: false, host, message: `HTTP ${res.status}` }
    return { ok: true, host }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur réseau'
    const detail = /abort/i.test(msg) ? 'Timeout (4s)' : msg.slice(0, 160)
    return { ok: false, host, message: detail }
  }
}

export async function saveContactWithConflictCheck(formData: FormData): Promise<{ ok: true; id: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // 1. Parse Fields
  const nom        = (formData.get('nom') as string | null)?.trim()
  const prenom     = (formData.get('prenom') as string | null)?.trim()
  const email      = (formData.get('email') as string | null)?.trim()
  const inst       = (formData.get('institution') as string | null)?.trim()
  const is_private = formData.get('is_private') === 'true'

  // 2. SECRET CHECK (Bypass RLS to find collisions)
  const serviceClient = createServiceClient()
  let conflictWithId: number | null = null

  if (nom || prenom || email) {
    let query = serviceClient.from('Contact').select('ContactID, is_private')
    
    if (email) {
      query = query.eq('Email', email)
    } else {
      query = query.ilike('Nom', nom || '').ilike('Prénom', prenom || '')
    }

    const { data: matches } = await query
    
    // We found a match that the current user might not see
    const privateMatch = matches?.find(m => m.is_private)
    if (privateMatch) {
      conflictWithId = privateMatch.ContactID
    }
  }

  // 3. Create the Contact (Public/Private as requested)
  const { data: contact, error: insertErr } = await supabase.from('Contact').insert({
    Nom: nom,
    Prénom: prenom,
    Email: email,
    NomInstitution: inst,
    is_private: is_private
  }).select('ContactID').single()

  if (insertErr || !contact) return { error: insertErr?.message ?? 'Insert failed' }

  // 4. Record Conflict if detected
  if (conflictWithId && !is_private) {
    await serviceClient.from('contact_conflicts').insert({
      public_contact_id: contact.ContactID,
      private_contact_id: conflictWithId
    })
  }

  revalidatePath('/atelier')
  return { ok: true, id: contact.ContactID }
}

export async function fetchContactConflicts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Check if user is admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return []

  const { data } = await supabase
    .from('contact_conflicts')
    .select('*, public:public_contact_id(ContactID, Nom, Prénom, NomInstitution), private:private_contact_id(ContactID, Nom, Prénom, NomInstitution)')
    .eq('resolved', false)

  return data ?? []
}
