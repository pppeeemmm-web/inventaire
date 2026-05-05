'use server'

import { createClient } from '@/lib/supabase/server'

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
    .select('*, auth.users(email)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Audit fetch error:', error.message)
    return []
  }

  return (data ?? []).map(entry => ({
    ...entry,
    user_email: (entry as any).users?.email
  }))
}
