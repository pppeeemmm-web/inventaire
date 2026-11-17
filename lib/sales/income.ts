import { asTypedSupabase } from '@/lib/pipeline/suivi-client'
import { parisToday, saleMoneyState, type SaleMoneyState } from '@/lib/sales/sale-money'

/**
 * Sales income — the sale orders (`work_order`, R7) are the source of truth (not `Oeuvres`).
 *
 * House rule (Pem 2026-11-17, docs/LEGAL_POLICY.md decision 6): money received on a sale stays
 * « en attente » until the sale is delivered and its 14-day return period is over
 * (`lib/sales/sale-money.ts`). Only **definitive** money counts in the year totals:
 *   - every `payments` row of a definitive sale, on its `payment_date`;
 *   - plus definitive sales with no payment rows at all (`price_final`), on the day they were paid.
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
  return_window_days: number
  return_window_starts_at: string | null
  return_window_skipped: boolean
}
type PaymentRow = { amount: number; payment_date: string | null; work_order_id: string | null }

/** Studio calendar day (Europe/Paris) of a timestamp, as YYYY-MM-DD. */
function parisDay(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ts))
}

/** Every sale order and every payment, each payment with its sale's money state. */
async function loadSaleMoney(supabase: unknown) {
  const sb = asTypedSupabase(supabase)
  const [ordRes, payRes] = await Promise.all([
    sb.from('work_order')
      .select('id, status, price_final, paid_at, return_window_days, return_window_starts_at, return_window_skipped')
      .eq('kind', 'sale').limit(10000),
    sb.from('payments').select('amount, payment_date, work_order_id').limit(10000),
  ])
  const error = ordRes.error?.message ?? payRes.error?.message ?? null
  const today = parisToday()
  const orders = (ordRes.data ?? []) as SaleRow[]
  const stateOf = new Map<string, SaleMoneyState>(orders.map((o) => [o.id, saleMoneyState(o, today)]))
  const payments = ((payRes.data ?? []) as PaymentRow[]).map((p) => ({
    ...p,
    amount: Number(p.amount ?? 0),
    // A payment of the former `sale_order` (none exist) counts as definitive.
    state: (p.work_order_id ? stateOf.get(p.work_order_id) ?? 'held' : 'definitive') as SaleMoneyState,
  }))
  const withPayments = new Set(payments.map((p) => p.work_order_id).filter(Boolean))
  // Paid without any payment row: the price stands in for the money received.
  const unpaidRows = orders.filter((o) => ['paid', 'delivered'].includes(o.status) && o.paid_at && !withPayments.has(o.id))
  const held = payments.filter((p) => p.state === 'held').reduce((s, p) => s + p.amount, 0)
    + unpaidRows.filter((o) => stateOf.get(o.id) === 'held').reduce((s, o) => s + Number(o.price_final ?? 0), 0)
  const toRefund = payments.filter((p) => p.state === 'refund').reduce((s, p) => s + p.amount, 0)
  return { error, payments, unpaidRows, stateOf, held, toRefund }
}

export async function fetchSalesIncome(supabase: unknown, year: number): Promise<SalesIncome> {
  const m = await loadSaleMoney(supabase)
  const inYear = (day: string | null) => !!day && day.slice(0, 4) === String(year)
  const paid = m.payments.filter((p) => p.state === 'definitive' && inYear(p.payment_date)).reduce((s, p) => s + p.amount, 0)
  const unpaidDefinitive = m.unpaidRows
    .filter((o) => m.stateOf.get(o.id) === 'definitive' && inYear(o.paid_at ? parisDay(o.paid_at) : null))
    .reduce((s, o) => s + Number(o.price_final ?? 0), 0)
  return { total: paid + unpaidDefinitive, fromPayments: paid, fromUnpaidCompletedOrders: unpaidDefinitive, held: m.held, toRefund: m.toRefund, error: m.error }
}

/** One dated definitive amount — same rules as `fetchSalesIncome`, across every year. */
export type IncomeEntry = { date: string; amount: number; source: 'payment' | 'order' }

/**
 * Every definitive income entry (Fiscal → By year): payments of definitive sales on their payment
 * day, plus definitive sales with no payment rows on the day they were paid. Summing a year gives
 * `fetchSalesIncome(year).total`. `held` / `toRefund` are today's amounts apart from the years.
 */
export async function fetchIncomeEntries(supabase: unknown): Promise<{ entries: IncomeEntry[]; held: number; toRefund: number; error: string | null }> {
  const m = await loadSaleMoney(supabase)
  const entries: IncomeEntry[] = []
  for (const p of m.payments) {
    const day = String(p.payment_date ?? '').slice(0, 10)
    if (day && p.state === 'definitive') entries.push({ date: day, amount: p.amount, source: 'payment' })
  }
  for (const o of m.unpaidRows) {
    if (o.paid_at && m.stateOf.get(o.id) === 'definitive') entries.push({ date: parisDay(String(o.paid_at)), amount: Number(o.price_final ?? 0), source: 'order' })
  }
  return { entries, held: m.held, toRefund: m.toRefund, error: m.error }
}
