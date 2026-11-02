import type { FieldFilter, ReportConfig, ValuesMode } from '@/lib/reports/engine'

/** Which section a report reads from (Access-style "Rapport" button on that section). */
export type ReportSource = 'works' | 'production' | 'constats' | 'kaizen' | 'sales' | 'contacts'
export const REPORT_SOURCES: readonly ReportSource[] = ['works', 'production', 'constats', 'kaizen', 'sales', 'contacts'] as const

export type SavedReport = {
  id: number
  name: string
  source: ReportSource
  config: ReportConfig
  owner_id: string | null
  updated_at: string
}

export function parseReportSource(raw: unknown): ReportSource | null {
  return typeof raw === 'string' && (REPORT_SOURCES as readonly string[]).includes(raw) ? (raw as ReportSource) : null
}

function parseFilter(raw: unknown): FieldFilter | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  if (o.type === 'text') return { type: 'text', q: s('q') }
  if (o.type === 'range') return { type: 'range', min: s('min'), max: s('max') }
  if (o.type === 'bool') return { type: 'bool', value: o.value === true }
  if (o.type === 'values') {
    const mode = (['any', 'all', 'none'].includes(String(o.mode)) ? o.mode : 'any') as ValuesMode
    const values = Array.isArray(o.values) ? o.values.filter((v): v is string => typeof v === 'string') : []
    return { type: 'values', mode, values }
  }
  return null
}

/**
 * Defensive read of a stored config. Field ids are checked against the source later
 * (`cleanConfig`), since the source's field list lives in the client.
 */
export function parseReportConfig(raw: unknown): ReportConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const fields = Array.isArray(o.fields) ? o.fields.filter((v): v is string => typeof v === 'string') : []
  const filters: Record<string, FieldFilter> = {}
  if (o.filters && typeof o.filters === 'object') {
    for (const [k, v] of Object.entries(o.filters as Record<string, unknown>)) {
      const f = parseFilter(v)
      if (f) filters[k] = f
    }
  }
  const sortRaw = (o.sort && typeof o.sort === 'object' ? o.sort : {}) as Record<string, unknown>
  return {
    fields,
    filters,
    sort: { field: typeof sortRaw.field === 'string' ? sortRaw.field : '', dir: sortRaw.dir === 'asc' ? 'asc' : 'desc' },
    q: typeof o.q === 'string' ? o.q : '',
    pivot: o.pivot === true,
  }
}
