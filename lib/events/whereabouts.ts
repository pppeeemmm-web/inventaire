// R6 — where each work of an event is right now, read from the event's R7 orders (never stored apart).
// Notes: « Studio · Commande P-2026-003 signée · Sortie 1 oct. · Rentrée 16 déc. · Vendue V-2026-004 ».

import { STUDIO_CONTACT_ID } from './event-model'

export interface WhereOrder {
  id: string
  ref: string | null
  kind: string
  status: string
  party_id: number
  start_date: string | null
  end_date: string | null
  created_at: string
  lines: { oeuvre_id: number; line_status: string; insurance_value: number | null; price: number | null }[]
}

export type Whereabouts =
  | { at: 'studio'; shownInPlace: boolean }
  | { at: 'order'; order: WhereOrder; lineStatus: string; sold: boolean; out: boolean; back: boolean }

/** The order that says most about the work: a live sale first, then the latest custody order. */
export function whereIs(oeuvreId: number, orders: WhereOrder[], placeId: number | null): Whereabouts {
  const mine = orders
    .filter((o) => o.status !== 'cancelled')
    .map((o) => ({ o, line: o.lines.find((l) => l.oeuvre_id === oeuvreId) }))
    .filter((x): x is { o: WhereOrder; line: WhereOrder['lines'][number] } => !!x.line && x.line.line_status !== 'removed')
  if (mine.length === 0) return { at: 'studio', shownInPlace: placeId === STUDIO_CONTACT_ID }
  const sale = mine.find((x) => x.o.kind === 'sale' && x.o.status !== 'draft')
  const pick = sale ?? mine.sort((a, b) => b.o.created_at.localeCompare(a.o.created_at))[0]
  const sold = !!sale || pick.line.line_status === 'sold'
  return {
    at: 'order',
    order: pick.o,
    lineStatus: pick.line.line_status,
    sold,
    out: pick.o.status === 'out' && pick.line.line_status === 'active',
    back: pick.o.status === 'closed' || pick.line.line_status === 'returned',
  }
}

/** Insurance value of a work on the event's custody orders (loan / deposit / Confié line). */
export function insuranceOf(oeuvreId: number, orders: WhereOrder[]): number | null {
  for (const o of orders) {
    if (o.status === 'cancelled' || o.kind === 'sale') continue
    const l = o.lines.find((x) => x.oeuvre_id === oeuvreId)
    if (l && (l.insurance_value ?? l.price) != null) return l.insurance_value ?? l.price
  }
  return null
}
