'use server'

// Periods + source per work (owner 2026-11-02). Team reads and writes (RLS, like themes). A work's
// period is automatic from its day / year unless `work_period_override` has a row for it.
// A3 (2026-11-14): periods carry dates (`start_on` / `end_on`), and each work may have the place it
// was made (`work_place` → `place`). Pem 2026-11-14: a period's place is every work's place unless the
// work has its own (read, never written — `effectivePlace`); places carry an address (`place.address`).
// Pem 2026-11-14: the single place became the « Création » history — dated lines, each with a place
// (`work_creation_step`, supabase/sql/work_creation_steps.sql); `work_place` is no longer read.

import { createClient } from '@/lib/supabase/server'
import { lookupGeocode } from '@/lib/geocode-nominatim'
import { logError } from '@/lib/error-reporter/server'
import { CREATION_KINDS, sortSteps, type CreationKind, type CreationStep, type DatePrecision, type PeriodChoice, type PeriodSourceData, type Place, type WorkPeriod, type WorkSource } from '@/lib/work-periods'

type Err = { error: string }
type Supa = Awaited<ReturnType<typeof createClient>>

const PAGE = 1000
const MAX_NAME = 120
const MIN_YEAR = 1900
const MAX_YEAR = 2200
const PERIOD_COLS = 'id, name, start_year, end_year, start_on, end_on, default_place_id'
const PLACE_COLS = 'id, name, address, town, country, latitude, longitude'
const STEP_COLS = 'id, oeuvre_id, on_date, date_precision, kind, place_id, note, work_session_id'
const MAX_STEP_NOTE = 500

async function signedIn(supabase: Supa): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return !!user
}

export async function loadPeriodSourceData(): Promise<PeriodSourceData | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const [pRes, sRes, oRes, plRes] = await Promise.all([
    supabase.from('work_period').select(PERIOD_COLS).order('start_on'),
    supabase.from('work_source').select('id, name').order('name'),
    supabase.from('work_period_override').select('oeuvre_id, period_id').limit(20_000),
    supabase.from('place').select(PLACE_COLS).order('name'),
  ])
  if (pRes.error) return { error: pRes.error.message }
  if (plRes.error) return { error: plRes.error.message }
  if (sRes.error) return { error: sRes.error.message }
  if (oRes.error) return { error: oRes.error.message }
  const overrides: Record<number, number | null> = {}
  for (const r of oRes.data ?? []) overrides[r.oeuvre_id] = r.period_id
  const sourcesByWork: Record<number, number[]> = {}
  const sourceNotes: Record<number, Record<number, string>> = {}
  // Links can pass PostgREST's 1000-row page: read them page by page.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('work_source_link')
      .select('oeuvre_id, source_id, note')
      .order('oeuvre_id')
      .order('source_id')
      .range(from, from + PAGE - 1)
    if (error) return { error: error.message }
    for (const r of data ?? []) {
      ;(sourcesByWork[r.oeuvre_id] ??= []).push(r.source_id)
      if (r.note?.trim()) (sourceNotes[r.oeuvre_id] ??= {})[r.source_id] = r.note
    }
    if (!data || data.length < PAGE) break
  }
  const creation: Record<number, CreationStep[]> = {}
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('work_creation_step')
      .select(STEP_COLS)
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return { error: error.message }
    for (const r of (data ?? []) as CreationStep[]) (creation[r.oeuvre_id] ??= []).push(r)
    if (!data || data.length < PAGE) break
  }
  for (const k of Object.keys(creation)) creation[Number(k)] = sortSteps(creation[Number(k)])
  return {
    periods: (pRes.data ?? []) as WorkPeriod[],
    sources: (sRes.data ?? []) as WorkSource[],
    overrides,
    sourcesByWork,
    sourceNotes,
    places: (plRes.data ?? []) as Place[],
    creation,
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function cleanDay(v: unknown): string | null {
  if (typeof v !== 'string' || !ISO_DAY.test(v)) return null
  const y = Number(v.slice(0, 4))
  if (y < MIN_YEAR || y > MAX_YEAR) return null
  const d = new Date(`${v}T12:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v
}

export type PeriodInput = { id?: number; name: string; start_on: string; end_on: string | null; default_place_id: number | null }

export async function savePeriod(input: PeriodInput): Promise<{ ok: true; period: WorkPeriod } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const name = (input.name ?? '').trim().slice(0, MAX_NAME)
  if (!name) return { error: 'name' }
  const start = cleanDay(input.start_on)
  if (start == null) return { error: 'start_year' }
  const end = input.end_on == null || input.end_on === '' ? null : cleanDay(input.end_on)
  if (input.end_on && end == null) return { error: 'end_year' }
  if (end != null && end < start) return { error: 'end_before_start' }
  const place = input.default_place_id
  if (place != null && !(Number.isInteger(place) && place > 0)) return { error: 'bad_place' }
  // The years follow the dates (DB trigger); they are sent too so the row type stays complete.
  const values = {
    name,
    start_on: start,
    end_on: end,
    start_year: Number(start.slice(0, 4)),
    end_year: end ? Number(end.slice(0, 4)) : null,
    default_place_id: place,
  }
  const q =
    input.id != null
      ? supabase.from('work_period').update(values).eq('id', input.id)
      : supabase.from('work_period').insert(values)
  const { data, error } = await q.select(PERIOD_COLS).single()
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

const MAX_NOTE = 300

/** The short line for one source on one work (the link must exist: the source is ticked). */
export async function setWorkSourceNote(
  oeuvreId: number,
  sourceId: number,
  note: string,
): Promise<{ ok: true; note: string | null } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0 || !Number.isInteger(sourceId) || sourceId <= 0) return { error: 'bad_work' }
  const value = (note ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE) || null
  const { data, error } = await supabase
    .from('work_source_link')
    .update({ note: value })
    .eq('oeuvre_id', oeuvreId)
    .eq('source_id', sourceId)
    .select('oeuvre_id')
  if (error) {
    await logError('setWorkSourceNote failed', error, { source: 'periods.setWorkSourceNote', metadata: { oeuvreId, sourceId } })
    return { error: error.message }
  }
  if (!data?.length) return { error: 'not_linked' }
  return { ok: true, note: value }
}

/** Inventory bulk action: give one source to every selected work (existing links and notes kept). */
export async function addSourceToWorks(sourceId: number, oeuvreIds: number[]): Promise<{ ok: true; added: number[] } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  if (!Number.isInteger(sourceId) || sourceId <= 0) return { error: 'bad_source' }
  const ids = [...new Set(oeuvreIds.filter((x) => Number.isInteger(x) && x > 0))]
  if (!ids.length) return { ok: true, added: [] }
  for (let i = 0; i < ids.length; i += PAGE) {
    const chunk = ids.slice(i, i + PAGE)
    const { error } = await supabase
      .from('work_source_link')
      .upsert(chunk.map((oeuvre_id) => ({ oeuvre_id, source_id: sourceId })), { onConflict: 'oeuvre_id,source_id', ignoreDuplicates: true })
    if (error) {
      await logError('addSourceToWorks failed', error, { source: 'periods.addSourceToWorks', metadata: { sourceId, n: ids.length } })
      return { error: error.message }
    }
  }
  return { ok: true, added: ids }
}

// ── Places (A3) ──────────────────────────────────────────────────────────────

export type PlaceInput = {
  id?: number
  name: string
  address?: string | null
  town?: string | null
  country?: string | null
  latitude?: number | null
  longitude?: number | null
}

const short = (v: string | null | undefined) => (v ?? '').trim().slice(0, MAX_NAME) || null

export async function savePlace(input: PlaceInput): Promise<{ ok: true; place: Place } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const name = short(input.name)
  if (!name) return { error: 'name' }
  const lat = input.latitude ?? null
  const lon = input.longitude ?? null
  if ((lat == null) !== (lon == null)) return { error: 'coords' }
  if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) return { error: 'coords' }
  if (lon != null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) return { error: 'coords' }
  const values = { name, address: (input.address ?? '').trim().slice(0, 300) || null, town: short(input.town), country: short(input.country), latitude: lat, longitude: lon }
  const q =
    input.id != null
      ? supabase.from('place').update(values).eq('id', input.id)
      : supabase.from('place').insert(values)
  const { data, error } = await q.select(PLACE_COLS).single()
  if (error || !data) return { error: error?.code === '23505' ? 'duplicate' : (error?.message ?? 'save') }
  return { ok: true, place: data as Place }
}

/**
 * Coordinates for a place from its address / town / country (OpenStreetMap Nominatim, the lookup the
 * Atelier map already uses). Only when someone asks — the address leaves the app for that search.
 */
export async function findPlaceCoords(input: { address?: string | null; town?: string | null; country?: string | null }): Promise<{ ok: true; latitude: number; longitude: number } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const where = [input.address, input.town].map((v) => (v ?? '').trim()).filter(Boolean).join(', ')
  const country = (input.country ?? '').trim()
  if (!where && !country) return { error: 'empty' }
  const hit = await lookupGeocode(where, country)
  if (!hit) return { error: 'not_found' }
  return { ok: true, latitude: Math.round(hit.lat * 1e5) / 1e5, longitude: Math.round(hit.lng * 1e5) / 1e5 }
}

/** Deleting a place clears it from every work (cascade) and from periods that suggested it. */
export async function deletePlace(id: number): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  const { error } = await supabase.from('place').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

export type SessionLocation = { sessionId: string; day: string | null; latitude: number; longitude: number }

/**
 * Where the phone was when a field session held this work (`work_session.payload.field_context`,
 * captured since 3.1.6), earliest session first — the one closest to when the work was made. Read
 * only; the card turns it into a place suggestion (`nearestPlace`), never a write.
 */
export async function fetchWorkSessionLocations(
  oeuvreId: number,
): Promise<{ ok: true; locations: SessionLocation[] } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  if (!(Number.isInteger(oeuvreId) && oeuvreId > 0)) return { error: 'bad_work' }
  const { data, error } = await supabase
    .from('work_session')
    .select('id, created_at, day:payload->>session_day, lat:payload->field_context->latitude, lon:payload->field_context->longitude')
    .contains('payload', { items: [{ oeuvre_id: oeuvreId }] })
    .order('created_at')
    .limit(50)
  if (error) return { error: error.message }
  const locations: SessionLocation[] = []
  for (const r of (data ?? []) as { id: string; created_at: string; day: string | null; lat: unknown; lon: unknown }[]) {
    if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue
    locations.push({ sessionId: r.id, day: r.day ?? r.created_at.slice(0, 10), latitude: r.lat, longitude: r.lon })
  }
  return { ok: true, locations }
}

export type CreationStepInput = {
  id?: number
  oeuvre_id: number
  on_date: string | null
  date_precision: DatePrecision | null
  kind: CreationKind
  place_id: number | null
  note: string | null
  work_session_id?: string | null
}

const PRECISIONS: DatePrecision[] = ['year', 'month', 'day']

/** Add or edit one line of a work's « Création » history. */
export async function saveCreationStep(input: CreationStepInput): Promise<{ ok: true; step: CreationStep } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  if (!(Number.isInteger(input.oeuvre_id) && input.oeuvre_id > 0)) return { error: 'bad_work' }
  if (!CREATION_KINDS.includes(input.kind)) return { error: 'bad_kind' }
  const on = input.on_date == null || input.on_date === '' ? null : cleanDay(input.on_date)
  if (input.on_date && on == null) return { error: 'bad_date' }
  const precision = on == null ? null : input.date_precision
  if (on != null && (precision == null || !PRECISIONS.includes(precision))) return { error: 'bad_date' }
  if (precision === 'year' && !on!.endsWith('-01-01')) return { error: 'bad_date' }
  if (precision === 'month' && !on!.endsWith('-01')) return { error: 'bad_date' }
  const place = input.place_id
  if (place != null && !(Number.isInteger(place) && place > 0)) return { error: 'bad_place' }
  const note = (input.note ?? '').trim().slice(0, MAX_STEP_NOTE) || null
  if (on == null && place == null && note == null) return { error: 'empty' }
  const values = { on_date: on, date_precision: precision, kind: input.kind, place_id: place, note }
  const q =
    input.id != null
      ? supabase.from('work_creation_step').update(values).eq('id', input.id).eq('oeuvre_id', input.oeuvre_id)
      : supabase
          .from('work_creation_step')
          .insert({ ...values, oeuvre_id: input.oeuvre_id, work_session_id: input.work_session_id ?? null })
  const { data, error } = await q.select(STEP_COLS).single()
  if (error) {
    await logError('saveCreationStep failed', error, { source: 'periods.saveCreationStep', metadata: { oeuvreId: input.oeuvre_id } })
    return { error: error.message }
  }
  return { ok: true, step: data as CreationStep }
}

export async function deleteCreationStep(id: number): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  if (!(await signedIn(supabase))) return { error: 'auth' }
  if (!(Number.isInteger(id) && id > 0)) return { error: 'bad_step' }
  const { error } = await supabase.from('work_creation_step').delete().eq('id', id)
  if (error) {
    await logError('deleteCreationStep failed', error, { source: 'periods.deleteCreationStep', metadata: { id } })
    return { error: error.message }
  }
  return { ok: true }
}
