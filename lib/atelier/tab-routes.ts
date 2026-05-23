/** Tabs with dedicated App Router segments (Slice 3 migration). */
export type SegmentedAtelierTab = 'inventory' | 'sales'

export const ATELIER_SEGMENTED_TAB_ROUTES: Record<SegmentedAtelierTab, string> = {
  inventory: '/atelier/inventory',
  sales: '/atelier/sales',
}

export function isSegmentedAtelierTab(tab: string): tab is SegmentedAtelierTab {
  return tab in ATELIER_SEGMENTED_TAB_ROUTES
}

/** Canonical href for portal tab navigation (segment route or legacy query). */
export function atelierTabHref(tab: string): string {
  if (isSegmentedAtelierTab(tab)) return ATELIER_SEGMENTED_TAB_ROUTES[tab]
  return `/atelier?tab=${encodeURIComponent(tab)}`
}

/** Legacy `?tab=` links that should 308/redirect to a segment route. */
export function legacyTabRedirectPath(tab: string | undefined): string | null {
  if (tab && isSegmentedAtelierTab(tab)) return ATELIER_SEGMENTED_TAB_ROUTES[tab]
  return null
}
