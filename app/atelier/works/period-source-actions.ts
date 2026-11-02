'use server'

// Periods + source per work (owner 2026-11-02). Team reads and writes (RLS, like themes). A work's
// period is automatic from its year unless `work_period_override` has a row for it.

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import type { PeriodChoice, PeriodSourceData, WorkPeriod, WorkSource } from '@/lib/work-periods'

type Err = { error: string }
type Supa = Awaited<ReturnType<typeof createClient>>

const PAGE = 1000
const MAX_NAME = 120
const MIN_YEAR = 1900
const MAX_YEAR = 2200

async function signedIn(supabase: Supa): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user
}

export async function loadPeriodSourceData(): Promise<PeriodSourceData | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const [pRes, sRes, oRes] = await Promise.all([
    supabase.from('work_period').select('id, name, start_year, end_year').order('start_year'),
    supabase.from('work_source').select('id, name').order('name'),
    supabase.from('work_period_override').select('oeuvre_id, period_id').limit(20_000),
  ])
  if (pRes.error) return { error: pRes.error.message }
  if (sRes.error) return { error: sRes.error.message }
  if (oRes.error) return { error: oRes.error.message }
  const overrides: Record<number, number | null> = {}
  for (const r of oRes.data ?? []) overrides[r.oeuvre_id] = r.period_id
  const sourcesByWork: Record<number, number[]> = {}
  // Links can pass PostgREST's 1000-row page: read them page by page.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('work_source_link')
      .select('oeuvre_id, source_id')
      .order('oeuvre_id')
      .order('source_id')
      .range(from, from + PAGE - 1)
    if (error) return { error: error.message }
    for (const r of data ?? []) (sourcesByWork[r.oeuvre_id] ??= []).push(r.source_id)
    if (!data || data.length < PAGE) break
  }
  return {
    periods: (pRes.data ?? []) as WorkPeriod[],
    sources: (sRes.data ?? []) as WorkSource[],
    overrides,
    sourcesByWork,
  }
}

function cleanYear(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n >= MIN_YEAR && n <= MAX_YEAR ? n : null
}

export type PeriodInput = { id?: number; name: string; start_year: number; end_year: number | null }

export async function savePeriod(input: PeriodInput): Promise<{ ok: true; period: WorkPeriod } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const name = (input.name ?? '').trim().slice(0, MAX_NAME)
  if (!name) return { error: 'name' }
  const start = cleanYear(input.start_year)
  if (start == null) return { error: 'start_year' }
  const end = input.end_year == null ? null : cleanYear(input.end_year)
  if (input.end_year != null && end == null) return { error: 'end_year' }
  if (end != null && end < start) return { error: 'end_before_start' }
  const values = { name, start_year: start, end_year: end }
  const q =
    input.id != null
      ? supabase.from('work_period').update(values).eq('id', input.id)
      : supabase.from('work_period').insert(values)
  const { data, error } = await q.select('id, name, start_year, end_year').single()
  if (error || !data) return { error: error?.message ?? 'save' }
  return { ok: true, period: data as WorkPeriod }
}

/** Deleting a period also drops overrides pointing at it (cascade): those works go back to automatic. */
export async function deletePeriod(id: number): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const { error } = await supabase.from('work_period').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function saveSource(input: { id?: number; name: string }): Promise<{ ok: true; source: WorkSource } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const name = (input.name ?? '').trim().slice(0, MAX_NAME)
  if (!name) return { error: 'name' }
  const q =
    input.id != null
      ? supabase.from('work_source').update({ name }).eq('id', input.id)
      : supabase.from('work_source').insert({ name })
  const { data, error } = await q.select('id, name').single()
  if (error || !data) return { error: error?.code === '23505' ? 'duplicate' : (error?.message ?? 'save') }
  return { ok: true, source: data as WorkSource }
}

/** Deleting a source value removes it from every work (cascade). */
export async function deleteSource(id: number): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const { error } = await supabase.from('work_source').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function setWorkPeriod(oeuvreId: number, choice: PeriodChoice): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'bad_work' }
  if (choice === 'auto') {
    const { error } = await supabase.from('work_period_override').delete().eq('oeuvre_id', oeuvreId)
    if (error) return { error: error.message }
    return { ok: true }
  }
  const period_id = choice === 'none' ? null : choice
  if (period_id != null && !Number.isInteger(period_id)) return { error: 'bad_period' }
  const { error } = await supabase
    .from('work_period_override')
    .upsert({ oeuvre_id: oeuvreId, period_id, set_at: new Date().toISOString() }, { onConflict: 'oeuvre_id' })
  if (error) return { error: error.message }
  return { ok: true }
}

/** Replace a work's sources with `sourceIds`. */
export async function setWorkSources(oeuvreId: number, sourceIds: number[]): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return { error: 'bad_work' }
  const ids = [...new Set(sourceIds.filter((x) => Number.isInteger(x) && x > 0))]
  const { error: delErr } = await supabase
    .from('work_source_link')
    .delete()
    .eq('oeuvre_id', oeuvreId)
    .not('source_id', 'in', `(${ids.length ? ids.join(',') : '0'})`)
  if (delErr) return { error: delErr.message }
  if (ids.length) {
    const { error } = await supabase
      .from('work_source_link')
      .upsert(ids.map((source_id) => ({ oeuvre_id: oeuvreId, source_id })), { onConflict: 'oeuvre_id,source_id', ignoreDuplicates: true })
    if (error) {
      await logError('setWorkSources insert failed', error, { source: 'periods.setWorkSources', metadata: { oeuvreId } })
      return { error: error.message }
    }
  }
  return { ok: true }
}
