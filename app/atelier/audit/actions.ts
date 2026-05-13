'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'

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
    console.error('Audit fetch error:', error.message)
    return []
  }

  // Enrich with user_email via service-role auth.admin lookup (cross-schema
  // PostgREST joins to auth.users aren't supported).
  const rows = data ?? []
  const userIds = Array.from(new Set(
    rows.map((r) => (r as { user_id?: string | null }).user_id).filter((id): id is string => !!id)
  ))
  const emailMap = new Map<string, string>()
  if (userIds.length > 0) {
    const svc = createServiceClient()
    const { data: list } = await svc.auth.admin.listUsers({ perPage: 200 })
    for (const u of list?.users ?? []) {
      if (u.id && u.email && userIds.includes(u.id)) emailMap.set(u.id, u.email)
    }
  }

  return rows.map((entry) => ({
    ...entry,
    user_email: (entry as { user_id?: string | null }).user_id
      ? emailMap.get((entry as { user_id: string }).user_id)
      : undefined,
  }))
}
