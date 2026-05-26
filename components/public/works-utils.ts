// Shared types and pure helpers for /works views (carousel + grid).

import type { ThemeWork, WorksLayout } from '@/lib/portfolio-config-types'

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
  bevel_px?: number
  bevel_profile?: 'smooth' | 'hard'
  light_temp_k?: number
  light_direction_deg?: number
  light_intensity_pct?: number
  light_circadian?: boolean
}

/** Strip RichEditor HTML for plain-text labels (grid intro, carousel chapter line). */
export function richTextToPlain(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim()
}

// ── Theme matching ───────────────────────────────────────────────────────

export function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Case- and accent-insensitive exact theme name match (atelier stores catalogue theme names). */
export function workMatchesCollectionTheme(
  workThemes: string[],
  collectionTheme: string | null | undefined,
): boolean {
  if (!collectionTheme?.trim()) return true
  const sMatch = normalizeTheme(collectionTheme)
  return workThemes.some((th) => normalizeTheme(th) === sMatch)
}

export type ThemeNameRecord = { id: number; name: string }

/**
 * Resolve a portfolio collection's theme label to one catalogue theme row.
 * Uses the same normalization as public /works matching; prefers an exact name match when ambiguous.
 */
export function resolveThemeByName(
  themes: ReadonlyArray<ThemeNameRecord>,
  label: string | null | undefined,
): ThemeNameRecord | null {
  if (!label?.trim()) return null
  const want = normalizeTheme(label)
  const matches = themes.filter((t) => normalizeTheme(t.name) === want)
  if (matches.length === 0) return null
  const exact = matches.find((t) => t.name === label)
  if (exact) return exact
  return matches.slice().sort((a, b) => a.id - b.id)[0]!
}

/**
 * Œuvres linked in oeuvre_theme for the resolved theme id (atelier Site / Portfolio editors).
 * Does not use fuzzy multi-theme matching — only junction membership for that theme id.
 */
export function themeWorksForCollectionLabel(
  label: string | null | undefined,
  themes: ReadonlyArray<ThemeNameRecord>,
  themePrivateWorks: Readonly<Record<number, number[]>>,
  oeuvreById: ReadonlyMap<number, ThemeWork>,
): ThemeWork[] {
  const theme = resolveThemeByName(themes, label)
  if (!theme) return []
  const ids = themePrivateWorks[theme.id] ?? []
  const out: ThemeWork[] = []
  for (const id of ids) {
    const w = oeuvreById.get(id)
    if (w) out.push(w)
  }
  return out
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
      if (!workMatchesCollectionTheme(w.themes, col.theme)) continue
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
