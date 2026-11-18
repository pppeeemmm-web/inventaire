// Order dates → the user's calendars (Pem 2026-11-18), like exhibitions (sync-exhibition.ts).
// One all-day event per date: deposit / loan / Confié « out » and « back by »; a sale or a gift's planned
// delivery; the last day of a sale's 14-day return. A cancelled order loses its events. Links in
// `calendar_event_link` (work_order_id + date_key, supabase/sql/calendar_order_dates.sql, applied 2026-11-18).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CalendarEventDraft } from '@/lib/calendar/types'
import { accessForAccount, addDays, dateKey, deleteRemote, upsertRemote, type AccountRow } from '@/lib/calendar/sync-exhibition'

export type OrderDateKey = 'start' | 'end' | 'delivery' | 'return_end'

export type OrderSyncLabels = Record<OrderDateKey, (ref: string, party: string) => string>

type Order = {
  id: string; ref: string | null; kind: string; status: string; start_date: string | null; end_date: string | null
  return_window_starts_at: string | null; return_window_days: number | null; return_window_skipped: boolean | null
  party_id: number; notes: string | null
}

/** Which dates an order puts in the calendar, by kind. */
export function orderCalendarDates(o: Order): Partial<Record<OrderDateKey, string>> {
  if (o.status === 'cancelled') return {}
  const out: Partial<Record<OrderDateKey, string>> = {}
  const start = dateKey(o.start_date)
  const end = dateKey(o.end_date)
  if (o.kind === 'consignment' || o.kind === 'loan' || o.kind === 'entrusted') {
    if (start) out.start = start
    if (end && o.status !== 'closed') out.end = end
  } else if ((o.kind === 'sale' || o.kind === 'gift') && start && !['delivered', 'handed_over'].includes(o.status)) {
    out.delivery = start
  }
  if (o.kind === 'sale' && !o.return_window_skipped && o.return_window_starts_at && (o.return_window_days ?? 0) > 0) {
    const from = dateKey(o.return_window_starts_at)
    if (from) out.return_end = addDays(from, (o.return_window_days ?? 14))
  }
  return out
}

export async function syncOrderToCalendars(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  labels: OrderSyncLabels,
): Promise<{ ok: true; pushed: number } | { ok: false; message: string }> {
  const { data: accounts, error: accErr } = await supabase
    .from('calendar_account')
    .select('id, provider, refresh_token_encrypted, tenant_id, token_salt')
    .eq('auth_user_id', userId)
  if (accErr) return { ok: false, message: accErr.message }
  const accRows = (accounts ?? []) as AccountRow[]
  if (accRows.length === 0) return { ok: false, message: 'calendar_err_no_accounts' }

  const { data: o, error } = await supabase
    .from('work_order')
    .select('id, ref, kind, status, start_date, end_date, return_window_starts_at, return_window_days, return_window_skipped, party_id, notes')
    .eq('id', orderId)
    .maybeSingle()
  if (error || !o) return { ok: false, message: 'calendar_err_not_found' }
  const order = o as Order
  const { data: c } = await supabase.from('Contact').select('NomInstitution, Nom, "Prénom"').eq('ContactID', order.party_id).maybeSingle()
  const contact = c as { NomInstitution: string | null; Nom: string | null; Prénom: string | null } | null
  const party = contact ? (contact.NomInstitution || `${contact.Prénom ?? ''} ${contact.Nom ?? ''}`.trim()) : ''
  const ref = order.ref ?? ''

  const dates = orderCalendarDates(order)
  const drafts = (Object.entries(dates) as [OrderDateKey, string][]).map(([key, day]) => ({
    key,
    draft: { summary: labels[key](ref, party), description: order.notes || '—', startDate: day, endExclusive: addDays(day, 1) } as CalendarEventDraft,
  }))

  let pushed = 0
  for (const acc of accRows) {
    let access: string
    try {
      access = await accessForAccount(acc)
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'calendar_err_token' }
    }
    const { data: linkRows } = await supabase
      .from('calendar_event_link')
      .select('id, date_key, external_event_id, sync_etag')
      .eq('calendar_account_id', acc.id)
      .eq('auth_user_id', userId)
      .eq('work_order_id', orderId)
    const links = (linkRows ?? []) as { id: string; date_key: string | null; external_event_id: string; sync_etag: string | null }[]

    // Dates the order no longer has: the event goes.
    for (const row of links.filter((l) => !(l.date_key && l.date_key in dates))) {
      try {
        await deleteRemote(acc.provider, access, row.external_event_id)
      // eslint-disable-next-line pem-i18n/no-silent-catch -- the event may already be gone from the calendar; the link is removed anyway
      } catch { /* already gone */ }
      await supabase.from('calendar_event_link').delete().eq('id', row.id)
    }

    for (const { key, draft } of drafts) {
      const row = links.find((l) => l.date_key === key)
      try {
        const res = await upsertRemote(acc.provider, access, draft, row?.external_event_id ?? null, row?.sync_etag ?? null)
        pushed += 1
        const payload = {
          auth_user_id: userId, calendar_account_id: acc.id, provider: acc.provider,
          suivi_process_id: null, suivi_etape_id: null, work_order_id: orderId, date_key: key,
          external_event_id: res.externalEventId, sync_etag: res.etag, updated_at: new Date().toISOString(),
        }
        if (row) await supabase.from('calendar_event_link').update(payload).eq('id', row.id)
        else await supabase.from('calendar_event_link').insert(payload)
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'calendar_err_sync' }
      }
    }
  }
  return { ok: true, pushed }
}
