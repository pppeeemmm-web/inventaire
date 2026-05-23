/** Tabs with dedicated App Router segments (Slice 3 + 3B). */
export type SegmentedAtelierTab =
  | 'overview'
  | 'inventory'
  | 'sales'
  | 'pipeline'
  | 'production'
  | 'stock-take'
  | 'notes'
  | 'reports'
  | 'exhibitions'
  | 'concepts'
  | 'themes'
  | 'logistics'
  | 'vault'
  | 'fiscal'
  | 'broadcast'
  | 'audit'
  | 'constellation'
  | 'map'
  | 'journal'
  | 'system'
  | 'portfolio'
  | 'contacts'
  | 'stock'
  | 'site'
  | 'analytics'

export const ATELIER_SEGMENTED_TAB_ROUTES: Record<SegmentedAtelierTab, string> = {
  overview: '/atelier/overview',
  inventory: '/atelier/inventory',
  sales: '/atelier/sales',
  pipeline: '/atelier/pipeline',
  production: '/atelier/production',
  'stock-take': '/atelier/stock-take',
  notes: '/atelier/notes',
  reports: '/atelier/reports',
  exhibitions: '/atelier/exhibitions',
  concepts: '/atelier/concepts',
  themes: '/atelier/themes',
  logistics: '/atelier/logistics',
  vault: '/atelier/vault',
  fiscal: '/atelier/fiscal',
  broadcast: '/atelier/broadcast',
  audit: '/atelier/audit',
  constellation: '/atelier/constellation',
  map: '/atelier/map',
  journal: '/atelier/journal',
  system: '/atelier/system',
  portfolio: '/atelier/portfolio',
  contacts: '/atelier/contacts',
  stock: '/atelier/stock',
  site: '/atelier/site',
  analytics: '/atelier/analytics',
}

export function isSegmentedAtelierTab(tab: string): tab is SegmentedAtelierTab {
  return tab in ATELIER_SEGMENTED_TAB_ROUTES
}

/** Canonical href for portal tab navigation. */
export function atelierTabHref(tab: string): string {
  if (isSegmentedAtelierTab(tab)) return ATELIER_SEGMENTED_TAB_ROUTES[tab]
  return `/atelier/overview`
}

/** Legacy `?tab=` links → segment route (308 on `/atelier`). */
export function legacyTabRedirectPath(tab: string | undefined): string | null {
  if (tab && isSegmentedAtelierTab(tab)) return ATELIER_SEGMENTED_TAB_ROUTES[tab]
  return null
}
