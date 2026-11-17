/**
 * R4 (Pem 2026-11-17): shared by the Carte « Création » mode and the Chronologie tab — one colour per
 * studio (a period's place, in period order), so a pin and a period band read alike. Browser-safe.
 */

import type { WorkPeriod } from '@/lib/work-periods'

export const STUDIO_COLORS = ['#d4b886', '#7fc8a9', '#6fb6e0', '#c08080', '#a080d0']
export const FIELD_PLACE_COLOR = '#e0a35a'

/** Studio place ids in period order (a place used by two periods keeps its first rank). */
export function studioOrder(periods: WorkPeriod[]): number[] {
  const ids: number[] = []
  for (const p of [...periods].sort((a, b) => a.start_on.localeCompare(b.start_on))) {
    if (p.default_place_id != null && !ids.includes(p.default_place_id)) ids.push(p.default_place_id)
  }
  return ids
}

export function placeColor(placeId: number | null, studios: number[]): string {
  if (placeId == null) return FIELD_PLACE_COLOR
  const i = studios.indexOf(placeId)
  return i >= 0 ? STUDIO_COLORS[i % STUDIO_COLORS.length] : FIELD_PLACE_COLOR
}

/** Month index (year * 12 + month - 1) of a YYYY-MM-DD day. */
export function monthOf(day: string): number {
  return Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1
}

/** « 2026-05 » ↔ month index (URL params between the two tabs). */
export function monthKey(mi: number): string {
  return `${Math.floor(mi / 12)}-${String((mi % 12) + 1).padStart(2, '0')}`
}
export function parseMonthKey(v: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? '')
  if (!m) return null
  const month = Number(m[2])
  return month >= 1 && month <= 12 ? Number(m[1]) * 12 + month - 1 : null
}

/**
 * Does a work made on `day` / in `year` fall in [from, to] (month indexes)? A work known only by its year
 * counts only when the span holds the whole year (a single month must not pull in 200 « 2026 » works) —
 * the same rule as the Chronologie panel.
 */
export function inSpan(day: string | null, year: number | null, from: number, to: number): boolean {
  if (day) {
    const mi = monthOf(day)
    return mi >= from && mi <= to
  }
  if (year != null) return from <= year * 12 && to >= year * 12 + 11
  return false
}
