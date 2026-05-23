/**
 * Graph node identity helpers (Slice 5).
 * Canonical DB shape: public.nodes (node_type + source_pk) → node_id UUID.
 */

export const GRAPH_NODE_TYPES = [
  'oeuvre',
  'contact',
  'theme',
  'concept',
  'working_group',
  'exhibition',
] as const

export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number]

const NODE_TYPE_SET = new Set<string>(GRAPH_NODE_TYPES)

export function isGraphNodeType(value: string): value is GraphNodeType {
  return NODE_TYPE_SET.has(value)
}

/** Stable string ref for logs / caches (not the DB primary key). */
export function nodeRef(type: GraphNodeType, sourcePk: number | string): string {
  return `${type}:${String(sourcePk)}`
}

export function parseNodeRef(ref: string): { type: GraphNodeType; sourcePk: string } | null {
  const i = ref.indexOf(':')
  if (i <= 0) return null
  const type = ref.slice(0, i)
  const sourcePk = ref.slice(i + 1)
  if (!isGraphNodeType(type) || !sourcePk) return null
  return { type, sourcePk }
}

export function sourcePkFromOeuvreId(oeuvreId: number): string {
  return String(oeuvreId)
}

export function sourcePkFromContactId(contactId: number): string {
  return String(contactId)
}

export function sourcePkFromThemeId(themeId: number): string {
  return String(themeId)
}

export function sourcePkFromUuid(id: string): string {
  return id
}

/** Row shape of public.entity (post–Slice 5 SQL). */
export type EntityRow = {
  node_id: string
  node_type: GraphNodeType
  source_pk: string
  created_at: string
  display_label: string | null
  title: string | null
  is_public: boolean
  legacy_int_id: number | null
  legacy_uuid: string | null
}

/** tblrelations row with graph uids (legacy oeuvre ids optional shim). */
export type GraphRelationRow = {
  id: string
  source_id: number | null
  target_id: number | null
  source_uid: string | null
  target_uid: string | null
  relation_type: string | null
  strength: number | null
  description: string | null
}

/** True when constellation force-layout can use legacy oeuvre integer positions. */
export function isOeuvreOeuvreEdge(row: GraphRelationRow): boolean {
  return row.source_id != null && row.target_id != null
}
