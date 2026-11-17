/**
 * One definition of « in production » (docs/WORK_RULES.md rule 16, Pem 2026-11-17). Read from the
 * status id, never from its label (labels load after the first paint). Used by the Production board,
 * its report and the work-session picker. Display chips (`statusOf`) and the address rule
 * (`oeuvre_stage_key`, database) describe other things and keep their own logic.
 */

/** Out of the studio's work: archived (3), sold (6), destroyed (9), lost (10), given (11). */
export const OUT_OF_PRODUCTION_STATUS_IDS: readonly number[] = [3, 6, 9, 10, 11]

export function isOutOfProduction(statusId: number | null | undefined): boolean {
  return statusId != null && OUT_OF_PRODUCTION_STATUS_IDS.includes(statusId)
}

type StageFields = { Catalogué?: boolean | null; NeedsPhotograph?: boolean | null }

/** The stage is not finished: not catalogued, or catalogued with the photo still to take. */
export function stageUnfinished(o: StageFields): boolean {
  return !o.Catalogué || !!o.NeedsPhotograph
}

/**
 * In production: not out of production, and either its stage is unfinished or it has an open task
 * (`work_action` not done, not paused — Encadrer, Retoucher… on a finished work count too).
 */
export function isInProduction(
  o: StageFields & { OeuvreID: number; statusId?: number | null },
  worksWithOpenTasks?: Set<number>,
): boolean {
  if (isOutOfProduction(o.statusId)) return false
  return stageUnfinished(o) || !!worksWithOpenTasks?.has(o.OeuvreID)
}
