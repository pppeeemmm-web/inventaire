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
