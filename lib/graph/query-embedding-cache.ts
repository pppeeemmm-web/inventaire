import type { SupabaseClient } from '@supabase/supabase-js'
import { EMBEDDING_MODEL, normalizeSearchQuery } from '@/lib/graph/embedding-config'

function parseVector(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || !raw.every((n) => typeof n === 'number')) return null
  return raw
}

/** Read a cached query vector (production path — no local Ollama). */
export async function getCachedQueryVector(
  svc: SupabaseClient,
  query: string,
): Promise<number[] | null> {
  const queryNorm = normalizeSearchQuery(query)
  const { data, error } = await svc
    .from('query_embedding_cache')
    .select('vector')
    .eq('query_norm', queryNorm)
    .maybeSingle()
  if (error || !data) return null
  return parseVector(data.vector)
}

/** Persist an embedded query so Vercel can search Qdrant without Ollama. */
export async function cacheQueryVector(
  svc: SupabaseClient,
  query: string,
  vector: number[],
): Promise<void> {
  const queryNorm = normalizeSearchQuery(query)
  const { error } = await svc.from('query_embedding_cache').upsert({
    query_norm: queryNorm,
    vector,
    model: EMBEDDING_MODEL,
  })
  if (error) throw new Error(error.message)
}

/** Queue a query for the desktop embed worker (deduped by normalized text). */
export async function enqueuePendingQueryEmbedding(
  svc: SupabaseClient,
  query: string,
): Promise<void> {
  const queryNorm = normalizeSearchQuery(query)
  const { data: existing } = await svc
    .from('pending_query_embeddings')
    .select('id')
    .eq('query_norm', queryNorm)
    .limit(1)
  if (existing?.length) return

  const { error } = await svc.from('pending_query_embeddings').insert({ query_norm: queryNorm })
  if (error) throw new Error(error.message)
}
