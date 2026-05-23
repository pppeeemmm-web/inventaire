import { createHash } from 'node:crypto'

/** Slice 8 — shared embedding / Qdrant constants (safe for server + docs). */

export const EMBEDDING_MODEL = 'nomic-embed-text'
export const EMBEDDING_VECTOR_SIZE = 768
export const QDRANT_COLLECTION = 'pem_universe'

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function queryEmbeddingCacheKey(query: string): string {
  return createHash('sha256').update(normalizeSearchQuery(query), 'utf8').digest('hex')
}
