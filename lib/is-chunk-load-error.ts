/** True when webpack/Next failed to fetch a code-split chunk (common after deploy + stale SW/HTML). */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /Loading chunk \d+ failed/i.test(msg) || /ChunkLoadError/i.test(msg)
}

export const PEM_CHUNK_RELOAD_KEY = 'pem-chunk-reload-attempted'
