/**
 * Which works may enter a sale or a consignment (owner 2026-11-03: sold, given, archived,
 * destroyed and lost works are out of circulation). Server-side gate for the order actions;
 * the pickers already hide these works, this stops any other path.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** New sale order / reservation: in production, available, or consigned (sold through the gallery). */
export const SALE_ORDER_FROM = [1, 2, 7] as const
/** Completing a sale: the reservation the order made (4), or a work still in the studio / gallery. */
export const SALE_COMPLETE_FROM = [1, 2, 4, 7] as const
/** New consignment / loan: works still in the studio. */
export const CONSIGN_FROM = [1, 2] as const

/** `work_out_of_circulation` when any work is deleted, has a fate, or a status outside `allowed`. */
export async function circulationError(
  // Callers pass differently typed clients (typed Database / untyped).
  supabase: SupabaseClient<any, any, any>,
  ids: number[],
  allowed: readonly number[],
): Promise<string | null> {
  if (ids.length === 0) return null
  const { data, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, statusId, fate, deleted_at')
    .in('OeuvreID', ids)
  if (error) return error.message
  const rows = (data ?? []) as { OeuvreID: number; statusId: number | null; fate: string | null; deleted_at: string | null }[]
  if (rows.length !== new Set(ids).size) return 'work_out_of_circulation'
  const bad = rows.some((w) => w.deleted_at || w.fate || !allowed.includes(w.statusId ?? 1))
  return bad ? 'work_out_of_circulation' : null
}
