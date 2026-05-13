'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SuiviReminderListRow } from '@/lib/types/database'

export async function revalidateRemindersTag() {
  revalidateTag('reminders')
}

/** RLS-scoped unread count (session-bound; `userId` reserved for future cache keys). */
export async function getUnreadReminderCountCached(userId: string): Promise<number> {
  void userId
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('suivi_reminder')
    .select('id', { count: 'exact', head: true })
    .eq('lu', false)
  if (error) {
    console.error('[atelier reminder count]', error.message)
    return 0
  }
  return count ?? 0
}

export async function listUnreadSuiviReminders(limit: number): Promise<SuiviReminderListRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suivi_reminder')
    .select('id, process_id, etape_id, message, remind_at, lu')
    .eq('lu', false)
    .order('remind_at', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 500))
  if (error) {
    console.error('[atelier reminder list]', error.message)
    return []
  }
  return (data ?? []) as SuiviReminderListRow[]
}

export async function markSuiviReminderRead(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('suivi_reminder').update({ lu: true }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  await revalidateRemindersTag()
  return { ok: true }
}

export async function insertSuiviReminder(input: {
  process_id: string
  message: string
  remind_at: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('suivi_reminder').insert({
    process_id: input.process_id,
    message: input.message,
    remind_at: input.remind_at,
  })
  if (error) return { ok: false, error: error.message }
  await revalidateRemindersTag()
  return { ok: true }
}
