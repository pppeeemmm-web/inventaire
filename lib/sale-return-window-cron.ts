/**
 * Expired sale return windows — run from secured cron route (service role).
 */
import { createServiceClient } from '@/lib/supabase/server'
import { logSystemCronEvent } from '@/lib/utils/logging'
import { addCalendarDaysIso, parseSaleOrderBatchIds } from '@/lib/sale-return-window'

const STATUS_SOLD = 6
const STATUS_PRIVATE_ARCHIVE = 5

export async function applyExpiredSaleReturnWindows(): Promise<{ processed: number; worksMoved: number }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { processed: 0, worksMoved: 0 }
  }

  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: orders, error } = await supabase.from('sale_order')
    .select('id, oeuvre_id, notes, return_window_days, return_window_starts_at, return_window_skipped')
    .eq('statut', 'completed')
    .eq('return_window_skipped', false)

  if (error || !orders?.length) {
    return { processed: 0, worksMoved: 0 }
  }

  let processed = 0
  let worksMoved = 0

  for (const row of (orders ?? [])) {
    const days = Number(row.return_window_days ?? 14)
    const start: string | null = row.return_window_starts_at ?? null
    if (!start || days <= 0 || row.return_window_skipped) continue

    const endStr = addCalendarDaysIso(start, days)
    if (endStr > today) continue

    processed++
    const ids = parseSaleOrderBatchIds(row.notes, row.oeuvre_id)

    const { data: works } = await supabase
      .from('Oeuvres')
      .select('OeuvreID, statusId, is_gift')
      .in('OeuvreID', ids)

    const toArchive = (works ?? []).filter((w: any) => w.statusId === STATUS_SOLD && !w.is_gift).map((w: any) => w.OeuvreID)
    if (toArchive.length === 0) continue

    const { error: upErr } = await supabase
      .from('Oeuvres')
      .update({ statusId: STATUS_PRIVATE_ARCHIVE })
      .in('OeuvreID', toArchive)
      .eq('statusId', STATUS_SOLD)

    if (!upErr) {
      worksMoved += toArchive.length
      await logSystemCronEvent({
        eventType: 'STATUS_CHANGE',
        tableName: 'Oeuvres',
        rowId: String(row.id),
        newValue: STATUS_PRIVATE_ARCHIVE,
        metadata: {
          trigger: 'return_window_expired',
          sale_order_id: row.id,
          oeuvre_ids: toArchive,
        },
      })
    }
  }

  return { processed, worksMoved }
}
