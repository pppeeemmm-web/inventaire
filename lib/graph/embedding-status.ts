/** Slice 8 — node embedding_status values surfaced in Atelier lists. */

export const EMBEDDING_STATUSES = ['pending', 'embedding', 'ok', 'error', 'skipped'] as const

export type EmbeddingStatus = (typeof EMBEDDING_STATUSES)[number]

export function isEmbeddingStatus(raw: string): raw is EmbeddingStatus {
  return (EMBEDDING_STATUSES as readonly string[]).includes(raw)
}

/** Statuses that warrant a list badge (worker not finished or failed). */
export const BADGE_EMBEDDING_STATUSES: readonly EmbeddingStatus[] = ['pending', 'embedding', 'error']

export function shouldShowEmbeddingBadge(
  status: EmbeddingStatus | undefined,
): status is 'pending' | 'embedding' | 'error' {
  return status != null && BADGE_EMBEDDING_STATUSES.includes(status)
}
