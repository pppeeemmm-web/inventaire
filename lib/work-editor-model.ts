/**
 * Shared production + ownership model for WorkForm / WorkDrawer.
 * statusId 1/2 are derived from artist ownership + production stage.
 */

import type { Oeuvre } from '@/lib/types/database'

export type ProdStageId = 'atelier' | 'catalogued' | 'available'
export type OwnStageId =
  | 'artist'
  | 'reserved'
  | 'consigned'
  | 'loan'
  | 'sold'
  | 'gift'
  | 'artist_archive'

/** statusId for non-artist ownership stages (`artist` unused — derived with prod stage). */
export const OWN_TO_STATUS_ID: Record<OwnStageId, number> = {
  artist: 1,
  reserved: 4,
  consigned: 7,
  loan: 8,
  sold: 6,
  gift: 11,
  artist_archive: 3,
}

export function ownStageFromStatusId(statusId: number | null | undefined): OwnStageId {
  if (statusId === null || statusId === undefined) return 'artist'
  switch (statusId) {
    case 4:
      return 'reserved'
    case 7:
      return 'consigned'
    case 8:
      return 'loan'
    case 6:
      return 'sold'
    case 11:
      return 'gift'
    case 3:
      return 'artist_archive'
    case 5:
      return 'artist_archive'
    default:
      return 'artist'
  }
}

export function prodStageFromOeuvre(o: Oeuvre | null): ProdStageId {
  if (!o || !o.Catalogué) return 'atelier'
  if ((o as { NeedsPhotograph?: boolean }).NeedsPhotograph) return 'catalogued'
  return 'available'
}

export function computeStatusId(ownStage: OwnStageId, prodStage: ProdStageId): number {
  if (ownStage !== 'artist') return OWN_TO_STATUS_ID[ownStage] ?? 1
  if (prodStage === 'available') return 2
  return 1
}
