/** Laboratoire (docs/design/2026-11-28/Laboratoire.md; SQL supabase/sql/laboratoire.sql). Browser-safe. */

export const LAB_ROLES = ['champ', 'chapitre', 'but', 'conjecture', 'regle', 'recette', 'matiere', 'terme'] as const
export type LabRole = (typeof LAB_ROLES)[number]
/** What can grow under a field or a chapter, in the book's order (goal → rules → recipes → open conjectures …). */
export const LAB_CHILD_ROLES: LabRole[] = ['chapitre', 'but', 'regle', 'recette', 'conjecture', 'matiere', 'terme']

/** The grid of limits (same for every recipe), in the order of the card. */
export const LAB_CRITERIA = [
  'adhesion', 'flexibility', 'ageing', 'compatibility', 'layering', 'max_thickness', 'supports', 'drying', 'optical',
  'solubility', 'handling', 'batch_life', 'health_cost',
] as const
export type LabCriterion = (typeof LAB_CRITERIA)[number]
export type LabSource = 'literature' | 'trials'
export type LabSign = 'ok' | 'condition' | 'no' | 'unknown'
export const LAB_SIGNS: LabSign[] = ['ok', 'condition', 'no', 'unknown']
export const LAB_SIGN_MARK: Record<LabSign, string> = { ok: '✓', condition: '~', no: '✗', unknown: '?' }

export type LabIngredient = { stockItemId: number | null; stockName: string | null; label: string | null; amount: number | null; unit: string | null; ratioPct: number | null; note: string | null }
export type LabStep = { body: string; duration: string | null; equipmentId: number | null; equipmentName: string | null; warning: string | null }
export type LabAssessment = { criterion: LabCriterion; source: LabSource; sign: LabSign; score: number | null; note: string | null; sourceRef: string | null; journalEntryId: number | null }
export type LabChild = { id: string; title: string; role: LabRole; position: number | null; stage: string }

/** The Laboratoire part of an idea's desk (null for an ordinary idea). */
export type LabDesk = {
  role: LabRole
  version: number | null
  /** concept.updated_at — sent back to save_recipe as the stale check. */
  updatedAt: string
  children: LabChild[]
  ingredients: LabIngredient[]
  steps: LabStep[]
  assessments: LabAssessment[]
}

export function isLabRole(x: unknown): x is LabRole {
  return typeof x === 'string' && (LAB_ROLES as readonly string[]).includes(x)
}
