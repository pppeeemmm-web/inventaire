import { fromPayments, fromSaleOrder } from '@/lib/sales/sales-client'

/**
 * Sales income for a calendar year — `sale_order` is the source of truth (not `Oeuvres`).
 *
 * Cash basis (BNC recettes encaissées):
 *   - every `payments` row whose `payment_date` falls in the year;
 *   - plus completed orders closed in the year that have no payment rows at all
 *     (`prix_final`), so a sale closed without recording payments still counts once.
 *
 * Works with the browser or the server Supabase client.
 */
export type SalesIncome = {
  total: number
  fromPayments: number
  fromUnpaidCompletedOrders: number
  error: string | null
}

/** Paris new year is always CET (+01:00). */
function yearBounds(year: number) {
  return { from: `${year}-01-01T00:00:00+01:00`, to: `${year + 1}-01-01T00:00:00+01:00` }
}

export async function fetchSalesIncome(supabase: unknown, year: number): Promise<SalesIncome> {
  const { from, to } = yearBounds(year)
  const [payRes, ordRes] = await Promise.all([
    fromPayments(supabase).select('amount').gte('payment_date', `${year}-01-01`).lt('payment_date', `${year + 1}-01-01`),
    fromSaleOrder(supabase).select('id, prix_final').eq('statut', 'completed').gte('completed_at', from).lt('completed_at', to),
  ])
  const error = payRes.error?.message ?? ordRes.error?.message ?? null

  const paid = (payRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const orders = ordRes.data ?? []
  let unpaidCompleted = 0
  if (orders.length) {
    const { data: linked, error: linkErr } = await fromPayments(supabase)
      .select('order_id')
      .in('order_id', orders.map((o) => o.id))
    if (linkErr) return { total: paid, fromPayments: paid, fromUnpaidCompletedOrders: 0, error: linkErr.message }
    const withPayments = new Set((linked ?? []).map((p) => p.order_id))
    unpaidCompleted = orders
      .filter((o) => !withPayments.has(o.id))
      .reduce((s, o) => s + Number(o.prix_final ?? 0), 0)
  }

  return { total: paid + unpaidCompleted, fromPayments: paid, fromUnpaidCompletedOrders: unpaidCompleted, error }
}

/** One dated amount received — same cash rules as `fetchSalesIncome`, across every year. */
export type IncomeEntry = { date: string; amount: number; source: 'payment' | 'order' }

/** Studio calendar day (Europe/Paris) of a timestamp, as YYYY-MM-DD. */
function parisDay(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ts))
}

/**
 * Every income entry on record (Fiscal → By year): payments on their payment day, plus completed
 * orders with no payment rows on their completion day. Summing a year gives `fetchSalesIncome(year)`.
 */
export async function fetchIncomeEntries(supabase: unknown): Promise<{ entries: IncomeEntry[]; error: string | null }> {
  const [payRes, ordRes, linkRes] = await Promise.all([
    fromPayments(supabase).select('amount, payment_date').not('payment_date', 'is', null).limit(10000),
    fromSaleOrder(supabase).select('id, prix_final, completed_at').eq('statut', 'completed').not('completed_at', 'is', null).limit(10000),
    fromPayments(supabase).select('order_id').not('order_id', 'is', null).limit(10000),
  ])
  const error = payRes.error?.message ?? ordRes.error?.message ?? linkRes.error?.message ?? null

  const entries: IncomeEntry[] = []
  for (const p of payRes.data ?? []) {
    const day = String(p.payment_date ?? '').slice(0, 10)
    if (day) entries.push({ date: day, amount: Number(p.amount ?? 0), source: 'payment' })
  }
  const withPayments = new Set((linkRes.data ?? []).map((p) => p.order_id))
  for (const o of ordRes.data ?? []) {
    if (withPayments.has(o.id) || !o.completed_at) continue
    entries.push({ date: parisDay(String(o.completed_at)), amount: Number(o.prix_final ?? 0), source: 'order' })
  }
  return { entries, error }
}
