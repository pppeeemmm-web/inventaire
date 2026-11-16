'use server'

// Overview counts over the WHOLE catalogue (TODO 18 « pipeline pulse on the server », 2026-11-16).
// The Overview counted the works loaded in the browser: the first 50 until the background load
// finished (~9 s dev, longer live). This read sends back only the totals. Read only; team guard.

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { computeOverviewCounts, OVERVIEW_COUNT_SELECT, type OverviewCountRow, type OverviewCounts } from '@/lib/atelier/overview-counts'

/** Keyset pages under PostgREST's 1 000-row cap; stops after 20 pages (18 000 works). */
const PAGE = 900

export async function getOverviewCatalogueCounts(): Promise<OverviewCounts | null> {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return null

  const rows: OverviewCountRow[] = []
  let before: number | null = null
  for (let i = 0; i < 20; i++) {
    let q = supabase
      .from('Oeuvres')
      .select(OVERVIEW_COUNT_SELECT)
      .is('deleted_at', null)
      .order('OeuvreID', { ascending: false })
      .limit(PAGE)
    if (before != null) q = q.lt('OeuvreID', before)
    const { data, error } = await q
    if (error) {
      await logError('getOverviewCatalogueCounts failed', error, { source: 'getOverviewCatalogueCounts' })
      return null
    }
    const page = (data ?? []) as unknown as OverviewCountRow[]
    rows.push(...page)
    if (page.length < PAGE) return computeOverviewCounts(rows, new Date().getFullYear())
    before = page[page.length - 1]!.OeuvreID
  }
  return null
}
