import { asTypedSupabase } from '@/lib/pipeline/suivi-client'
import { definitiveDay, parisToday, saleMoneyState, type SaleMoneyState } from '@/lib/sales/sale-money'

/**
 * Sales income — the sale orders (`work_order`, R7) are the source of truth (not `Oeuvres`).
 *
 * House rule (Pem 2026-11-17, docs/LEGAL_POLICY.md decision 6): money received on a sale stays
 * « en attente » until the sale is delivered and its 14-day return period is over
 * (`lib/sales/sale-money.ts`). Only **definitive** money counts in the year totals, in the year it
 * **becomes definitive** (Pem 2026-11-18 — not the payment year): the day after the last return day
 * (`definitiveDay`):
 *   - every `payments` row of a definitive sale;
 *   - plus definitive sales with no payment rows at all (`price_final`).
 * Money on a sale not yet definitive is « held »; money on a cancelled / returned sale is « to refund »
 * (the app moves no money). Gifts never count.
 *
 * Works with the browser or the server Supabase client.
 */
export type SalesIncome = {
  /** Definitive money in the year. */
  total: number
  fromPayments: number
  fromUnpaidCompletedOrders: number
  /** Today: received, not definitive yet (any year). */
  held: number
  /** Today: received on cancelled / returned sales, to pay back. */
  toRefund: number
  error: string | null
}

type SaleRow = {
  id: string
  status: string
  price_final: number | null
  paid_at: string | null
  delivered_at: string | null
  return_window_days: number
  return_window_starts_at: string | null
  return_window_skipped: boolean
}
type PaymentRow = { amount: number; payment_date: string | null; work_order_id: string | null; refunded_at?: string | null }


/** Every sale order and every payment, each payment with its sale's money state. */
async function loadSaleMoney(supabase: unknown) {
  const sb = asTypedSupabase(supabase)
  const [ordRes, payRes] = await Promise.all([
    sb.from('work_order')
      .select('id, status, price_final, paid_at, delivered_at, return_window_days, return_window_starts_at, return_window_skipped')
      .eq('kind', 'sale').limit(10000),
    sb.from('payments').select('amount, payment_date, work_order_id, refunded_at').limit(10000),
  ])
  const error = ordRes.error?.message ?? payRes.error?.message ?? null
  const today = parisToday()
  const orders = (ordRes.data ?? []) as SaleRow[]
  const stateOf = new Map<string, SaleMoneyState>(orders.map((o) => [o.id, saleMoneyState(o, today)]))
  const dayOf = new Map<string, string | null>(orders.map((o) => [o.id, definitiveDay(o, today)]))
  const payments = ((payRes.data ?? []) as unknown as PaymentRow[]).map((p) => ({
    ...p,
    amount: Number(p.amount ?? 0),
    // A payment with no order (none exist since R7) counts as definitive.
    state: (p.work_order_id ? stateOf.get(p.work_order_id) ?? 'held' : 'definitive') as SaleMoneyState,
  }))
  const withPayments = new Set(payments.map((p) => p.work_order_id).filter(Boolean))
  // Paid without any payment row: the price stands in for the money received.
  const unpaidRows = orders.filter((o) => ['paid', 'delivered'].includes(o.status) && o.paid_at && !withPayments.has(o.id))
  const held = payments.filter((p) => p.state === 'held').reduce((s, p) => s + p.amount, 0)
    + unpaidRows.filter((o) => stateOf.get(o.id) === 'held').reduce((s, o) => s + Number(o.price_final ?? 0), 0)
  // Refunded (« Remboursé le … ») is no longer to refund.
  const toRefund = payments.filter((p) => p.state === 'refund' && !p.refunded_at).reduce((s, p) => s + p.amount, 0)
  /** The day a payment's money counts: its sale's definitive day (no order: its own day). */
  const countDay = (p: { work_order_id: string | null; payment_date: string | null }) =>
    p.work_order_id ? dayOf.get(p.work_order_id) ?? null : String(p.payment_date ?? '').slice(0, 10) || null
  return { error, payments, unpaidRows, stateOf, dayOf, countDay, held, toRefund }
}

export async function fetchSalesIncome(supabase: unknown, year: number): Promise<SalesIncome> {
  const m = await loadSaleMoney(supabase)
  const inYear = (day: string | null) => !!day && day.slice(0, 4) === String(year)
  const paid = m.payments.filter((p) => p.state === 'definitive' && inYear(m.countDay(p))).reduce((s, p) => s + p.amount, 0)
  const unpaidDefinitive = m.unpaidRows
    .filter((o) => m.stateOf.get(o.id) === 'definitive' && inYear(m.dayOf.get(o.id) ?? null))
    .reduce((s, o) => s + Number(o.price_final ?? 0), 0)
  return { total: paid + unpaidDefinitive, fromPayments: paid, fromUnpaidCompletedOrders: unpaidDefinitive, held: m.held, toRefund: m.toRefund, error: m.error }
}

/** One dated definitive amount — same rules as `fetchSalesIncome`, across every year. */
export type IncomeEntry = { date: string; amount: number; source: 'payment' | 'order' }

/**
 * Every definitive income entry (Fiscal → By year): payments of definitive sales and definitive sales
 * with no payment rows, each on the day its sale became definitive. Summing a year gives
 * `fetchSalesIncome(year).total`. `held` / `toRefund` are today's amounts apart from the years.
 */
export async function fetchIncomeEntries(supabase: unknown): Promise<{ entries: IncomeEntry[]; held: number; toRefund: number; error: string | null }> {
  const m = await loadSaleMoney(supabase)
  const entries: IncomeEntry[] = []
  for (const p of m.payments) {
    const day = m.countDay(p)
    if (day && p.state === 'definitive') entries.push({ date: day, amount: p.amount, source: 'payment' })
  }
  for (const o of m.unpaidRows) {
    const day = m.dayOf.get(o.id)
    if (day && m.stateOf.get(o.id) === 'definitive') entries.push({ date: day, amount: Number(o.price_final ?? 0), source: 'order' })
  }
  return { entries, held: m.held, toRefund: m.toRefund, error: m.error }
}
