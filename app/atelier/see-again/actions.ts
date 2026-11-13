'use server'

// "See again" card (owner GO 2026-11-13, HANDOFF_2026-11-13_OPUS task D). Links come from seeing
// things again. No AI-written text: it only chooses what to show — the same three slots all day
// (seed = the Paris date). Data: journal_entry, Oeuvres, tblrelations, nodes (pgvector).
// Dismissals per person: supabase/sql/see_again_dismissed.sql.

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import { insertConstellationRelation } from '@/app/atelier/(portal)/constellation/actions'
// Hand-made work ↔ work relations: a pair with one of these is already linked.
import { WORK_LINK_TYPES, type WorkLinkType } from '@/lib/work-links'


export type SeeAgainWork = { id: number; title: string | null; image: string | null }
export type SeeAgainSlots = {
  then: { id: number; day: string; kind: string; snippet: string; sameWeek: boolean } | null
  alone: SeeAgainWork | null
  close: { a: SeeAgainWork; b: SeeAgainWork } | null
}
type Err = { error: string }
type Kind = 'then' | 'alone' | 'close'

/** Small stable hash → index; the same day and slot give the same pick. */
function pick<T>(items: T[], seed: string): T | null {
  if (!items.length) return null
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return items[(h >>> 0) % items.length]
}

async function guardTeam() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isTeam } = await supabase.rpc('is_team')
  return isTeam ? supabase : null
}

/** Days from Jan 1 for a YYYY-MM-DD (leap years ignored on purpose: "this week" is ±3 days). */
function dayOfYear(d: string): number {
  const [, m, day] = d.split('-').map(Number)
  return [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1] + day
}

export async function getSeeAgain(): Promise<SeeAgainSlots | Err> {
  const supabase = await guardTeam()
  if (!supabase) return { error: 'auth' }
  const today = calendarDayInParisFromIso(new Date().toISOString())
  const year = Number(today.slice(0, 4))

  const [entriesRes, worksRes, linksRes, relsRes, dismissedRes] = await Promise.all([
    supabase.from('journal_entry').select('id, event_on, kind, body').is('hidden_at', null).lt('event_on', today).limit(5000),
    supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, txtImageNameLink')
      .is('deleted_at', null)
      .not('txtImageNameLink', 'is', null)
      .order('OeuvreID', { ascending: true })
      .limit(5000),
    supabase.from('journal_entry_link').select('oeuvre_id').not('oeuvre_id', 'is', null).not('validated_at', 'is', null),
    supabase.from('tblrelations').select('source_id, target_id').in('relation_type', [...WORK_LINK_TYPES]),
    supabase.from('see_again_dismissed').select('kind, a, b'),
  ])
  for (const r of [entriesRes, worksRes, linksRes, relsRes, dismissedRes]) {
    if (r.error) return { error: r.error.message }
  }

  const dismissed = new Set((dismissedRes.data ?? []).map((d) => `${d.kind}:${d.a}:${d.b}`))
  const works = (worksRes.data ?? []).map((w) => ({ id: w.OeuvreID, title: w.Titre, image: w.txtImageNameLink }))
  const byId = new Map(works.map((w) => [w.id, w]))
  const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)
  const related = new Set<number>()
  const pairs = new Set<string>()
  for (const r of relsRes.data ?? []) {
    if (r.source_id == null || r.target_id == null) continue
    related.add(r.source_id)
    related.add(r.target_id)
    pairs.add(pairKey(r.source_id, r.target_id))
  }
  const journalLinked = new Set((linksRes.data ?? []).map((l) => l.oeuvre_id as number))

  // 1. Then — an entry from this week of an earlier year; else an older entry (30+ days).
  const entries = (entriesRes.data ?? []).filter((e) => !dismissed.has(`then:${e.id}:`))
  const todayDoy = dayOfYear(today)
  const sameWeek = entries.filter((e) => {
    if (Number(e.event_on.slice(0, 4)) >= year) return false
    const diff = Math.abs(dayOfYear(e.event_on) - todayDoy)
    return Math.min(diff, 365 - diff) <= 3
  })
  const monthAgo = calendarDayInParisFromIso(new Date(Date.now() - 30 * 86_400_000).toISOString())
  const thenEntry = pick(sameWeek, `${today}:then`) ?? pick(entries.filter((e) => e.event_on <= monthAgo), `${today}:then`)
  const then = thenEntry
    ? {
        id: thenEntry.id,
        day: thenEntry.event_on,
        kind: thenEntry.kind,
        // Markdown marks out (headings, emphasis, quotes); `#1234` mentions stay (no space after #).
        snippet: thenEntry.body
          .replace(/^\s*#{1,6}\s+/gm, '')
          .replace(/(\*\*|__|`|^>\s?)/gm, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 220),
        sameWeek: sameWeek.includes(thenEntry),
      }
    : null

  // 2. Alone — no journal link, no hand-made relation.
  const alone = pick(
    works.filter((w) => !related.has(w.id) && !journalLinked.has(w.id) && !dismissed.has(`alone:${w.id}:`)),
    `${today}:alone`,
  )

  // 3. Close — a seeded work and its nearest other work by embedding, with no relation between them.
  let close: SeeAgainSlots['close'] = null
  const svc = createServiceClient()
  for (let attempt = 0; attempt < 6 && !close; attempt++) {
    const seedWork = pick(works, `${today}:close:${attempt}`)
    if (!seedWork) break
    const { data: node } = await svc
      .from('nodes')
      .select('embedding')
      .eq('node_type', 'oeuvre')
      .eq('source_pk', String(seedWork.id))
      .eq('embedding_status', 'ok')
      .maybeSingle()
    if (!node?.embedding) continue
    const { data: matches, error } = await svc.rpc('match_nodes', { query_embedding: node.embedding as unknown as string, match_count: 12 })
    if (error || !matches?.length) continue
    const ids = (matches as Array<{ node_id: string; node_type: string }>).filter((m) => m.node_type === 'oeuvre').map((m) => m.node_id)
    const { data: pks } = await svc.from('nodes').select('node_id, source_pk').in('node_id', ids)
    const pkOf = new Map<string, number>(
      ((pks ?? []) as Array<{ node_id: string; source_pk: string }>).map((p) => [p.node_id, Number(p.source_pk)]),
    )
    for (const nodeId of ids) {
      const other = pkOf.get(nodeId)
      if (other == null || other === seedWork.id || !byId.has(other)) continue
      const key = pairKey(seedWork.id, other)
      if (pairs.has(key) || dismissed.has(`close:${key}`)) continue
      const [a, b] = seedWork.id < other ? [seedWork, byId.get(other)!] : [byId.get(other)!, seedWork]
      close = { a, b }
      break
    }
  }

  return { then, alone, close }
}

/** "Not related" / hide: not shown to this person again. */
export async function dismissSeeAgain(kind: Kind, a: number, b?: number): Promise<{ ok: true } | Err> {
  const supabase = await guardTeam()
  if (!supabase) return { error: 'auth' }
  const [x, y] = b != null && b < a ? [b, a] : [a, b]
  const { error } = await supabase
    .from('see_again_dismissed')
    .upsert({ kind, a: String(x), b: y != null ? String(y) : '' }, { onConflict: 'user_id,kind,a,b', ignoreDuplicates: true })
  if (error) return { error: error.message }
  return { ok: true }
}

/**
 * "Link" on the close pair (owner 2026-11-13: links have a type and a direction): a human relation
 * `from` → `to` of the chosen type, written like the Constellation does.
 */
export async function linkSeeAgainPair(from: number, to: number, type: WorkLinkType = 'proximity'): Promise<{ ok: true } | Err> {
  if (!(WORK_LINK_TYPES as readonly string[]).includes(type)) return { error: 'type' }
  const res = await insertConstellationRelation({ source_id: from, target_id: to, relation_type: type })
  if ('error' in res) return { error: res.error }
  revalidatePath('/atelier/constellation')
  return { ok: true }
}
