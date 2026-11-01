import { createHash } from 'node:crypto'

/** Slice 8 — shared embedding constants (safe for server + docs). Vectors: `nodes.embedding` (pgvector). */

export const EMBEDDING_MODEL = 'nomic-embed-text'
export const EMBEDDING_VECTOR_SIZE = 768

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function queryEmbeddingCacheKey(query: string): string {
  return createHash('sha256').update(normalizeSearchQuery(query), 'utf8').digest('hex')
}
