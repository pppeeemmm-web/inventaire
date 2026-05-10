/**
 * Session-level cache for `work_action_type` rows — avoids refetching on every
 * WorkDrawer open / ProductionTab poll when the lookup table is unchanged.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type WorkActionTypeRow = {
  id: number
  label: string
  color: string
  field_key: string | null
  sort_order: number
}

let cache: WorkActionTypeRow[] | null = null

export function invalidateWorkActionTypesCache() {
  cache = null
}

export async function getWorkActionTypes(sb: SupabaseClient): Promise<WorkActionTypeRow[]> {
  if (cache) return cache
  const { data, error } = await sb.from('work_action_type').select('*').order('sort_order').order('id')
  if (error) {
    console.warn('[work_action_type]', error.message)
    return []
  }
  cache = (data ?? []) as WorkActionTypeRow[]
  return cache
}
