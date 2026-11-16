// Overview catalogue counts (TODO 18 « pipeline pulse on the server », 2026-11-16). One function used on
// both sides: the server read (`app/atelier/overview-stats-actions.ts`) counts the whole catalogue so the
// Overview is right from first paint; the Overview counts its loaded rows once the full catalogue is in
// (live after edits). Plain module: no 'use server' / 'use client'.

/** The Oeuvres columns the counts read (subset of the catalogue row). */
export type OverviewCountRow = {
  OeuvreID: number
  Titre: string | null
  Technique: number | null
  Support: number | null
  Année: string | null
  Hauteur: string | number | null
  Largeur: string | number | null
  Prix: number | null
  statusId: number | null
  Exposable?: boolean | null
  Catalogué: boolean | null
  txtImageNameLink?: string | null
  LocalisationID?: number | null
  localisation_address_id?: number | null
  NeedsPhotograph?: boolean | null
}

export const OVERVIEW_COUNT_SELECT =
  'OeuvreID, Titre, Technique, Support, "Année", Hauteur, Largeur, Prix, statusId, Exposable, "Catalogué", txtImageNameLink, LocalisationID, localisation_address_id, NeedsPhotograph'

export type OverviewCounts = {
  total: number
  byYear: number
  withPrice: number
  available: number
  exposable: number
  catalogued: number
  notCatalogued: number
  missingDims: number
  missingImages: number
  missingLoc: number
  missingAddress: number
  missingTech: number
  missingSupport: number
  missingYear: number
  missingTitle: number
  /** Photo shot but not yet validated — `addWorkImage` never clears NeedsPhotograph. */
  needsPhotoValidation: number
  totalValue: number
  /** Works per technique id (null = no technique), as [id, n] pairs. */
  byTechnique: [number | null, number][]
}

/** Same rules as the Overview always used. `year` = the calendar year counted as « made this year ». */
export function computeOverviewCounts(rows: readonly OverviewCountRow[], year: number): OverviewCounts {
  const yearPrefix = String(year)
  const c: OverviewCounts = {
    total: rows.length, byYear: 0, withPrice: 0, available: 0, exposable: 0, catalogued: 0, notCatalogued: 0,
    missingDims: 0, missingImages: 0, missingLoc: 0, missingAddress: 0, missingTech: 0, missingSupport: 0,
    missingYear: 0, missingTitle: 0, needsPhotoValidation: 0, totalValue: 0, byTechnique: [],
  }
  const tech = new Map<number | null, number>()
  for (const o of rows) {
    if (o.Année?.startsWith(yearPrefix)) c.byYear++
    if (o.Prix && o.Prix > 0) { c.withPrice++; c.totalValue += o.Prix }
    if (o.statusId === 2) {
      c.available++
      if (o.Exposable) c.exposable++
    }
    if (!o.Hauteur || !o.Largeur) c.missingDims++
    if (!o.txtImageNameLink) c.missingImages++
    if (!o.LocalisationID) c.missingLoc++
    else if (o.localisation_address_id == null) c.missingAddress++
    if (o.Technique == null) c.missingTech++
    if (o.Support == null) c.missingSupport++
    if (!o.Année) c.missingYear++
    if (!o.Titre?.trim()) c.missingTitle++
    if (o.NeedsPhotograph) c.needsPhotoValidation++
    if (o.Catalogué) c.catalogued++
    else c.notCatalogued++
    tech.set(o.Technique ?? null, (tech.get(o.Technique ?? null) ?? 0) + 1)
  }
  c.byTechnique = [...tech.entries()]
  return c
}
