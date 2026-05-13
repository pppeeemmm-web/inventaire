/** Shared constellation cloud map JSON (R2 blob). Version for migrations. */
export const CONSTELLATION_MAP_VERSION = 1 as const

export type ConstellationGroupBy = 'year' | 'theme' | 'workgroup' | 'none' | 'custom'

export type ConstellationMapPt = { x: number; y: number }

export type ConstellationMapShape =
  | { type: 'line'; points: ConstellationMapPt[]; color: string; width: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; size: number }

/** Frozen edge for recall / export (no DB id required). */
export type ConstellationMapEdgeSnapshot = {
  source_id: number
  target_id: number
  relation_type: string | null
  strength: number | null
  description: string | null
}

export interface ConstellationMapDocument {
  version: typeof CONSTELLATION_MAP_VERSION
  groupBy: ConstellationGroupBy
  selectedThemeId: number | null
  /** Working-group id (uuid string) when groupBy is workgroup */
  selectedGroupId: string | null
  customWorkIds: number[]
  positions: Record<string, ConstellationMapPt>
  shapes: ConstellationMapShape[]
  edgesSnapshot: ConstellationMapEdgeSnapshot[]
  viewport: { x: number; y: number; z: number }
}

export function isConstellationMapDocument(v: unknown): v is ConstellationMapDocument {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.version !== CONSTELLATION_MAP_VERSION) return false
  if (typeof o.groupBy !== 'string') return false
  if (!['year', 'theme', 'workgroup', 'none', 'custom'].includes(o.groupBy)) return false
  if (o.positions == null || typeof o.positions !== 'object') return false
  if (!Array.isArray(o.shapes)) return false
  if (!Array.isArray(o.edgesSnapshot)) return false
  if (!Array.isArray(o.customWorkIds)) return false
  if (!o.customWorkIds.every((x: unknown) => typeof x === 'number')) return false
  if (o.viewport == null || typeof o.viewport !== 'object') return false
  const vp = o.viewport as Record<string, unknown>
  if (typeof vp.x !== 'number' || typeof vp.y !== 'number' || typeof vp.z !== 'number') return false
  const sg = o.selectedGroupId
  if (sg != null && typeof sg !== 'string') return false
  const st = o.selectedThemeId
  if (st != null && typeof st !== 'number') return false
  return true
}
