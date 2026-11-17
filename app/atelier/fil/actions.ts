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
import { approvePendingChange, rejectPendingChange } from '@/app/atelier/(portal)/audit/pending-actions'
import { cancelWorkOrder } from '@/app/atelier/(portal)/sales/orders-actions'

export type FilKind = 'note_line' | 'idea' | 'kaizen_item' | 'pending_change' | 'work_order'
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
type Ok = { ok: true }

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

  const [linesRes, kaizenRes, pendingRes, statesRes, ordersRes] = await Promise.all([
    supabase.from('note_line').select('*').is('discarded_at', null).order('created_at', { ascending: false }).limit(500),
    supabase.from('kaizen_item').select('id, created_at, title, body, author_id, section, work_ids, done_at').is('done_at', null).order('created_at', { ascending: false }).limit(300),
    supabase.from('pending_changes').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
    supabase.from('feed_item_state').select('item_kind, item_id, state, at, recalled_at'),
    supabase.from('work_order').select('id, ref, kind, party_id, created_at, created_by').eq('status', 'draft').not('created_by', 'is', null).neq('created_by', me).order('created_at', { ascending: false }).limit(100),
  ])
  for (const r of [linesRes, kaizenRes, pendingRes, statesRes, ordersRes]) {
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
    partyName.set(c.ContactID, c.NomInstitution || [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || `#${c.ContactID}`)
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

  const workIds = [
    ...lines.map((l) => l.oeuvre_id),
    ...kaizen.map((k) => (k.work_ids ?? [])[0]),
    ...pending.map((p) => p.oeuvre_id),
    ...[...firstWorkOf.values()],
  ].filter((x): x is number => typeof x === 'number')
  const authorIds = [...lines.map((l) => l.author_id), ...kaizen.map((k) => k.author_id), ...pending.map((p) => p.author_id), ...drafts.map((d) => d.created_by)].filter(
    (x): x is string => !!x,
  )
  const [works, names] = await Promise.all([worksFor(supabase, [...new Set(workIds)]), namesFor(supabase, [...new Set(authorIds)])])
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
  }

  // A draft order stays in the Fil until it is signed or cancelled in Commandes (no « seen » state):
  // « Garder » leaves it, « Retirer » cancels the draft (the cancellation is on the order itself).
  if (kind === 'work_order') {
    if (decision === 'discard') {
      const res = await cancelWorkOrder(id)
      if ('error' in res) return res
    }
    revalidatePath('/hub/fil')
    return { ok: true }
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
