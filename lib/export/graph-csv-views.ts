import type { Database } from '@/lib/types/supabase.generated'

type EntityRow = Database['public']['Views']['entity']['Row']
type EdgeFactRow = Database['public']['Views']['edge_fact']['Row']

export type GraphCsvView = 'entity' | 'edge_fact'

export type GraphCsvViewConfig<Row extends Record<string, unknown>> = {
  view: GraphCsvView
  table: GraphCsvView
  select: string
  columns: { key: keyof Row & string; header: string }[]
}

export const ENTITY_CSV_CONFIG: GraphCsvViewConfig<EntityRow> = {
  view: 'entity',
  table: 'entity',
  select:
    'node_id, node_type, source_pk, created_at, display_label, title, is_public, legacy_int_id, legacy_uuid',
  columns: [
    { key: 'node_id', header: 'node_id' },
    { key: 'node_type', header: 'node_type' },
    { key: 'source_pk', header: 'source_pk' },
    { key: 'created_at', header: 'created_at' },
    { key: 'display_label', header: 'display_label' },
    { key: 'title', header: 'title' },
    { key: 'is_public', header: 'is_public' },
    { key: 'legacy_int_id', header: 'legacy_int_id' },
    { key: 'legacy_uuid', header: 'legacy_uuid' },
  ],
}

export const EDGE_FACT_CSV_CONFIG: GraphCsvViewConfig<EdgeFactRow> = {
  view: 'edge_fact',
  table: 'edge_fact',
  select:
    'edge_id, relation_type, strength, description, edge_created_at, legacy_source_oeuvre_id, legacy_target_oeuvre_id, source_node_id, target_node_id, source_node_type, source_pk, source_label, source_legacy_int_id, source_legacy_uuid, target_node_type, target_pk, target_label, target_legacy_int_id, target_legacy_uuid',
  columns: [
    { key: 'edge_id', header: 'edge_id' },
    { key: 'relation_type', header: 'relation_type' },
    { key: 'strength', header: 'strength' },
    { key: 'description', header: 'description' },
    { key: 'edge_created_at', header: 'edge_created_at' },
    { key: 'legacy_source_oeuvre_id', header: 'legacy_source_oeuvre_id' },
    { key: 'legacy_target_oeuvre_id', header: 'legacy_target_oeuvre_id' },
    { key: 'source_node_id', header: 'source_node_id' },
    { key: 'target_node_id', header: 'target_node_id' },
    { key: 'source_node_type', header: 'source_node_type' },
    { key: 'source_pk', header: 'source_pk' },
    { key: 'source_label', header: 'source_label' },
    { key: 'source_legacy_int_id', header: 'source_legacy_int_id' },
    { key: 'source_legacy_uuid', header: 'source_legacy_uuid' },
    { key: 'target_node_type', header: 'target_node_type' },
    { key: 'target_pk', header: 'target_pk' },
    { key: 'target_label', header: 'target_label' },
    { key: 'target_legacy_int_id', header: 'target_legacy_int_id' },
    { key: 'target_legacy_uuid', header: 'target_legacy_uuid' },
  ],
}

export type AnyGraphCsvConfig = typeof ENTITY_CSV_CONFIG | typeof EDGE_FACT_CSV_CONFIG

export function resolveGraphCsvView(raw: string | null): AnyGraphCsvConfig | null {
  if (raw === 'entity') return ENTITY_CSV_CONFIG
  if (raw === 'edge_fact') return EDGE_FACT_CSV_CONFIG
  return null
}

export function rowToCsvCells(
  row: Record<string, unknown>,
  columns: { key: string; header: string }[],
): unknown[] {
  return columns.map((col) => row[col.key] ?? '')
}
