export type AtelierTabId =
  | 'overview'
  | 'inventory'
  | 'reports'
  | 'constellation'
  | 'production'
  | 'logistics'
  | 'sales'
  | 'exhibitions'
  | 'vault'
  | 'contacts'
  | 'map'
  | 'pipeline'
  | 'fiscal'
  | 'concepts'
  | 'themes'
  | 'stock'
  | 'stock-take'
  | 'notes'
  | 'system'
  | 'portfolio'
  | 'audit'
  | 'broadcast'

export type AtelierTabFreshnessClass =
  | 'route-fresh'
  | 'warm-catalogue'
  | 'interaction-fresh'
  | 'cold'
  | 'derived'

export type AtelierTabCachePolicy = {
  freshness: AtelierTabFreshnessClass
  dataOwner: string
  staleMs: number
  refreshOn: readonly string[]
  invalidateOn: readonly string[]
}

const MINUTE = 60_000

/**
 * Tab data contract: no interaction keeps cached tab payloads; tab entry or domain
 * mutations refresh the smallest affected bundle.
 */
export const ATELIER_TAB_CACHE_POLICY: Record<AtelierTabId, AtelierTabCachePolicy> = {
  overview: {
    freshness: 'route-fresh',
    dataOwner: 'Atelier RSC bootstrap',
    staleMs: 0,
    refreshOn: ['route-load'],
    invalidateOn: ['reminder', 'pipeline', 'concept', 'fiscal'],
  },
  inventory: {
    freshness: 'warm-catalogue',
    dataOwner: 'TeamPortalClient catalogue state',
    staleMs: 10 * MINUTE,
    refreshOn: ['first-open', 'manual-load-more'],
    invalidateOn: ['work', 'theme', 'group', 'status', 'presentation'],
  },
  reports: {
    freshness: 'derived',
    dataOwner: 'Loaded catalogue props; exports fetch server-side on demand',
    staleMs: 30 * MINUTE,
    refreshOn: ['export'],
    invalidateOn: ['work', 'theme', 'group', 'status'],
  },
  constellation: {
    freshness: 'warm-catalogue',
    dataOwner: 'Constellation actions plus catalogue props',
    staleMs: 10 * MINUTE,
    refreshOn: ['first-open', 'graph-mutation'],
    invalidateOn: ['work', 'theme', 'group', 'relation'],
  },
  production: {
    freshness: 'warm-catalogue',
    dataOwner: 'Production tab actions plus catalogue props',
    staleMs: 5 * MINUTE,
    refreshOn: ['first-open', 'action-mutation'],
    invalidateOn: ['work', 'status', 'work-action'],
  },
  logistics: {
    freshness: 'interaction-fresh',
    dataOwner: 'Logistics tab server actions',
    staleMs: 5 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'shipment-mutation'],
    invalidateOn: ['shipment', 'shipment-work'],
  },
  sales: {
    freshness: 'interaction-fresh',
    dataOwner: 'Sales tab server actions',
    staleMs: 5 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'sale-mutation', 'payment-mutation'],
    invalidateOn: ['sale-order', 'payment', 'work-price'],
  },
  exhibitions: {
    freshness: 'interaction-fresh',
    dataOwner: 'Exhibition server actions',
    staleMs: 5 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'exhibition-mutation'],
    invalidateOn: ['exhibition', 'exhibition-step', 'calendar-link'],
  },
  vault: {
    freshness: 'cold',
    dataOwner: 'Vault document table',
    staleMs: 30 * MINUTE,
    refreshOn: ['first-open', 'document-mutation', 'manual-refresh'],
    invalidateOn: ['document'],
  },
  contacts: {
    freshness: 'interaction-fresh',
    dataOwner: 'Post-paint contacts plus contact editor reads',
    staleMs: 10 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'contact-mutation'],
    invalidateOn: ['contact', 'contact-address', 'contact-role'],
  },
  map: {
    freshness: 'cold',
    dataOwner: 'Contact addresses plus local geocode cache',
    staleMs: 60 * MINUTE,
    refreshOn: ['first-open', 'manual-refresh'],
    invalidateOn: ['contact-address', 'geocode-cache'],
  },
  pipeline: {
    freshness: 'interaction-fresh',
    dataOwner: 'Pipeline server actions',
    staleMs: 2 * MINUTE,
    refreshOn: ['route-bootstrap', 'first-open', 'stale-open', 'pipeline-mutation'],
    invalidateOn: ['pipeline', 'pipeline-step', 'reminder'],
  },
  fiscal: {
    freshness: 'interaction-fresh',
    dataOwner: 'Fiscal tab expense reads',
    staleMs: 10 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'expense-mutation', 'year-change'],
    invalidateOn: ['expense', 'sale-order'],
  },
  concepts: {
    freshness: 'cold',
    dataOwner: 'Concept server actions',
    staleMs: 30 * MINUTE,
    refreshOn: ['first-open', 'concept-mutation'],
    invalidateOn: ['concept'],
  },
  themes: {
    freshness: 'warm-catalogue',
    dataOwner: 'Shared junction/reference state',
    staleMs: 10 * MINUTE,
    refreshOn: ['first-open', 'theme-mutation'],
    invalidateOn: ['theme', 'group', 'work-public-flag'],
  },
  portfolio: {
    freshness: 'warm-catalogue',
    dataOwner: 'Portfolio config cache plus catalogue props',
    staleMs: 10 * MINUTE,
    refreshOn: ['first-open', 'config-mutation', 'analytics-open'],
    invalidateOn: ['portfolio', 'work-public-flag'],
  },
  broadcast: {
    freshness: 'interaction-fresh',
    dataOwner: 'Broadcast dashboard action',
    staleMs: 2 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'broadcast-mutation'],
    invalidateOn: ['broadcast-queue', 'broadcast-event'],
  },
  stock: {
    freshness: 'interaction-fresh',
    dataOwner: 'Supplier stock item reads',
    staleMs: 10 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'stock-mutation'],
    invalidateOn: ['stock-item'],
  },
  'stock-take': {
    freshness: 'interaction-fresh',
    dataOwner: 'Stock take item reads',
    staleMs: 5 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'stock-count-mutation'],
    invalidateOn: ['stock-item', 'stock-take'],
  },
  notes: {
    freshness: 'interaction-fresh',
    dataOwner: 'Voice note server actions',
    staleMs: 2 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'voice-note-mutation'],
    invalidateOn: ['voice-note'],
  },
  system: {
    freshness: 'interaction-fresh',
    dataOwner: 'Manual system_log reads',
    staleMs: 5 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'ledger-mutation'],
    invalidateOn: ['system-log'],
  },
  audit: {
    freshness: 'interaction-fresh',
    dataOwner: 'Audit/pending actions',
    staleMs: 2 * MINUTE,
    refreshOn: ['first-open', 'stale-open', 'review-mutation'],
    invalidateOn: ['pending-change', 'system-log', 'work-session'],
  },
}

export function atelierTabCacheKey(tab: AtelierTabId, scope = 'default') {
  return `atelier:${tab}:${scope}`
}
