/**
 * Drawer palette swatch → Inventory colour filter.
 *
 * Same idea as `inventory-filter-handoff.ts`: the family is queued in sessionStorage and
 * consumed by Inventory on mount. When Inventory is already mounted (drawer opened from
 * the Inventory panel), a window event applies it immediately.
 */
import { COLOUR_FAMILIES, type ColourFamily } from '@/lib/colour-families'

const KEY = 'pem_inv_colour'
export const COLOUR_FILTER_EVENT = 'pem:inventory-colour-filter'

export function requestColourFilter(family: ColourFamily): void {
  try {
    sessionStorage.setItem(KEY, family)
  // eslint-disable-next-line pem-i18n/no-silent-catch -- private mode: the event below still applies it in-tab
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent<ColourFamily>(COLOUR_FILTER_EVENT, { detail: family }))
}

export function consumeColourFilter(): ColourFamily | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return (COLOUR_FAMILIES as readonly string[]).includes(raw) ? (raw as ColourFamily) : null
  // eslint-disable-next-line pem-i18n/no-silent-catch -- private mode: nothing queued
  } catch {
    return null
  }
}
