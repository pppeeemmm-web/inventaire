import type { Oeuvre } from '@/lib/types/database'
import type { PdfProfileMatrix } from '@/lib/portfolio-pdf-types'
import type { LandingGradientStop } from '@/lib/landing-background'
import {
  applyLandingBlendTransition,
  DEFAULT_LANDING_GRADIENT_STOPS,
  LANDING_BG_BLEND_POSITION_DEFAULT,
  LANDING_BG_BLEND_SOFTNESS_DEFAULT,
  migrateLandingGradientStops,
} from '@/lib/landing-background'
import type { LandingHeroGlossBlend } from '@/lib/landing-hero-gloss'
import type { LandingHeroBevelProfile } from '@/lib/landing-hero-bevel'
import {
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  LANDING_HERO_BEVEL_PX_DEFAULT,
  migrateHeroBevelProfile,
  migrateHeroBevelPx,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
  migrateWorksLightDirectionDeg,
  migrateWorksLightIntensityPct,
  migrateWorksLightTempK,
} from '@/lib/works-mode-light'
import {
  LANDING_HERO_GLOSS_BLEND_DEFAULT,
  LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
  LANDING_HERO_GLOSS_POSITION_DEFAULT,
  LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
  migrateHeroGlossBlend,
} from '@/lib/landing-hero-gloss'

export type { LandingGradientStop }
export type { PageBackgroundConfig, SiteBlockNavBarStyle } from '@/lib/page-background'
import {
  migrateNavBarStyle,
  migratePageBackground,
  type PageBackgroundConfig,
  type SiteBlockNavBarStyle,
} from '@/lib/page-background'

// ── Types ─────────────────────────────────────────────────────────────────

export type SiteBlockKind = 'hero' | 'identity' | 'about' | 'practice' | 'works_modes'

export interface SiteBlock {
  kind: SiteBlockKind
  visible: boolean
  /** Optional page gradient; omitted = inherit `landing` background. */
  page_bg?: PageBackgroundConfig
  /** Works page only: `transparent` = gradient to viewport top (no nav bar sleeve). */
  nav_bar_style?: SiteBlockNavBarStyle
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
  /** Inset bevel depth on the work mount (0 disables). Default {@link LANDING_HERO_BEVEL_PX_DEFAULT}. */
  bevel_px:     number
  bevel_profile: LandingHeroBevelProfile
  /** Wall light color temperature in kelvin; default {@link WORKS_LIGHT_TEMP_DEFAULT}. */
  light_temp_k: number
  /** Direction the light comes from, 0–360°; default {@link WORKS_LIGHT_DIRECTION_DEFAULT} (top-left). */
  light_direction_deg: number
  /** Brightness multiplier in 50–150 %; default {@link WORKS_LIGHT_INTENSITY_DEFAULT}. */
  light_intensity_pct: number
  /** When true, kelvin / direction / intensity are driven by the visitor's local clock. */
  light_circadian: boolean
}

export const DEFAULT_HERO_CAPTION_EN = "'Matsukaze' — Meaning 'Wind through the Pines'"
export const DEFAULT_HERO_CAPTION_FR = '« Matsukaze » — signifiant « Le vent dans les pins »'

function migrateLandingHeroId(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

export interface LandingConfig {
  hero_image_url: string
  /** R2 storage key (`tblImage.txtImageNameLink`) — resolved on the public site via `imageUrl()`. */
  hero_image_key: string
  /** Catalogue link for editor re-open; optional when URL is pasted manually. */
  hero_oeuvre_id: number | null
  hero_image_id: number | null
  hero_caption_fr: string
  hero_caption_en: string
  /** Page background gradient, 2–6 colour stops. */
  bg_gradient_stops: LandingGradientStop[]
  /** Transition centre, % from top (drives 4-stop layout). */
  bg_blend_position_pct: number
  /** Transition hardness: 0 = hard, 100 = soft (drives 4-stop layout). */
  bg_blend_softness_pct: number
  /** Gloss overlay blend mode (`off` disables). */
  hero_gloss_blend: LandingHeroGlossBlend
  /** Gloss intensity 0–100 (matches legacy ~100 ≈ 0.55 centre alpha). */
  hero_gloss_strength_pct: number
  /** White-point height on disc, % from top (lower = higher). */
  hero_gloss_position_pct: number
  /** Gloss radius before transparent; lower preserves image shadows. */
  hero_gloss_falloff_pct: number
  /** Inset lip on hero disc (0 = off, max 12 px). */
  hero_bevel_px: number
  /** Bevel shadow profile on the painted disc. */
  hero_bevel_profile: LandingHeroBevelProfile
  /** @deprecated Ignored — Portfolio PDF topic removed from /enquiry; always false after parse. */
  enquiry_portfolio_pdf: boolean
  /** @deprecated Ignored — landing heroes use AVIF alpha; always false after parse. */
  hero_white_key: boolean
}

export const LANDING_ENQUIRY_PORTFOLIO_PDF_DEFAULT = false

/** Legacy JSON field; enquiry Portfolio PDF UI removed — always false after parse. */
export function migrateEnquiryPortfolioPdf(_v: unknown): boolean {
  return false
}

/** Legacy JSON field; white-key UI removed — landing always renders without multiply/backdrop. */
export function migrateHeroWhiteKey(_v: unknown): boolean {
  return false
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
  landing: {
    hero_image_url: '',
    hero_image_key: '',
    hero_oeuvre_id: null,
    hero_image_id: null,
    hero_caption_fr: DEFAULT_HERO_CAPTION_FR,
    hero_caption_en: DEFAULT_HERO_CAPTION_EN,
    bg_gradient_stops: applyLandingBlendTransition(
      DEFAULT_LANDING_GRADIENT_STOPS,
      LANDING_BG_BLEND_POSITION_DEFAULT,
      LANDING_BG_BLEND_SOFTNESS_DEFAULT,
    ),
    bg_blend_position_pct: LANDING_BG_BLEND_POSITION_DEFAULT,
    bg_blend_softness_pct: LANDING_BG_BLEND_SOFTNESS_DEFAULT,
    hero_gloss_blend: LANDING_HERO_GLOSS_BLEND_DEFAULT,
    hero_gloss_strength_pct: LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
    hero_gloss_position_pct: LANDING_HERO_GLOSS_POSITION_DEFAULT,
    hero_gloss_falloff_pct: LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
    hero_bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
    hero_bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
    enquiry_portfolio_pdf: LANDING_ENQUIRY_PORTFOLIO_PDF_DEFAULT,
    hero_white_key: false,
  },
  sections: [],
  works_collections: [],
  pdf_profiles: {},
  site_blocks: DEFAULT_SITE_BLOCKS,
  works_modes: [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    is_active: true, sort_order: 0, layout: 'carousel',
    collections: [], outro_fr: '', outro_en: '',
    bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
    bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
    light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
    light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
    light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
    light_circadian: false,
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
      bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
      bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
      light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
      light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
      light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
      light_circadian: false,
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
    bevel_px:    migrateHeroBevelPx(m.bevel_px),
    bevel_profile: migrateHeroBevelProfile(m.bevel_profile),
    light_temp_k: migrateWorksLightTempK(m.light_temp_k),
    light_direction_deg: migrateWorksLightDirectionDeg(m.light_direction_deg),
    light_intensity_pct: migrateWorksLightIntensityPct(m.light_intensity_pct),
    light_circadian: m.light_circadian === true,
  }))
}

function migrateLandingHex(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim()
  const m = s.match(/^#?([0-9a-f]{6})$/i)
  return m ? `#${m[1].toLowerCase()}` : fallback
}

function migrateLandingPct(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function migrateSiteBlocks(raw: any): SiteBlock[] {
  if (!Array.isArray(raw?.site_blocks)) return DEFAULT_SITE_BLOCKS.map(b => ({ ...b }))
  const seen = new Set<SiteBlockKind>()
  const result: SiteBlock[] = []
  for (const b of raw.site_blocks) {
    if (b && typeof b.kind === 'string' && SITE_BLOCK_KINDS.includes(b.kind) && !seen.has(b.kind)) {
      seen.add(b.kind)
      const kind = b.kind as SiteBlockKind
      const pageBg = migratePageBackground(b.page_bg)
      const navBarStyle = migrateNavBarStyle(kind, b.nav_bar_style)
      const row: SiteBlock = { kind, visible: b.visible !== false }
      if (pageBg) row.page_bg = pageBg
      if (navBarStyle) row.nav_bar_style = navBarStyle
      result.push(row)
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
      hero_image_key: String(raw.landing?.hero_image_key ?? '').trim(),
      hero_oeuvre_id: migrateLandingHeroId(raw.landing?.hero_oeuvre_id),
      hero_image_id: migrateLandingHeroId(raw.landing?.hero_image_id),
      hero_caption_fr: String(raw.landing?.hero_caption_fr ?? '').trim() || DEFAULT_HERO_CAPTION_FR,
      hero_caption_en: String(raw.landing?.hero_caption_en ?? '').trim() || DEFAULT_HERO_CAPTION_EN,
      bg_gradient_stops: migrateLandingGradientStops(raw.landing),
      bg_blend_position_pct: migrateLandingPct(
        raw.landing?.bg_blend_position_pct,
        LANDING_BG_BLEND_POSITION_DEFAULT,
      ),
      bg_blend_softness_pct: migrateLandingPct(
        raw.landing?.bg_blend_softness_pct,
        LANDING_BG_BLEND_SOFTNESS_DEFAULT,
      ),
      hero_gloss_blend: migrateHeroGlossBlend(raw.landing?.hero_gloss_blend),
      hero_gloss_strength_pct: migrateLandingPct(
        raw.landing?.hero_gloss_strength_pct,
        LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
      ),
      hero_gloss_position_pct: migrateLandingPct(
        raw.landing?.hero_gloss_position_pct,
        LANDING_HERO_GLOSS_POSITION_DEFAULT,
      ),
      hero_gloss_falloff_pct: migrateLandingPct(
        raw.landing?.hero_gloss_falloff_pct,
        LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
      ),
      hero_bevel_px: migrateHeroBevelPx(raw.landing?.hero_bevel_px),
      hero_bevel_profile: migrateHeroBevelProfile(raw.landing?.hero_bevel_profile),
      enquiry_portfolio_pdf: migrateEnquiryPortfolioPdf(raw.landing?.enquiry_portfolio_pdf),
      hero_white_key: migrateHeroWhiteKey(raw.landing?.hero_white_key),
    },
    sections:          oldSections.map(migrateCollection),
    works_collections: oldWorks.map(migrateCollection),
    works_modes:       migrateModes(raw, oldWorks.map(migrateCollection)),
    site_blocks:       migrateSiteBlocks(raw),
    pdf_profiles:      raw.pdf_profiles && typeof raw.pdf_profiles === 'object' ? raw.pdf_profiles : {},
  }
}
