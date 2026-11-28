'use server'

// Year pass (week-1 report, docs/agent/reports/2026-11-28_system-overview.md §3.1; Pem « go year pass », 2026-11-28).
// Writes `Oeuvres."Année"` (YYYY-01-01, read with `yearOf()`), admin only like the other direct edits to an existing
// work (production-actions.ts), and stamps edited_at / edited_by like saveWork (an open card without a base is then
// refused, never silently overwritten). A stale check on the value the screen read: the year is written only if it is
// still `expect` (null = still empty) — else `unchanged`, never « ok ». The work card's rule holds here too: a year
// earlier than the recorded start of a « new » work not yet finished clears that automatic start (owner 2026-11-23,
// saveWork). `oeuvre_versions` keeps the history (trigger). « c. » waits for the « c. » design (TODO §1).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

type Result = { ok: true; year: number | null } | { error: 'oeuvre_id' | 'year' | 'admin_only' | 'unchanged' | 'failed' }

/** Same bounds as setProductionOrigin's found year: 1900 → this year in Paris. */
const MIN_YEAR = 1900

export async function setWorkYear(oeuvreId: number, year: number | null, expect: number | null): Promise<Result> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'oeuvre_id' }
  const max = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 4))
  const valid = (y: number | null) => y === null || (Number.isInteger(y) && y >= MIN_YEAR && y <= max)
  if (!valid(year) || !valid(expect)) return { error: 'year' }

  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'admin_only' }
  const { data: { user } } = await supabase.auth.getUser()

  const { data: cur } = await supabase
    .from('Oeuvres')
    .select('production_origin, production_started_on, production_completed_on')
    .eq('OeuvreID', oeuvreId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!cur) return { error: 'unchanged' }
  const patch: Record<string, unknown> = { Année: year === null ? null : `${year}-01-01`, edited_by: user?.id ?? null, edited_at: new Date().toISOString() }
  const startedYear = cur.production_started_on && /^\d{4}/.test(cur.production_started_on) ? Number(cur.production_started_on.slice(0, 4)) : null
  if (year !== null && startedYear !== null && year < startedYear && cur.production_origin === 'new' && !cur.production_completed_on) {
    patch.production_origin = null
    patch.production_started_on = null
  }

  let q = supabase.from('Oeuvres').update(patch).eq('OeuvreID', oeuvreId).is('deleted_at', null)
  q = expect === null ? q.is('Année', null) : q.eq('Année', `${expect}-01-01`)
  const { data, error } = await q.select('OeuvreID')
  if (error) {
    await logError('setWorkYear failed', error, { source: 'works.setWorkYear', metadata: { oeuvreId } })
    return { error: 'failed' }
  }
  if (!data?.length) return { error: 'unchanged' }
  // The public /works page is cached 15 min and sorts by year (principle 6 allows this one, not /atelier).
  revalidatePath('/works')
  return { ok: true, year }
}
