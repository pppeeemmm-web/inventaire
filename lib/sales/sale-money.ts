// House rule (Pem 2026-11-17, docs/LEGAL_POLICY.md decision 6): every sale has a 14-day return
// period starting at delivery / hand-over, and the money received stays « en attente » until it is
// over. One rule, read by the order screen, Revenus & dépenses and the work card banner.
// Pure (client + server).

import { addCalendarDaysIso } from '@/lib/sale-return-window'

export type SaleMoneyState = 'held' | 'definitive' | 'refund'

export interface SaleWindowFields {
  status: string
  return_window_days: number | null
  return_window_starts_at: string | null
  return_window_skipped: boolean | null
}

/** Studio calendar day (Europe/Paris) as YYYY-MM-DD. */
export function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** Last day the buyer may return the works (null before delivery, or with no period). */
export function returnLastDay(o: SaleWindowFields): string | null {
  const days = Number(o.return_window_days ?? 14)
  if (o.return_window_skipped || days <= 0 || !o.return_window_starts_at) return null
  return addCalendarDaysIso(o.return_window_starts_at.slice(0, 10), days)
}

/**
 * held — not delivered yet, or delivered and still inside the return period;
 * definitive — delivered and the return period is over (no return);
 * refund — the sale was cancelled or returned: whatever was paid is to be paid back.
 */
export function saleMoneyState(o: SaleWindowFields, today = parisToday()): SaleMoneyState {
  if (o.status === 'cancelled') return 'refund'
  if (o.status !== 'delivered') return 'held'
  const days = Number(o.return_window_days ?? 14)
  if (o.return_window_skipped || days <= 0) return 'definitive'
  const last = returnLastDay(o)
  if (!last) return 'held'
  return today > last ? 'definitive' : 'held'
}

/** Whole days left to return (0 on the last day), or null when no period is running. */
export function returnDaysLeft(o: SaleWindowFields, today = parisToday()): number | null {
  if (o.status !== 'delivered') return null
  const last = returnLastDay(o)
  if (!last || today > last) return null
  return Math.round((new Date(`${last}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000)
}
