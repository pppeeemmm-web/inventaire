/** Inventory broadcast feed — eligibility + safe public payloads for middleware (Make/n8n). */

import { imageUrl, thumbUrl, yearOf } from '@/lib/data'

/** Minimal Oeuvres columns needed for eligibility checks. */
export type BroadcastOeuvreRow = {
  OeuvreID: number
  deleted_at?: string | null
  is_public: boolean | null
  broadcast_ready: boolean | null
  txtImageNameLink: string | null
  broadcast_caption_seed?: string | null
}

export function isBroadcastEligible(o: BroadcastOeuvreRow): boolean {
  if (o.deleted_at) return false
  if (!o.is_public) return false
  if (!o.broadcast_ready) return false
  if (!String(o.txtImageNameLink ?? '').trim()) return false
  return true
}

/** Lowercase platform slug for dedupe key (e.g. instagram, linkedin). */
export function normalizeBroadcastPlatform(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const p = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!p || p.length > 64) return null
  return p
}

export type BroadcastFeedItem = {
  oeuvreId: number
  titre: string | null
  /** ISO-ish Année from DB; year as integer in `anneeYear` when parsable */
  annee: string | null
  anneeYear: number | null
  hauteur: string | null
  largeur: string | null
  profondeur: string | null
  techniqueLabel: string | null
  supportLabel: string | null
  imageUrl: string | null
  thumbUrl: string | null
  captionSeed: string | null
}

export type BroadcastFeedWorkRow = BroadcastOeuvreRow & {
  Titre: string | null
  Année: string | null
  Hauteur: string | null
  Largeur: string | null
  Profondeur: string | null
  Technique: number | null
  Support: number | null
}

export function buildBroadcastFeedItem(
  row: BroadcastFeedWorkRow,
  techniqueLabel: string | null,
  supportLabel: string | null,
): BroadcastFeedItem {
  const file = row.txtImageNameLink
  const y = yearOf(row.Année ?? undefined)
  const seed = (row.broadcast_caption_seed ?? '').toString().trim()
  return {
    oeuvreId: row.OeuvreID,
    titre: row.Titre ?? null,
    annee: row.Année ?? null,
    anneeYear: y,
    hauteur: row.Hauteur ?? null,
    largeur: row.Largeur ?? null,
    profondeur: row.Profondeur ?? null,
    techniqueLabel,
    supportLabel,
    imageUrl: imageUrl(file),
    thumbUrl: thumbUrl(file),
    captionSeed: seed || null,
  }
}
