/**
 * One-shot filter hand-off into the Inventory tab.
 *
 * The atelier portal is a single client shell with tab switching rather than real
 * navigation, so a deep link is expressed as sessionStorage + `onGoTab('inventory')`.
 * Same pattern as `pem_open_contact` (TeamPortalClient → ContactsTab) and
 * `pem_inv_scroll` (Inventory's own scroll restore).
 *
 * The payload is consumed and cleared by Inventory on mount, so it never re-applies.
 */

export const INVENTORY_FILTER_HANDOFF_KEY = 'pem_inv_criteria'

/** Mirrors Inventory's `Criterion`, minus the locally-assigned `id`. */
export interface InventoryHandoffCriterion {
  field: string
  op: string
  value?: string
}

export interface InventoryFilterHandoff {
  /** Human-readable origin, shown as the active-filter label. */
  label: string
  criteria: InventoryHandoffCriterion[]
}

/** Queue a filter for the Inventory tab. Call immediately before `onGoTab('inventory')`. */
export function queueInventoryFilter(handoff: InventoryFilterHandoff): void {
  try {
    sessionStorage.setItem(INVENTORY_FILTER_HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    // Private-mode / quota: the tab switch still happens, just unfiltered.
  }
}

/** Read and clear a queued filter. Returns null when there is nothing pending. */
export function consumeInventoryFilter(): InventoryFilterHandoff | null {
  try {
    const raw = sessionStorage.getItem(INVENTORY_FILTER_HANDOFF_KEY)
    if (!raw) return null
    sessionStorage.removeItem(INVENTORY_FILTER_HANDOFF_KEY)
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const { label, criteria } = parsed as Partial<InventoryFilterHandoff>
    if (!Array.isArray(criteria) || criteria.length === 0) return null
    const clean = criteria.filter(
      (c): c is InventoryHandoffCriterion =>
        !!c && typeof c.field === 'string' && typeof c.op === 'string',
    )
    if (clean.length === 0) return null
    return { label: typeof label === 'string' ? label : '', criteria: clean }
  } catch {
    return null
  }
}
