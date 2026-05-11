'use client'

import { useSyncExternalStore } from 'react'

/** SSR-safe; defaults to `false` until hydrated. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', onStoreChange)
      return () => m.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
