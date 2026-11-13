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

/** Nodes of every type still waiting for the embed worker (Overview indexing card). */
export async function countEmbeddingBacklog(): Promise<number | null> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return null

  const { count, error } = await supabase
    .from('nodes')
    .select('node_id', { count: 'exact', head: true })
    .in('embedding_status', [...BADGE_EMBEDDING_STATUSES])

  if (error) {
    console.error('[embedding-status]', error.message)
    return null
  }
  return count ?? 0
}

/** Voice notes with audio and no transcript entry yet (Overview "Local jobs" card). */
export async function countVoiceTranscriptBacklog(): Promise<number | null> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return null

  const [notes, done] = await Promise.all([
    supabase.from('voice_note').select('id').not('audio_r2_key', 'is', null),
    supabase.from('journal_entry').select('voice_note_id').not('voice_note_id', 'is', null),
  ])
  if (notes.error || done.error) {
    console.error('[voice-backlog]', notes.error?.message ?? done.error?.message)
    return null
  }
  const transcribed = new Set((done.data ?? []).map(r => r.voice_note_id))
  return (notes.data ?? []).filter(n => !transcribed.has(n.id)).length
}

/** When the PC archive (`npm run archive`) last ran — `system_log` ARCHIVE_RUN row stamped by the script. */
export async function getLastArchiveRun(): Promise<{ at: string | null } | null> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return null
  const { data, error } = await supabase
    .from('system_log')
    .select('created_at')
    .eq('event_type', 'ARCHIVE_RUN')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[archive-run]', error.message)
    return null
  }
  return { at: data?.created_at ?? null }
}
