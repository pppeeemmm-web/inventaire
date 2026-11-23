'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isSupabaseMissingTableError } from '@/lib/supabase/missing-table'
import { contactListLabel } from '@/lib/contacts/contact-display'
import type { ImportedContact } from '@/lib/contact-import-types'
import { saveContact, type SaveContactResult } from './save-contact'
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
  /** skipped = a duplicate email or no name; failed = refused or errored by the door (nothing written for it, logged). */
  | { ok: true; imported: number; skipped: number; failed: number; contactIds: number[] }
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
  // supabase/sql/contact_private_rls.sql). Writes through the door `saveContact` (signed-in user); the service
  // client only for the duplicate check (it must see private cards too).
  const { data: isAdmin } = await supabase.rpc('is_admin')
  const svc = createServiceClient()

  if (!contacts.length) return { ok: true, imported: 0, skipped: 0, failed: 0, contactIds: [] }

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
  let failed   = 0
  const contactIds: number[] = []

  for (const c of contacts) {
    // Skip if any email already exists
    const isDupe = c.emails.some(e => existingEmails.has(e.email.toLowerCase()))
    // Also skip if no name and no institution
    const hasIdentity = c.prenom || c.nom || c.institution
    if (isDupe || !hasIdentity) { skipped++; continue }

    const primaryPhone = c.phones[0] ?? null

    // One door, one transaction (BuildingPrinciples 2): the card, its emails, phones, websites and addresses (places,
    // through save_contact_places) are written together or not at all.
    const res = await saveContact({
      id: null,
      fields: {
        Prénom:         c.prenom,
        Nom:            c.nom,
        NomInstitution: c.institution,
        Role:           c.role,
        Téléphone1:     (primaryPhone?.phone ?? null)?.slice(0, 20) ?? null,
        IndicatifPays1: (primaryPhone?.country_code ?? null)?.slice(0, 10) ?? null,
        Notes:          c.notes,
        Actif:          true,
        ...(isAdmin ? { is_private: true } : {}),
      },
      lists: {
        emails:    c.emails.map((e, i) => ({ email: e.email, label: e.label || 'Personnel', is_primary: i === 0 })),
        phones:    c.phones.map((p, i) => ({ phone: p.phone, country_code: p.country_code, label: p.label || 'Mobile', is_primary: i === 0 })),
        websites:  c.websites.map((w) => ({ url: w.url, label: w.label || 'Web' })),
        addresses: c.addresses.map((a, i) => ({
          label: a.label || 'Principal', adresse: a.adresse, code_postal: a.code_postal, ville: a.ville, pays: a.pays,
          is_primary: i === 0, position: i,
        })),
      },
    })
    // A refusal or an error writes nothing: counted as « not saved » (never as imported, never as a duplicate).
    if (!('ok' in res)) {
      await logError('Contact import: not saved', 'error' in res ? res.error : `refused: ${'refused' in res ? res.refused : 'unchanged'}`, {
        source: 'importGoogleContacts',
      })
      failed++; continue
    }

    const cid = res.card.contact.ContactID
    c.emails.forEach(e => existingEmails.add(e.email.toLowerCase()))

    imported++
    contactIds.push(cid)
  }

  revalidatePath('/atelier')
  return { ok: true, imported, skipped, failed, contactIds }
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
  /** Journal entries naming it (`journal_entry_link.contact_id`). */
  journal: number
}

/** `blocked`: nothing was deleted; the client words the reasons (`formatContactDeleteBlockers`). */
export type ContactDeleteResult = { error: string } | { ok: true } | { blocked: ContactDeleteBlocker[] }

type BlockerCountKey = 'owner' | 'holder' | 'shipments' | 'orders' | 'invoices' | 'supplyOrders' | 'journal'

/** Live foreign keys to "Contact" with NO ACTION / RESTRICT (checked 2026-11-18): they make the delete fail. */
const CONTACT_DELETE_BLOCKING_REFS: { table: string; col: string; key: BlockerCountKey }[] = [
  { table: 'Oeuvres', col: 'ContactID', key: 'owner' },
  { table: 'Oeuvres', col: 'LocalisationID', key: 'holder' },
  { table: 'shipment', col: 'to_contact_id', key: 'shipments' },
  { table: 'work_order', col: 'party_id', key: 'orders' },
  { table: 'invoice', col: 'party_id', key: 'invoices' },
  { table: 'supply_order', col: 'supplier_id', key: 'supplyOrders' },
  { table: 'journal_entry_link', col: 'contact_id', key: 'journal' },
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
      owner: 0, holder: 0, shipments: 0, orders: 0, invoices: 0, supplyOrders: 0, journal: 0,
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
 * writes them, through the same door `saveContact`: one primary row each in `contact_phones` / `contact_emails` /
 * a place linked to the card (label « Principal », Places phase B). Returns that place's id when one was written.
 * The screen asks `findSimilarContacts` first (a warning, not a refusal).
 */
export async function saveContactWithConflictCheck(
  formData: FormData,
): Promise<{ ok: true; id: number; addressId: number | null } | { error: string; door?: SaveContactResult }> {
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

  // 3. Create the card through the one door (BuildingPrinciples 2): the Contact row, its primary email / phone and
  // the address (a place linked to the card, through save_contact_places) in one transaction — all or nothing.
  const res = await saveContact({
    id: null,
    fields: {
      Nom: nom || null,
      Prénom: prenom || null,
      NomInstitution: inst || null,
      ...(phone ? { Téléphone1: phone } : {}),
      ...(is_private ? { is_private: true } : {}),
    },
    lists: {
      ...(email ? { emails: [{ email, label: 'Personnel', is_primary: true }] } : {}),
      ...(phone ? { phones: [{ phone, country_code: null, label: 'Mobile', is_primary: true }] } : {}),
      ...(hasAddr ? { addresses: [{ label: 'Principal', is_primary: true, position: 0, ...addr }] } : {}),
    },
  })
  // A refusal is never « ok » (principle 3): the screen words it from `door`.
  if (!('ok' in res)) return { error: 'error' in res ? res.error : `refused: ${'refused' in res ? res.refused : 'unchanged'}`, door: res }
  const contactId = res.card.contact.ContactID
  // `addressId` = the place the new card is linked to (what a work or an order points at).
  const addressId = hasAddr ? (res.card.addresses[0]?.place_id ?? null) : null

  // 4. Record Conflict if detected
  if (conflictWithId && !is_private) {
    const { error: ccInsErr } = await serviceClient.from('contact_conflicts').insert({
      public_contact_id: contactId,
      private_contact_id: conflictWithId
    })
    if (ccInsErr && !isSupabaseMissingTableError(ccInsErr)) {
      return { error: `contact_conflicts: ${ccInsErr.message}` }
    }
  }

  revalidatePath('/atelier')
  return { ok: true, id: contactId, addressId }
}

export type SimilarContact = { id: number; label: string; by: 'email' | 'name' }

/** `ilike` without wildcards: the typed text matched as is, case-insensitive. */
function ilikeExact(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/**
 * Cards that look like the one about to be created (quick add, manual create): the same email — the check the
 * Google import uses (`Contact.Email` or any `contact_emails` row) — or the same name. A warning for the screen,
 * never a refusal. Read under RLS: only cards this user may see are named (a « Privé » one stays hidden).
 */
export async function findSimilarContacts(input: {
  nom?: string | null
  prenom?: string | null
  institution?: string | null
  email?: string | null
}): Promise<{ matches: SimilarContact[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  const nom = input.nom?.trim() || null
  const prenom = input.prenom?.trim() || null
  const inst = input.institution?.trim() || null
  const email = input.email?.trim() || null
  const cols = 'ContactID, NomInstitution, Nom, "Prénom"'
  type Hit = { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }
  const byId = new Map<number, SimilarContact>()
  const add = (rows: Hit[] | null, by: SimilarContact['by']) => {
    for (const r of rows ?? []) if (!byId.has(r.ContactID)) byId.set(r.ContactID, { id: r.ContactID, label: contactListLabel(r), by })
  }

  if (email) {
    const e = ilikeExact(email)
    const [main, extra] = await Promise.all([
      supabase.from('Contact').select(cols).ilike('Email', e).limit(5),
      supabase.from('contact_emails').select('contact_id').ilike('email', e).limit(5),
    ])
    if (main.error) return { error: main.error.message }
    if (extra.error) return { error: extra.error.message }
    add(main.data as Hit[], 'email')
    const ids = [...new Set((extra.data ?? []).map((r) => r.contact_id))].filter((id) => !byId.has(id))
    if (ids.length) {
      const { data, error } = await supabase.from('Contact').select(cols).in('ContactID', ids)
      if (error) return { error: error.message }
      add(data as Hit[], 'email')
    }
  }

  if (nom || prenom || inst) {
    let q = supabase.from('Contact').select(cols)
    if (nom) q = q.ilike('Nom', ilikeExact(nom))
    if (prenom) q = q.ilike('Prénom', ilikeExact(prenom))
    if (!nom && !prenom) q = q.ilike('NomInstitution', ilikeExact(inst!))
    const { data, error } = await q.limit(50)
    if (error) return { error: error.message }
    // A part of the name left empty must be empty on the card too (null, or '' on older quick-add rows).
    const blank = (v: string | null) => !v?.trim()
    add(
      (data as Hit[]).filter((r) => (nom || blank(r.Nom)) && (prenom || blank(r.Prénom))),
      'name',
    )
  }

  return { matches: [...byId.values()].slice(0, 5) }
}
