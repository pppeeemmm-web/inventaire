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

/** Payload shape without timestamp — used for equality + session writes. */
export type WorkFormDraftContent = Omit<WorkFormDraftPayload, 'savedAt'>

function sortedNums(a: number[]): number[] {
  return [...a].sort((x, y) => x - y)
}

function sortedStrs(a: string[]): string[] {
  return [...a].sort()
}

/** Normalize parsed JSON so loose storage payloads compare to UI snapshots. */
export function normalizeWorkFormDraftContent(
  p: Partial<WorkFormDraftContent> | WorkFormDraftPayload,
): WorkFormDraftContent {
  return {
    titre: String(p.titre ?? ''),
    annee: String(p.annee ?? ''),
    techniqueId: String(p.techniqueId ?? ''),
    supportId: String(p.supportId ?? ''),
    formatId: String(p.formatId ?? ''),
    hauteur: String(p.hauteur ?? ''),
    largeur: String(p.largeur ?? ''),
    profondeur: String(p.profondeur ?? ''),
    prodStage: String(p.prodStage ?? ''),
    needsPhoto: !!p.needsPhoto,
    ownStage: String(p.ownStage ?? ''),
    contactId: String(p.contactId ?? ''),
    anonymityLevel: typeof p.anonymityLevel === 'number' ? p.anonymityLevel : 0,
    prix: String(p.prix ?? '0'),
    tvaRate: String(p.tvaRate ?? '0'),
    discount: String(p.discount ?? '0'),
    paymentDone: !!p.paymentDone,
    exposable: !!p.exposable,
    commentaires: String(p.commentaires ?? ''),
    historique: String(p.historique ?? ''),
    selThemes: Array.isArray(p.selThemes) ? p.selThemes.map(Number) : [],
    selGroups: Array.isArray(p.selGroups) ? p.selGroups.map(String) : [],
  }
}

export function workFormDraftContentEquals(a: WorkFormDraftContent, b: WorkFormDraftContent): boolean {
  const na = normalizeWorkFormDraftContent(a)
  const nb = normalizeWorkFormDraftContent(b)
  if (na.titre !== nb.titre) return false
  if (na.annee !== nb.annee) return false
  if (na.techniqueId !== nb.techniqueId) return false
  if (na.supportId !== nb.supportId) return false
  if (na.formatId !== nb.formatId) return false
  if (na.hauteur !== nb.hauteur) return false
  if (na.largeur !== nb.largeur) return false
  if (na.profondeur !== nb.profondeur) return false
  if (na.prodStage !== nb.prodStage) return false
  if (na.needsPhoto !== nb.needsPhoto) return false
  if (na.ownStage !== nb.ownStage) return false
  if (na.contactId !== nb.contactId) return false
  if (na.anonymityLevel !== nb.anonymityLevel) return false
  if (na.prix !== nb.prix) return false
  if (na.tvaRate !== nb.tvaRate) return false
  if (na.discount !== nb.discount) return false
  if (na.paymentDone !== nb.paymentDone) return false
  if (na.exposable !== nb.exposable) return false
  if (na.commentaires !== nb.commentaires) return false
  if (na.historique !== nb.historique) return false
  const ta = sortedNums(na.selThemes)
  const tb = sortedNums(nb.selThemes)
  if (ta.length !== tb.length) return false
  for (let i = 0; i < ta.length; i++) if (ta[i] !== tb[i]) return false
  const ga = sortedStrs(na.selGroups)
  const gb = sortedStrs(nb.selGroups)
  if (ga.length !== gb.length) return false
  for (let i = 0; i < ga.length; i++) if (ga[i] !== gb[i]) return false
  return true
}

export function draftStorageKey(oeuvreId: number | null): string {
  return `${WORK_FORM_DRAFT_PREFIX}${oeuvreId ?? 'new'}`
}
