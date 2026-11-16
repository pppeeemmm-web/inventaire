'use server'

// Atelier page open (TODO 18, owner GO 2026-11-16): the frame's background reads (lookups, Journal +
// Kaizen badges, contact conflicts) and the Overview's own reads (See again, reminders) went out as
// separate Server Actions, one after another. These are the single reads they make when the page
// opens; consumers take their slice via `lib/atelier/open-reads.ts`. Reads only; each action keeps
// its guard. Catalogue chunks are not here (TODO 19); the Overview's counts are (one small read, totals only).

import { fetchAtelierShellPostPaint } from '@/app/atelier/atelier-data-actions'
import { countTeamActivitySince } from '@/app/atelier/team-activity-actions'
import { kaizenUnseenCounts } from '@/app/atelier/(portal)/kaizen/actions'
import { fetchContactConflicts } from '@/app/atelier/(portal)/contacts/conflicts-actions'
import { getSeeAgain } from '@/app/atelier/see-again/actions'
import { listUnreadSuiviReminders } from '@/app/atelier/reminders-actions'
import { getOverviewCatalogueCounts } from '@/app/atelier/overview-stats-actions'
import {
  OVERVIEW_REMINDER_LIMIT,
  overviewOpenKey,
  shellOpenKey,
  type OpenReadBundle,
} from '@/lib/atelier/open-read-keys'
import { runOpenReads } from '@/lib/atelier/open-read-server'

const overviewJobs = (): [string, () => Promise<unknown>][] => [
  [overviewOpenKey.seeAgain, () => getSeeAgain()],
  [overviewOpenKey.reminders, () => listUnreadSuiviReminders(OVERVIEW_REMINDER_LIMIT)],
  [overviewOpenKey.counts, () => getOverviewCatalogueCounts()],
]

/** The frame's reads on page open; with `overview`, the Overview tab's too (page opened on Overview). */
export async function loadAtelierShellOpen(opts: { since: string; overview: boolean }): Promise<OpenReadBundle> {
  const jobs: [string, () => Promise<unknown>][] = [
    [shellOpenKey.postPaint, () => fetchAtelierShellPostPaint()],
    [shellOpenKey.teamActivity(opts.since), () => countTeamActivitySince(opts.since)],
    [shellOpenKey.kaizen, () => kaizenUnseenCounts()],
    [shellOpenKey.conflicts, () => fetchContactConflicts()],
  ]
  if (opts.overview) jobs.push(...overviewJobs())
  return runOpenReads(jobs)
}

/** Overview reached from another tab: its two reads in one call. */
export async function loadOverviewOpen(): Promise<OpenReadBundle> {
  return runOpenReads(overviewJobs())
}
