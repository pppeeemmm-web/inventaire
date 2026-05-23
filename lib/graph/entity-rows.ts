import type { Database } from '@/lib/types/supabase.generated'
import {
  type EntityRow,
  type GraphRelationRow,
  type GraphNodeType,
  isGraphNodeType,
} from '@/lib/graph/node-ref'

export type DbEntityRow = Database['public']['Views']['entity']['Row']

export function dbEntityToEntityRow(row: DbEntityRow): EntityRow | null {
  if (!row.node_id || !row.node_type || !row.source_pk) return null
  if (!isGraphNodeType(row.node_type)) return null
  return {
    node_id: row.node_id,
    node_type: row.node_type as GraphNodeType,
    source_pk: row.source_pk,
    created_at: row.created_at ?? '',
    display_label: row.display_label,
    title: row.title,
    is_public: row.is_public ?? false,
    legacy_int_id: row.legacy_int_id,
    legacy_uuid: row.legacy_uuid,
  }
}

export function collectRelationNodeIds(relations: GraphRelationRow[]): string[] {
  const ids = new Set<string>()
  for (const r of relations) {
    if (r.source_uid) ids.add(r.source_uid)
    if (r.target_uid) ids.add(r.target_uid)
  }
  return [...ids]
}

export function partitionConstellationEdges(relations: GraphRelationRow[]) {
  const canvasEdges: GraphRelationRow[] = []
  const graphOnlyEdges: GraphRelationRow[] = []
  for (const r of relations) {
    if (r.source_id != null && r.target_id != null) canvasEdges.push(r)
    else graphOnlyEdges.push(r)
  }
  return { canvasEdges, graphOnlyEdges }
}
