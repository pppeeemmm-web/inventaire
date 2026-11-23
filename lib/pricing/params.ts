// Reverse pricing — the few numbers the calculator starts from (docs/design/2026-11-23/ReversePricing.md §9).
// Edited in code once a year. No table. Fiscal.tsx still holds its own URSSAF_RATE copy: when the rate
// changes, change both until Fiscal reads it from here.

/** Artist-author social contributions (URSSAF) as a share of what the studio receives. À confirmer avec le comptable. */
export const CONTRIBUTIONS_RATE = 0.211

export type ChannelId = 'studio' | 'gallery' | 'fair' | 'online' | 'patron'

/** A channel's starting knobs: commission % of the price paid, discount % of the list, extra cost in €. */
export type ChannelKnobs = { id: ChannelId; c: number; d: number; x: number }

export const DEFAULT_CHANNELS: readonly ChannelKnobs[] = [
  { id: 'studio', c: 0, d: 0, x: 0 },
  { id: 'gallery', c: 40, d: 0, x: 0 },
  { id: 'fair', c: 0, d: 0, x: 0 },
  { id: 'online', c: 15, d: 0, x: 0 },
  { id: 'patron', c: 0, d: 0, x: 0 },
]

/** Rounding of a list price: 10 € below 5 000 €, 50 € from 5 000 € (Pem 2026-11-23). */
export function listStep(list: number): number {
  return list >= 5000 ? 50 : 10
}
