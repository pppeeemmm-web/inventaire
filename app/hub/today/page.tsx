// R2 « Aujourd'hui » — the light phone route (docs/design/2026-11-17/PhoneToday.notes.md, Speed first).
// Server-rendered, outside the Atelier shell: no Overview bootstrap, no catalogue, no 1.8 MB shell JS.
// Streaming: the header and the input bar (TodayFrame) go out at once; every query starts here in
// parallel and each section streams in when its own data is ready — the slow « À revoir » read
// (1.4–1.9 s in the 2026-11-17 baseline) no longer holds back the rest. Also served at /hub.
// `?day=YYYY-MM-DD` shows another day (‹ › in the header; never after today). « À revoir » and the
// pulse line (Fil count, field inbox) belong to today only and are not read for another day.
// The two folds (« Attributs d'œuvres modifiés », « Création ») are read only when opened.
import { Suspense } from 'react'
import { getFieldPulseData } from '@/app/atelier/field-inbox/data'
import { getSeeAgain } from '@/app/atelier/see-again/actions'
import { getJournalDayExtras } from '@/app/atelier/(portal)/journal/entry-actions'
import { listWorkSessionJournal, type WorkSessionJournalRow } from '@/app/atelier/session/actions'
import { countFil } from '@/app/atelier/fil/actions'
import { worksPhotographedOn } from './photographed'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { TodayCachedNote } from '@/components/hub/TodayCachedNote'
import {
  TodayEntries,
  TodayFolds,
  TodayFrame,
  TodayLoadError,
  TodayPhotographed,
  TodayPulse,
  TodaySeeAgain,
  TodaySkeleton,
  TodaySuggestions,
  TodaySummary,
  TodayWorks,
  type TodayWork,
} from '@/components/hub/TodayClient'

export const dynamic = 'force-dynamic'

/** Never rejects: a failed read shows as a short line, not a broken page. */
function settle<T>(p: Promise<T>): Promise<T | { error: string }> {
  return p.catch((e: unknown) => ({ error: e instanceof Error ? e.message : 'load' }))
}

function worksOfDay(rows: WorkSessionJournalRow[], day: string): TodayWork[] {
  const seen = new Set<number>()
  const works: TodayWork[] = []
  for (const row of rows) {
    if (row.calendar_day !== day) continue
    for (const item of row.items) {
      if (item.oeuvre_id == null || seen.has(item.oeuvre_id)) continue
      seen.add(item.oeuvre_id)
      works.push({ id: item.oeuvre_id, title: item.oeuvre_title, thumb: item.work_thumb })
    }
  }
  return works
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** The day asked for in `?day=`, or today: a malformed day, an impossible date or a future day falls back to today. */
function requestedDay(raw: string | string[] | undefined, today: string): string {
  const day = Array.isArray(raw) ? raw[0] : raw
  if (!day || !DAY_RE.test(day)) return today
  const ms = Date.parse(`${day}T12:00:00Z`)
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) return today
  return day > today ? today : day
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ day?: string | string[] }> }) {
  const today = todayCalendarDayInParis()
  const day = requestedDay((await searchParams).day, today)
  const isToday = day === today
  // All reads start now, together; no section waits on another. Today-only reads are skipped for another day.
  const pulse = isToday ? settle(getFieldPulseData()) : null
  // The Fil count (R1 step 6): null for a non-admin or a failed read — left off the pulse line.
  const fil = isToday ? countFil().catch(() => null) : null
  const seeAgain = isToday ? settle(getSeeAgain()) : null
  // Folds skipped here: TodayFolds reads them when one opens.
  const extras = settle(getJournalDayExtras(day, { folds: false }))
  const sessions = settle(listWorkSessionJournal(20, { skipReconcile: true }))
  // Another day only: works whose photo file name carries that date (the trace before work sessions).
  const photographed = isToday ? null : settle(worksPhotographedOn(day))

  // `key={day}`: moving to another day shows fresh skeletons instead of the previous day's sections.
  return (
    <TodayFrame day={day} today={today}>
      {/* Render time: the phone's cached copy (app/sw.ts) shows its age, then refreshes. */}
      <TodayCachedNote renderedAt={Date.now()} />
      <Suspense key={`s-${day}`} fallback={<TodaySkeleton rows={1} />}>
        <SummarySection extras={extras} sessions={sessions} day={day} />
      </Suspense>
      {pulse && fil ? (
        <Suspense fallback={<TodaySkeleton rows={1} />}>
          <PulseSection pulse={pulse} fil={fil} />
        </Suspense>
      ) : null}
      {seeAgain ? (
        <Suspense fallback={<TodaySkeleton rows={2} />}>
          <SeeAgainSection seeAgain={seeAgain} />
        </Suspense>
      ) : null}
      <Suspense key={`w-${day}`} fallback={<TodaySkeleton rows={2} />}>
        <WorksSection sessions={sessions} day={day} isToday={isToday} />
      </Suspense>
      {photographed ? (
        <Suspense key={`p-${day}`} fallback={null}>
          <PhotographedSection photographed={photographed} />
        </Suspense>
      ) : null}
      <Suspense key={`e-${day}`} fallback={<TodaySkeleton rows={3} />}>
        <EntriesSection extras={extras} day={day} isToday={isToday} />
      </Suspense>
      <Suspense key={`x-${day}`} fallback={null}>
        <SuggestionsSection extras={extras} />
      </Suspense>
      <Suspense key={`f-${day}`} fallback={null}>
        <FoldsSection extras={extras} day={day} />
      </Suspense>
    </TodayFrame>
  )
}

type Extras = Awaited<ReturnType<typeof getJournalDayExtras>> | { error: string }
type Sessions = WorkSessionJournalRow[] | { error: string }

async function SummarySection({ extras, sessions, day }: { extras: Promise<Extras>; sessions: Promise<Sessions>; day: string }) {
  const [x, s] = await Promise.all([extras, sessions])
  const ok = !('error' in x)
  return (
    <TodaySummary
      entries={ok ? x.entries.filter((e) => !e.hidden).length : 0}
      works={Array.isArray(s) ? worksOfDay(s, day).length : 0}
      voices={ok ? x.voices.length : 0}
    />
  )
}

async function PulseSection({
  pulse,
  fil,
}: {
  pulse: Promise<Awaited<ReturnType<typeof getFieldPulseData>> | { error: string }>
  fil: Promise<number | null>
}) {
  const [p, f] = await Promise.all([pulse, fil])
  return 'error' in p ? null : <TodayPulse metrics={p.metrics} fil={f} />
}

async function SeeAgainSection({ seeAgain }: { seeAgain: Promise<Awaited<ReturnType<typeof getSeeAgain>> | { error: string }> }) {
  const r = await seeAgain
  return 'error' in r ? null : <TodaySeeAgain seeAgain={r} />
}

async function WorksSection({ sessions, day, isToday }: { sessions: Promise<Sessions>; day: string; isToday: boolean }) {
  const s = await sessions
  return Array.isArray(s) ? <TodayWorks works={worksOfDay(s, day)} isToday={isToday} /> : <TodayLoadError />
}

async function EntriesSection({ extras, day, isToday }: { extras: Promise<Extras>; day: string; isToday: boolean }) {
  const x = await extras
  return 'error' in x ? <TodayLoadError /> : <TodayEntries entries={x.entries.filter((e) => !e.hidden)} day={day} isToday={isToday} />
}

async function PhotographedSection({ photographed }: { photographed: Promise<Awaited<ReturnType<typeof worksPhotographedOn>> | { error: string }> }) {
  const p = await photographed
  if ('error' in p) return <TodayLoadError />
  return p.works.length ? <TodayPhotographed works={p.works} more={p.more} /> : null
}

/** ✦ AI link suggestions of the day's visible entries (same data as the Journal); ✓ / ✕ for an admin. */
async function SuggestionsSection({ extras }: { extras: Promise<Extras> }) {
  const x = await extras
  if ('error' in x) return null
  const rows = x.entries.filter((e) => !e.hidden).flatMap((e) => e.proposals)
  return rows.length ? <TodaySuggestions rows={rows} canDecide={x.isAdmin} /> : null
}

/** Waits on the day's read only for `isAdmin` (the work-changes fold is admin only, as in the Journal). */
async function FoldsSection({ extras, day }: { extras: Promise<Extras>; day: string }) {
  const x = await extras
  return <TodayFolds day={day} showChanges={!('error' in x) && x.isAdmin} />
}
