'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Count team activity since the given timestamps: works edited + work sessions
 * touched by OTHER users (Journal badge), and new manual System-ledger entries
 * (System badge — ledger inserts carry no author, so all new entries count).
 * "Last seen" cursors live client-side (localStorage), so this stays a pure read.
 */
export async function countTeamActivitySince(
  sinceIso: string,
  ledgerSinceIso?: string,
): Promise<{ journal: number; ledger: number } | { error: string }> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'auth' }
  const since = new Date(sinceIso)
  if (Number.isNaN(since.getTime())) return { error: 'bad_since' }
  const iso = since.toISOString()
  const ledgerSince = new Date(ledgerSinceIso ?? sinceIso)
  const ledgerIso = Number.isNaN(ledgerSince.getTime()) ? iso : ledgerSince.toISOString()
  // `ledger` = Kaizen badge: new System ledger entries + Kaizen entries by others (System lives in Kaizen).
  const [works, sessions, ledger, kaizen] = await Promise.all([
    sb
      .from('Oeuvres')
      .select('OeuvreID', { count: 'exact', head: true })
      .gt('edited_at', iso)
      .neq('edited_by', user.id),
    sb
      .from('work_session')
      .select('id', { count: 'exact', head: true })
      .gt('updated_at', iso)
      .neq('user_id', user.id),
    sb
      .from('system_log')
      .select('id', { count: 'exact', head: true })
      .is('event_type', null)
      .gt('created_at', ledgerIso),
    sb
      .from('kaizen_item')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', ledgerIso)
      .neq('author_id', user.id),
  ])
  if (works.error && sessions.error && ledger.error) return { error: works.error.message }
  return {
    journal: (works.count ?? 0) + (sessions.count ?? 0),
    ledger: (ledger.count ?? 0) + (kaizen.count ?? 0),
  }
}
