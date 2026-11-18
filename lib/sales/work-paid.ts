// « Payé » on a work follows the payments of its sale order (TODO 10, Pem GO 2026-11-18).
// The order's « Soldée » step (all of the price received) writes `Oeuvres.is_paid = true` on its
// works, a « Retour » writes it back to false; the card and batch edit can still set it by hand.
// The work card reads the order's payments to say where the value comes from. Pure (client + server).

/** The sale order a work is on and the money received on it (refunded payments left out). */
export interface WorkSaleMoney {
  id: string
  ref: string | null
  status: string
  /** `work_order.price_final` — the price the payments are measured against. */
  price: number | null
  received: number
}

/** True when the sale is fully paid: its step says so, or the money received covers the price. */
export function salePaidFromPayments(s: Pick<WorkSaleMoney, 'status' | 'price' | 'received'>): boolean {
  if (s.status === 'paid' || s.status === 'delivered') return true
  return s.price != null && s.price > 0 && s.received >= s.price - 0.005
}
