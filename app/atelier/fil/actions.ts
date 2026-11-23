'use server'

// The Fil — R1 build step 6 (docs/design/2026-11-17/R1_InputsFeed.notes.md): everything the team puts
// in, sorted by Pem in one place. Accepted by default; Pem flicks off what he disagrees with.
// Admin only (feed_item_state RLS, supabase/sql/r1_feed.sql). The Fil only reads: nothing is moved
// or locked where it was written. Every discard is logged (feed_item_state.state = 'discarded') and
// can be recalled from Audit.
//
// Sources: note_line (work / proposal lines; idea lines grouped one item per idea), kaizen_item by
// others (open), pending_changes (work facts waiting for approval — approve / reject reuse Audit's
// actions), draft orders a team member made (R7 v2: « a hand change in the work card becomes a draft
// order … submitted to me to check »; they stay until signed or cancelled in Commandes — « Retirer »
// cancels the draft). Items Pem leaves alone fold into « Refroidies » after COOL_DAYS (approvals and
// draft orders never cool).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { diffPendingPayload } from '@/lib/work-pending-keys'
import { resolveMessage } from '@/lib/i18n/resolve-message'
import type { DictKey } from '@/lib/i18n/dictionary'
import { contactListLabel } from '@/lib/contacts/contact-display'
import { approvePendingChange, rejectPendingChange } from '@/app/atelier/(portal)/audit/pending-actions'
import { cancelWorkOrder } from '@/app/atelier/(portal)/sales/orders-actions'
import { saveContact, type ContactFields } from '@/app/atelier/(portal)/contacts/save-contact'
import { archiveContact, savePersonLink, setContactSpheres, type LinkInput } from '@/app/atelier/(portal)/contacts/people-actions'

export type FilKind = 'note_line' | 'idea' | 'kaizen_item' | 'pending_change' | 'work_order' | 'contact_change'
export type ContactChangeAction = 'changed' | 'spheres' | 'link_add' | 'link_remove' | 'archived' | 'recalled'
export type FilSection = 'creation' | 'fiches' | 'kaizen'
export type FilDecision = 'keep' | 'discard'

export type FilItem = {
  key: string
  kind: FilKind
  id: string
  section: FilSection
  author: string | null
  at: string
  title: string | null
  body: string
  work: { id: number; title: string | null; thumb: string | null } | null
  /** Idea: new lines since Pem last looked. */
  newLines?: number
  /** Note line: on a work's notes, or a free « Proposer une idée ». */
  lineKind?: 'work' | 'proposal'
  /** Work facts: « champ : avant → après ». */
  changes?: Array<{ key: string; before: string | null; after: string | null }>
  /** Work facts: edit / create / image_add (an image proposal shows its picture). */
  changeKind?: string | null
  image?: string | null
  /** Draft order (R7): the order to open, its kind and the other party. */
  order?: { id: string; ref: string | null; kind: string; party: string }
  /** Team change to a person (People.md §3): whose card, what was done, list kinds touched (not revertible). */
  contact?: { id: number; name: string; action: ContactChangeAction; lists: string | null }
  flagged: boolean
  cooled: boolean
}

export type FilLogEntry = {
  kind: FilKind
  id: string
  at: string
  recalledAt: string | null
  label: string
  /** A rejected image proposal cannot come back (its file was discarded). */
  recallable: boolean
}

type Err = { error: string }
type Ok = { ok: true; note?: string }

type LogRow = {
  id: number
  action: string
  table_name: string | null
  row_id: string | null
  old_value: unknown
  new_value: unknown
  author_id: string | null
  created_at: string | null
}

const CONTACT_ACTION: Record<string, ContactChangeAction> = {
  'Contact modifié': 'changed',
  'Sphères modifiées': 'spheres',
  'Lien ajouté': 'link_add',
  'Lien retiré': 'link_remove',
  'Contact archivé': 'archived',
  'Contact rappelé': 'recalled',
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function show(v: unknown): string | null {
  if (v == null || v === '') return null
  if (Array.isArray(v)) return v.length ? v.join(', ') : null
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

/** The log row as « champ : avant → après » lines and the list kinds touched. */
function contactChanges(
  row: LogRow,
  action: ContactChangeAction,
  nameOf: { contacts: Map<number, string>; works: Map<number, { title: string | null }> } = { contacts: new Map(), works: new Map() },
): { changes: Array<{ key: string; before: string | null; after: string | null }>; lists: string | null } {
  const o = obj(row.old_value)
  const n = obj(row.new_value)
  if (action === 'changed') {
    const lists = Array.isArray(n._lists) ? (n._lists as unknown[]).join(', ') : null
    const keys = Object.keys(n).filter((k) => k !== '_lists')
    return { changes: keys.map((k) => ({ key: k, before: show(o[k]), after: show(n[k]) })), lists }
  }
  if (action === 'spheres') return { changes: [{ key: 'spheres', before: show(o.spheres), after: show(n.spheres) }], lists: null }
  if (action === 'archived' || action === 'recalled') {
    return { changes: [{ key: 'archived', before: show(o.archived), after: show(n.archived) }], lists: null }
  }
  const p = action === 'link_add' ? n : o
  const target =
    p.to_contact != null
      ? nameOf.contacts.get(Number(p.to_contact)) ?? `#${String(p.to_contact)}`
      : p.to_work != null
        ? nameOf.works.get(Number(p.to_work))?.title ?? `#${String(p.to_work)}`
        : '—'
  const text = `${String(p.kind ?? '')} → ${target}`
  return { changes: [{ key: 'lien', before: action === 'link_remove' ? text : null, after: action === 'link_add' ? text : null }], lists: null }
}

const COOL_DAYS = 14

/** An idea line is new to Pem when written after his last look at the idea, or recalled since then. */
function isNewIdeaLine(line: { created_at: string }, seenAt: string | undefined, recalledAt: string | undefined): boolean {
  if (!seenAt) return true
  return line.created_at > seenAt || (!!recalledAt && recalledAt > seenAt)
}

async function gate() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'auth' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { ok: false as const, error: 'admin' }
  return { ok: true as const, supabase, user }
}

type Supa = Awaited<ReturnType<typeof createClient>>

async function namesFor(supabase: Supa, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (!ids.length) return names
  // `select('*')`: the typed select parser rejects the accented `Prénom` column name.
  const { data } = await supabase.from('Contact').select('*').in('auth_user_id', ids)
  for (const c of (data ?? []) as { auth_user_id: string | null; Prénom: string | null; Nom: string | null }[]) {
    if (c.auth_user_id) names.set(c.auth_user_id, [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—')
  }
  return names
}

async function worksFor(supabase: Supa, ids: number[]) {
  const works = new Map<number, { id: number; title: string | null; thumb: string | null }>()
  if (!ids.length) return works
  const { data } = await supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').in('OeuvreID', ids)
  for (const w of data ?? []) works.set(w.OeuvreID, { id: w.OeuvreID, title: w.Titre, thumb: w.txtImageNameLink })
  return works
}

export async function listFil(): Promise<{ items: FilItem[] } | Err> {
  const g = await gate()
  if (!g.ok) return { error: g.error }
  const { supabase, user } = g
  const me = user.id

  const [linesRes, kaizenRes, pendingRes, statesRes, ordersRes, contactLogRes] = await Promise.all([
    supabase.from('note_line').select('*').is('discarded_at', null).order('created_at', { ascending: false }).limit(500),
    supabase.from('kaizen_item').select('id, created_at, title, body, author_id, section, work_ids, done_at').is('done_at', null).order('created_at', { ascending: false }).limit(300),
    supabase.from('pending_changes').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
    supabase.from('feed_item_state').select('item_kind, item_id, state, at, recalled_at'),
    supabase.from('work_order').select('id, ref, kind, party_id, created_at, created_by').eq('status', 'draft').not('created_by', 'is', null).neq('created_by', me).order('created_at', { ascending: false }).limit(100),
    supabase
      .from('system_log')
      .select('id, action, table_name, row_id, old_value, new_value, author_id, created_at')
      .eq('event_type', 'contact_team_change')
      .order('created_at', { ascending: false })
      .limit(200),
  ])
  for (const r of [linesRes, kaizenRes, pendingRes, statesRes, ordersRes, contactLogRes]) {
    if (r.error) {
      await logError('fil list failed', r.error, { source: 'fil.listFil' })
      return { error: r.error.message }
    }
  }

  // A state takes the item out of the Fil, unless the discard was recalled.
  const state = new Map<string, { at: string }>()
  const recalledLine = new Map<string, string>()
  for (const s of statesRes.data ?? []) {
    if (s.state === 'discarded' && s.recalled_at) {
      if (s.item_kind === 'note_line') recalledLine.set(s.item_id, s.recalled_at)
      continue
    }
    state.set(`${s.item_kind}:${s.item_id}`, { at: s.at })
  }
  const coolBefore = new Date(Date.now() - COOL_DAYS * 86_400_000).toISOString()

  const lines = (linesRes.data ?? []).filter((l) => l.author_id !== me)
  const kaizen = (kaizenRes.data ?? []).filter((k) => k.author_id !== me)
  const pending = pendingRes.data ?? []
  const drafts = ordersRes.data ?? []
  const [draftLines, draftParties] = drafts.length
    ? await Promise.all([
        supabase.from('work_order_work').select('order_id, oeuvre_id, position').in('order_id', drafts.map((d) => d.id)).order('position'),
        supabase.from('Contact').select('*').in('ContactID', [...new Set(drafts.map((d) => d.party_id))]),
      ])
    : [{ data: [] as Array<{ order_id: string; oeuvre_id: number; position: number }> }, { data: [] }]
  const firstWorkOf = new Map<string, number>()
  for (const l of draftLines.data ?? []) if (!firstWorkOf.has(l.order_id)) firstWorkOf.set(l.order_id, l.oeuvre_id)
  const partyName = new Map<number, string>()
  for (const c of (draftParties.data ?? []) as { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]) {
    partyName.set(c.ContactID, contactListLabel(c))
  }

  // Idea lines: one item per idea, counting lines newer than Pem's last look.
  const byIdea = new Map<string, typeof lines>()
  for (const l of lines) {
    if (l.target_kind !== 'idea' || !l.concept_id) continue
    if (!isNewIdeaLine(l, state.get(`idea:${l.concept_id}`)?.at, recalledLine.get(String(l.id)))) continue
    const list = byIdea.get(l.concept_id) ?? []
    list.push(l)
    byIdea.set(l.concept_id, list)
  }
  const ideaIds = [...byIdea.keys()]
  const { data: concepts } = ideaIds.length
    ? await supabase.from('concept').select('id, titre').in('id', ideaIds)
    : { data: [] as Array<{ id: string; titre: string }> }
  const conceptTitle = new Map((concepts ?? []).map((c) => [c.id, c.titre]))

  const contactLog = ((contactLogRes.data ?? []) as LogRow[]).filter((r) => CONTACT_ACTION[r.action] && r.row_id && !state.has(`contact_change:${r.id}`))
  // Link changes name another contact or a work: collect them to resolve in one read each.
  const linkContactIds: number[] = []
  const linkWorkIds: number[] = []
  for (const r of contactLog) {
    const a = CONTACT_ACTION[r.action]
    if (a !== 'link_add' && a !== 'link_remove') continue
    const p = obj(a === 'link_add' ? r.new_value : r.old_value)
    if (p.to_contact != null && Number.isInteger(Number(p.to_contact))) linkContactIds.push(Number(p.to_contact))
    if (p.to_work != null && Number.isInteger(Number(p.to_work))) linkWorkIds.push(Number(p.to_work))
  }
  const workIds = [
    ...linkWorkIds,
    ...lines.map((l) => l.oeuvre_id),
    ...kaizen.map((k) => (k.work_ids ?? [])[0]),
    ...pending.map((p) => p.oeuvre_id),
    ...[...firstWorkOf.values()],
  ].filter((x): x is number => typeof x === 'number')
  const authorIds = [
    ...lines.map((l) => l.author_id),
    ...kaizen.map((k) => k.author_id),
    ...pending.map((p) => p.author_id),
    ...drafts.map((d) => d.created_by),
    ...contactLog.map((r) => r.author_id),
  ].filter((x): x is string => !!x)
  const contactIds = [...new Set([...contactLog.map((r) => Number(r.row_id)).filter((n) => Number.isInteger(n)), ...linkContactIds])]
  const [works, names, contactRows] = await Promise.all([
    worksFor(supabase, [...new Set(workIds)]),
    namesFor(supabase, [...new Set(authorIds)]),
    contactIds.length ? supabase.from('Contact').select('*').in('ContactID', contactIds) : Promise.resolve({ data: [] }),
  ])
  const contactName = new Map<number, string>()
  for (const c of (contactRows.data ?? []) as { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]) {
    contactName.set(c.ContactID, contactListLabel(c))
  }
  const name = (id: string | null) => (id ? names.get(id) ?? null : null)

  const items: FilItem[] = []

  for (const l of lines) {
    if (l.target_kind === 'idea') continue
    if (state.has(`note_line:${l.id}`)) continue
    items.push({
      key: `note_line:${l.id}`,
      kind: 'note_line',
      id: String(l.id),
      section: 'creation',
      author: name(l.author_id),
      at: l.created_at,
      title: null,
      body: l.body,
      work: l.oeuvre_id != null ? works.get(l.oeuvre_id) ?? { id: l.oeuvre_id, title: null, thumb: null } : null,
      lineKind: l.target_kind === 'proposal' ? 'proposal' : 'work',
      flagged: l.flagged_for_pem,
      cooled: l.created_at < coolBefore,
    })
  }

  for (const [conceptId, list] of byIdea) {
    const last = list[0]
    items.push({
      key: `idea:${conceptId}`,
      kind: 'idea',
      id: conceptId,
      section: 'creation',
      author: name(last.author_id),
      at: last.created_at,
      title: conceptTitle.get(conceptId) ?? null,
      body: last.body,
      work: null,
      newLines: list.length,
      flagged: list.some((l) => l.flagged_for_pem),
      cooled: last.created_at < coolBefore,
    })
  }

  for (const k of kaizen) {
    if (state.has(`kaizen_item:${k.id}`)) continue
    const wid = (k.work_ids ?? [])[0]
    items.push({
      key: `kaizen_item:${k.id}`,
      kind: 'kaizen_item',
      id: String(k.id),
      section: 'kaizen',
      author: name(k.author_id),
      at: k.created_at,
      title: k.title,
      body: k.body ?? '',
      work: wid != null ? works.get(wid) ?? null : null,
      flagged: false,
      cooled: k.created_at < coolBefore,
    })
  }

  for (const p of pending) {
    if (state.has(`pending_change:${p.id}`)) continue
    const payload = p.payload as Record<string, string>
    const diff = diffPendingPayload(p.baseline as Record<string, unknown> | null, payload)
    items.push({
      key: `pending_change:${p.id}`,
      kind: 'pending_change',
      id: String(p.id),
      section: 'fiches',
      author: name(p.author_id),
      at: p.created_at,
      title: null,
      body: '',
      work: p.oeuvre_id != null ? works.get(p.oeuvre_id) ?? { id: p.oeuvre_id, title: null, thumb: null } : null,
      changes: diff.slice(0, 6).map((d) => ({ key: d.key, before: d.before, after: d.after })),
      changeKind: p.change_kind,
      image: p.change_kind === 'image_add' ? payload.filename ?? null : null,
      flagged: false,
      // Approvals wait for Pem: they never cool.
      cooled: false,
    })
  }

  for (const d of drafts) {
    const wid = firstWorkOf.get(d.id)
    items.push({
      key: `work_order:${d.id}`,
      kind: 'work_order',
      id: d.id,
      section: 'fiches',
      author: name(d.created_by),
      at: d.created_at,
      title: null,
      body: '',
      work: wid != null ? works.get(wid) ?? { id: wid, title: null, thumb: null } : null,
      order: { id: d.id, ref: d.ref, kind: d.kind, party: partyName.get(d.party_id) ?? `#${d.party_id}` },
      flagged: false,
      // A draft waits for Pem: it never cools.
      cooled: false,
    })
  }

  for (const r of contactLog) {
    const action = CONTACT_ACTION[r.action]
    const cid = Number(r.row_id)
    const { changes, lists } = contactChanges(r, action, { contacts: contactName, works })
    items.push({
      key: `contact_change:${r.id}`,
      kind: 'contact_change',
      id: String(r.id),
      section: 'fiches',
      author: name(r.author_id),
      at: r.created_at ?? new Date(0).toISOString(),
      title: null,
      body: '',
      work: null,
      changes: changes.slice(0, 12),
      contact: { id: cid, name: contactName.get(cid) ?? `#${cid}`, action, lists },
      flagged: false,
      // Team changes wait for Pem: they never cool.
      cooled: false,
    })
  }

  // Flagged first (« Une idée pour Pem ? »), then newest.
  items.sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.at.localeCompare(a.at))
  return { items }
}

async function setState(supabase: Supa, userId: string, kind: FilKind, id: string, value: 'seen' | 'discarded'): Promise<Err | null> {
  const { error } = await supabase
    .from('feed_item_state')
    .upsert(
      { user_id: userId, item_kind: kind, item_id: id, state: value, at: new Date().toISOString(), recalled_at: null },
      { onConflict: 'user_id,item_kind,item_id' },
    )
  return error ? { error: error.message } : null
}

/** Right = keep (seen / approve), left = discard (hide the line / reject), from the swipe deck. */
export async function decideFil(kind: FilKind, id: string, decision: FilDecision): Promise<Ok | Err> {
  const g = await gate()
  if (!g.ok) return { error: g.error }
  const { supabase, user } = g
  const now = new Date().toISOString()

  if (kind === 'pending_change') {
    const res = decision === 'keep' ? await approvePendingChange(Number(id)) : await rejectPendingChange(Number(id), '')
    if ('error' in res) return res
    // The work changed since the proposal: nothing written, the card stays; Audit decides.
    if ('conflict' in res) {
      return { error: resolveMessage('fr', 'pending_conflict_fil').replace('{fields}', res.conflict.fields.join(', ')) }
    }
  }

  // A draft order stays in the Fil until it is signed or cancelled in Commandes (no « seen » state):
  // « Garder » leaves it, « Retirer » cancels the draft (the cancellation is on the order itself).
  if (kind === 'work_order') {
    if (decision === 'discard') {
      const res = await cancelWorkOrder(id)
      // The step moved meanwhile (another tab): say it in words, not the code.
      if ('error' in res) return res.error === 'ord_err_step' ? { error: resolveMessage('fr', 'ord_err_step') } : res
    }
    revalidatePath('/hub/fil')
    return { ok: true }
  }

  // A team change to a person: « Vu » marks it seen; « Revenir » re-applies the old values through the
  // people doors first (a refusal is returned, nothing marked), then marks it seen.
  if (kind === 'contact_change') {
    let note: string | undefined
    if (decision === 'discard') {
      const { data: row, error } = await supabase
        .from('system_log')
        .select('id, action, table_name, row_id, old_value, new_value, author_id, created_at')
        .eq('id', Number(id))
        .eq('event_type', 'contact_team_change')
        .maybeSingle()
      if (error) return { error: error.message }
      const log = row as LogRow | null
      const action = log ? CONTACT_ACTION[log.action] : undefined
      const contactId = Number(log?.row_id)
      if (!log || !action || !Number.isInteger(contactId)) return { error: 'not_found' }
      const o = obj(log.old_value)
      const n = obj(log.new_value)
      const refusal = (r: unknown): Err | null => {
        const x = r as { refused?: string; detail?: unknown; error?: string }
        if (x.error) return { error: x.error }
        if (x.refused) return { error: `${x.refused}${x.detail ? ` (${typeof x.detail === 'string' ? x.detail : JSON.stringify(x.detail)})` : ''}` }
        return null
      }
      if (action === 'changed') {
        const fields = { ...o }
        delete fields._lists
        if (Object.keys(fields).length) {
          const res = await saveContact({ id: contactId, fields: fields as ContactFields })
          const bad = refusal(res)
          if (bad) return bad
        }
        if (Array.isArray(n._lists) && n._lists.length) note = resolveMessage('fr', 'fil_c_revert_lists_note')
      } else if (action === 'spheres') {
        const keys = Array.isArray(o.spheres) ? (o.spheres as unknown[]).filter((k): k is string => typeof k === 'string') : []
        const bad = refusal(await setContactSpheres(contactId, keys))
        if (bad) return bad
      } else if (action === 'link_add' || action === 'link_remove') {
        const p = obj(action === 'link_add' ? n : o)
        const input: LinkInput = {
          op: action === 'link_add' ? 'remove' : 'add',
          from: Number(p.from ?? contactId),
          kind: p.kind as LinkInput['kind'],
          toContact: p.to_contact != null ? Number(p.to_contact) : null,
          toWork: p.to_work != null ? Number(p.to_work) : null,
          sourceKind: typeof p.source_kind === 'string' ? p.source_kind : null,
          sourceRef: typeof p.source_ref === 'string' ? p.source_ref : null,
        }
        const bad = refusal(await savePersonLink(input))
        if (bad) return bad
      } else {
        // archived → back to active; recalled → archived again.
        const bad = refusal(await archiveContact(contactId, action === 'recalled'))
        if (bad) return bad
      }
    }
    // A successful revert is stored as 'discarded' so the Fil log lists it; « Vu » stays 'seen'.
    const st = await setState(supabase, user.id, kind, id, decision === 'discard' ? 'discarded' : 'seen')
    if (st) return st
    revalidatePath('/hub/fil')
    return note ?{ ok: true, note } : { ok: true }
  }

  if (decision === 'discard' && kind === 'note_line') {
    const { error } = await supabase.from('note_line').update({ discarded_at: now, discarded_by: user.id }).eq('id', Number(id))
    if (error) return { error: error.message }
  }

  if (decision === 'discard' && kind === 'idea') {
    // The new lines from others on this idea are discarded one by one (each logged, each recallable).
    // Same « new » rule as listFil: newer than Pem's last look, or recalled since.
    const seen = await supabase.from('feed_item_state').select('at').eq('item_kind', 'idea').eq('item_id', id).maybeSingle()
    const { data: live, error } = await supabase
      .from('note_line')
      .select('id, created_at')
      .eq('concept_id', id)
      .is('discarded_at', null)
      .neq('author_id', user.id)
    if (error) return { error: error.message }
    const recalled = new Map<string, string>()
    if (live?.length) {
      const rs = await supabase
        .from('feed_item_state')
        .select('item_id, recalled_at')
        .eq('item_kind', 'note_line')
        .in('item_id', live.map((l) => String(l.id)))
        .not('recalled_at', 'is', null)
      for (const r of rs.data ?? []) if (r.recalled_at) recalled.set(r.item_id, r.recalled_at)
    }
    const fresh = (live ?? []).filter((l) => isNewIdeaLine(l, seen.data?.at, recalled.get(String(l.id))))
    for (const l of fresh) {
      const upd = await supabase.from('note_line').update({ discarded_at: now, discarded_by: user.id }).eq('id', l.id)
      if (upd.error) return { error: upd.error.message }
      const st = await setState(supabase, user.id, 'note_line', String(l.id), 'discarded')
      if (st) return st
    }
    // The idea itself is only « seen up to now »: later lines show again.
    const st = await setState(supabase, user.id, 'idea', id, 'seen')
    if (st) return st
    revalidatePath('/hub/fil')
    return { ok: true }
  }

  const st = await setState(supabase, user.id, kind, id, decision === 'keep' ? 'seen' : 'discarded')
  if (st) return st
  revalidatePath('/hub/fil')
  return { ok: true }
}

/** Audit: every discard, newest first, with what it was. */
export async function listFilLog(limit = 100): Promise<{ entries: FilLogEntry[] } | Err> {
  const g = await gate()
  if (!g.ok) return { error: g.error }
  const { supabase } = g
  const { data, error } = await supabase
    .from('feed_item_state')
    .select('item_kind, item_id, at, recalled_at')
    .eq('state', 'discarded')
    .order('at', { ascending: false })
    .limit(limit)
  if (error) return { error: error.message }
  const rows = data ?? []

  const lineIds = rows.filter((r) => r.item_kind === 'note_line').map((r) => Number(r.item_id))
  const kaizenIds = rows.filter((r) => r.item_kind === 'kaizen_item').map((r) => Number(r.item_id))
  const pendingIds = rows.filter((r) => r.item_kind === 'pending_change').map((r) => Number(r.item_id))
  const contactLogIds = rows.filter((r) => r.item_kind === 'contact_change').map((r) => Number(r.item_id)).filter((n) => Number.isInteger(n))
  const logRowsRes = contactLogIds.length
    ? await supabase.from('system_log').select('id, action, row_id').eq('event_type', 'contact_team_change').in('id', contactLogIds)
    : { data: [] as Array<{ id: number; action: string; row_id: string | null }> }
  const logById = new Map((logRowsRes.data ?? []).map((l) => [String(l.id), l]))
  const logContactIds = [...new Set((logRowsRes.data ?? []).map((l) => Number(l.row_id)).filter((n) => Number.isInteger(n)))]
  const logContactRes = logContactIds.length ? await supabase.from('Contact').select('*').in('ContactID', logContactIds) : { data: [] }
  const logContactName = new Map<number, string>()
  for (const c of (logContactRes.data ?? []) as { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null }[]) {
    logContactName.set(c.ContactID, contactListLabel(c))
  }
  const [lines, kaizen, pending] = await Promise.all([
    lineIds.length ? supabase.from('note_line').select('id, body, oeuvre_id').in('id', lineIds) : Promise.resolve({ data: [] as Array<{ id: number; body: string; oeuvre_id: number | null }> }),
    kaizenIds.length ? supabase.from('kaizen_item').select('id, title').in('id', kaizenIds) : Promise.resolve({ data: [] as Array<{ id: number; title: string }> }),
    pendingIds.length ? supabase.from('pending_changes').select('id, oeuvre_id, change_kind').in('id', pendingIds) : Promise.resolve({ data: [] as Array<{ id: number; oeuvre_id: number | null; change_kind: string | null }> }),
  ])
  const lineMap = new Map((lines.data ?? []).map((l) => [String(l.id), l]))
  const kaizenMap = new Map((kaizen.data ?? []).map((k) => [String(k.id), k]))
  const pendingMap = new Map((pending.data ?? []).map((p) => [String(p.id), p]))

  return {
    entries: rows.map((r) => {
      const kind = r.item_kind as FilKind
      let label = r.item_id
      let recallable = true
      if (kind === 'note_line') {
        const l = lineMap.get(r.item_id)
        label = l ? `${l.oeuvre_id != null ? `#${l.oeuvre_id} · ` : ''}${l.body.slice(0, 140)}` : r.item_id
      } else if (kind === 'kaizen_item') {
        label = kaizenMap.get(r.item_id)?.title ?? r.item_id
      } else if (kind === 'pending_change') {
        const p = pendingMap.get(r.item_id)
        label = p?.oeuvre_id != null ? `#${p.oeuvre_id}` : r.item_id
        recallable = p?.change_kind !== 'image_add'
      } else if (kind === 'contact_change') {
        recallable = false
        const l = logById.get(r.item_id)
        const act = l ? CONTACT_ACTION[l.action] : undefined
        if (l && act) {
          const cid = Number(l.row_id)
          const who = logContactName.get(cid) ?? `#${l.row_id}`
          label = `${who} · ${resolveMessage('fr', `fil_c_${act}` as DictKey)}`
        }
      }
      return { kind, id: r.item_id, at: r.at, recalledAt: r.recalled_at, label, recallable }
    }),
  }
}

/** Audit « Rappeler »: the item comes back where it was and into the Fil; the log keeps the mark. */
export async function recallFil(kind: FilKind, id: string): Promise<Ok | Err> {
  const g = await gate()
  if (!g.ok) return { error: g.error }
  const { supabase } = g

  // A revert went through the people doors; it cannot be redone from here.
  if (kind === 'contact_change') return { error: 'cannot_recall' }

  if (kind === 'note_line') {
    const { error } = await supabase.from('note_line').update({ discarded_at: null, discarded_by: null }).eq('id', Number(id))
    if (error) return { error: error.message }
  } else if (kind === 'pending_change') {
    const { data: row } = await supabase.from('pending_changes').select('status, change_kind').eq('id', Number(id)).maybeSingle()
    if (row?.change_kind === 'image_add') return { error: 'image' }
    if (row?.status === 'rejected') {
      const { error } = await supabase
        .from('pending_changes')
        .update({ status: 'pending', reviewed_at: null, reviewer_id: null, reject_reason: null })
        .eq('id', Number(id))
      if (error) return { error: error.message }
    }
  }

  const { error } = await supabase
    .from('feed_item_state')
    .update({ recalled_at: new Date().toISOString() })
    .eq('item_kind', kind)
    .eq('item_id', id)
    .eq('state', 'discarded')
  if (error) return { error: error.message }
  revalidatePath('/hub/fil')
  revalidatePath('/atelier/audit')
  return { ok: true }
}

/** Count for Aujourd'hui / Overview: open items, cooled ones left out. Null when the Fil is not
 *  readable (not admin, or the read failed): the pulse line then leaves it out. */
export async function countFil(): Promise<number | null> {
  const res = await listFil()
  return 'error' in res ? null : res.items.filter((i) => !i.cooled).length
}
