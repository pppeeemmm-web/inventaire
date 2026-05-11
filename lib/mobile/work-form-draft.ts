/** Session draft for WorkForm crash recovery (narrow / all viewports). */

export const WORK_FORM_DRAFT_PREFIX = 'pem-workform-draft-v1:'

export type WorkFormDraftPayload = {
  titre: string
  annee: string
  techniqueId: string
  supportId: string
  formatId: string
  hauteur: string
  largeur: string
  profondeur: string
  prodStage: string
  needsPhoto: boolean
  ownStage: string
  contactId: string
  anonymityLevel: number
  prix: string
  tvaRate: string
  discount: string
  paymentDone: boolean
  exposable: boolean
  commentaires: string
  historique: string
  selThemes: number[]
  selGroups: string[]
  savedAt: number
}

export function draftStorageKey(oeuvreId: number | null): string {
  return `${WORK_FORM_DRAFT_PREFIX}${oeuvreId ?? 'new'}`
}
