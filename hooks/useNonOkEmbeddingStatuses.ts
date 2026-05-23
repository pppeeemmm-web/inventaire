'use client'

import { useEffect, useState } from 'react'
import { fetchNonOkOeuvreEmbeddingStatuses } from '@/app/atelier/embedding-status-actions'
import type { OeuvreEmbeddingStatusMap } from '@/app/atelier/embedding-status-actions'

const POLL_MS = 30_000

/** Loads oeuvre ids with pending/embedding/error status; polls while any are in-flight. */
export function useNonOkEmbeddingStatuses(): OeuvreEmbeddingStatusMap {
  const [map, setMap] = useState<OeuvreEmbeddingStatusMap>({})

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function load() {
      const next = await fetchNonOkOeuvreEmbeddingStatuses()
      if (cancelled) return
      setMap(next)
      const hasInFlight = Object.values(next).some((s) => s === 'pending' || s === 'embedding')
      if (hasInFlight) {
        timer = setTimeout(() => {
          void load()
        }, POLL_MS)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return map
}
