/** RFC 4180 cell escaping — Excel / LibreOffice safe. */

export function escapeCsvCell(value: unknown): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowToCsv(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(',')
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [rowToCsv(headers), ...rows.map((r) => rowToCsv(r))]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
