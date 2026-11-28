'use server'

// Year pass (week-1 report, docs/agent/reports/2026-11-28_system-overview.md §3.1; Pem « go year pass », 2026-11-28).
// Writes only `Oeuvres."Année"` (YYYY-01-01, read with `yearOf()`), admin only like the other direct edits to an
// existing work (production-actions.ts). A stale check on the value the screen read: the year is written only if it is
// still `expect` (null = still empty), so a second phone or a card edit in between is never overwritten — it answers
// `unchanged`, never « ok ». `oeuvre_versions` keeps the history (trigger). « c. » waits for the « c. » design (TODO §1).

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

type Result = { ok: true; year: number | null } | { error: 'oeuvre_id' | 'year' | 'admin_only' | 'unchanged' | 'failed' }

const MIN_YEAR = 1950

export async function setWorkYear(oeuvreId: number, year: number | null, expect: number | null): Promise<Result> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'oeuvre_id' }
  const max = new Date().getFullYear()
  const valid = (y: number | null) => y === null || (Number.isInteger(y) && y >= MIN_YEAR && y <= max)
  if (!valid(year) || !valid(expect)) return { error: 'year' }

  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'admin_only' }
  const { data: { user } } = await supabase.auth.getUser()

  let q = supabase
    .from('Oeuvres')
    .update({ Année: year === null ? null : `${year}-01-01`, edited_by: user?.id ?? null, edited_at: new Date().toISOString() })
    .eq('OeuvreID', oeuvreId)
    .is('deleted_at', null)
  q = expect === null ? q.is('Année', null) : q.eq('Année', `${expect}-01-01`)
  const { data, error } = await q.select('OeuvreID')
  if (error) {
    await logError('setWorkYear failed', error, { source: 'works.setWorkYear', metadata: { oeuvreId } })
    return { error: 'failed' }
  }
  if (!data?.length) return { error: 'unchanged' }
  return { ok: true, year }
}
