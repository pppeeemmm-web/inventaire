// R7b — the order drives the chain (docs/design/2026-11-18/R7b_OrderCascade.notes.md). Browser-safe:
// shipment steps, prep demands, invoice settings. Tables: supabase/sql/r7b_order_cascade.sql
// (applied live 2026-11-18, Pem « ok »).

import type { DictKey } from '@/lib/i18n/dictionary'

export type ShipmentKind = 'ship' | 'pickup' | 'return'
export type ShipmentStatus = 'open' | 'photos' | 'picked' | 'packed' | 'insured' | 'labelled' | 'shipped' | 'delivered' | 'cancelled'
export type DemandKind = 'framing' | 'mounting' | 'dedication'

/** Pem 2026-11-18: framing, mounting, dedication / signature. */
export const DEMAND_KINDS: readonly DemandKind[] = ['framing', 'mounting', 'dedication']
export const DEMAND_LABEL: Record<DemandKind, DictKey> = {
  framing: 'cas_demand_framing', mounting: 'cas_demand_mounting', dedication: 'cas_demand_dedication',
}

/** The checklist, in order. A pick-up has no insurance, label or carrier: packed → handed over. */
export const SHIP_STEPS: Record<ShipmentKind, ShipmentStatus[]> = {
  ship: ['open', 'photos', 'picked', 'packed', 'insured', 'labelled', 'shipped', 'delivered'],
  pickup: ['open', 'photos', 'picked', 'packed', 'delivered'],
  return: ['open', 'photos', 'packed', 'insured', 'labelled', 'shipped', 'delivered'],
}

export function stepLabel(kind: ShipmentKind, s: ShipmentStatus): DictKey {
  if (kind === 'pickup' && s === 'delivered') return 'cas_st_handed'
  return `cas_st_${s}` as DictKey
}

export function nextShipStep(kind: ShipmentKind, s: ShipmentStatus): ShipmentStatus | null {
  const steps = SHIP_STEPS[kind]
  const i = steps.indexOf(s)
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null
}

export const SHIP_OPEN: readonly ShipmentStatus[] = ['open', 'photos', 'picked']
export const SHIP_DONE: readonly ShipmentStatus[] = ['delivered', 'cancelled']

/** Order kinds that leave the studio through a shipment (a Confié too: to the framer and back). */
export const SHIPPED_KINDS = ['sale', 'consignment', 'loan', 'gift', 'entrusted'] as const

/**
 * The VAT mention printed on invoices — the accountant's wording (LEGAL_POLICY §4, question 2).
 * Null until it is given: the invoice then prints « Mention TVA : à définir avec le comptable ».
 */
export const INVOICE_VAT_MENTION: string | null = null

/** When an invoice may be issued: once the sale is paid (Pem's default until the accountant answers Q13). */
export const INVOICE_FROM_STATUS = ['paid', 'delivered'] as const

/** The studio's SIRET, printed on invoices (a French invoice must carry it). Null until Pem gives it. */
export const STUDIO_SIRET: string | null = null
