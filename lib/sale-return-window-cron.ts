/**
 * Expired sale return windows — run from secured cron route (service role).
 *
 * Owner 2026-11-03: a sold work stays "Vendu" once its return window ends. The cron used to move
 * it to "Archive privée" (OeuvreStatus 5), which no longer exists; it now only counts the orders
 * whose window has closed (the drawer banner reads the window from the order dates).
 */
import { createServiceClient } from '@/lib/supabase/server'
import { addCalendarDaysIso } from '@/lib/sale-return-window'

export async function applyExpiredSaleReturnWindows(): Promise<{ processed: number; worksMoved: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { processed: 0, worksMoved: 0 }
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: orders, error } = await supabase.from('sale_order')
    .select('id, return_window_days, return_window_starts_at, return_window_skipped')
    .eq('statut', 'completed')
    .eq('return_window_skipped', false)

  if (error || !orders?.length) {
    return { processed: 0, worksMoved: 0 }
  }

  let processed = 0
  for (const row of orders) {
    const days = Number(row.return_window_days ?? 14)
    const start: string | null = row.return_window_starts_at ?? null
    if (!start || days <= 0 || row.return_window_skipped) continue
    if (addCalendarDaysIso(start, days) > today) continue
    processed++
  }

  return { processed, worksMoved: 0 }
}
