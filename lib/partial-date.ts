/**
 * Partial dates (owner 2026-11-03: "I cannot always be accurate"). A date known only to the year
 * or the month is stored as the first day of that period plus a precision.
 * Browser-safe; used by condition reports (destroyed / lost event date).
 */
export const DATE_PRECISIONS = ['year', 'month', 'day'] as const
export type DatePrecision = (typeof DATE_PRECISIONS)[number]

export type PartialDate = { date: string; precision: DatePrecision }

const pad = (n: number) => String(n).padStart(2, '0')

function valid(y: number, m: number, d: number): boolean {
  if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1) return false
  return d <= new Date(y, m, 0).getDate()
}

/**
 * Typed text → partial date. Accepts `2019`, `03/2019`, `12/03/2019` (also `-` / `.` separators)
 * and ISO `2019-03`, `2019-03-12`. Empty → null; anything else → 'invalid'.
 */
export function parsePartialDate(raw: string): PartialDate | null | 'invalid' {
  const s = raw.trim()
  if (!s) return null
  let m = /^(\d{4})$/.exec(s)
  if (m) return valid(+m[1], 1, 1) ? { date: `${m[1]}-01-01`, precision: 'year' } : 'invalid'
  m = /^(\d{1,2})[/.-](\d{4})$/.exec(s) ?? null
  if (m) return valid(+m[2], +m[1], 1) ? { date: `${m[2]}-${pad(+m[1])}-01`, precision: 'month' } : 'invalid'
  m = /^(\d{4})-(\d{1,2})$/.exec(s)
  if (m) return valid(+m[1], +m[2], 1) ? { date: `${m[1]}-${pad(+m[2])}-01`, precision: 'month' } : 'invalid'
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (m) return valid(+m[3], +m[2], +m[1]) ? { date: `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`, precision: 'day' } : 'invalid'
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) return valid(+m[1], +m[2], +m[3]) ? { date: `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`, precision: 'day' } : 'invalid'
  return 'invalid'
}

/** Stored date + precision → the text the input shows back (`2019`, `03/2019`, `12/03/2019`). */
export function partialDateInput(date: string | null | undefined, precision: DatePrecision | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!m) return ''
  if (precision === 'year') return m[1]
  if (precision === 'month') return `${m[2]}/${m[1]}`
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** Display: "2019", "mars 2019", "12 mars 2019" (locale `fr-FR` / `en-GB`). */
export function formatPartialDate(
  date: string | null | undefined,
  precision: DatePrecision | null | undefined,
  locale: string,
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!m) return ''
  if (precision === 'year') return m[1]
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return precision === 'month'
    ? d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}
