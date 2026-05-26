'use server'

import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

/** Nav noise excluded from Audit ledger (same filter as fetch/delete). */
const AUDIT_LEDGER_EXCLUDED_EVENT_TYPE = 'ATELIER_VIEW'

export type AuditActionResult =
  | { ok: true; deletedCount: number }
  | { error: string }

async function requireAuditAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: isAdmin } = await supabase.rpc('is_admin')
  return Boolean(isAdmin)
}

export async function fetchAuditAdmin(): Promise<boolean> {
  const supabase = await createClient()
  return requireAuditAdmin(supabase)
}

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

  if (!(await requireAuditAdmin(supabase))) return []

  const { data, error } = await supabase
    .from('system_log')
    .select('*')
    .not('event_type', 'is', null)
    .neq('event_type', AUDIT_LEDGER_EXCLUDED_EVENT_TYPE)
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

/**
 * Bulk-delete machine audit rows (Audit tab ledger only).
 * Never deletes manual operator ledger rows (event_type IS NULL) or ATELIER_VIEW noise.
 */
export async function deleteAuditLogEntries(ids: number[]): Promise<AuditActionResult> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)))
  if (uniqueIds.length === 0) return { ok: true, deletedCount: 0 }

  const supabase = await createClient()
  if (!(await requireAuditAdmin(supabase))) {
    return { error: 'Action réservée à l’administrateur' }
  }

  const { data, error } = await supabase
    .from('system_log')
    .delete()
    .in('id', uniqueIds)
    .not('event_type', 'is', null)
    .neq('event_type', AUDIT_LEDGER_EXCLUDED_EVENT_TYPE)
    .select('id')

  if (error) {
    await logError('Audit bulk delete failed', error, {
      source: 'deleteAuditLogEntries',
      metadata: { ids: uniqueIds },
    })
    return { error: error.message }
  }

  return { ok: true, deletedCount: data?.length ?? 0 }
}
