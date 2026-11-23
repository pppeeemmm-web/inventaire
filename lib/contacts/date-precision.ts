// Format a stored date (YYYY-MM-DD…) by its precision: 'year' → 2024, 'month' → « mars 2024 », else the full day.
export function byPrecision(d: string, precision: string | null | undefined, locale: string): string {
  const date = new Date(`${d.slice(0, 10)}T12:00:00`)
  if (precision === 'year') return String(date.getFullYear())
  if (precision === 'month') return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}
