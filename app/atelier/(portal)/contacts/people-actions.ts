'use server'

// People: spheres, links between people (People.md §1, §4b, §4c). Reads and the two doors
// (`set_contact_spheres`, `save_person_link`). The SQL lives in supabase/sql/people_spheres_dates_links.sql.
// Team only; RLS stays the backstop. The new functions / tables are not in the generated types yet: loose casts.

import { createClient } from '@/lib/supabase/server'
import { contactPersonProseName } from '@/lib/contacts/contact-display'

export type Sphere = { key: string; fr: string; en: string }
export type SpheresResult = { ok: true; all: Sphere[]; mine: string[] } | { error: string }
export type SaveResult =
  | { ok: true; spheres?: string[] }
  | { unchanged: true; spheres?: string[] }
  | { refused: string; detail?: string }
export type PersonLinkKind = 'introduced' | 'spouse' | 'works_at' | 'advises' | 'works_with' | 'interested_in'
export type PersonLink = {
  kind: PersonLinkKind
  outgoing: boolean
  otherContactId: number | null
  otherName: string | null
  workId: number | null
  workTitle: string | null
  workImage: string | null
  sourceKind: string | null
  sourceRef: string | null
  createdAt: string
}
export type LinkInput = {
  op: 'add' | 'remove'
  from: number
  kind: PersonLinkKind
  toContact?: number | null
  toWork?: number | null
  sourceKind?: string | null
  sourceRef?: string | null
}

type Loose = {
  rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: { message: string } | null }>
  from: (table: string) => {
    select: (cols: string, opts?: { count?: 'exact'; head?: boolean }) => LooseQuery
  }
}
type LooseQuery = PromiseLike<{ data: unknown; error: { message: string } | null; count?: number | null }> & {
  eq: (col: string, v: unknown) => LooseQuery
  in: (col: string, v: unknown[]) => LooseQuery
  order: (col: string, o?: { ascending: boolean }) => LooseQuery
  or: (filter: string, opts?: { referencedTable?: string }) => LooseQuery
}

async function teamClient() {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  return isTeam ? supabase : null
}

// Team check + admin flag (once per call). RLS lets the team read private cards; the app hides them from non-admins.
async function teamCtx() {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return null
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return { supabase, isAdmin: isAdmin === true }
}

const NOT_PRIVATE = 'is_private.is.null,is_private.eq.false'

async function isPrivateCard(db: Loose, contactId: number): Promise<{ priv: boolean; error?: string }> {
  const { data, error } = await db.from('Contact').select('is_private').eq('ContactID', contactId)
  if (error) return { priv: false, error: error.message }
  return { priv: ((data ?? []) as { is_private: boolean | null }[])[0]?.is_private === true }
}

function loose(s: unknown): Loose {
  return s as Loose
}

function validId(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0
}

function mapSave(data: unknown): SaveResult {
  const d = (data ?? {}) as { ok?: boolean; unchanged?: boolean; refused?: string; detail?: string; spheres?: string[] }
  if (d.refused) return { refused: d.refused, ...(d.detail ? { detail: d.detail } : {}) }
  if (d.ok) return d.spheres ? { ok: true, spheres: d.spheres } : { ok: true }
  if (d.unchanged) return d.spheres ? { unchanged: true, spheres: d.spheres } : { unchanged: true }
  return { refused: 'error', detail: 'unexpected answer' }
}

export async function readContactSpheres(contactId: number): Promise<SpheresResult> {
  if (!validId(contactId)) return { error: 'not_found' }
  const ctx = await teamCtx()
  if (!ctx) return { error: 'auth' }
  const db = loose(ctx.supabase)
  if (!ctx.isAdmin) {
    const p = await isPrivateCard(db, contactId)
    if (p.error) return { error: p.error }
    if (p.priv) return { error: 'not_found' }
  }
  const [all, tags] = await Promise.all([
    db.from('contact_sphere').select('id, key, label_fr, label_en, position').order('position', { ascending: true }),
    db.from('contact_tag').select('sphere_id').eq('contact_id', contactId),
  ])
  if (all.error) return { error: all.error.message }
  if (tags.error) return { error: tags.error.message }
  const spheres = (all.data ?? []) as { id: number; key: string; label_fr: string; label_en: string }[]
  const mineIds = new Set(((tags.data ?? []) as { sphere_id: number }[]).map((t) => t.sphere_id))
  return {
    ok: true,
    all: spheres.map((s) => ({ key: s.key, fr: s.label_fr, en: s.label_en })),
    mine: spheres.filter((s) => mineIds.has(s.id)).map((s) => s.key),
  }
}

export async function setContactSpheres(contactId: number, keys: string[]): Promise<SaveResult> {
  if (!validId(contactId) || !Array.isArray(keys) || keys.some((k) => typeof k !== 'string')) {
    return { refused: 'bad_field' }
  }
  const supabase = await teamClient()
  if (!supabase) return { refused: 'forbidden' }
  const { data, error } = await loose(supabase).rpc('set_contact_spheres', { p_contact: contactId, p_keys: keys })
  if (error) return { refused: 'error', detail: error.message }
  return mapSave(data)
}

export async function archiveContact(
  contactId: number,
  archive: boolean,
): Promise<{ ok: true; archived: boolean } | { unchanged: true } | { refused: string; detail?: string }> {
  if (!validId(contactId) || typeof archive !== 'boolean') return { refused: 'bad_field' }
  const supabase = await teamClient()
  if (!supabase) return { refused: 'forbidden' }
  const { data, error } = await loose(supabase).rpc('archive_contact', { p_contact: contactId, p_archive: archive })
  if (error) return { refused: 'error', detail: error.message }
  const d = (data ?? {}) as { ok?: boolean; archived?: boolean; unchanged?: boolean; refused?: string; detail?: string }
  if (d.refused) return { refused: d.refused, ...(d.detail ? { detail: d.detail } : {}) }
  if (d.ok) return { ok: true, archived: d.archived === true }
  if (d.unchanged) return { unchanged: true }
  return { refused: 'error', detail: 'unexpected answer' }
}

export async function readPersonLinks(contactId: number): Promise<{ ok: true; items: PersonLink[] } | { error: string }> {
  if (!validId(contactId)) return { error: 'not_found' }
  const ctx = await teamCtx()
  if (!ctx) return { error: 'auth' }
  const { supabase, isAdmin } = ctx
  if (!isAdmin) {
    const p = await isPrivateCard(loose(supabase), contactId)
    if (p.error) return { error: p.error }
    if (p.priv) return { error: 'not_found' }
  }
  const { data, error } = await loose(supabase).rpc('person_links', { p_contact: contactId })
  if (error) return { error: error.message }
  const rows = (data ?? []) as {
    kind: PersonLinkKind
    outgoing: boolean
    other_contact_id: number | null
    other_work_id: number | null
    source_kind: string | null
    source_ref: string | null
    created_at: string
  }[]
  const contactIds = [...new Set(rows.map((r) => r.other_contact_id).filter((n): n is number => n != null))]
  const workIds = [...new Set(rows.map((r) => r.other_work_id).filter((n): n is number => n != null))]

  const names = new Map<number, string | null>()
  if (contactIds.length) {
    const { data: cs, error: ce } = await supabase
      .from('Contact')
      .select('ContactID, Nom, "Prénom", NomInstitution, is_private')
      .in('ContactID', contactIds)
    if (ce) return { error: ce.message }
    for (const c of cs ?? []) {
      if (!isAdmin && (c as { is_private?: boolean | null }).is_private === true) continue // private card: same as invisible
      const person = contactPersonProseName(c)
      names.set(c.ContactID, person || c.NomInstitution || null)
    }
  }
  const works = new Map<number, { title: string | null; image: string | null }>()
  if (workIds.length) {
    const { data: ws, error: we } = await supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, txtImageNameLink')
      .in('OeuvreID', workIds)
    if (we) return { error: we.message }
    for (const w of ws ?? []) works.set(w.OeuvreID, { title: w.Titre, image: w.txtImageNameLink })
  }

  const items: PersonLink[] = []
  for (const r of rows) {
    if (r.other_contact_id != null && !names.has(r.other_contact_id)) continue // card not visible to the caller
    const work = r.other_work_id != null ? works.get(r.other_work_id) : undefined
    items.push({
      kind: r.kind,
      outgoing: r.outgoing,
      otherContactId: r.other_contact_id,
      otherName: r.other_contact_id != null ? (names.get(r.other_contact_id) ?? null) : null,
      workId: r.other_work_id,
      workTitle: work?.title ?? null,
      workImage: work?.image ?? null,
      sourceKind: r.source_kind,
      sourceRef: r.source_ref,
      createdAt: r.created_at,
    })
  }
  return { ok: true, items }
}

export async function savePersonLink(input: LinkInput): Promise<SaveResult> {
  if (!input || !validId(input.from) || (input.op !== 'add' && input.op !== 'remove')) {
    return { refused: 'bad_field' }
  }
  if (input.toContact != null && !validId(input.toContact)) return { refused: 'bad_field', detail: 'to_contact' }
  if (input.toWork != null && !validId(input.toWork)) return { refused: 'bad_field', detail: 'to_work' }
  const supabase = await teamClient()
  if (!supabase) return { refused: 'forbidden' }
  const { data, error } = await loose(supabase).rpc('save_person_link', {
    p: {
      op: input.op,
      from: input.from,
      kind: input.kind,
      to_contact: input.toContact ?? null,
      to_work: input.toWork ?? null,
      source_kind: input.sourceKind ?? null,
      source_ref: input.sourceRef ?? null,
    },
  })
  if (error) return { refused: 'error', detail: error.message }
  return mapSave(data)
}

export async function readSpheres(): Promise<{ ok: true; all: Sphere[] } | { error: string }> {
  const supabase = await teamClient()
  if (!supabase) return { error: 'auth' }
  const { data, error } = await loose(supabase)
    .from('contact_sphere')
    .select('key, label_fr, label_en')
    .order('position', { ascending: true })
  if (error) return { error: error.message }
  const rows = (data ?? []) as { key: string; label_fr: string; label_en: string }[]
  return { ok: true, all: rows.map((s) => ({ key: s.key, fr: s.label_fr, en: s.label_en })) }
}

export async function readSphereCounts(): Promise<{ ok: true; counts: Record<string, number> } | { error: string }> {
  const ctx = await teamCtx()
  if (!ctx) return { error: 'auth' }
  const db = loose(ctx.supabase)
  const { data, error } = await db.from('contact_sphere').select('id, key')
  if (error) return { error: error.message }
  const spheres = (data ?? []) as { id: number; key: string }[]
  const results = await Promise.all(
    spheres.map((s) =>
      ctx.isAdmin
        ? db.from('contact_tag').select('contact_id', { count: 'exact', head: true }).eq('sphere_id', s.id)
        : db
            .from('contact_tag')
            .select('contact_id, Contact!inner(is_private)', { count: 'exact', head: true })
            .eq('sphere_id', s.id)
            .or(NOT_PRIVATE, { referencedTable: 'Contact' }),
    ),
  )
  const counts: Record<string, number> = {}
  for (let i = 0; i < spheres.length; i++) {
    if (results[i].error) return { error: results[i].error!.message }
    counts[spheres[i].key] = results[i].count ?? 0
  }
  return { ok: true, counts }
}

export async function readContactIdsWithSphere(key: string): Promise<{ ok: true; ids: number[] } | { error: string }> {
  if (typeof key !== 'string' || !key) return { error: 'not_found' }
  const ctx = await teamCtx()
  if (!ctx) return { error: 'auth' }
  const db = loose(ctx.supabase)
  const sp = await db.from('contact_sphere').select('id').eq('key', key)
  if (sp.error) return { error: sp.error.message }
  const sphere = ((sp.data ?? []) as { id: number }[])[0]
  if (!sphere) return { error: 'not_found' }
  const q = ctx.isAdmin
    ? db.from('contact_tag').select('contact_id').eq('sphere_id', sphere.id)
    : db
        .from('contact_tag')
        .select('contact_id, Contact!inner(is_private)')
        .eq('sphere_id', sphere.id)
        .or(NOT_PRIVATE, { referencedTable: 'Contact' })
  const { data, error } = await q
  if (error) return { error: error.message }
  return { ok: true, ids: ((data ?? []) as { contact_id: number }[]).map((r) => r.contact_id) }
}
