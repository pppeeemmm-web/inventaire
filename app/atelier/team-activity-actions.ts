'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Count team activity (works edited + work sessions touched by OTHER users)
 * since the given timestamp. Powers the Journal sidebar badge; the "last seen"
 * cursor lives client-side (localStorage), so this stays a pure read.
 */
export async function countTeamActivitySince(
  sinceIso: string,
): Promise<{ count: number } | { error: string }> {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'auth' }
  const since = new Date(sinceIso)
  if (Number.isNaN(since.getTime())) return { error: 'bad_since' }
  const iso = since.toISOString()
  const [works, sessions] = await Promise.all([
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
  ])
  if (works.error && sessions.error) return { error: works.error.message }
  return { count: (works.count ?? 0) + (sessions.count ?? 0) }
}
