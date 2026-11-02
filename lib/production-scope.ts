import { statusOf, type StatusKey } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'

/** Statuses that never show on the Production board (nor in its report). */
export const PRODUCTION_EXCLUDED_STATUSES: StatusKey[] = ['sold', 'gift', 'artist_archive', 'private_archive']

/**
 * A work is "in production" when it is not sold/given/archived and is either not catalogued yet,
 * still needs its photograph, or has a pending production action (`work_action.done = false`).
 * Shared by the Production board and its Rapport so both list the same works.
 */
export function isInProduction(
  o: Oeuvre,
  statusLabelMap: Record<number, string>,
  worksWithPendingActions: Set<number>,
): boolean {
  if (o.Catalogué && !o.NeedsPhotograph && !worksWithPendingActions.has(o.OeuvreID)) return false
  return !PRODUCTION_EXCLUDED_STATUSES.includes(statusOf(o, statusLabelMap))
}
