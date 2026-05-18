// Shared types and pure helpers for /works views (carousel + grid).

import type { WorksLayout } from '@/lib/portfolio-config-types'

export interface Work {
  OeuvreID: number
  Titre: string | null
  Annee: string | null
  Hauteur: string | null
  Largeur: string | null
  txtImageNameLink: string | null
  themes: string[]
  isRound: boolean
}

export interface Collection {
  id: string
  title_fr: string
  title_en: string
  intro_fr?: string
  intro_en?: string
  description_fr: string
  description_en: string
  theme?: string | null
  is_active: boolean
  manual_work_order?: number[]
}

export interface WorksMode {
  id: string
  label_fr: string
  label_en: string
  layout: WorksLayout
  collections: Collection[]
  outro_fr: string
  outro_en: string
}

// ── Theme matching ───────────────────────────────────────────────────────

export function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function workMatchesCollectionTheme(
  workThemes: string[],
  collectionTheme: string | null | undefined,
): boolean {
  if (!collectionTheme?.trim()) return true
  const sMatch = normalizeTheme(collectionTheme)
  return workThemes.some((th) => {
    const wMatch = normalizeTheme(th)
    return wMatch.includes(sMatch) || sMatch.includes(wMatch)
  })
}

// ── Work ordering ────────────────────────────────────────────────────────

/** Manual order first, then theme-matched residuals. Only works with images. */
export function worksForCollection(col: Collection, works: Work[]): Work[] {
  const seenHere = new Set<number>()
  const orderIds = col.manual_work_order ?? []
  const byId = new Map(works.map(w => [w.OeuvreID, w]))

  if (orderIds.length > 0) {
    const out: Work[] = []
    for (const id of orderIds) {
      const w = byId.get(id)
      if (!w?.txtImageNameLink) continue
      if (seenHere.has(w.OeuvreID)) continue
      seenHere.add(w.OeuvreID)
      out.push(w)
    }
    for (const w of works) {
      if (!w.txtImageNameLink) continue
      if (seenHere.has(w.OeuvreID)) continue
      if (!workMatchesCollectionTheme(w.themes, col.theme)) continue
      seenHere.add(w.OeuvreID)
      out.push(w)
    }
    return out
  }
  return works.filter(w => {
    if (!w.txtImageNameLink) return false
    if (!workMatchesCollectionTheme(w.themes, col.theme)) return false
    if (seenHere.has(w.OeuvreID)) return false
    seenHere.add(w.OeuvreID)
    return true
  })
}
