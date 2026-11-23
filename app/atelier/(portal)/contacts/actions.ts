'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSupabaseMissingTableError } from '@/lib/supabase/missing-table'
import { contactListLabel } from '@/lib/contacts/contact-display'
import type { ImportedContact } from '@/lib/contact-import-types'
import { callSaveContactPlaces } from '@/lib/contacts/save-contact-places'
import { logError } from '@/lib/error-reporter/server'
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

export type ImportResult =
  | { ok: true; imported: number; skipped: number; contactIds: number[] }
  | { error: string }

export async function importGoogleContacts(contacts: ImportedContact[]): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  // Team only before the service client (stress test S2, 2026-11-18).
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  // Imported contacts are « Privé » (admin-only) when an admin imports; a team member's import stays
  // visible to the team, or they could not see what they just imported (private RLS,
  // supabase/sql/contact_private_rls.sql). Service client for the writes and the duplicate check.
  const { data: isAdmin } = await supabase.rpc('is_admin')
  const svc = createServiceClient()

  if (!contacts.length) return { ok: true, imported: 0, skipped: 0, contactIds: [] }

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
    existingMain?.forEach((r: { Email: string | null }) => r.Email && existingEmails.add(r.Email.toLowerCase()))
    existingTable?.forEach((r: { email: string | null }) => r.email && existingEmails.add(r.email.toLowerCase()))
  }

  let imported = 0
  let skipped  = 0
  const contactIds: number[] = []

  for (const c of contacts) {
    // Skip if any email already exists
    const isDupe = c.emails.some(e => existingEmails.has(e.email.toLowerCase()))
    // Also skip if no name and no institution
    const hasIdentity = c.prenom || c.nom || c.institution
    if (isDupe || !hasIdentity) { skipped++; continue }

    const primaryEmail = c.emails[0]?.email ?? null
    const primaryPhone = c.phones[0] ?? null

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
        Notes:           c.notes,
        is_private:      !!isAdmin,
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

    // Addresses: places linked to the new card (Places phase B), through the address door; a known street is reused.
    if (c.addresses.length > 0) {
      const placesRes = await callSaveContactPlaces(supabase, cid, c.addresses.map((a, i) => ({
        label:       a.label || 'Principal',
        adresse:     a.adresse,
        code_postal: a.code_postal,
        ville:       a.ville,
        pays:        a.pays,
        is_primary:  i === 0,
      })))
      // The card is imported either way; a refused address is said, not swallowed (principle 3).
      if ('error' in placesRes) {
        await logError('Contact import: address not saved', placesRes.error, {
          source: 'importGoogleContacts', metadata: { contactId: cid },
        })
      }
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
    contactIds.push(cid)
  }

  revalidatePath('/atelier')
  return { ok: true, imported, skipped, contactIds }
}

/** Why a contact cannot be deleted: rows that point at it with no ON DELETE rule, or a login. */
export type ContactDeleteBlocker = {
  id: number
  name: string
  /** Linked to a sign-in (`auth_user_id`): never deleted here. */
  login: boolean
  /** Works it owns (`Oeuvres.ContactID`), bin included. */
  owner: number
  /** Works it holds (`Oeuvres.LocalisationID`), bin included. */
  holder: number
  shipments: number
  orders: number
  invoices: number
  supplyOrders: number
}

/** `blocked`: nothing was deleted; the client words the reasons (`formatContactDeleteBlockers`). */
export type ContactDeleteResult = { error: string } | { ok: true } | { blocked: ContactDeleteBlocker[] }

type BlockerCountKey = 'owner' | 'holder' | 'shipments' | 'orders' | 'invoices' | 'supplyOrders'

/** Live foreign keys to "Contact" with NO ACTION / RESTRICT (checked 2026-11-18): they make the delete fail. */
const CONTACT_DELETE_BLOCKING_REFS: { table: string; col: string; key: BlockerCountKey }[] = [
  { table: 'Oeuvres', col: 'ContactID', key: 'owner' },
  { table: 'Oeuvres', col: 'LocalisationID', key: 'holder' },
  { table: 'shipment', col: 'to_contact_id', key: 'shipments' },
  { table: 'work_order', col: 'party_id', key: 'orders' },
  { table: 'invoice', col: 'party_id', key: 'invoices' },
  { table: 'supply_order', col: 'supplier_id', key: 'supplyOrders' },
]

/** Exact count of rows per id in `table.col` (head counts: no row cap). */
async function countContactRefs(
  svc: ReturnType<typeof createServiceClient>,
  table: string,
  col: string,
  ids: number[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { count, error } = await svc.from(table).select(col, { count: 'exact', head: true }).in(col, chunk)
    if (error) throw new Error(`${table}.${col}: ${error.message}`)
    if (!count) continue
    if (chunk.length === 1) { out.set(chunk[0], count); continue }
    const perId = await Promise.all(
      chunk.map(async (id) => {
        const r = await svc.from(table).select(col, { count: 'exact', head: true }).eq(col, id)
        if (r.error) throw new Error(`${table}.${col}: ${r.error.message}`)
        return [id, r.count ?? 0] as const
      }),
    )
    for (const [id, n] of perId) if (n) out.set(id, n)
  }
  return out
}

/**
 * Delete one or more contacts. Their addresses, emails, phones, websites, socials and event links go
 * with them (ON DELETE CASCADE); buyer, documents, expenses, stock suppliers, private links and page
 * views are cleared (SET NULL).
 * Refuses the whole batch, before touching anything, when a contact still owns or holds a work, is
 * the party of a shipment, order, invoice or supply order, or is linked to a login.
 */
export async function deleteContacts(ids: number[]): Promise<ContactDeleteResult> {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  if (!ids.length) return { ok: true }

  // Only the contacts this user can see (RLS): a « Privé » contact is admin-only.
  const { data: rows, error: rowsErr } = await supabase
    .from('Contact')
    .select('ContactID, NomInstitution, Nom, "Prénom", auth_user_id')
    .in('ContactID', ids)
  if (rowsErr) return { error: rowsErr.message }
  const visible = (rows ?? []) as { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; auth_user_id: string | null }[]
  if (!visible.length) return { ok: true }
  const visibleIds = visible.map((c) => c.ContactID)

  // Count every blocking reference with the service role (the team must not miss rows RLS hides).
  const svc = createServiceClient()
  let counts: Map<number, number>[]
  try {
    counts = await Promise.all(
      CONTACT_DELETE_BLOCKING_REFS.map(({ table, col }) => countContactRefs(svc, table, col, visibleIds)),
    )
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }

  const blocked: ContactDeleteBlocker[] = []
  for (const c of visible) {
    const b: ContactDeleteBlocker = {
      id: c.ContactID,
      name: contactListLabel(c),
      login: !!c.auth_user_id,
      owner: 0, holder: 0, shipments: 0, orders: 0, invoices: 0, supplyOrders: 0,
    }
    CONTACT_DELETE_BLOCKING_REFS.forEach(({ key }, i) => { b[key] = counts[i].get(c.ContactID) ?? 0 })
    if (b.login || CONTACT_DELETE_BLOCKING_REFS.some(({ key }) => b[key] > 0)) blocked.push(b)
  }
  if (blocked.length) return { blocked }

  // One statement: the contact rows and their cascaded child rows go together, or nothing does.
  const { data: deleted, error: contactErr } = await supabase
    .from('Contact')
    .delete()
    .in('ContactID', visibleIds)
    .select('ContactID')

  if (contactErr) return { error: contactErr.message }
  if ((deleted ?? []).length !== visibleIds.length) {
    revalidatePath('/atelier')
    return { error: `Suppression incomplète : ${(deleted ?? []).length}/${visibleIds.length}` }
  }

  revalidatePath('/atelier')
  return { ok: true }
}

export type MergeContactsResult = { ok: true; keptId: number } | { error: string }

/**
 * Merge `fromId` into `intoId` — one DB transaction (`merge_contacts`, supabase/sql/merge_contacts_fn.sql): fills the kept
 * contact's empty fields, moves every reference (orders before works), moves emails / phones / links / event roles without
 * duplicates, moves Bureau IA card readings, then deletes `fromId`. Any failure rolls the whole merge back.
 * Admin only (checked inside the function). Refused: merge_invoices, merge_both_invoiced (codes the UI maps); two logins (sentence).
 */
export async function mergeContacts(intoId: number, fromId: number): Promise<MergeContactsResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  if (!intoId || !fromId || intoId === fromId) return { error: 'Fusion invalide' }

  const { error } = await supabase.rpc('merge_contacts', { p_keep: intoId, p_lose: fromId })
  if (error) {
    if (error.message === 'merge_forbidden') return { error: 'Accès refusé' }
    if (error.message === 'merge_not_found') return { error: 'Contact introuvable' }
    if (error.message === 'merge_two_logins') {
      return {
        error:
          'Les deux fiches ont des logins atelier différents. Gardez une seule fiche liée, ou déliez un compte avant de fusionner.',
      }
    }
    return { error: error.message }
  }

  revalidatePath('/atelier')
  revalidatePath('/atelier/contacts')
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

/**
 * Quick contact creation (Contacts quick add, R7 « + Nouveau contact » in an order's party picker).
 * Optional `phone` and `adresse` / `code_postal` / `ville` / `pays` are written as the contact editor
 * writes them: the Contact columns plus one primary row each in `contact_phones` / `contact_emails` /
 * a place linked to the card (label « Principal », Places phase B). Returns that place's id when one was written.
 */
export async function saveContactWithConflictCheck(formData: FormData): Promise<{ ok: true; id: number; addressId: number | null } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  // Team only before the service client (stress test S2, 2026-11-18).
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  // 1. Parse Fields
  const nom        = (formData.get('nom') as string | null)?.trim()
  const prenom     = (formData.get('prenom') as string | null)?.trim()
  const email      = (formData.get('email') as string | null)?.trim()
  const inst       = (formData.get('institution') as string | null)?.trim()
  // « Privé » = admin-only: only an admin may mark a new contact private.
  const { data: isAdmin } = await supabase.rpc('is_admin')
  const is_private = !!isAdmin && formData.get('is_private') === 'true'
  const opt = (k: string) => (formData.get(k) as string | null)?.trim() || null
  const phone = opt('phone')
  const addr = { adresse: opt('adresse'), code_postal: opt('code_postal'), ville: opt('ville'), pays: opt('pays') }
  const hasAddr = !!(addr.adresse || addr.code_postal || addr.ville || addr.pays)

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
    const privateMatch = matches?.find((m: { ContactID: number; is_private: boolean | null }) => m.is_private)
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
    is_private: is_private,
    ...(phone ? { Téléphone1: phone } : {}),
    ...(hasAddr ? { Adresse: addr.adresse, CodePostal: addr.code_postal, Ville: addr.ville, Pays: addr.pays } : {}),
  }).select('ContactID').single()

  if (insertErr || !contact) return { error: insertErr?.message ?? 'Insert failed' }

  // The child rows the contact card reads. The address is a place linked to the card (Places phase B); `addressId`
  // = that place (what a work or an order points at).
  let addressId: number | null = null
  if (hasAddr) {
    const res = await callSaveContactPlaces(supabase, contact.ContactID, [{ label: 'Principal', is_primary: true, ...addr }])
    if ('error' in res) return { error: res.error }
    const { data: link } = await supabase.from('contact_place_lines').select('place_id').eq('contact_id', contact.ContactID).limit(1).maybeSingle()
    addressId = link?.place_id ?? null
  }
  if (email) {
    const { error: eErr } = await supabase.from('contact_emails').insert({ contact_id: contact.ContactID, email, label: 'Personnel', is_primary: true })
    if (eErr) return { error: eErr.message }
  }
  if (phone) {
    const { error: pErr } = await supabase.from('contact_phones').insert({ contact_id: contact.ContactID, phone, label: 'Mobile', is_primary: true })
    if (pErr) return { error: pErr.message }
  }

  // 4. Record Conflict if detected
  if (conflictWithId && !is_private) {
    const { error: ccInsErr } = await serviceClient.from('contact_conflicts').insert({
      public_contact_id: contact.ContactID,
      private_contact_id: conflictWithId
    })
    if (ccInsErr && !isSupabaseMissingTableError(ccInsErr)) {
      return { error: `contact_conflicts: ${ccInsErr.message}` }
    }
  }

  revalidatePath('/atelier')
  return { ok: true, id: contact.ContactID, addressId }
}
