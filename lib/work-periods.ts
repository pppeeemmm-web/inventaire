/**
 * Periods + source per work (owner 2026-11-02); periods by DATE + the place a work was made
 * (A3, owner 2026-11-13). Browser-safe; actions in `app/atelier/works/period-source-actions.ts`,
 * tables in `supabase/sql/work_periods_sources.sql` + `supabase/sql/work_period_dates_places.sql`.
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
  town: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
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
  /** Place each work was made (`work_place`): work id → place id. Missing = not set. */
  workPlaces: Record<number, number>
}

/** Override choice in the drawer: automatic, explicitly none, or a period id. */
export type PeriodChoice = 'auto' | 'none' | number

export function emptyPeriodSourceData(): PeriodSourceData {
  return { periods: [], sources: [], overrides: {}, sourcesByWork: {}, sourceNotes: {}, places: [], workPlaces: {} }
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

export function effectivePeriod(oeuvreId: number, when: WorkWhen | number | null, data: PeriodSourceData): EffectivePeriod {
  if (Object.prototype.hasOwnProperty.call(data.overrides, oeuvreId)) {
    const pid = data.overrides[oeuvreId]
    return { period: pid == null ? null : (data.periods.find((p) => p.id === pid) ?? null), overridden: true }
  }
  return { period: autoPeriodFor(when, data.periods), overridden: false }
}

/**
 * Place a work was made (Pem 2026-11-14: "by default it would be set there"): the place set on the
 * work, else the place of its period (the atelier of that time) — read like the automatic period,
 * never written. `fromPeriod` marks the inferred case (shown greyed).
 */
export type EffectivePlace = { place: Place | null; fromPeriod: boolean }

export function effectivePlace(oeuvreId: number, when: WorkWhen | number | null, data: PeriodSourceData): EffectivePlace {
  const own = data.workPlaces[oeuvreId]
  if (own != null) return { place: data.places.find((p) => p.id === own) ?? null, fromPeriod: false }
  const period = effectivePeriod(oeuvreId, when, data).period
  const pid = period?.default_place_id ?? null
  return pid == null ? { place: null, fromPeriod: false } : { place: data.places.find((p) => p.id === pid) ?? null, fromPeriod: true }
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
