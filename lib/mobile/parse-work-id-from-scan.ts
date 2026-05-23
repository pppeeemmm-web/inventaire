/** Parse work id from QR text or URL (scan-to-open). */

const PATH_RE = /\/atelier\/works\/(\d+)(?:\/edit)?(?:\?|$)/i
const PATH_RE_LOOSE = /\/works\/(\d+)/i
const QUERY_WORK_RE = /[?&]work=(\d+)/i

export function parseWorkIdFromScanText(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  const direct = /^\d{1,9}$/.test(s) ? parseInt(s, 10) : NaN
  if (!Number.isNaN(direct)) return direct
  const q = s.match(QUERY_WORK_RE)
  if (q?.[1]) {
    const n = parseInt(q[1], 10)
    return Number.isNaN(n) ? null : n
  }
  const m = s.match(PATH_RE) ?? s.match(PATH_RE_LOOSE)
  if (m?.[1]) {
    const n = parseInt(m[1], 10)
    return Number.isNaN(n) ? null : n
  }
  return null
}
