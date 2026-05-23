'use server'

import { createClient } from '@/lib/supabase/server'
import {
  BADGE_EMBEDDING_STATUSES,
  isEmbeddingStatus,
  type EmbeddingStatus,
} from '@/lib/graph/embedding-status'

export type OeuvreEmbeddingStatusMap = Record<number, EmbeddingStatus>

async function guardTeam() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

/** All oeuvres whose embedding is not yet searchable (small set → one query). */
export async function fetchNonOkOeuvreEmbeddingStatuses(): Promise<OeuvreEmbeddingStatusMap> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return {}

  const { data, error } = await supabase
    .from('nodes')
    .select('source_pk, embedding_status')
    .eq('node_type', 'oeuvre')
    .in('embedding_status', [...BADGE_EMBEDDING_STATUSES])

  if (error) {
    console.error('[embedding-status]', error.message)
    return {}
  }

  const out: OeuvreEmbeddingStatusMap = {}
  for (const row of data ?? []) {
    const id = Number(row.source_pk)
    if (Number.isFinite(id) && isEmbeddingStatus(row.embedding_status)) {
      out[id] = row.embedding_status
    }
  }
  return out
}
