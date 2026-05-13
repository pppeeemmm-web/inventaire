/**
 * Client-side pivot aggregation (pure, no React).
 * One composite row key (from 1+ row dimensions), optional column dimension, multiple value columns.
 */

export type Dim<R> = {
  id: string
  label: string
  get: (r: R) => string | number | null | undefined
}

export type AggKind = 'count' | 'sum' | 'avg' | 'min' | 'max'

export type Agg<R> = {
  id: string
  label: string
  kind: AggKind
  /** Required for sum / avg / min / max */
  get?: (r: R) => number
}

export type PivotConfig<R> = {
  rowDims: Dim<R>[]
  colDim?: Dim<R>
  values: Agg<R>[]
}

/** Per-cell and running bucket for one value slot */
type Bucket = { n: number; sum: number; min: number; max: number }

function emptyBucket(): Bucket {
  return { n: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
}

function dimStr(v: string | number | null | undefined, emptyLabel: string): string {
  if (v == null || v === '') return emptyLabel
  return String(v)
}

function rowKey<R>(row: R, rowDims: Dim<R>[], emptyLabel: string): string {
  return rowDims.map((d) => dimStr(d.get(row), emptyLabel)).join(' · ')
}

function bump<R>(b: Bucket, row: R, agg: Agg<R>): void {
  switch (agg.kind) {
    case 'count': {
      b.n += 1
      break
    }
    case 'sum':
    case 'avg':
    case 'min':
    case 'max': {
      const g = agg.get
      if (!g) return
      const v = g(row)
      if (typeof v !== 'number' || Number.isNaN(v)) return
      b.n += 1
      b.sum += v
      b.min = Math.min(b.min, v)
      b.max = Math.max(b.max, v)
      break
    }
    default:
      break
  }
}

function finalize(b: Bucket, kind: AggKind): number | null {
  if (kind === 'count') return b.n
  if (b.n === 0) return null
  switch (kind) {
    case 'sum':
      return b.sum
    case 'avg':
      return b.sum / b.n
    case 'min':
      return b.min === Number.POSITIVE_INFINITY ? null : b.min
    case 'max':
      return b.max === Number.NEGATIVE_INFINITY ? null : b.max
    default:
      return null
  }
}

export type PivotResult = {
  /** Sorted row labels */
  rows: string[]
  /** Sorted column labels (length 1 when no col dim — still use single bucket "—") */
  cols: string[]
  /** cells[ri][ci][vi] */
  cells: (number | null)[][][]
  /** Row totals across columns, same shape as one cell row */
  rowTotals: (number | null)[][]
  /** Column totals across rows */
  colTotals: (number | null)[][]
  /** Grand total per value */
  grand: (number | null)[]
}

export function buildPivot<R>(rows: R[], cfg: PivotConfig<R>, emptyLabel = '—'): PivotResult {
  const colDim = cfg.colDim
  const colKeyFor = (row: R) => (colDim ? dimStr(colDim.get(row), emptyLabel) : emptyLabel)

  const cellMap = new Map<string, Map<string, Bucket[]>>()
  const rowTot = new Map<string, Bucket[]>()
  const colTot = new Map<string, Bucket[]>()
  const grandB: Bucket[] = cfg.values.map(() => emptyBucket())

  const ensureBuckets = (map: Map<string, Bucket[]>, key: string): Bucket[] => {
    let arr = map.get(key)
    if (!arr) {
      arr = cfg.values.map(() => emptyBucket())
      map.set(key, arr)
    }
    return arr
  }

  for (const row of rows) {
    const rk = rowKey(row, cfg.rowDims, emptyLabel)
    const ck = colKeyFor(row)

    if (!cellMap.has(rk)) cellMap.set(rk, new Map())
    const rm = cellMap.get(rk)!
    let cb = rm.get(ck)
    if (!cb) {
      cb = cfg.values.map(() => emptyBucket())
      rm.set(ck, cb)
    }

    const rt = ensureBuckets(rowTot, rk)
    const ct = ensureBuckets(colTot, ck)

    cfg.values.forEach((agg, vi) => {
      bump(cb![vi], row, agg)
      bump(rt[vi], row, agg)
      bump(ct[vi], row, agg)
      bump(grandB[vi], row, agg)
    })
  }

  const rowsSorted = [...cellMap.keys()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
  const colSet = new Set<string>()
  for (const rm of cellMap.values()) for (const c of rm.keys()) colSet.add(c)
  const colsSorted = [...colSet].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))

  const cells: (number | null)[][][] = rowsSorted.map((rk) =>
    colsSorted.map((ck) => {
      const bs = cellMap.get(rk)?.get(ck) ?? cfg.values.map(() => emptyBucket())
      return cfg.values.map((agg, vi) => finalize(bs[vi], agg.kind))
    }),
  )

  const rowTotals: (number | null)[][] = rowsSorted.map((rk) => {
    const bs = rowTot.get(rk) ?? cfg.values.map(() => emptyBucket())
    return cfg.values.map((agg, vi) => finalize(bs[vi], agg.kind))
  })

  const colTotals: (number | null)[][] = colsSorted.map((ck) => {
    const bs = colTot.get(ck) ?? cfg.values.map(() => emptyBucket())
    return cfg.values.map((agg, vi) => finalize(bs[vi], agg.kind))
  })

  const grand = cfg.values.map((agg, vi) => finalize(grandB[vi], agg.kind))

  return { rows: rowsSorted, cols: colsSorted, cells, rowTotals, colTotals, grand }
}
