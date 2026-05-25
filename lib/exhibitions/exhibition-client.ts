import type { Database, Json } from '@/lib/types/supabase.generated'
import { asTypedSupabase } from '@/lib/pipeline/suivi-client'

export { fromSuiviProcess, fromSuiviEtape } from '@/lib/pipeline/suivi-client'
export { fromOeuvres } from '@/lib/vault/vault-client'

export type ExhibitionLayoutRow = Database['public']['Tables']['exhibition_layout']['Row']
export type ExhibitionLayoutUpdate = Database['public']['Tables']['exhibition_layout']['Update']

type SuiviProcessUpdate = Database['public']['Tables']['suivi_process']['Update']
type SuiviEtapeInsert = Database['public']['Tables']['suivi_etape']['Insert']
type SuiviEtapeUpdate = Database['public']['Tables']['suivi_etape']['Update']

export function fromExhibitionLayout(sb: unknown) {
  return asTypedSupabase(sb).from('exhibition_layout')
}

export function toLayoutJson<T>(value: T): Json {
  return value as unknown as Json
}

export interface LayoutWall {
  id: string
  nom: string
  color: string
}

export interface LayoutPlacement {
  oeuvre_id: number
  wall_id: string
  position: number
  scale: number
  label?: string
  x?: number
  y?: number
}

export interface ExhibitionLayoutView {
  id: string
  created_at: string
  updated_at: string
  nom: string
  process_id: string | null
  floorplan_path: string | null
  floorplan_w: number | null
  floorplan_h: number | null
  walls: LayoutWall[]
  placements: LayoutPlacement[]
  notes: string | null
}

export function asExhibitionLayout(row: ExhibitionLayoutRow): ExhibitionLayoutView {
  return {
    ...row,
    walls: (row.walls as unknown as LayoutWall[]) ?? [],
    placements: (row.placements as unknown as LayoutPlacement[]) ?? [],
  }
}

function nullsToUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v]),
  )
}

export function toSuiviProcessUpdate(patch: Record<string, unknown>): SuiviProcessUpdate {
  return nullsToUndefined(patch) as SuiviProcessUpdate
}

export function toSuiviEtapeInsert(step: Record<string, unknown>): SuiviEtapeInsert {
  return nullsToUndefined(step) as SuiviEtapeInsert
}

export function toSuiviEtapeUpdate(step: Record<string, unknown>): SuiviEtapeUpdate {
  return nullsToUndefined(step) as SuiviEtapeUpdate
}

export function toLayoutUpdate(
  patch: Partial<Pick<ExhibitionLayoutView, 'nom' | 'walls' | 'placements' | 'notes' | 'process_id'>>,
): ExhibitionLayoutUpdate {
  const update: ExhibitionLayoutUpdate = {}
  if (patch.nom !== undefined) update.nom = patch.nom
  if (patch.notes !== undefined) update.notes = patch.notes
  if (patch.process_id !== undefined) update.process_id = patch.process_id
  if (patch.walls !== undefined) update.walls = toLayoutJson(patch.walls)
  if (patch.placements !== undefined) update.placements = toLayoutJson(patch.placements)
  return update
}
