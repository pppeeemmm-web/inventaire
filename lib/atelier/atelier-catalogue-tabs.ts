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
  'kaizen',
  'kaizen-ops',
  'aide',
  'ai',
  // R4: reads its own whole-catalogue bundle (`loadTimePlaceData`).
  'chronologie',
])

/** True when first paint should include the œuvres keyset chunk (or client hydrate). */
export function tabNeedsCatalogueChunkOnColdStart(tab: SegmentedAtelierTab): boolean {
  return !ATELIER_TABS_WITHOUT_CATALOGUE_CHUNK.has(tab)
}

/**
 * Tabs that show the first chunk but never the whole catalogue (TODO 18, Pem « OK » 2026-11-18):
 * Overview counts on the server until the list is complete and shows the 16 newest works; Stock reads
 * no works. Checked against `team-portal-segment-panel.tsx` on 2026-11-18.
 */
const ATELIER_TABS_FIRST_CHUNK_ONLY: ReadonlySet<SegmentedAtelierTab> = new Set(['overview', 'stock'])

/** True when the tab reads the whole catalogue: the rest of the works loads in the background there. */
export function tabNeedsWholeCatalogue(tab: SegmentedAtelierTab): boolean {
  return tabNeedsCatalogueChunkOnColdStart(tab) && !ATELIER_TABS_FIRST_CHUNK_ONLY.has(tab)
}
