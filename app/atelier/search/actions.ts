'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  EMBEDDING_MODEL,
  QDRANT_COLLECTION,
  normalizeSearchQuery,
} from '@/lib/graph/embedding-config'
import {
  cacheQueryVector,
  enqueuePendingQueryEmbedding,
  getCachedQueryVector,
} from '@/lib/graph/query-embedding-cache'
import { resolveOllamaClientUrl } from '@/lib/contact-url-enrich'
import { dbEntityToEntityRow } from '@/lib/graph/entity-rows'
import type { EntityRow } from '@/lib/graph/node-ref'

export type SemanticSearchHit = {
  nodeId: string
  nodeType: string
  label: string
  score: number
  legacyIntId: number | null
}

export type SemanticSearchResult =
  | { error: string }
  | { ok: true; hits: SemanticSearchHit[]; unavailable?: boolean; pending?: boolean }

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

function qdrantConfig() {
  const url = process.env.QDRANT_URL?.trim()
  const key = process.env.QDRANT_API_KEY?.trim()
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

function isLocalOllamaReachable(): boolean {
  return Boolean(
    process.env.OLLAMA_ORIGIN?.trim() ||
      process.env.OLLAMA_WEB_URL?.trim() ||
      process.env.OLLAMA_HOST?.trim() ||
      process.env.VERCEL !== '1',
  )
}

async function embedQueryViaOllama(text: string): Promise<number[]> {
  const res = await fetch(`${resolveOllamaClientUrl()}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}`)
  }
  const json = (await res.json()) as { embedding?: number[] }
  if (!Array.isArray(json.embedding)) {
    throw new Error('Invalid Ollama embedding response')
  }
  return json.embedding
}

async function resolveQueryVector(
  svc: ReturnType<typeof createServiceClient>,
  queryNorm: string,
): Promise<{ vector: number[] } | { pending: true } | { unavailable: true }> {
  const cached = await getCachedQueryVector(svc, queryNorm)
  if (cached) return { vector: cached }

  if (isLocalOllamaReachable()) {
    try {
      const vector = await embedQueryViaOllama(queryNorm)
      await cacheQueryVector(svc, queryNorm, vector)
      return { vector }
    } catch {
      // fall through to enqueue
    }
  }

  try {
    await enqueuePendingQueryEmbedding(svc, queryNorm)
    return { pending: true }
  } catch {
    return { unavailable: true }
  }
}

async function qdrantSearch(vector: number[], limit: number) {
  const cfg = qdrantConfig()
  if (!cfg) return null
  const res = await fetch(`${cfg.url}/collections/${QDRANT_COLLECTION}/points/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.key,
    },
    body: JSON.stringify({ vector, limit, with_payload: true }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`Qdrant ${res.status}`)
  }
  const json = (await res.json()) as { result?: { id: string | number; score: number; payload?: Record<string, unknown> }[] }
  return json.result ?? []
}

async function hydrateSemanticHits(
  results: NonNullable<Awaited<ReturnType<typeof qdrantSearch>>>,
): Promise<SemanticSearchHit[]> {
  const nodeIds = results
    .map((r) => {
      const p = r.payload
      if (p && typeof p.node_id === 'string') return p.node_id
      return String(r.id)
    })
    .filter(Boolean)

  const svc = createServiceClient()
  const { data: entities, error: entErr } = await svc
    .from('entity')
    .select('node_id, node_type, source_pk, created_at, display_label, title, is_public, legacy_int_id, legacy_uuid')
    .in('node_id', nodeIds)
  if (entErr) throw new Error(entErr.message)

  const byId = new Map<string, EntityRow>()
  for (const row of entities ?? []) {
    const parsed = dbEntityToEntityRow(row)
    if (parsed) byId.set(parsed.node_id, parsed)
  }

  return results
    .map((r) => {
      const nodeId =
        (typeof r.payload?.node_id === 'string' ? r.payload.node_id : String(r.id))
      const ent = byId.get(nodeId)
      return {
        nodeId,
        nodeType: ent?.node_type ?? String(r.payload?.node_type ?? ''),
        label: ent?.display_label ?? ent?.title ?? nodeId,
        score: r.score,
        legacyIntId: ent?.legacy_int_id ?? null,
      }
    })
    .filter((h) => h.nodeId)
}

export async function searchSemanticAtelier(query: string): Promise<SemanticSearchResult> {
  const { error: authErr } = await guardTeam()
  if (authErr) return { error: authErr }

  const q = normalizeSearchQuery(query)
  if (q.length < 2) return { ok: true, hits: [] }

  const cfg = qdrantConfig()
  if (!cfg) return { ok: true, hits: [], unavailable: true }

  try {
    const svc = createServiceClient()
    const resolved = await resolveQueryVector(svc, q)
    if ('pending' in resolved) return { ok: true, hits: [], pending: true }
    if ('unavailable' in resolved) return { ok: true, hits: [], unavailable: true }

    const results = await qdrantSearch(resolved.vector, 12)
    if (!results?.length) return { ok: true, hits: [] }

    const hits = await hydrateSemanticHits(results)
    return { ok: true, hits }
  } catch {
    return { ok: true, hits: [], unavailable: true }
  }
}
