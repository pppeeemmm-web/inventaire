/** Pure helpers for sale return window (safe for client + server). */

export function addCalendarDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export function parseSaleOrderBatchIds(notes: string | null, oeuvreId: number): number[] {
  if (notes?.includes('BATCH_IDS:')) {
    try {
      const m = notes.match(/BATCH_IDS: (\[.*?\])/)
      if (m) return JSON.parse(m[1]) as number[]
    } catch {
      /* fall through */
    }
  }
  return [oeuvreId]
}
