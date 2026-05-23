'use client'

import { useSyncExternalStore, type RefObject } from 'react'

const DEFAULT_BREAKPOINT = 767

function readNarrow(el: HTMLElement | null, breakpoint: number): boolean {
  if (!el) return false
  const w = el.clientWidth
  return w > 0 && w <= breakpoint
}

/**
 * Narrow portal chrome from the Atelier shell container width (`@container atelier`).
 * Full-viewport shell matches viewport ≤767px; embed-friendly when the shell is narrower.
 */
export function useAtelierNarrow(
  containerRef: RefObject<HTMLElement | null>,
  breakpoint = DEFAULT_BREAKPOINT,
): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const el = containerRef.current
      if (!el) return () => {}
      const ro = new ResizeObserver(() => onStoreChange())
      ro.observe(el)
      return () => ro.disconnect()
    },
    () => readNarrow(containerRef.current, breakpoint),
    () => false,
  )
}
