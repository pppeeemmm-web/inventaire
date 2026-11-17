import { asTypedSupabase } from '@/lib/pipeline/suivi-client'

/**
 * Sales income — the sale orders (`work_order`, R7) are the source of truth (not `Oeuvres`).
 *
 * Cash basis (BNC recettes encaissées):
 *   - every `payments` row whose `payment_date` falls in the year (« Encaisser » on an order);
 *   - plus sales paid in the year that have no payment rows at all (`price_final`), so a sale
 *     marked paid without recording payments still counts once.
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

/** Sale orders paid, with no payment row: their price counts on the day they were paid. */
async function paidWorkOrdersWithoutPayments(supabase: unknown, from?: string, to?: string) {
  const sb = asTypedSupabase(supabase)
  let q = sb.from('work_order').select('id, price_final, paid_at').eq('kind', 'sale').in('status', ['paid', 'delivered']).not('paid_at', 'is', null).limit(10000)
  if (from && to) q = q.gte('paid_at', from).lt('paid_at', to)
  const { data, error } = await q
  if (error) return { rows: [] as { price_final: number | null; paid_at: string | null }[], error: error.message }
  const orders = data ?? []
  if (orders.length === 0) return { rows: [], error: null }
  const { data: linked, error: linkErr } = await sb.from('payments').select('work_order_id').in('work_order_id', orders.map((o) => o.id))
  if (linkErr) return { rows: [], error: linkErr.message }
  const withPayments = new Set((linked ?? []).map((p) => p.work_order_id))
  return { rows: orders.filter((o) => !withPayments.has(o.id)), error: null }
}

export async function fetchSalesIncome(supabase: unknown, year: number): Promise<SalesIncome> {
  const { from, to } = yearBounds(year)
  const [payRes, woRes] = await Promise.all([
    asTypedSupabase(supabase).from('payments').select('amount').gte('payment_date', `${year}-01-01`).lt('payment_date', `${year + 1}-01-01`),
    paidWorkOrdersWithoutPayments(supabase, from, to),
  ])
  const error = payRes.error?.message ?? woRes.error ?? null
  const paid = (payRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const unpaidPaidOrders = woRes.rows.reduce((s, o) => s + Number(o.price_final ?? 0), 0)
  return { total: paid + unpaidPaidOrders, fromPayments: paid, fromUnpaidCompletedOrders: unpaidPaidOrders, error }
}

/** One dated amount received — same cash rules as `fetchSalesIncome`, across every year. */
export type IncomeEntry = { date: string; amount: number; source: 'payment' | 'order' }

/** Studio calendar day (Europe/Paris) of a timestamp, as YYYY-MM-DD. */
function parisDay(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ts))
}

/**
 * Every income entry on record (Fiscal → By year): payments on their payment day, plus paid
 * sale orders with no payment rows on the day they were paid. Summing a year gives `fetchSalesIncome(year)`.
 */
export async function fetchIncomeEntries(supabase: unknown): Promise<{ entries: IncomeEntry[]; error: string | null }> {
  const [payRes, woRes] = await Promise.all([
    asTypedSupabase(supabase).from('payments').select('amount, payment_date').not('payment_date', 'is', null).limit(10000),
    paidWorkOrdersWithoutPayments(supabase),
  ])
  const error = payRes.error?.message ?? woRes.error ?? null
  const entries: IncomeEntry[] = []
  for (const p of payRes.data ?? []) {
    const day = String(p.payment_date ?? '').slice(0, 10)
    if (day) entries.push({ date: day, amount: Number(p.amount ?? 0), source: 'payment' })
  }
  for (const o of woRes.rows) {
    if (o.paid_at) entries.push({ date: parisDay(String(o.paid_at)), amount: Number(o.price_final ?? 0), source: 'order' })
  }
  return { entries, error }
}
