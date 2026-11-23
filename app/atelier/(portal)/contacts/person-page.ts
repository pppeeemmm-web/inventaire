'use server'

// The person page's reads (People.md §5, step 3 — reads only, no new table, no write). Each read is one server
// call sized to the block it feeds, paged, with its count asked of the database (principle 5 and 7):
// works by relation (owns / holds / bought), orders, papers. Team only; RLS stays the backstop.
// « Dans le Journal » keeps its own read (`journal-mentions.ts`).

import { createClient } from '@/lib/supabase/server'

export type PersonWorkRel = 'owns' | 'holds' | 'bought'
const REL_COLUMN: Record<PersonWorkRel, 'ContactID' | 'LocalisationID' | 'AcheteurID'> = {
  owns: 'ContactID',
  holds: 'LocalisationID',
  bought: 'AcheteurID',
}

const PERSON_WORKS_PAGE = 12
const PERSON_LIST_PAGE = 10

export type PersonWork = { id: number; title: string | null; image: string | null }
export type PersonOrder = {
  id: string
  ref: string | null
  kind: string
  status: string
  date: string
  priceFinal: number | null
  currency: string
}
export type PersonPaper = { id: string; name: string; kind: string | null; date: string | null }

type Page<T> = { ok: true; count: number; items: T[] } | { error: string }

async function teamClient() {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  return isTeam ? supabase : null
}

function validId(n: number): boolean {
  return Number.isInteger(n) && n > 0
}

function validOffset(n: number): number {
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** One strip of works: head count + one page of thumbs, newest number first. */
export async function readPersonWorks(contactId: number, rel: PersonWorkRel, offset = 0): Promise<Page<PersonWork>> {
  if (!validId(contactId) || !(rel in REL_COLUMN)) return { error: 'not_found' }
  const supabase = await teamClient()
  if (!supabase) return { error: 'auth' }
  const from = validOffset(offset)
  const { data, error, count } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, txtImageNameLink', { count: 'exact' })
    .eq(REL_COLUMN[rel], contactId)
    .is('deleted_at', null)
    .order('OeuvreID', { ascending: false })
    .range(from, from + PERSON_WORKS_PAGE - 1)
  if (error) return { error: error.message }
  return {
    ok: true,
    count: count ?? 0,
    items: (data ?? []).map((o) => ({ id: o.OeuvreID, title: o.Titre, image: o.txtImageNameLink })),
  }
}

export type PersonSeenRel = 'kit' | 'event'

/**
 * « Vu » — works this person was shown: sent in a kit (`private_link_work` through `private_link.contact_id`) or
 * hung at an event they took part in (`event_work` through `event_contact`). The count is the number of showings
 * (a work sent in two kits counts twice), asked of the database; thumbs of one page, repeats folded.
 */
export async function readPersonSeen(contactId: number, rel: PersonSeenRel, offset = 0): Promise<Page<PersonWork>> {
  if (!validId(contactId) || (rel !== 'kit' && rel !== 'event')) return { error: 'not_found' }
  const supabase = await teamClient()
  if (!supabase) return { error: 'auth' }
  const from = validOffset(offset)
  // Embedded filters are outside the generated types: a loose builder, rows mapped by hand.
  const db = supabase as unknown as { from: (t: string) => any }
  const res =
    rel === 'kit'
      ? await db
          .from('private_link_work')
          .select('token, oeuvre_id, Oeuvres!inner(OeuvreID, Titre, txtImageNameLink, deleted_at), private_link!inner(contact_id)', { count: 'exact' })
          .eq('private_link.contact_id', contactId)
          .is('Oeuvres.deleted_at', null)
          .order('oeuvre_id', { ascending: false })
          .order('token', { ascending: true })
          .range(from, from + PERSON_WORKS_PAGE - 1)
      : await db
          .from('event_work')
          .select('process_id, oeuvre_id, Oeuvres!inner(OeuvreID, Titre, txtImageNameLink, deleted_at), suivi_process!inner(event_contact!inner(contact_id))', { count: 'exact' })
          .eq('suivi_process.event_contact.contact_id', contactId)
          .is('Oeuvres.deleted_at', null)
          .order('oeuvre_id', { ascending: false })
          .order('process_id', { ascending: true })
          .range(from, from + PERSON_WORKS_PAGE - 1)
  if (res.error) return { error: res.error.message as string }
  const rows = (res.data ?? []) as { Oeuvres: { OeuvreID: number; Titre: string | null; txtImageNameLink: string | null } }[]
  return {
    ok: true,
    count: res.count ?? 0,
    items: rows.map((r) => ({ id: r.Oeuvres.OeuvreID, title: r.Oeuvres.Titre, image: r.Oeuvres.txtImageNameLink })),
  }
}

/** Orders where this person is the party, newest first. */
export async function readPersonOrders(contactId: number, offset = 0): Promise<Page<PersonOrder>> {
  if (!validId(contactId)) return { error: 'not_found' }
  const supabase = await teamClient()
  if (!supabase) return { error: 'auth' }
  const from = validOffset(offset)
  const { data, error, count } = await supabase
    .from('work_order')
    .select('id, ref, kind, status, created_at, signed_at, price_final, currency', { count: 'exact' })
    .eq('party_id', contactId)
    .order('created_at', { ascending: false })
    .range(from, from + PERSON_LIST_PAGE - 1)
  if (error) return { error: error.message }
  return {
    ok: true,
    count: count ?? 0,
    items: (data ?? []).map((o) => ({
      id: o.id,
      ref: o.ref,
      kind: o.kind,
      status: o.status,
      date: String(o.signed_at ?? o.created_at).slice(0, 10),
      priceFinal: o.price_final,
      currency: o.currency,
    })),
  }
}

/** Papers filed under this person, newest first. */
export async function readPersonPapers(contactId: number, offset = 0): Promise<Page<PersonPaper>> {
  if (!validId(contactId)) return { error: 'not_found' }
  const supabase = await teamClient()
  if (!supabase) return { error: 'auth' }
  const from = validOffset(offset)
  const { data, error, count } = await supabase
    .from('document')
    .select('id, name, kind, doc_date, created_at', { count: 'exact' })
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .range(from, from + PERSON_LIST_PAGE - 1)
  if (error) return { error: error.message }
  return {
    ok: true,
    count: count ?? 0,
    items: (data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      kind: d.kind,
      date: d.doc_date ?? String(d.created_at).slice(0, 10),
    })),
  }
}
