'use server'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

export interface AuditLogEntry {
  id:          number
  created_at:  string
  action:      string
  details:     string
  event_type:  string
  table_name:  string
  row_id:      string
  new_value:   any
  metadata:    any
  user_id?:    string | null
  user_email?: string
}

export async function fetchSystemLogs(limit = 100): Promise<AuditLogEntry[]> {
  const supabase = await createClient()

  // Verify Admin (since this is a high-privilege view)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return []

  const { data, error } = await supabase
    .from('system_log')
    .select('*')
    .not('event_type', 'is', null)
    .neq('event_type', 'ATELIER_VIEW')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    await logError('Audit fetch failed', error, { source: 'fetchSystemLogs' })
    return []
  }

  // Enrich with team emails from Contact (auth_user_id → Email); no service-role.
  const rows = data ?? []
  const userIds = Array.from(new Set(
    rows.map((r) => (r as { user_id?: string | null }).user_id).filter((id): id is string => !!id)
  ))
  const emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: contacts, error: cErr } = await supabase
      .from('Contact')
      .select('auth_user_id, Email')
      .in('auth_user_id', userIds)
    if (cErr) console.error('Audit contact email enrich:', cErr.message)
    for (const row of contacts ?? []) {
      const r = row as { auth_user_id?: string | null; Email?: string | null }
      if (r.auth_user_id && r.Email?.trim()) emailMap.set(r.auth_user_id, r.Email.trim())
    }
  }

  return rows.map((entry) => ({
    ...entry,
    user_email: (entry as { user_id?: string | null }).user_id
      ? emailMap.get((entry as { user_id: string }).user_id)
      : undefined,
  }))
}
