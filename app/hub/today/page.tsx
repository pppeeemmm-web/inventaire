// R2 « Aujourd'hui » — the light phone route (docs/design/2026-11-17/PhoneToday.notes.md, Speed first).
// Server-rendered, outside the Atelier shell: no Overview bootstrap, no catalogue, no 1.8 MB shell JS.
// Streaming: the header and the input bar (TodayFrame) go out at once; every query starts here in
// parallel and each section streams in when its own data is ready — the slow « À revoir » read
// (1.4–1.9 s in the 2026-11-17 baseline) no longer holds back the rest. Also served at /hub.
import { Suspense } from 'react'
import { getFieldPulseData } from '@/app/atelier/field-inbox/data'
import { getSeeAgain } from '@/app/atelier/see-again/actions'
import { getJournalDayExtras } from '@/app/atelier/(portal)/journal/entry-actions'
import { listWorkSessionJournal, type WorkSessionJournalRow } from '@/app/atelier/session/actions'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import {
  TodayEntries,
  TodayFrame,
  TodayLoadError,
  TodayPulse,
  TodaySeeAgain,
  TodaySkeleton,
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

export default function TodayPage() {
  const day = todayCalendarDayInParis()
  // All four reads start now, together; no section waits on another.
  const pulse = settle(getFieldPulseData())
  const seeAgain = settle(getSeeAgain())
  const extras = settle(getJournalDayExtras(day))
  const sessions = settle(listWorkSessionJournal(20, { skipReconcile: true }))

  return (
    <TodayFrame day={day}>
      <Suspense fallback={<TodaySkeleton rows={1} />}>
        <SummarySection extras={extras} sessions={sessions} day={day} />
      </Suspense>
      <Suspense fallback={<TodaySkeleton rows={1} />}>
        <PulseSection pulse={pulse} />
      </Suspense>
      <Suspense fallback={<TodaySkeleton rows={2} />}>
        <SeeAgainSection seeAgain={seeAgain} />
      </Suspense>
      <Suspense fallback={<TodaySkeleton rows={2} />}>
        <WorksSection sessions={sessions} day={day} />
      </Suspense>
      <Suspense fallback={<TodaySkeleton rows={3} />}>
        <EntriesSection extras={extras} />
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

async function PulseSection({ pulse }: { pulse: Promise<Awaited<ReturnType<typeof getFieldPulseData>> | { error: string }> }) {
  const p = await pulse
  return 'error' in p ? null : <TodayPulse metrics={p.metrics} />
}

async function SeeAgainSection({ seeAgain }: { seeAgain: Promise<Awaited<ReturnType<typeof getSeeAgain>> | { error: string }> }) {
  const r = await seeAgain
  return 'error' in r ? null : <TodaySeeAgain seeAgain={r} />
}

async function WorksSection({ sessions, day }: { sessions: Promise<Sessions>; day: string }) {
  const s = await sessions
  return Array.isArray(s) ? <TodayWorks works={worksOfDay(s, day)} /> : <TodayLoadError />
}

async function EntriesSection({ extras }: { extras: Promise<Extras> }) {
  const x = await extras
  return 'error' in x ? <TodayLoadError /> : <TodayEntries entries={x.entries.filter((e) => !e.hidden)} />
}
