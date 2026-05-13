import { createClient } from '@/lib/supabase/server'

interface LogEntry {
  eventType: 'STATUS_CHANGE' | 'LOCATION_MOVE' | 'PRICE_CHANGE' | 'VAULT_UPLOAD' | 'ORDER_CREATED' | 'SYSTEM_CONFIG' | 'VISIBILITY_GATE' | 'GATE_BYPASS' | 'PAYMENT_GRAIN' | 'CRON_JOB'
  tableName?: string
  rowId?: string | number
  oldValue?: any
  newValue?: any
  metadata?: any
}

/**
 * Centrally records significant events in the Atelier.
 * Captures User Attribution automatically via the session client.
 */
export async function logSystemEvent(entry: LogEntry) {
  const supabase = await createClient()
  
  // Get current user for attribution
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    console.warn('Attempted to log system event without active user session:', entry.eventType)
    return
  }

  // `action` is a short human-readable label; `event_type` is the machine category (audit-only system_log).
  const action = entry.tableName && entry.rowId != null
    ? `${entry.eventType} ${entry.tableName}#${entry.rowId}`
    : entry.eventType

  const { error } = await supabase.from('system_log').insert({
    user_id: user.id,
    action,
    event_type: entry.eventType,
    table_name: entry.tableName,
    row_id: entry.rowId != null ? String(entry.rowId) : null,
    old_value: entry.oldValue,
    new_value: entry.newValue,
    metadata: entry.metadata
  })

  if (error) {
    console.error('Failed to write to system_log:', error.message)
  }
}

/** Cron / automation — service role, no user session (best-effort). */
export async function logSystemCronEvent(entry: LogEntry) {
  try {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const supabase = createServiceClient()
    const action =
      entry.tableName && entry.rowId != null
        ? `${entry.eventType} ${entry.tableName}#${entry.rowId}`
        : entry.eventType
    const { error } = await supabase.from('system_log').insert({
      action,
      event_type: entry.eventType,
      table_name: entry.tableName,
      row_id: entry.rowId != null ? String(entry.rowId) : null,
      old_value: entry.oldValue,
      new_value: entry.newValue,
      metadata: { ...entry.metadata, source: 'cron' },
    } as any)
    if (error) console.error('[cron-log]', error.message)
  } catch (e) {
    console.error('[cron-log]', e)
  }
}
