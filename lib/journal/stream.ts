import 'server-only'

// The Journal stream (design 2026-11-22, Step A): pages of days that hold anything, newest first, each
// with its cards (lib/journal/day-read.ts) and its summary counts. Also the « Mois » / « Années » lines.
// Counts come from the database (`journal_scale`, supabase/sql/journal_scale.sql); works photographed in
// field sessions are added here (their day lives in the session payload).

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { listWorkSessionJournal } from '@/app/atelier/session/actions'
import type { JournalDayExtras } from '@/app/atelier/(portal)/journal/entry-actions'
import { JOURNAL_DAY_RE, readJournalDays } from '@/lib/journal/day-read'
import { calendarDayInParisFromIso, todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { latestCorrections } from '@/lib/journal-corrections'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type JournalGrain = 'day' | 'month' | 'year'

export type JournalScaleRow = {
  /** YYYY-MM-DD: the day, or the first day of the month / year. */
  bucket: string
  entries: number
  voices: number
  photos: number
  remarks: number
  creation: number
  proposals: number
  /** Distinct works photographed in field sessions (day grain only; 0 otherwise). */
  sessionWorks: number
  /** Idea lines (one per idea and kind of change per day, `concept_change`; merged here, not counted by `journal_scale`). */
  ideas?: number
  /** Up to 4 works photographed that day, for the « Mois » line (day grain only). */
  works?: JournalSessionWork[]
}

export type JournalSessionWork = { id: number | null; title: string | null; thumb: string | null; key: string }

export type JournalStreamDay = {
  day: string
  counts: JournalScaleRow
  extras: JournalDayExtras
  /** Works photographed that day (field sessions), each once; items not yet tied to a work keep their own key. */
  sessionWorks: JournalSessionWork[]
}

export type JournalStreamPage = {
  isAdmin: boolean
  today: string
  days: JournalStreamDay[]
  /** Pass as `before` for the next page; null when nothing older exists. */
  next: string | null
}

const zero = (bucket: string): JournalScaleRow => ({ bucket, entries: 0, voices: 0, photos: 0, remarks: 0, creation: 0, proposals: 0, sessionWorks: 0 })

function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}

async function scale(supabase: Supabase, before: string | null, limit: number, grain: JournalGrain): Promise<JournalScaleRow[] | null> {
  const { data, error } = await supabase.rpc('journal_scale' as never, { p_before: before, p_limit: limit, p_grain: grain } as never)
  if (error) {
    await logError('journal_scale failed', error, { source: 'journal.stream' })
    return null
  }
  return ((data ?? []) as Array<Omit<JournalScaleRow, 'sessionWorks'>>).map((r) => ({ ...r, bucket: String(r.bucket).slice(0, 10), sessionWorks: 0 }))
}

/** Field-session works by Paris day (the last 200 sessions: the same bound as the Journal today). */
async function sessionWorksByDay(): Promise<Map<string, JournalSessionWork[]>> {
  const rows = await listWorkSessionJournal(200, { skipReconcile: true }).catch(() => [])
  const out = new Map<string, JournalSessionWork[]>()
  const seen = new Map<string, Set<number>>()
  for (const row of rows) {
    const day = row.calendar_day
    if (!day || !JOURNAL_DAY_RE.test(day)) continue
    const list = out.get(day) ?? []
    const ids = seen.get(day) ?? new Set<number>()
    for (const item of row.items) {
      if (item.oeuvre_id == null) {
        list.push({ id: null, title: item.title_hint?.trim() || null, thumb: null, key: item.id })
        continue
      }
      if (ids.has(item.oeuvre_id)) continue
      ids.add(item.oeuvre_id)
      list.push({ id: item.oeuvre_id, title: item.oeuvre_title, thumb: item.work_thumb, key: `w${item.oeuvre_id}` })
    }
    out.set(day, list)
    seen.set(day, ids)
  }
  return out
}

/**
 * The next `count` days holding anything, strictly before `before` (null = from today, today included
 * and always present). Today is listed even when empty: the phone opens on it.
 */
export async function readJournalStreamPage(before: string | null, count = 5): Promise<JournalStreamPage | { error: string }> {
  if (before != null && !JOURNAL_DAY_RE.test(before)) return { error: 'day' }
  const n = Math.min(Math.max(count, 1), 14)
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    { data: adminFlag },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc('is_admin')])
  if (!user) return { error: 'auth' }
  const isAdmin = adminFlag === true
  const today = todayCalendarDayInParis()
  const upper = before ?? shiftDay(today, 1)

  const [rows, sessions, hiddenDays, changeDays, ideaDays] = await Promise.all([
    scale(supabase, upper, n, 'day'),
    sessionWorksByDay(),
    // An admin also sees hidden entries (dimmed, to unhide them): their days are paged too (`journal_scale` counts visible cards only).
    isAdmin ? adminHiddenDays(supabase, upper, n) : Promise.resolve([] as string[]),
    // Days whose only trace is a work changed (Pem 2026-11-23: « show them »); versions are admin-only by RLS.
    isAdmin ? adminChangeDays(supabase, upper, n) : Promise.resolve([] as string[]),
    // Days whose only trace is an idea moved, reworked or grafted (Idées 2026-11-23; team reads `concept_change`).
    ideaChangeDays(supabase, upper, n),
  ])
  const byDay = new Map<string, JournalScaleRow>()
  if (rows) for (const r of rows) byDay.set(r.bucket, r)
  for (const [day, works] of sessions) {
    if (day >= upper) continue
    const r = byDay.get(day) ?? zero(day)
    r.sessionWorks = works.filter((w) => w.id != null).length || works.length
    byDay.set(day, r)
  }
  for (const day of [...hiddenDays, ...changeDays, ...ideaDays]) if (!byDay.has(day)) byDay.set(day, zero(day))
  if (!before && !byDay.has(today)) byDay.set(today, zero(today))
  let days = [...byDay.keys()].sort((a, b) => b.localeCompare(a)).slice(0, n)
  // The count read failed: fall back to the 30 days before `upper`. No loop: when they hold nothing
  // (or when this page has fewer days than asked) there is no next page.
  if (!rows) {
    const from = shiftDay(upper, -30)
    const extras = await readJournalDays(supabase, { userId: user.id, isAdmin }, from, shiftDay(upper, -1), { folds: true })
    if ('error' in extras) return extras
    const found = [...extras]
      .filter(([day, x]) => (!before && day === today) || x.entries.length || x.voices.length || x.inspirations.length || x.remarks.length || x.creation.length || x.changes.length || (x.ideaChanges ?? []).length || sessions.has(day))
      .map(([day]) => day)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, n)
    days = found
    return {
      isAdmin,
      today,
      days: days.map((day) => ({
        day,
        counts: byDay.get(day) ?? zero(day),
        extras: extras.get(day) ?? { isAdmin, entries: [], changes: [], voices: [], creation: [], conceptOptions: [], inspirations: [], remarks: [] },
        sessionWorks: sessions.get(day) ?? [],
      })),
      next: days.length === n ? days[days.length - 1] : null,
    }
  }
  if (!days.length) return { isAdmin, today, days: [], next: null }

  const from = days[days.length - 1]
  const to = days[0]
  const extras = await readJournalDays(supabase, { userId: user.id, isAdmin }, from, to, { folds: true })
  if ('error' in extras) return extras
  const empty: JournalDayExtras = { isAdmin, entries: [], changes: [], voices: [], creation: [], conceptOptions: [], inspirations: [], remarks: [] }
  // A day listed by its counts or its traces but with nothing to draw (e.g. only work changes on fields the
  // Journal does not compare) is left out — never an empty day in the stream (today excepted).
  const shown = days
    .map((day) => ({ day, counts: byDay.get(day) ?? zero(day), extras: extras.get(day) ?? empty, sessionWorks: sessions.get(day) ?? [] }))
    .filter((d) => {
      if (d.day === today) return true
      const x = d.extras
      return x.entries.length || x.voices.length || x.inspirations.length || x.remarks.length || x.creation.length || x.changes.length || (x.ideaChanges ?? []).length || d.sessionWorks.length
    })
  return { isAdmin, today, days: shown, next: days.length < n ? null : from }
}

/** Works linked (validated) from the entries of the days in `rows`, by day. */
async function linkedWorksByDay(supabase: Supabase, rows: JournalScaleRow[]): Promise<Map<string, JournalSessionWork[]>> {
  const out = new Map<string, JournalSessionWork[]>()
  const withEntries = rows.filter((r) => r.entries > 0 || r.photos > 0)
  if (!withEntries.length) return out
  const from = withEntries[withEntries.length - 1].bucket
  const to = withEntries[0].bucket
  const { data: entries } = await supabase
    .from('journal_entry')
    .select('id, event_on')
    .gte('event_on', from)
    .lte('event_on', to)
    .is('hidden_at', null)
    .is('corrects_id', null)
    .order('event_on', { ascending: false })
    .limit(2000)
  const dayOf = new Map((entries ?? []).map((e) => [Number(e.id), String(e.event_on)]))
  if (!dayOf.size) return out
  const { data: links } = await supabase
    .from('journal_entry_link')
    .select('entry_id, oeuvre_id')
    .in('entry_id', [...dayOf.keys()])
    .not('oeuvre_id', 'is', null)
    .not('validated_at', 'is', null)
    .limit(4000)
  const ids = [...new Set((links ?? []).map((l) => Number(l.oeuvre_id)))]
  if (!ids.length) return out
  const { data: works } = await supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').in('OeuvreID', ids.slice(0, 500))
  const info = new Map((works ?? []).map((w) => [w.OeuvreID, w]))
  for (const l of links ?? []) {
    const day = dayOf.get(Number(l.entry_id))
    const w = info.get(Number(l.oeuvre_id))
    if (!day || !w) continue
    const list = out.get(day) ?? []
    if (!list.some((x) => x.id === w.OeuvreID)) list.push({ id: w.OeuvreID, title: w.Titre ?? null, thumb: w.txtImageNameLink ?? null, key: `w${w.OeuvreID}` })
    out.set(day, list)
  }
  return out
}

/** Days (before `upper`, newest first) holding a hidden entry — admins only by RLS on hidden rows. */
async function adminHiddenDays(supabase: Supabase, upper: string, n: number): Promise<string[]> {
  const { data } = await supabase
    .from('journal_entry')
    .select('event_on')
    .not('hidden_at', 'is', null)
    .is('corrects_id', null)
    .lt('event_on', upper)
    .order('event_on', { ascending: false })
    .limit(n * 20)
  return [...new Set((data ?? []).map((r) => String(r.event_on)))].slice(0, n)
}

/**
 * Idea lines per day / month / year before `before` (Paris time): one per idea and kind of change per day, as the
 * day shows them. Read from `concept_change` (team reads); the newest 2000 changes are enough for the scale views.
 */
async function ideaLinesByBucket(supabase: Supabase, grain: JournalGrain, before: string | null): Promise<Map<string, number>> {
  let q = supabase.from('concept_change').select('concept_id, what, changed_at').order('changed_at', { ascending: false }).limit(2000)
  if (before) q = q.lt('changed_at', `${before}T03:00:00Z`)
  const { data, error } = await q
  if (error) {
    await logError('idea lines for the scale failed', error, { source: 'journal.readJournalScale' })
    return new Map()
  }
  const seen = new Set<string>()
  const out = new Map<string, number>()
  for (const r of data ?? []) {
    const day = calendarDayInParisFromIso(String(r.changed_at))
    if (before && day >= before) continue
    const k = `${day}:${r.concept_id}:${r.what}`
    if (seen.has(k)) continue
    seen.add(k)
    const b = grain === 'day' ? day : grain === 'month' ? `${day.slice(0, 7)}-01` : `${day.slice(0, 4)}-01-01`
    out.set(b, (out.get(b) ?? 0) + 1)
  }
  return out
}

/** Paris days (before `upper`, newest first) on which an idea was planted, moved, reworked or grafted (team reads). */
async function ideaChangeDays(supabase: Supabase, upper: string, n: number): Promise<string[]> {
  const { data } = await supabase
    .from('concept_change')
    .select('changed_at')
    .lt('changed_at', `${upper}T03:00:00Z`)
    .order('changed_at', { ascending: false })
    .limit(1000)
  const days: string[] = []
  for (const r of data ?? []) {
    const day = calendarDayInParisFromIso(String(r.changed_at))
    if (day >= upper || days.includes(day)) continue
    days.push(day)
    if (days.length >= n) break
  }
  return days
}

/** Paris days (before `upper`, newest first) on which a work was changed — admins only by RLS. */
async function adminChangeDays(supabase: Supabase, upper: string, n: number): Promise<string[]> {
  // `upper` is a Paris day; the UTC bound is loose by a few hours and the rows are filtered by Paris day.
  const { data } = await supabase
    .from('oeuvre_versions')
    .select('changed_at')
    .lt('changed_at', `${upper}T03:00:00Z`)
    .order('changed_at', { ascending: false })
    .limit(4000)
  const days: string[] = []
  for (const r of data ?? []) {
    const day = calendarDayInParisFromIso(String(r.changed_at))
    if (day >= upper || days.includes(day)) continue
    days.push(day)
    if (days.length >= n) break
  }
  return days
}

/** One exact day with its cards and counts — the stream reads a day again after an action on it. */
export async function readJournalStreamDay(day: string): Promise<JournalStreamPage | { error: string }> {
  if (!JOURNAL_DAY_RE.test(day)) return { error: 'day' }
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    { data: adminFlag },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc('is_admin')])
  if (!user) return { error: 'auth' }
  const isAdmin = adminFlag === true
  const [extras, rows, sessions] = await Promise.all([
    readJournalDays(supabase, { userId: user.id, isAdmin }, day, day, { folds: true }),
    scale(supabase, shiftDay(day, 1), 1, 'day'),
    sessionWorksByDay(),
  ])
  if ('error' in extras) return extras
  const counts = rows?.find((r) => r.bucket === day) ?? zero(day)
  const works = sessions.get(day) ?? []
  counts.sessionWorks = works.filter((w) => w.id != null).length || works.length
  const x = extras.get(day) as JournalDayExtras
  return { isAdmin, today: todayCalendarDayInParis(), days: [{ day, counts, extras: x, sessionWorks: works }], next: null }
}

/** « Mois » (one line per day) and « Années » (one line per month): counts only, newest first. */
export async function readJournalScale(grain: JournalGrain, before: string | null, limit: number): Promise<JournalScaleRow[] | { error: string }> {
  if (before != null && !JOURNAL_DAY_RE.test(before)) return { error: 'day' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const rows = await scale(supabase, before, Math.min(Math.max(limit, 1), 400), grain)
  if (!rows) return { error: 'scale' }
  const ideas = await ideaLinesByBucket(supabase, grain, before)
  if (grain !== 'day') {
    const byBucket = new Map(rows.map((r) => [r.bucket, r]))
    const oldestB = rows.length ? rows[rows.length - 1].bucket : null
    for (const [b, n] of ideas) {
      if (oldestB && b < oldestB && rows.length >= limit) continue
      const r = byBucket.get(b) ?? zero(b)
      r.ideas = n
      byBucket.set(b, r)
    }
    return [...byBucket.values()].sort((a, b) => b.bucket.localeCompare(a.bucket)).slice(0, limit)
  }
  const [sessions, linked] = await Promise.all([sessionWorksByDay(), linkedWorksByDay(supabase, rows)])
  const byDay = new Map(rows.map((r) => [r.bucket, r]))
  const oldest = rows.length ? rows[rows.length - 1].bucket : null
  for (const [day, works] of sessions) {
    if (before && day >= before) continue
    if (oldest && day < oldest && rows.length >= limit) continue
    const r = byDay.get(day) ?? zero(day)
    r.sessionWorks = works.filter((w) => w.id != null).length || works.length
    r.works = works.filter((w) => w.id != null).slice(0, 4)
    byDay.set(day, r)
  }
  for (const [day, n] of ideas) {
    if (oldest && day < oldest && rows.length >= limit) continue
    const r = byDay.get(day) ?? zero(day)
    r.ideas = n
    byDay.set(day, r)
  }
  // Works linked from that day's notes fill the line's pictures after the photographed ones.
  for (const [day, works] of linked) {
    const r = byDay.get(day)
    if (!r) continue
    const have = new Set((r.works ?? []).map((w) => w.id))
    r.works = [...(r.works ?? []), ...works.filter((w) => !have.has(w.id))].slice(0, 4)
  }
  return [...byDay.values()].sort((a, b) => b.bucket.localeCompare(a.bucket)).slice(0, limit)
}

export type JournalWorkMention = { day: string; kind: 'entry' | 'remark'; snippet: string }
export type JournalWorkMentions = { id: number; title: string | null; thumb: string | null; mentions: JournalWorkMention[] }

/** The desk rail: a work's picture and every day that mentions it (validated entry links, remarks), newest first. */
export async function readWorkMentions(workId: number): Promise<JournalWorkMentions | { error: string }> {
  if (!Number.isInteger(workId) || workId <= 0) return { error: 'work' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const [workRes, linksRes, remarksRes] = await Promise.all([
    supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').eq('OeuvreID', workId).maybeSingle(),
    supabase.from('journal_entry_link').select('entry_id').eq('oeuvre_id', workId).not('validated_at', 'is', null).order('created_at', { ascending: false }).limit(200),
    supabase.from('note_line').select('created_at, body').eq('oeuvre_id', workId).is('discarded_at', null).order('created_at', { ascending: false }).limit(50),
  ])
  const entryIds = (linksRes.data ?? []).map((l) => Number(l.entry_id))
  const [entriesRes, fixesRes] = entryIds.length
    ? await Promise.all([
        supabase.from('journal_entry').select('id, event_on, body').in('id', entryIds).is('hidden_at', null).is('corrects_id', null),
        supabase.from('journal_entry').select('corrects_id, body, created_at, hidden_at').in('corrects_id', entryIds),
      ])
    : [{ data: [] as Array<{ id: number; event_on: string; body: string }> }, { data: [] as Array<{ corrects_id: number | null; body: string; created_at: string; hidden_at: string | null }> }]
  const fixes = latestCorrections(fixesRes.data ?? [])
  const snip = (text: string) => (text.length > 90 ? `${text.slice(0, 90)}…` : text)
  const mentions: JournalWorkMention[] = [
    ...(entriesRes.data ?? []).map((e) => ({ day: String(e.event_on), kind: 'entry' as const, snippet: snip(fixes.get(Number(e.id)) ?? e.body) })),
    ...(remarksRes.data ?? []).map((n) => ({ day: calendarDayInParisFromIso(n.created_at), kind: 'remark' as const, snippet: snip(n.body) })),
  ].sort((a, b) => b.day.localeCompare(a.day))
  const w = workRes.data
  return { id: workId, title: w?.Titre ?? null, thumb: w?.txtImageNameLink ?? null, mentions: mentions.slice(0, 30) }
}
