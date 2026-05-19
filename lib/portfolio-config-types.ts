import type { Oeuvre } from '@/lib/types/database'
import type { PdfProfileMatrix } from '@/lib/portfolio-pdf-types'

// ── Types ─────────────────────────────────────────────────────────────────

export type SiteBlockKind = 'hero' | 'identity' | 'about' | 'practice' | 'works_modes'

export interface SiteBlock {
  kind: SiteBlockKind
  visible: boolean
}

export const SITE_BLOCK_KINDS: SiteBlockKind[] = ['hero', 'identity', 'about', 'practice', 'works_modes']

export const DEFAULT_SITE_BLOCKS: SiteBlock[] = SITE_BLOCK_KINDS.map(k => ({ kind: k, visible: true }))

export interface CollectionItem {
  id:              string
  title_fr:        string
  title_en:        string
  intro_fr:        string
  intro_en:        string
  description_fr:  string
  description_en:  string
  theme:           string | null
  sort_order:      number
  is_active:       boolean
  manual_work_order?: number[]
}

export type WorksLayout = 'carousel' | 'grid'

export interface WorksMode {
  id:           string
  label_fr:     string
  label_en:     string
  is_active:    boolean
  sort_order:   number
  layout:       WorksLayout
  collections:  CollectionItem[]
  outro_fr:     string
  outro_en:     string
}

export interface LandingConfig {
  hero_image_url: string
}

export interface PortfolioConfig {
  general: {
    artist_name:       string
    contact_email:     string
    instagram:         string
    phone:             string
    media_tagline_fr:  string
    media_tagline_en:  string
  }
  about: {
    intro_fr: string
    intro_en: string
  }
  practice: {
    approach_fr:  string
    approach_en:  string
    themes:       string[]
    materials_fr: string
    materials_en: string
  }
  landing:           LandingConfig
  sections:          CollectionItem[]
  works_collections: CollectionItem[]
  works_modes:       WorksMode[]
  site_blocks:       SiteBlock[]
  pdf_profiles:      PdfProfileMatrix
}

export type ThemeWork = { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }

export interface PortfolioTabProps {
  oeuvres: Oeuvre[]
  themes:  { id: number; name: string }[]
  themePublicStats?: Record<number, { total: number; pub: number }>
  themePrivateWorks?: Record<number, number[]>
  oeuvresCatalogueTotal?: number
}

// ── Defaults ──────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: PortfolioConfig = {
  general: { artist_name: '', contact_email: '', instagram: '', phone: '', media_tagline_fr: '', media_tagline_en: '' },
  about:   { intro_fr: '', intro_en: '' },
  practice:{ approach_fr: '', approach_en: '', themes: [], materials_fr: '', materials_en: '' },
  landing: { hero_image_url: '' },
  sections: [],
  works_collections: [],
  pdf_profiles: {},
  site_blocks: DEFAULT_SITE_BLOCKS,
  works_modes: [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    is_active: true, sort_order: 0, layout: 'carousel',
    collections: [], outro_fr: '', outro_en: '',
  }],
}

// ── Utilities ─────────────────────────────────────────────────────────────

export function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr
  const next = arr.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function isHttpsHeroUrl(s: string): boolean {
  const u = (s ?? '').trim()
  return /^https:\/\//i.test(u)
}

// ── Migration ─────────────────────────────────────────────────────────────

function migrateCollection(c: any): CollectionItem {
  return {
    id:             c.id || Math.random().toString(36).slice(2),
    title_fr:       c.title_fr || c.title || '',
    title_en:       c.title_en || '',
    intro_fr:       c.intro_fr || '',
    intro_en:       c.intro_en || '',
    description_fr: c.description_fr || c.description || '',
    description_en: c.description_en || '',
    theme:          c.theme ?? null,
    sort_order:     c.sort_order ?? 0,
    is_active:      c.is_active ?? true,
    manual_work_order: Array.isArray(c.manual_work_order)
      ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : undefined,
  }
}

function migrateModes(raw: any, fallbackCollections: CollectionItem[]): WorksMode[] {
  const list = Array.isArray(raw.works_modes) ? raw.works_modes : []
  if (list.length === 0) {
    return [{
      id: 'default', label_fr: 'Œuvres', label_en: 'Works',
      is_active: true, sort_order: 0, layout: 'carousel' as const,
      collections: fallbackCollections,
      outro_fr: raw.works_outro_fr ?? '',
      outro_en: raw.works_outro_en ?? '',
    }]
  }
  return list.map((m: any, i: number): WorksMode => ({
    id:          m.id || Math.random().toString(36).slice(2),
    label_fr:    m.label_fr || m.label || (i === 0 ? 'Œuvres' : `Mode ${i + 1}`),
    label_en:    m.label_en || m.label || (i === 0 ? 'Works'  : `Mode ${i + 1}`),
    is_active:   m.is_active ?? true,
    sort_order:  m.sort_order ?? i,
    layout:      m.layout === 'grid' ? 'grid' : 'carousel',
    collections: Array.isArray(m.collections) ? m.collections.map((c: any) => ({
      id:             c.id || Math.random().toString(36).slice(2),
      title_fr:       c.title_fr || c.title || '',
      title_en:       c.title_en || '',
      intro_fr:       c.intro_fr || '',
      intro_en:       c.intro_en || '',
      description_fr: c.description_fr || c.description || '',
      description_en: c.description_en || '',
      theme:          c.theme ?? null,
      sort_order:     c.sort_order ?? 0,
      is_active:      c.is_active ?? true,
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : undefined,
    })) : [],
    outro_fr:    m.outro_fr || '',
    outro_en:    m.outro_en || '',
  }))
}

function migrateSiteBlocks(raw: any): SiteBlock[] {
  if (!Array.isArray(raw?.site_blocks)) return DEFAULT_SITE_BLOCKS.map(b => ({ ...b }))
  const seen = new Set<SiteBlockKind>()
  const result: SiteBlock[] = []
  for (const b of raw.site_blocks) {
    if (b && typeof b.kind === 'string' && SITE_BLOCK_KINDS.includes(b.kind) && !seen.has(b.kind)) {
      seen.add(b.kind)
      result.push({ kind: b.kind, visible: b.visible !== false })
    }
  }
  for (const k of SITE_BLOCK_KINDS) {
    if (!seen.has(k)) result.push({ kind: k, visible: true })
  }
  return result
}

export function migrate(raw: any): PortfolioConfig {
  const isOldArray = Array.isArray(raw)
  const oldSections = isOldArray ? raw : (raw.sections || [])
  const oldWorks    = isOldArray ? raw : (raw.works_collections || [])

  return {
    general: {
      artist_name:      raw.general?.artist_name      || '',
      contact_email:    raw.general?.contact_email    || '',
      instagram:        raw.general?.instagram        || '',
      phone:            raw.general?.phone            || '',
      media_tagline_fr: raw.general?.media_tagline_fr || '',
      media_tagline_en: raw.general?.media_tagline_en || '',
    },
    about: {
      intro_fr: raw.about?.intro_fr || raw.about?.intro || raw.general?.about_intro || '',
      intro_en: raw.about?.intro_en || '',
    },
    practice: {
      approach_fr:  raw.practice?.approach_fr  || raw.practice?.approach  || '',
      approach_en:  raw.practice?.approach_en  || '',
      themes:       raw.practice?.themes       || [],
      materials_fr: raw.practice?.materials_fr || raw.practice?.materials || '',
      materials_en: raw.practice?.materials_en || '',
    },
    landing: {
      hero_image_url: String(raw.landing?.hero_image_url ?? '').trim(),
    },
    sections:          oldSections.map(migrateCollection),
    works_collections: oldWorks.map(migrateCollection),
    works_modes:       migrateModes(raw, oldWorks.map(migrateCollection)),
    site_blocks:       migrateSiteBlocks(raw),
    pdf_profiles:      raw.pdf_profiles && typeof raw.pdf_profiles === 'object' ? raw.pdf_profiles : {},
  }
}
