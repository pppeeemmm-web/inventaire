'use server'

// The person page's timeline (People.md §5) — reads only, no SQL: one stream of what happened with this person,
// built from the tables that already hold it: orders, payments, shipments, events, kits, papers, enquiries.
// Paged by a keyset per source (each source keeps its own (date, id) cursor), merged newest first, 20 a page.
// Counts per kind are asked of the database (principle 7). Team only; RLS stays the backstop.
// Not here yet: touches (`moment`, needs SQL), custody changes (needs a database read over work versions).

import { createClient } from '@/lib/supabase/server'
import { TIMELINE_KINDS, type TimelineKind } from '@/lib/contacts/person-timeline-kinds'


export type TimelineItem = {
  kind: TimelineKind
  id: string
  /** Sort key: the row's date (YYYY-MM-DD or an ISO timestamp). */
  at: string
  /** Fixed-list keys (order kind / status…) or free text, rendered by the page. */
  title: string
  detail: string | null
  status: string | null
  amount: number | null
  href: string | null
}

type Source = 'order' | 'payment' | 'shipment' | 'event' | 'process' | 'kit' | 'paper' | 'enquiry'
const SOURCES: Source[] = ['order', 'payment', 'shipment', 'event', 'process', 'kit', 'paper', 'enquiry']
const KIND_OF: Record<Source, TimelineKind> = {
  order: 'order',
  payment: 'payment',
  shipment: 'shipment',
  event: 'event',
  process: 'event',
  kit: 'kit',
  paper: 'paper',
  enquiry: 'enquiry',
}

/** Per source: the last (date, id) shown, or `done` when that source has nothing older. */
export type TimelineCursor = Partial<Record<Source, { at: string; id: string } | 'done'>>

const PAGE = 20

type Row = { item: TimelineItem; source: Source; key: { at: string; id: string } }
// The embedded filters below are outside the generated types: a loose builder, results mapped by hand.
type Q = any
type Loose = { from: (t: string) => Q }

async function teamClient() {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  return isTeam ? supabase : null
}

function quote(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Rows strictly older than the source's cursor, ordered (date desc, id desc). */
function after(q: Q, dateCol: string, idCol: string, cur: { at: string; id: string } | undefined): Q {
  let r = q.not(dateCol, 'is', null)
  if (cur) r = r.or(`${dateCol}.lt.${quote(cur.at)},and(${dateCol}.eq.${quote(cur.at)},${idCol}.lt.${quote(cur.id)})`)
  return r.order(dateCol, { ascending: false }).order(idCol, { ascending: false })
}

function day(v: unknown): string {
  return String(v ?? '')
}

/** The person's email addresses, read on the server (enquiries carry an email, no contact column yet). */
async function personEmails(db: Loose, contactId: number): Promise<string[]> {
  const { data } = await db.from('contact_emails').select('email').eq('contact_id', contactId)
  const out = new Set<string>()
  for (const r of (data ?? []) as { email: string | null }[]) {
    const e = (r.email ?? '').trim().toLowerCase()
    if (e && e.includes('@')) out.add(e)
  }
  return [...out]
}

function enquiryFilter(emails: string[]): string {
  // ilike without wildcards = case-insensitive equality; % and _ escaped.
  return emails.map((e) => `email.ilike.${quote(e.replace(/[%_*\\]/g, (c) => `\\${c}`))}`).join(',')
}

async function readSource(db: Loose, src: Source, contactId: number, cur: { at: string; id: string } | undefined, emails: string[], limit: number): Promise<Row[] | { error: string }> {
  let res: { data: unknown[] | null; error: { message: string } | null }
  switch (src) {
    case 'order':
      res = await after(db.from('work_order').select('id, ref, kind, status, created_at, price_final').eq('party_id', contactId), 'created_at', 'id', cur).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { id: string; ref: string | null; kind: string; status: string; created_at: string; price_final: number | null }[]).map((o) => ({
        source: src,
        key: { at: o.created_at, id: o.id },
        item: { kind: 'order', id: o.id, at: o.created_at, title: o.kind, detail: o.ref, status: o.status, amount: o.price_final, href: `/atelier/sales?order=${o.id}` },
      }))
    case 'payment':
      res = await after(
        db.from('payments').select('id, amount, payment_date, method, refunded_at, work_order_id, work_order!inner(party_id, ref)').eq('work_order.party_id', contactId),
        'payment_date',
        'id',
        cur,
      ).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { id: string; amount: number | null; payment_date: string; method: string | null; refunded_at: string | null; work_order_id: string; work_order: { ref: string | null } | null }[]).map((p) => ({
        source: src,
        key: { at: day(p.payment_date), id: p.id },
        item: { kind: 'payment', id: p.id, at: day(p.payment_date), title: p.method ?? '', detail: p.work_order?.ref ?? null, status: p.refunded_at ? 'refunded' : null, amount: p.amount, href: `/atelier/sales?order=${p.work_order_id}` },
      }))
    case 'shipment':
      res = await after(db.from('shipment').select('id, kind, status, created_at, carrier').eq('to_contact_id', contactId), 'created_at', 'id', cur).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { id: string; kind: string | null; status: string | null; created_at: string; carrier: string | null }[]).map((s) => ({
        source: src,
        key: { at: s.created_at, id: s.id },
        item: { kind: 'shipment', id: s.id, at: s.created_at, title: s.kind ?? '', detail: s.carrier, status: s.status, amount: null, href: null },
      }))
    case 'event':
      res = await after(
        db.from('suivi_process').select('id, nom, type, date_debut, statut, event_contact!inner(contact_id, role)').eq('event_contact.contact_id', contactId),
        'date_debut',
        'id',
        cur,
      ).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { id: string; nom: string | null; type: string | null; date_debut: string; event_contact: { role: string | null }[] }[]).map((e) => ({
        source: src,
        key: { at: day(e.date_debut), id: e.id },
        item: { kind: 'event', id: e.id, at: day(e.date_debut), title: e.nom ?? '', detail: e.event_contact?.[0]?.role ?? e.type, status: null, amount: null, href: `/atelier/exhibitions?event=${e.id}` },
      }))
    case 'process':
      res = await after(
        db.from('suivi_process').select('id, nom, type, date_debut, event_contact!left(contact_id)').eq('contact_id', contactId).eq('event_contact.contact_id', contactId).is('event_contact', null),
        'date_debut',
        'id',
        cur,
      ).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { id: string; nom: string | null; type: string | null; date_debut: string }[]).map((e) => ({
        source: src,
        key: { at: day(e.date_debut), id: e.id },
        item: { kind: 'event', id: e.id, at: day(e.date_debut), title: e.nom ?? '', detail: e.type, status: null, amount: null, href: `/atelier/exhibitions?event=${e.id}` },
      }))
    case 'kit':
      res = await after(db.from('private_link').select('token, created_at, first_opened_at, view_count, revoked_at, message').eq('contact_id', contactId), 'created_at', 'token', cur).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { token: string; created_at: string; first_opened_at: string | null; view_count: number | null; revoked_at: string | null }[]).map((k) => ({
        source: src,
        key: { at: k.created_at, id: k.token },
        item: {
          kind: 'kit',
          id: k.token,
          at: k.created_at,
          title: '',
          detail: k.first_opened_at ? String(k.view_count ?? 0) : null,
          status: k.revoked_at ? 'revoked' : k.first_opened_at ? 'opened' : 'sent',
          amount: null,
          href: null,
        },
      }))
    case 'paper':
      res = await after(db.from('document').select('id, name, kind, created_at').eq('contact_id', contactId), 'created_at', 'id', cur).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { id: string; name: string; kind: string | null; created_at: string }[]).map((d) => ({
        source: src,
        key: { at: d.created_at, id: d.id },
        item: { kind: 'paper', id: d.id, at: d.created_at, title: d.name, detail: d.kind, status: null, amount: null, href: '/atelier/vault' },
      }))
    case 'enquiry': {
      if (!emails.length) return []
      res = await after(db.from('inquiry').select('id, created_at, category, status, message').or(enquiryFilter(emails)), 'created_at', 'id', cur).limit(limit)
      if (res.error) return { error: res.error.message }
      return (res.data as { id: string; created_at: string; category: string | null; status: string | null; message: string | null }[]).map((q) => {
        const m = (q.message ?? '').replace(/\s+/g, ' ').trim()
        return {
          source: src,
          key: { at: q.created_at, id: q.id },
          item: { kind: 'enquiry', id: q.id, at: q.created_at, title: q.category ?? '', detail: m.length > 100 ? `${m.slice(0, 99).trimEnd()}…` : m || null, status: q.status, amount: null, href: null },
        }
      })
    }
  }
}

function newer(a: Row, b: Row): number {
  // Newest first: date desc, then kind, then id — any fixed order works, the cursors are per source.
  if (a.key.at !== b.key.at) return a.key.at < b.key.at ? 1 : -1
  if (a.source !== b.source) return a.source < b.source ? 1 : -1
  // Rows of one source with the same date keep the database order thanks to the stable Array.prototype.sort;
  // the per-source cursor relies on that prefix order.
  return 0
}

/** One page of the timeline, newest first; `kind` narrows to one kind. `next` is null when nothing is older. */
export async function readPersonTimeline(
  contactId: number,
  cursor: TimelineCursor | null = null,
  kind: TimelineKind | null = null,
): Promise<{ ok: true; items: TimelineItem[]; next: TimelineCursor | null } | { error: string }> {
  if (!Number.isInteger(contactId) || contactId <= 0) return { error: 'not_found' }
  if (kind && !TIMELINE_KINDS.includes(kind)) return { error: 'not_found' }
  const supabase = await teamClient()
  if (!supabase) return { error: 'auth' }
  const db = supabase as unknown as Loose
  const cur = cursor ?? {}
  const sources = SOURCES.filter((s) => (!kind || KIND_OF[s] === kind) && cur[s] !== 'done')
  const emails = sources.includes('enquiry') ? await personEmails(db, contactId) : []

  const results = await Promise.all(
    sources.map((s) => {
      const c = cur[s]
      return readSource(db, s, contactId, c && c !== 'done' ? c : undefined, emails, PAGE + 1)
    }),
  )
  const all: Row[] = []
  for (const r of results) {
    if ('error' in r) return { error: r.error }
    all.push(...r)
  }
  all.sort(newer)
  const taken = all.slice(0, PAGE)

  const next: TimelineCursor = { ...cur }
  let more = false
  sources.forEach((s, i) => {
    const rows = results[i] as Row[]
    const mine = taken.filter((r) => r.source === s)
    if (mine.length) next[s] = mine[mine.length - 1].key
    if (rows.length > mine.length) more = true
    else next[s] = 'done'
  })
  const items: TimelineItem[] = []
  const shown = new Set<string>()
  for (const r of taken) {
    const k = `${r.item.kind}:${r.item.id}`
    if (shown.has(k)) continue
    shown.add(k)
    items.push(r.item)
  }
  return { ok: true, items, next: more ? next : null }
}

/** How many rows of each kind this person has — counted by the database, one head query per source. */
export async function readPersonTimelineCounts(contactId: number): Promise<{ ok: true; counts: Record<TimelineKind, number> } | { error: string }> {
  if (!Number.isInteger(contactId) || contactId <= 0) return { error: 'not_found' }
  const supabase = await teamClient()
  if (!supabase) return { error: 'auth' }
  const db = supabase as unknown as Loose
  const emails = await personEmails(db, contactId)
  const head = { count: 'exact', head: true }
  const [order, payment, shipment, event, process, kit, paper, enquiry] = await Promise.all([
    db.from('work_order').select('id', head).eq('party_id', contactId).not('created_at', 'is', null),
    db.from('payments').select('id, work_order!inner(party_id)', head).eq('work_order.party_id', contactId).not('payment_date', 'is', null),
    db.from('shipment').select('id', head).eq('to_contact_id', contactId).not('created_at', 'is', null),
    db.from('suivi_process').select('id, event_contact!inner(contact_id)', head).eq('event_contact.contact_id', contactId).not('date_debut', 'is', null),
    db.from('suivi_process').select('id, event_contact!left(contact_id)', head).eq('contact_id', contactId).eq('event_contact.contact_id', contactId).is('event_contact', null).not('date_debut', 'is', null),
    db.from('private_link').select('token', head).eq('contact_id', contactId).not('created_at', 'is', null),
    db.from('document').select('id', head).eq('contact_id', contactId).not('created_at', 'is', null),
    emails.length ? db.from('inquiry').select('id', head).or(enquiryFilter(emails)).not('created_at', 'is', null) : Promise.resolve({ count: 0, error: null }),
  ])
  const parts = { order, payment, shipment, event, process, kit, paper, enquiry } as Record<Source, { count: number | null; error: { message: string } | null }>
  for (const p of Object.values(parts)) if (p.error) return { error: p.error.message }
  const n = (s: Source) => parts[s].count ?? 0
  return {
    ok: true,
    counts: {
      order: n('order'),
      payment: n('payment'),
      shipment: n('shipment'),
      event: n('event') + n('process'),
      kit: n('kit'),
      paper: n('paper'),
      enquiry: n('enquiry'),
    },
  }
}
