import type { Agg, Dim } from '@/lib/pivot'
import { buildPivot, type PivotResult } from '@/lib/pivot'

/** Matches `public.edge_fact` (Slice 6); alias in supabase.generated after `npm run gen:types`. */
export type EdgeFactRow = {
  edge_id: string
  relation_type: string | null
  strength: number | null
  description: string | null
  edge_created_at: string | null
  legacy_source_oeuvre_id: number | null
  legacy_target_oeuvre_id: number | null
  source_node_id: string | null
  target_node_id: string | null
  source_node_type: string | null
  source_pk: string | null
  source_label: string | null
  source_legacy_int_id: number | null
  source_legacy_uuid: string | null
  target_node_type: string | null
  target_pk: string | null
  target_label: string | null
  target_legacy_int_id: number | null
  target_legacy_uuid: string | null
}

export type ContactThemePivotRow = {
  contactLabel: string
  themeLabel: string
  oeuvreNodeId: string
}

const CONTACT_RELATIONS = new Set(['owner', 'buyer', 'located_at'])

export function dbEdgeFactRow(row: EdgeFactRow): EdgeFactRow | null {
  if (!row.edge_id || !row.source_node_id || !row.target_node_id) return null
  return row
}

/** Join oeuvre→theme with oeuvre→contact edges on the same source oeuvre node. */
export function buildContactThemePivotRows(facts: EdgeFactRow[]): ContactThemePivotRow[] {
  const themesByOeuvre = new Map<string, { label: string }[]>()
  const contactsByOeuvre = new Map<string, { label: string }[]>()

  for (const f of facts) {
    const src = f.source_node_id
    if (!src) continue
    const rel = f.relation_type ?? ''
    if (rel === 'theme' && f.source_node_type === 'oeuvre' && f.target_node_type === 'theme') {
      const label = f.target_label ?? f.target_pk ?? '—'
      const list = themesByOeuvre.get(src) ?? []
      list.push({ label })
      themesByOeuvre.set(src, list)
    }
    if (
      CONTACT_RELATIONS.has(rel) &&
      f.source_node_type === 'oeuvre' &&
      f.target_node_type === 'contact'
    ) {
      const label = f.target_label ?? f.target_pk ?? '—'
      const list = contactsByOeuvre.get(src) ?? []
      list.push({ label })
      contactsByOeuvre.set(src, list)
    }
  }

  const out: ContactThemePivotRow[] = []
  for (const [oeuvreNodeId, themes] of themesByOeuvre) {
    const contacts = contactsByOeuvre.get(oeuvreNodeId)
    if (!contacts?.length) continue
    for (const c of contacts) {
      for (const th of themes) {
        out.push({
          oeuvreNodeId,
          contactLabel: c.label,
          themeLabel: th.label,
        })
      }
    }
  }
  return out
}

export type EdgeFactPivotLabels = {
  relationType: string
  sourceType: string
  targetType: string
  sourceLabel: string
  targetLabel: string
  strength: string
  count: string
  contact: string
  theme: string
}

export function edgeFactPivotDims(
  labels: EdgeFactPivotLabels,
): { dims: Dim<EdgeFactRow>[]; values: Agg<EdgeFactRow>[] } {
  const dims: Dim<EdgeFactRow>[] = [
    {
      id: 'relation_type',
      label: labels.relationType,
      get: (r) => r.relation_type ?? '—',
    },
    {
      id: 'source_type',
      label: labels.sourceType,
      get: (r) => r.source_node_type ?? '—',
    },
    {
      id: 'target_type',
      label: labels.targetType,
      get: (r) => r.target_node_type ?? '—',
    },
    {
      id: 'source_label',
      label: labels.sourceLabel,
      get: (r) => r.source_label ?? '—',
    },
    {
      id: 'target_label',
      label: labels.targetLabel,
      get: (r) => r.target_label ?? '—',
    },
  ]
  const values: Agg<EdgeFactRow>[] = [
    { id: 'count', label: labels.count, kind: 'count' },
    {
      id: 'sum_strength',
      label: labels.strength,
      kind: 'sum',
      get: (r) => (typeof r.strength === 'number' ? r.strength : 0),
    },
  ]
  return { dims, values }
}

export function contactThemePivotDims(
  labels: Pick<EdgeFactPivotLabels, 'contact' | 'theme' | 'count'>,
): { dims: Dim<ContactThemePivotRow>[]; values: Agg<ContactThemePivotRow>[] } {
  return {
    dims: [
      { id: 'contact', label: labels.contact, get: (r) => r.contactLabel },
      { id: 'theme', label: labels.theme, get: (r) => r.themeLabel },
    ],
    values: [{ id: 'count', label: labels.count, kind: 'count' }],
  }
}

/** Run pivot on edge_fact rows (client or server). */
export function pivotEdgeFacts(
  rows: EdgeFactRow[],
  cfg: {
    rowDimId: string
    colDimId?: string
    valueIds: string[]
    labels: EdgeFactPivotLabels
  },
  emptyLabel = '—',
): PivotResult {
  const { dims, values } = edgeFactPivotDims(cfg.labels)
  const rowD = dims.find((d) => d.id === cfg.rowDimId) ?? dims[0]!
  const colD = cfg.colDimId ? dims.find((d) => d.id === cfg.colDimId) : undefined
  const vals = values.filter((v) => cfg.valueIds.includes(v.id))
  return buildPivot(rows, { rowDims: [rowD], colDim: colD, values: vals.length ? vals : values.slice(0, 1) }, emptyLabel)
}

export function pivotContactThemes(
  rows: ContactThemePivotRow[],
  labels: Pick<EdgeFactPivotLabels, 'contact' | 'theme' | 'count'>,
  emptyLabel = '—',
): PivotResult {
  const { dims, values } = contactThemePivotDims(labels)
  return buildPivot(rows, { rowDims: [dims[0]!], colDim: dims[1], values }, emptyLabel)
}
