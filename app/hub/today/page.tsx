// R2 « Aujourd'hui » v1 — the light phone route (docs/design/2026-11-17/PhoneToday.notes.md, Speed first).
// Server-rendered, outside the Atelier shell: no Overview bootstrap, no catalogue, no 1.8 MB shell JS.
// The day's data loads in parallel here, instead of the Journal tab's chain of client server calls.
import { getFieldPulseData } from '@/app/atelier/field-inbox/data'
import { getSeeAgain } from '@/app/atelier/see-again/actions'
import { getJournalDayExtras } from '@/app/atelier/(portal)/journal/entry-actions'
import { listWorkSessionJournal } from '@/app/atelier/session/actions'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { TodayClient, type TodayWork } from '@/components/hub/TodayClient'

export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  const day = todayCalendarDayInParis()
  const [pulse, seeAgain, extras, sessions] = await Promise.all([
    getFieldPulseData(),
    getSeeAgain(),
    getJournalDayExtras(day),
    listWorkSessionJournal(20, { skipReconcile: true }),
  ])

  const seen = new Set<number>()
  const works: TodayWork[] = []
  for (const row of sessions) {
    if (row.calendar_day !== day) continue
    for (const item of row.items) {
      if (item.oeuvre_id == null || seen.has(item.oeuvre_id)) continue
      seen.add(item.oeuvre_id)
      works.push({ id: item.oeuvre_id, title: item.oeuvre_title, thumb: item.work_thumb })
    }
  }

  const ok = !('error' in extras)
  return (
    <TodayClient
      day={day}
      metrics={pulse.metrics}
      seeAgain={'error' in seeAgain ? null : seeAgain}
      entries={ok ? extras.entries.filter((e) => !e.hidden) : []}
      voiceCount={ok ? extras.voices.length : 0}
      works={works}
      partialError={!ok || 'error' in seeAgain}
    />
  )
}
