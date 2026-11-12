/**
 * Periods + source per work (owner 2026-11-02). Browser-safe; actions in
 * `app/atelier/works/period-source-actions.ts`, tables in `supabase/sql/work_periods_sources.sql`.
 */

import { yearOf } from '@/lib/data'

export type WorkPeriod = { id: number; name: string; start_year: number; end_year: number | null }
export type WorkSource = { id: number; name: string }

export type PeriodSourceData = {
  periods: WorkPeriod[]
  sources: WorkSource[]
  /** Per-work exception: a period id, or null = "no period". Missing key = automatic. */
  overrides: Record<number, number | null>
  sourcesByWork: Record<number, number[]>
  /** Short line per work + source (`work_source_link.note`): work id → source id → text. */
  sourceNotes: Record<number, Record<number, string>>
}

/** Override choice in the drawer: automatic, explicitly none, or a period id. */
export type PeriodChoice = 'auto' | 'none' | number

export function emptyPeriodSourceData(): PeriodSourceData {
  return { periods: [], sources: [], overrides: {}, sourcesByWork: {}, sourceNotes: {} }
}

export function periodContains(p: WorkPeriod, year: number): boolean {
  return year >= p.start_year && (p.end_year == null || year <= p.end_year)
}

/** Period a year falls into. Overlaps: the one that started latest wins, then the shorter one. */
export function autoPeriodFor(year: number | null, periods: WorkPeriod[]): WorkPeriod | null {
  if (year == null) return null
  let best: WorkPeriod | null = null
  for (const p of periods) {
    if (!periodContains(p, year)) continue
    if (
      !best ||
      p.start_year > best.start_year ||
      (p.start_year === best.start_year && (p.end_year ?? Infinity) < (best.end_year ?? Infinity))
    ) {
      best = p
    }
  }
  return best
}

/**
 * Year the automatic period reads: `Année`, else the production start date (a field-session
 * work has a start day before anyone sets its year — #2407, owner 2026-11-12). Display only.
 */
export function periodYearOf(w: { Année?: string | null; production_started_on?: string | null }): number | null {
  return yearOf(w.Année) ?? yearOf(w.production_started_on)
}

export type EffectivePeriod = { period: WorkPeriod | null; overridden: boolean }

export function effectivePeriod(oeuvreId: number, year: number | null, data: PeriodSourceData): EffectivePeriod {
  if (Object.prototype.hasOwnProperty.call(data.overrides, oeuvreId)) {
    const pid = data.overrides[oeuvreId]
    return { period: pid == null ? null : (data.periods.find((p) => p.id === pid) ?? null), overridden: true }
  }
  return { period: autoPeriodFor(year, data.periods), overridden: false }
}

export function periodChoiceOf(oeuvreId: number, data: PeriodSourceData): PeriodChoice {
  if (!Object.prototype.hasOwnProperty.call(data.overrides, oeuvreId)) return 'auto'
  return data.overrides[oeuvreId] ?? 'none'
}

/** "2019–2021", "2019–" when still going. */
export function periodRange(p: WorkPeriod): string {
  if (p.end_year == null) return `${p.start_year}–`
  return p.end_year === p.start_year ? String(p.start_year) : `${p.start_year}–${p.end_year}`
}

export function sortPeriods(periods: WorkPeriod[]): WorkPeriod[] {
  return [...periods].sort((a, b) => a.start_year - b.start_year || (a.end_year ?? 9999) - (b.end_year ?? 9999) || a.id - b.id)
}
