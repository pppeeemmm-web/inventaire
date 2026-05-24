import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'

/**
 * Tabs that do not need the œuvres keyset chunk on cold RSC paint (PEM post-V5 §464).
 * Catalogue loads client-side when the user navigates here from a deferred shell.
 */
export const ATELIER_TABS_WITHOUT_CATALOGUE_CHUNK: ReadonlySet<SegmentedAtelierTab> = new Set([
  'audit',
  'broadcast',
  'concepts',
  'logistics',
  'stock-take',
  'system',
  'journal',
  'analytics',
])

/** True when first paint should include the œuvres keyset chunk (or client hydrate). */
export function tabNeedsCatalogueChunkOnColdStart(tab: SegmentedAtelierTab): boolean {
  return !ATELIER_TABS_WITHOUT_CATALOGUE_CHUNK.has(tab)
}
