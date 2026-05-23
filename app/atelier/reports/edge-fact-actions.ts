'use server'

import { createClient } from '@/lib/supabase/server'
import type { EdgeFactRow } from '@/lib/graph/edge-fact'

export type EdgeFactFetchResult =
  | { error: string }
  | { ok: true; rows: EdgeFactRow[] }

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

export async function fetchEdgeFactRows(): Promise<EdgeFactFetchResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // View exists after graph_foundation/08; regenerate types with npm run gen:types.
  const { data, error } = await supabase
    .from('edge_fact' as 'entity')
    .select(
      'edge_id, relation_type, strength, description, edge_created_at, legacy_source_oeuvre_id, legacy_target_oeuvre_id, source_node_id, target_node_id, source_node_type, source_pk, source_label, source_legacy_int_id, source_legacy_uuid, target_node_type, target_pk, target_label, target_legacy_int_id, target_legacy_uuid',
    )
    .range(0, 49999)

  if (error) return { error: error.message }
  return { ok: true, rows: (data ?? []) as EdgeFactRow[] }
}
