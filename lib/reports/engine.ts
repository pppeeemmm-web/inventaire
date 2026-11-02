/**
 * Report engine (owner 2026-11-02, Access-style): a source declares its rows and fields; the
 * Reports tab lets the user tick, order and filter any field. Pure — no React, no Supabase.
 */

export type FieldKind = 'text' | 'number' | 'date' | 'bool' | 'enum' | 'multi'

export type FieldValue = string | number | boolean | string[] | null

export type ReportField<R> = {
  id: string
  label: string
  kind: FieldKind
  /** Raw value used to filter and sort. `enum` → label string, `multi` → labels, `date` → ISO. */
  value: (r: R) => FieldValue
  /** Cell text; defaults to {@link formatFieldValue}. */
  display?: (r: R) => string
  /** Summable in the pivot (prices, counts). */
  sum?: boolean
}

export type ValuesMode = 'any' | 'all' | 'none'

export type FieldFilter =
  | { type: 'text'; q: string }
  | { type: 'range'; min: string; max: string }
  | { type: 'bool'; value: boolean }
  | { type: 'values'; mode: ValuesMode; values: string[] }

export type ReportConfig = {
  /** Shown fields, in order. */
  fields: string[]
  /** Filters by field id — a field can be filtered without being shown. */
  filters: Record<string, FieldFilter>
  sort: { field: string; dir: 'asc' | 'desc' }
  /** Free search across the shown cells. */
  q: string
  pivot: boolean
}

export const EMPTY_CELL = '—'

export function formatFieldValue(v: FieldValue): string {
  if (v == null || v === '') return EMPTY_CELL
  if (typeof v === 'boolean') return v ? '✓' : EMPTY_CELL
  if (Array.isArray(v)) return v.length ? v.join(', ') : EMPTY_CELL
  return String(v)
}

export function cellText<R>(f: ReportField<R>, r: R): string {
  return f.display ? f.display(r) : formatFieldValue(f.value(r))
}

/** Values a list filter offers, with how many rows carry each (empty → "—"). */
export function fieldOptions<R>(f: ReportField<R>, rows: R[], locale: string): { value: string; n: number }[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const v = f.value(r)
    const arr = Array.isArray(v) ? (v.length ? v : [EMPTY_CELL]) : [v == null || v === '' ? EMPTY_CELL : String(v)]
    for (const x of new Set(arr)) counts.set(x, (counts.get(x) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, n]) => ({ value, n }))
    .sort((a, b) =>
      a.value === EMPTY_CELL ? 1 : b.value === EMPTY_CELL ? -1 : a.value.localeCompare(b.value, locale, { numeric: true }),
    )
}

export function isActiveFilter(f: FieldFilter | undefined): boolean {
  if (!f) return false
  if (f.type === 'text') return f.q.trim() !== ''
  if (f.type === 'range') return f.min.trim() !== '' || f.max.trim() !== ''
  if (f.type === 'values') return f.values.length > 0
  return true
}

function asList(v: FieldValue): string[] {
  if (Array.isArray(v)) return v.length ? v : [EMPTY_CELL]
  return [v == null || v === '' ? EMPTY_CELL : String(v)]
}

function passes<R>(f: ReportField<R>, flt: FieldFilter, r: R): boolean {
  const v = f.value(r)
  switch (flt.type) {
    case 'text':
      return cellText(f, r).toLowerCase().includes(flt.q.trim().toLowerCase())
    case 'bool':
      return !!v === flt.value
    case 'range': {
      if (v == null || v === '') return false
      if (f.kind === 'date') {
        const d = String(v).slice(0, 10)
        if (flt.min && d < flt.min) return false
        if (flt.max && d > flt.max) return false
        return true
      }
      const n = Number(v)
      if (flt.min.trim() !== '' && n < Number(flt.min)) return false
      if (flt.max.trim() !== '' && n > Number(flt.max)) return false
      return true
    }
    case 'values': {
      const have = asList(v)
      if (flt.mode === 'all') return flt.values.every((x) => have.includes(x))
      const hit = have.some((x) => flt.values.includes(x))
      return flt.mode === 'none' ? !hit : hit
    }
  }
}

function compare(a: FieldValue, b: FieldValue, locale: string): number {
  const empty = (x: FieldValue) => x == null || x === '' || (Array.isArray(x) && x.length === 0)
  if (empty(a) || empty(b)) return empty(a) === empty(b) ? 0 : empty(a) ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(b) - Number(a)
  return formatFieldValue(a).localeCompare(formatFieldValue(b), locale, { numeric: true })
}

/** Filters (every active field filter + the free search) then sorts. */
export function runReport<R>(
  rows: R[],
  fields: ReportField<R>[],
  cfg: ReportConfig,
  locale: string,
): R[] {
  const byId = new Map(fields.map((f) => [f.id, f]))
  const active = Object.entries(cfg.filters).filter(([id, flt]) => byId.has(id) && isActiveFilter(flt))
  const shown = cfg.fields.map((id) => byId.get(id)).filter((f): f is ReportField<R> => !!f)
  const q = cfg.q.trim().toLowerCase()

  const out = rows.filter((r) => {
    for (const [id, flt] of active) if (!passes(byId.get(id)!, flt, r)) return false
    if (q && !shown.some((f) => cellText(f, r).toLowerCase().includes(q))) return false
    return true
  })
  const sf = byId.get(cfg.sort.field)
  if (sf) {
    const m = cfg.sort.dir === 'asc' ? 1 : -1
    out.sort((a, b) => {
      const c = compare(sf.value(a), sf.value(b), locale)
      // Empty values stay last whatever the direction.
      const ea = sf.value(a) == null || sf.value(a) === ''
      const eb = sf.value(b) == null || sf.value(b) === ''
      return ea !== eb ? c : c * m
    })
  }
  return out
}

/** Keeps only the field ids a source knows (saved reports may predate a field change). */
export function cleanConfig<R>(cfg: ReportConfig, fields: ReportField<R>[], fallback: ReportConfig): ReportConfig {
  const known = new Set(fields.map((f) => f.id))
  const shown = cfg.fields.filter((id) => known.has(id))
  return {
    fields: shown.length ? shown : fallback.fields,
    filters: Object.fromEntries(Object.entries(cfg.filters).filter(([id]) => known.has(id))),
    sort: known.has(cfg.sort.field) ? cfg.sort : fallback.sort,
    q: cfg.q,
    pivot: cfg.pivot,
  }
}
