'use server'

// Cooling-off window of a sale (« délai de rétractation », R7): read from the sale `work_order`
// the work is on. The window starts at « Livrée » (`return_window_starts_at`, stamped by
// `advanceWorkOrder`) and lasts `return_window_days`. Was: `sale_order` + `BATCH_IDS` notes.

import { createClient } from '@/lib/supabase/server'
import { addCalendarDaysIso } from '@/lib/sale-return-window'

export type SaleReturnHint = {
  orderId: string
  daysTotal: number
  startsAt: string | null
  expiresOn: string | null
  daysLeft: number | null
  skipped: boolean
  delivered: boolean
  statut: string
}

type SaleRow = {
  id: string
  status: string
  return_window_days: number
  return_window_starts_at: string | null
  return_window_skipped: boolean
}

/** The banner hint for a work sold through a paid or delivered sale order (null otherwise). */
export async function getReturnWindowHintForOeuvre(oeuvreId: number): Promise<SaleReturnHint | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return null

  const { data: lines } = await supabase
    .from('work_order_work')
    .select('order_id, work_order!work_order_work_order_id_fkey(id, kind, status, return_window_days, return_window_starts_at, return_window_skipped, paid_at)')
    .eq('oeuvre_id', oeuvreId)
  const sale = (lines ?? [])
    .map((l) => l.work_order as unknown as (SaleRow & { kind: string; paid_at: string | null }) | null)
    .filter((o): o is SaleRow & { kind: string; paid_at: string | null } => !!o && o.kind === 'sale' && (o.status === 'paid' || o.status === 'delivered'))
    .sort((a, b) => String(b.paid_at ?? '').localeCompare(String(a.paid_at ?? '')))[0]
  if (!sale) return null

  const daysTotal = Number(sale.return_window_days ?? 14)
  const delivered = sale.status === 'delivered'
  const base = { orderId: sale.id, daysTotal, delivered, statut: sale.status }
  if (sale.return_window_skipped || daysTotal <= 0) {
    return { ...base, startsAt: sale.return_window_starts_at, expiresOn: null, daysLeft: null, skipped: true }
  }
  const start = sale.return_window_starts_at
  if (!start) return { ...base, startsAt: null, expiresOn: null, daysLeft: null, skipped: false }

  const today = new Date().toISOString().slice(0, 10)
  const expiresOn = addCalendarDaysIso(start, daysTotal)
  const ms = new Date(`${expiresOn}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()
  // Window over: no banner (the work simply stays « Vendu »).
  if (ms < 0) return null
  return { ...base, startsAt: start, expiresOn, daysLeft: Math.max(0, Math.ceil(ms / 86400000)), skipped: false }
}
