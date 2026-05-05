import { createClient } from '@/lib/supabase/server'

interface LogEntry {
  eventType: 'STATUS_CHANGE' | 'LOCATION_MOVE' | 'PRICE_CHANGE' | 'VAULT_UPLOAD' | 'ORDER_CREATED' | 'SYSTEM_CONFIG' | 'VISIBILITY_GATE' | 'GATE_BYPASS' | 'PAYMENT_GRAIN'
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

  const { error } = await supabase.from('system_log').insert({
    user_id: user.id,
    event_type: entry.eventType,
    table_name: entry.tableName,
    row_id: String(entry.rowId),
    old_value: entry.oldValue,
    new_value: entry.newValue,
    metadata: entry.metadata
  })

  if (error) {
    console.error('Failed to write to system_log:', error.message)
  }
}
