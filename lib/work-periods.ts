/**
 * Periods + source per work (owner 2026-11-02); periods by DATE + the place a work was made
 * (A3, owner 2026-11-13); the « Création » history (Pem 2026-11-14: "a history for the creation where
 * 'place' is just like 'history'") — dated lines, each with a place. Browser-safe; actions in
 * `app/atelier/works/period-source-actions.ts`, tables in `supabase/sql/work_periods_sources.sql`,
 * `work_period_dates_places.sql`, `work_creation_steps.sql`.
 */

import { yearOf } from '@/lib/data'

/** `start_on` / `end_on` (YYYY-MM-DD) are the truth; the years follow them (DB trigger). */
export type WorkPeriod = {
  id: number
  name: string
  start_year: number
  end_year: number | null
  start_on: string
  end_on: string | null
  /** The period's place (its atelier): works without a place of their own are read there (`effectivePlace`). */
  default_place_id: number | null
}
export type WorkSource = { id: number; name: string }
export type Place = {
  id: number
  name: string
  /** Street, number, postcode (Pem 2026-11-14: "a place can be an address"). */
  address: string | null
  town: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

/** Kinds of creation line, in the order they are offered. */
export const CREATION_KINDS = ['started', 'worked', 'resumed', 'finished'] as const
export type CreationKind = (typeof CREATION_KINDS)[number]
export type DatePrecision = 'year' | 'month' | 'day'

/** One line of a work's « Création » history (`work_creation_step`). */
export type CreationStep = {
  id: number
  oeuvre_id: number
  /** YYYY-MM-DD; a year is stored as 1 Jan, a month as its 1st. Null = undated. */
  on_date: string | null
  date_precision: DatePrecision | null
  kind: CreationKind
  place_id: number | null
  note: string | null
  /** Set when the line came from a field session's suggestion. */
  work_session_id: string | null
}

export type PeriodSourceData = {
  periods: WorkPeriod[]
  sources: WorkSource[]
  /** Per-work exception: a period id, or null = "no period". Missing key = automatic. */
  overrides: Record<number, number | null>
  sourcesByWork: Record<number, number[]>
  /** Short line per work + source (`work_source_link.note`): work id → source id → text. */
  sourceNotes: Record<number, Record<number, string>>
  places: Place[]
  /** « Création » lines per work, in order (`sortSteps`). Missing = none. */
  creation: Record<number, CreationStep[]>
}

/** Override choice in the drawer: automatic, explicitly none, or a period id. */
export type PeriodChoice = 'auto' | 'none' | number

export function emptyPeriodSourceData(): PeriodSourceData {
  return { periods: [], sources: [], overrides: {}, sourcesByWork: {}, sourceNotes: {}, places: [], creation: {} }
}

/** When a work was made, as precisely as it is known: a day, else a year. */
export type WorkWhen = { day: string | null; year: number | null }

type WhenFields = {
  Année?: string | null
  production_started_on?: string | null
  production_completed_on?: string | null
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function dayOf(v: string | null | undefined): string | null {
  const s = (v ?? '').slice(0, 10)
  return ISO_DAY.test(s) ? s : null
}

/**
 * The day a work's period reads: production end, else production start, else `Année` when it
 * carries a real day (not 1 Jan — a bare year is stored as YYYY-01-01). Same rule as SQL
 * `oeuvre_search_text`. The year: `Année`, else the production start (field-session works, #2407).
 */
export function workWhen(w: WhenFields): WorkWhen {
  const annee = dayOf(w.Année)
  const day = dayOf(w.production_completed_on) ?? dayOf(w.production_started_on) ?? (annee && !annee.endsWith('-01-01') ? annee : null)
  return { day, year: yearOf(w.Année) ?? yearOf(w.production_started_on) ?? (day ? Number(day.slice(0, 4)) : null) }
}

/** Kept for callers that only need the year (display). */
export function periodYearOf(w: WhenFields): number | null {
  return workWhen(w).year
}

function containsDay(p: WorkPeriod, day: string): boolean {
  return p.start_on <= day && (p.end_on == null || p.end_on >= day)
}

function containsYear(p: WorkPeriod, year: number): boolean {
  return year >= p.start_year && (p.end_year == null || year <= p.end_year)
}

/** Latest start wins, then the shorter span. */
function better(p: WorkPeriod, best: WorkPeriod | null): boolean {
  if (!best) return true
  if (p.start_on !== best.start_on) return p.start_on > best.start_on
  return (p.end_on ?? '9999-12-31') < (best.end_on ?? '9999-12-31')
}

/**
 * Period a work falls into. A day picks the period containing it; a year alone keeps the old rule
 * (latest start wins), so a 2024 work with no day lands in the later period until set by hand.
 */
export function autoPeriodFor(when: WorkWhen | number | null, periods: WorkPeriod[]): WorkPeriod | null {
  const w: WorkWhen = typeof when === 'number' ? { day: null, year: when } : (when ?? { day: null, year: null })
  let best: WorkPeriod | null = null
  for (const p of periods) {
    const hit = w.day ? containsDay(p, w.day) : w.year != null && containsYear(p, w.year)
    if (hit && better(p, best)) best = p
  }
  return best
}

/** A year alone that two periods share (2024: Galway then Marseille) — the drawer says so. */
export function yearIsShared(when: WorkWhen, periods: WorkPeriod[]): boolean {
  if (when.day || when.year == null) return false
  return periods.filter((p) => containsYear(p, when.year as number)).length > 1
}

export type EffectivePeriod = { period: WorkPeriod | null; overridden: boolean }

/**
 * A work with no date of its own reads its « Création » lines: the last line dated to the day, else
 * the year of the last dated line (same rule as SQL `oeuvre_search_text`).
 */
export function whenWithSteps(when: WorkWhen | number | null, steps: CreationStep[] | undefined): WorkWhen | number | null {
  const dated = (steps ?? []).filter((s) => s.on_date)
  if (!dated.length) return when
  const w: WorkWhen = typeof when === 'number' ? { day: null, year: when } : (when ?? { day: null, year: null })
  if (w.day && w.year != null) return w
  const byDate = [...dated].sort((a, b) => (a.on_date as string).localeCompare(b.on_date as string) || a.id - b.id)
  const lastDay = [...byDate].reverse().find((s) => s.date_precision === 'day')?.on_date ?? null
  const lastYear = Number((byDate[byDate.length - 1].on_date as string).slice(0, 4))
  return { day: w.day ?? lastDay, year: w.year ?? lastYear }
}

export function effectivePeriod(oeuvreId: number, when: WorkWhen | number | null, data: PeriodSourceData): EffectivePeriod {
  if (Object.prototype.hasOwnProperty.call(data.overrides, oeuvreId)) {
    const pid = data.overrides[oeuvreId]
    return { period: pid == null ? null : (data.periods.find((p) => p.id === pid) ?? null), overridden: true }
  }
  return { period: autoPeriodFor(whenWithSteps(when, data.creation[oeuvreId]), data.periods), overridden: false }
}

/** When a line falls, for its period: a day; a month reads its middle (a period can start mid-month); a year alone. */
export function stepWhen(s: CreationStep): WorkWhen | null {
  if (!s.on_date) return null
  const year = Number(s.on_date.slice(0, 4))
  if (s.date_precision === 'day') return { day: s.on_date, year }
  if (s.date_precision === 'month') return { day: `${s.on_date.slice(0, 7)}-15`, year }
  return { day: null, year }
}

/**
 * Periods the dated lines fall into, in order, without repeats. Two or more → the work spans periods
 * (Ireland 2021 → Marseille 2026) and the card asks which one it belongs to.
 */
export function periodsOfSteps(steps: CreationStep[] | undefined, periods: WorkPeriod[]): WorkPeriod[] {
  const out: WorkPeriod[] = []
  for (const s of steps ?? []) {
    const p = autoPeriodFor(stepWhen(s), periods)
    if (p && !out.some((x) => x.id === p.id)) out.push(p)
  }
  return out
}

/** Undated lines first (as entered), then by date. */
export function sortSteps(steps: CreationStep[]): CreationStep[] {
  return [...steps].sort((a, b) => {
    if (!a.on_date || !b.on_date) return a.on_date === b.on_date ? a.id - b.id : a.on_date ? 1 : -1
    return a.on_date.localeCompare(b.on_date) || a.id - b.id
  })
}

/** "2021", "juin 2024", "22 août 2026". */
export function stepDateLabel(s: Pick<CreationStep, 'on_date' | 'date_precision'>, locale?: string): string {
  if (!s.on_date) return ''
  const d = new Date(`${s.on_date}T12:00:00`)
  if (s.date_precision === 'year') return s.on_date.slice(0, 4)
  if (s.date_precision === 'month') return d.toLocaleDateString(locale ?? 'fr-FR', { month: 'long', year: 'numeric' })
  return d.toLocaleDateString(locale ?? 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The line's date as typed back into the field: "2021", "2024-06", "2026-08-22". */
export function stepDateInput(s: Pick<CreationStep, 'on_date' | 'date_precision'>): string {
  if (!s.on_date) return ''
  if (s.date_precision === 'year') return s.on_date.slice(0, 4)
  if (s.date_precision === 'month') return s.on_date.slice(0, 7)
  return s.on_date
}

/**
 * "2021", "2024-06" / "06/2024" / "2024/06", "2026-08-22" / "22/08/2026" → a stored date + precision;
 * '' → undated; anything else → 'bad'.
 */
export function parseStepDate(input: string): { on_date: string | null; date_precision: DatePrecision | null } | 'bad' {
  const v = input.trim()
  if (!v) return { on_date: null, date_precision: null }
  const pad = (n: string) => n.padStart(2, '0')
  const ok = (y: number) => y >= 1900 && y <= 2200
  let m = v.match(/^(\d{4})$/)
  if (m) return ok(+m[1]) ? { on_date: `${m[1]}-01-01`, date_precision: 'year' } : 'bad'
  const ym = v.match(/^(\d{4})[-/.](\d{1,2})$/)
  const my = v.match(/^(\d{1,2})[-/.](\d{4})$/)
  const month = ym ? { y: ym[1], mo: ym[2] } : my ? { y: my[2], mo: my[1] } : null
  if (month) {
    const mo = Number(month.mo)
    return ok(+month.y) && mo >= 1 && mo <= 12 ? { on_date: `${month.y}-${pad(month.mo)}-01`, date_precision: 'month' } : 'bad'
  }
  m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  const dmy = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  const parts = m ? [m[1], m[2], m[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null
  if (!parts) return 'bad'
  const iso = `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`
  const d = new Date(`${iso}T12:00:00Z`)
  if (!ok(+parts[0]) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return 'bad'
  return { on_date: iso, date_precision: 'day' }
}

/** Places of a work's « Création » lines, in order, without repeats (the route). */
export function routeOf(oeuvreId: number, data: PeriodSourceData): Place[] {
  const out: Place[] = []
  for (const s of data.creation[oeuvreId] ?? []) {
    if (s.place_id == null || out.some((p) => p.id === s.place_id)) continue
    const p = data.places.find((x) => x.id === s.place_id)
    if (p) out.push(p)
  }
  return out
}

/**
 * Place a work was made (Pem 2026-11-14: "by default it would be set there"): the places of its
 * « Création » lines (`route`; `place` = the last one), else the place of its period (the atelier of
 * that time) — read like the automatic period, never written. `fromPeriod` marks the inferred case
 * (shown greyed).
 */
export type EffectivePlace = { place: Place | null; fromPeriod: boolean; route: Place[] }

export function effectivePlace(oeuvreId: number, when: WorkWhen | number | null, data: PeriodSourceData): EffectivePlace {
  const route = routeOf(oeuvreId, data)
  if (route.length) return { place: route[route.length - 1], fromPeriod: false, route }
  const period = effectivePeriod(oeuvreId, when, data).period
  const pid = period?.default_place_id ?? null
  const place = pid == null ? null : (data.places.find((p) => p.id === pid) ?? null)
  return { place, fromPeriod: place != null, route: place ? [place] : [] }
}

/** "Tooreeney → Marseille Atelier" */
export function routeLabel(route: Place[]): string {
  return route.map((p) => p.name).join(' → ')
}

export function periodChoiceOf(oeuvreId: number, data: PeriodSourceData): PeriodChoice {
  if (!Object.prototype.hasOwnProperty.call(data.overrides, oeuvreId)) return 'auto'
  return data.overrides[oeuvreId] ?? 'none'
}

function fmtDay(iso: string, locale?: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale ?? 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "2019–2021", "2019–" when still going; a day where the span does not follow whole years. */
export function periodRange(p: WorkPeriod, locale?: string): string {
  const start = p.start_on.endsWith('-01-01') ? String(p.start_year) : fmtDay(p.start_on, locale)
  if (p.end_on == null) return `${start}–`
  const end = p.end_on.endsWith('-12-31') ? String(p.end_year) : fmtDay(p.end_on, locale)
  if (start === end) return start
  // Plain years keep the tight dash ("2019–2021"); a day needs room ("2022 – 12 juin 2024").
  const plain = /^\d{4}$/.test(start) && /^\d{4}$/.test(end)
  return plain ? `${start}–${end}` : `${start} – ${end}`
}

export function sortPeriods(periods: WorkPeriod[]): WorkPeriod[] {
  return [...periods].sort(
    (a, b) => a.start_on.localeCompare(b.start_on) || (a.end_on ?? '9999').localeCompare(b.end_on ?? '9999') || a.id - b.id,
  )
}

export function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => a.name.localeCompare(b.name))
}

/** "Atelier Belle de Mai · Marseille, France" */
export function placeLabel(p: Place): string {
  const where = [p.town, p.country].filter((x) => x && x.trim()).join(', ')
  return where ? `${p.name} · ${where}` : p.name
}

/** Great-circle distance in km (haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Radius for "the field session was at this place" (brief 2026-11-14: ≈ 2 km). */
export const SESSION_PLACE_RADIUS_KM = 2

/** Nearest place with coordinates within the radius of a point, else null. */
export function nearestPlace(lat: number, lon: number, places: Place[], maxKm = SESSION_PLACE_RADIUS_KM): Place | null {
  let best: Place | null = null
  let bestKm = maxKm
  for (const p of places) {
    if (p.latitude == null || p.longitude == null) continue
    const km = distanceKm(lat, lon, p.latitude, p.longitude)
    if (km <= bestKm) {
      best = p
      bestKm = km
    }
  }
  return best
}

/** "43.29, 5.38" (comma, semicolon or space; decimal comma accepted) → coordinates; '' → none. */
export function parsePlaceCoords(s: string): { latitude: number | null; longitude: number | null } | 'bad' {
  const v = s.trim()
  if (!v) return { latitude: null, longitude: null }
  const m = v.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/)
  if (!m) return 'bad'
  const latitude = Number(m[1].replace(',', '.'))
  const longitude = Number(m[2].replace(',', '.'))
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return 'bad'
  return { latitude, longitude }
}
