import type { SupabaseClient } from '@supabase/supabase-js'
import type { DictKey } from '@/lib/i18n/dictionary'
import { workActionTypeDisplayLabel } from '@/lib/work-action-type-label'

/**
 * Pending production steps (`work_action.done = false`) per work, as display labels in the
 * board's column order. Used by the Reports "Étapes en attente" column (table + PDF) and to
 * build the Production source (a work with a pending step is in production).
 */
export async function loadPendingActionsMap(
  sb: SupabaseClient,
  t: (k: DictKey) => string,
  ids?: number[],
): Promise<Map<number, string[]>> {
  let q = sb.from('work_action').select('oeuvre_id, action_type_id').eq('done', false)
  if (ids) q = q.in('oeuvre_id', ids)
  const [actsRes, typesRes] = await Promise.all([
    q,
    sb.from('work_action_type').select('id, label, sort_order').order('sort_order').order('id'),
  ])
  const types = (typesRes.data ?? []) as { id: number; label: string; sort_order: number }[]
  const rank = new Map(types.map((ty, i) => [ty.id, i]))
  const label = new Map(types.map((ty) => [ty.id, workActionTypeDisplayLabel(ty.id, ty.label, t)]))

  const byWork = new Map<number, number[]>()
  for (const a of (actsRes.data ?? []) as { oeuvre_id: number; action_type_id: number }[]) {
    const arr = byWork.get(a.oeuvre_id) ?? []
    if (!arr.includes(a.action_type_id)) arr.push(a.action_type_id)
    byWork.set(a.oeuvre_id, arr)
  }
  const out = new Map<number, string[]>()
  for (const [oid, typeIds] of byWork) {
    typeIds.sort((x, y) => (rank.get(x) ?? 999) - (rank.get(y) ?? 999))
    out.set(oid, typeIds.map((id) => label.get(id) ?? String(id)))
  }
  return out
}
