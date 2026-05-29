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
  WORKS_CAST_SHADOW_BLUR_DEFAULT,
  WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
  migrateWorksCastShadowBlurPx,
  migrateWorksCastShadowDistancePx,
  migrateWorksLightDirectionDeg,
  migrateWorksLightIntensityPct,
  migrateWorksLightTempK,
} from '@/lib/works-mode-light'
import {
  migrateCollectionHeadingSource,
  migrateCollectionShowText,
  type CollectionHeadingSource,
} from '@/lib/collection-display'
import {
  type KnobsConfig,
  type KnobFamilyOverrides,
  DEFAULT_KNOBS_CONFIG,
  migrateKnobsConfig,
  migrateKnobFamilyOverrides,
} from '@/lib/site-blocks/knob-types'
export type { KnobsConfig, KnobFamilyOverrides }
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
  /** Public /works heading: title fields vs assigned theme name. */
  heading_source?: CollectionHeadingSource
  /** When false, intro + description are hidden on /works (heading still shows). */
  show_text?: boolean
  manual_work_order?: number[]
}

/**
 * /works presentation presets. Carousel & grid are the original two; the rest
 * are alternative wall/page metaphors. Map / constellation / diptych currently
 * render an honest "coming soon" placeholder — they need data (geo coords,
 * theme weights, pair relations) that doesn't exist yet.
 */
export type WorksLayout =
  | 'carousel'
  | 'grid'
  | 'procession'
  | 'salon'
  | 'vitrine'
  | 'timeline'
  | 'letter'
  | 'map'
  | 'motion_interior'
  | 'constellation'
  | 'diptych'

export const WORKS_LAYOUT_VALUES: WorksLayout[] = [
  'carousel', 'grid', 'procession', 'salon', 'vitrine', 'timeline', 'letter',
  'map', 'motion_interior', 'constellation', 'diptych',
]

/** Layouts that render a placeholder (data not available yet). */
export const WORKS_LAYOUT_PLACEHOLDERS: ReadonlySet<WorksLayout> = new Set<WorksLayout>([
  'constellation', 'diptych',
])

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
  /** Cast shadow (carousel + vitrine only): on/off + distance + blur. */
  cast_shadow_enabled: boolean
  cast_shadow_distance_px: number
  cast_shadow_blur_px: number
  /**
   * Layout override for mobile viewports (< 768 px).
   * `'auto'` resolves via {@link resolveWorksMobileLayout} — complex 3D/gallery
   * modes fall back to `grid`; simpler modes keep their desktop layout.
   * Explicitly choosing a layout pins it regardless of the desktop value.
   */
  mobile_fallback: WorksLayout | 'auto'
  /** R2 key for the forest panorama background image (map layout only). */
  forest_panorama_r2_key?: string
  /** Base diameter of pinned work thumbnails in px (24–96). Default 48. */
  forest_panorama_pin_size?: number
  /** Depth falloff 0–1: pins higher on panorama (y≈0) scale down. 0 = flat. Default 0.5. */
  forest_panorama_depth?: number
  /** R2 key for the looping interior video (motion_interior layout only). */
  motion_interior_r2_key?: string
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
  /**
   * Phase 1 — per-page block composition. Optional for backward compat with
   * configs persisted before this field existed; populated by migration from
   * the existing monolithic fields (landing.hero_*, about.intro_*, etc.) so
   * public pages can iterate a block list via the registry in
   * `lib/site-blocks/registry.ts`.
   */
  pages?: PageBlocks
  /**
   * Phase 2 — site/page knob cascade config. Optional for backward compat;
   * populated by migrate() with DEFAULT_KNOBS_CONFIG when absent from JSON.
   */
  knobs?: KnobsConfig
}

// ── Per-page content blocks (Phase 1) ─────────────────────────────────────

/** The three composable pages. /practice is folded into /about. */
export type Page = 'landing' | 'works' | 'about'

export const PAGES: readonly Page[] = ['landing', 'works', 'about'] as const

/**
 * Block kinds form an open registry — see `lib/site-blocks/registry.ts` for
 * the descriptor per kind (editor + renderer + allowedPages + knobFamilies).
 * Adding a new kind = one folder under `lib/site-blocks/<kind>/` + one
 * registration line.
 *
 * This union is the SHIPPED set; unknown kinds in persisted data are
 * dropped during migration.
 */
export type BlockKind =
  // landing-only
  | 'hero' | 'identity'
  // works-only
  | 'works_modes' | 'map' | 'motion_interior'
  // about-only (incl. ex-practice fields folded in)
  | 'biographie' | 'expositions' | 'presse' | 'contact' | 'cv'
  | 'approach' | 'themes' | 'materials'
  // universal (any page)
  | 'text' | 'image' | 'statement' | 'quote' | 'gallery_strip' | 'divider'

export const ALL_BLOCK_KINDS: readonly BlockKind[] = [
  'hero', 'identity',
  'works_modes', 'map', 'motion_interior',
  'biographie', 'expositions', 'presse', 'contact', 'cv',
  'approach', 'themes', 'materials',
  'text', 'image', 'statement', 'quote', 'gallery_strip', 'divider',
] as const

export type BlockLayoutWidth = 'full' | 'half' | 'third'

export interface Block {
  /** Stable id — survives reordering and content edits. */
  uid: string
  kind: BlockKind
  /** Schema-enforced via registry `allowedPages` — see migration. */
  page: Page
  visible: boolean
  layout_width: BlockLayoutWidth
  /** Block-kind-specific data; shape defined by the descriptor in registry. */
  fields: Record<string, unknown>
  /** Phase 2 — per-block knob overrides on top of site/page cascade. */
  knob_override?: KnobFamilyOverrides
  sort_order: number
}

export type PageBlocks = Partial<Record<Page, Block[]>>

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
    cast_shadow_enabled: true,
    cast_shadow_distance_px: WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
    cast_shadow_blur_px: WORKS_CAST_SHADOW_BLUR_DEFAULT,
    mobile_fallback: 'auto',
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
    heading_source: migrateCollectionHeadingSource(c.heading_source),
    show_text:        migrateCollectionShowText(c.show_text),
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
      cast_shadow_enabled: true,
      cast_shadow_distance_px: WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
      cast_shadow_blur_px: WORKS_CAST_SHADOW_BLUR_DEFAULT,
      mobile_fallback: 'auto',
    }]
  }
  return list.map((m: any, i: number): WorksMode => ({
    id:          m.id || Math.random().toString(36).slice(2),
    label_fr:    m.label_fr || m.label || (i === 0 ? 'Œuvres' : `Mode ${i + 1}`),
    label_en:    m.label_en || m.label || (i === 0 ? 'Works'  : `Mode ${i + 1}`),
    is_active:   m.is_active ?? true,
    sort_order:  m.sort_order ?? i,
    layout:      (WORKS_LAYOUT_VALUES as readonly string[]).includes(m.layout) ? m.layout : 'carousel',
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
    cast_shadow_enabled: m.cast_shadow_enabled !== false,
    cast_shadow_distance_px: migrateWorksCastShadowDistancePx(m.cast_shadow_distance_px),
    cast_shadow_blur_px: migrateWorksCastShadowBlurPx(m.cast_shadow_blur_px),
    mobile_fallback: (m.mobile_fallback === 'auto' || (WORKS_LAYOUT_VALUES as readonly string[]).includes(m.mobile_fallback))
      ? m.mobile_fallback as WorksLayout | 'auto'
      : 'auto',
    forest_panorama_r2_key: typeof m.forest_panorama_r2_key === 'string' && m.forest_panorama_r2_key
      ? m.forest_panorama_r2_key : undefined,
    forest_panorama_pin_size: typeof m.forest_panorama_pin_size === 'number' && m.forest_panorama_pin_size > 0
      ? Math.min(96, Math.max(24, m.forest_panorama_pin_size)) : undefined,
    forest_panorama_depth: typeof m.forest_panorama_depth === 'number'
      ? Math.min(1, Math.max(0, m.forest_panorama_depth)) : undefined,
    motion_interior_r2_key: typeof m.motion_interior_r2_key === 'string' && m.motion_interior_r2_key
      ? m.motion_interior_r2_key : undefined,
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

/**
 * Generate a stable, ordered uid for a block. Prefer crypto.randomUUID when
 * available (Node 20+, modern browsers); fall back to a Math.random-based id
 * so SSR builds without crypto.randomUUID don't fail.
 */
function makeBlockUid(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function migrateBlockField(b: any): Block | null {
  if (!b || typeof b !== 'object') return null
  if (typeof b.kind !== 'string') return null
  if (!(ALL_BLOCK_KINDS as readonly string[]).includes(b.kind)) return null
  const page: Page = (PAGES as readonly string[]).includes(b.page) ? b.page : 'landing'
  const layout_width: BlockLayoutWidth =
    b.layout_width === 'half' ? 'half'
    : b.layout_width === 'third' ? 'third'
    : 'full'
  return {
    uid: typeof b.uid === 'string' && b.uid.length > 0 ? b.uid : makeBlockUid(),
    kind: b.kind as BlockKind,
    page,
    visible: b.visible !== false,
    layout_width,
    fields: (b.fields && typeof b.fields === 'object') ? b.fields : {},
    knob_override: b.knob_override ? migrateKnobFamilyOverrides(b.knob_override) : undefined,
    sort_order: Number.isFinite(b.sort_order) ? Number(b.sort_order) : 0,
  }
}

/**
 * Default per-page block lists derived from existing monolithic fields.
 * Used when `raw.pages` is absent (older configs) so pre-Phase-1 data still
 * renders via the registry path.
 *
 * Idempotent: a config that already has `pages` is round-trippable; we only
 * fill in any missing pages.
 */
export function deriveDefaultPages(cfg: Pick<PortfolioConfig, 'general' | 'about' | 'practice' | 'works_modes' | 'landing'>): Record<Page, Block[]> {
  const stable = (kind: BlockKind, page: Page, fields: Record<string, unknown>, sort_order = 0): Block => ({
    uid: `auto_${kind}_${page}`,
    kind,
    page,
    visible: true,
    layout_width: 'full',
    fields,
    sort_order,
  })
  return {
    landing: [
      stable('hero', 'landing', {
        hero_image_key: cfg.landing?.hero_image_key ?? '',
        hero_caption_fr: cfg.landing?.hero_caption_fr ?? '',
        hero_caption_en: cfg.landing?.hero_caption_en ?? '',
      }, 0),
      stable('identity', 'landing', {
        artist_name: cfg.general?.artist_name ?? '',
      }, 10),
    ],
    works: [
      // One auto-generated works_modes block per active mode. The block
      // references the WorksMode by id via fields.mode_id. label_fr/label_en
      // and layout are included as display hints for the PagesEditor; they
      // may become stale if the mode is renamed via the legacy Diffusion
      // section (the persisted block is not retroactively updated), but they
      // are display-only and never used for public rendering.
      ...cfg.works_modes
        .filter(m => m.is_active !== false)
        .map((m, i): Block => ({
          uid: `auto_works_modes_${m.id}`,
          kind: 'works_modes',
          page: 'works',
          visible: true,
          layout_width: 'full',
          fields: {
            mode_id: m.id,
            label_fr: m.label_fr,
            label_en: m.label_en,
            layout: m.layout,
          },
          sort_order: i * 10,
        })),
    ],
    about: [
      stable('biographie', 'about',
        { intro_fr: cfg.about?.intro_fr ?? '', intro_en: cfg.about?.intro_en ?? '' }, 0),
      stable('approach', 'about',
        { approach_fr: cfg.practice?.approach_fr ?? '', approach_en: cfg.practice?.approach_en ?? '' }, 10),
      stable('themes', 'about',
        { themes: cfg.practice?.themes ?? [] }, 20),
      stable('materials', 'about',
        { materials_fr: cfg.practice?.materials_fr ?? '', materials_en: cfg.practice?.materials_en ?? '' }, 30),
    ],
  }
}

/**
 * Migrate `raw.pages` from persisted JSON into a typed PageBlocks. Preserves
 * any existing blocks; auto-fills missing pages from `derivedDefaults` so the
 * public site always has SOMETHING to render per page even after a partial
 * editor save. Unknown block kinds in persisted data are dropped (warn).
 */
export function migratePages(
  raw: any,
  derivedDefaults: Record<Page, Block[]>,
): PageBlocks {
  const out: PageBlocks = {}
  const rawPages = (raw && typeof raw === 'object' && raw.pages && typeof raw.pages === 'object') ? raw.pages : null
  for (const page of PAGES) {
    const persisted = rawPages?.[page]
    if (Array.isArray(persisted) && persisted.length > 0) {
      const blocks = persisted
        .map(migrateBlockField)
        .filter((b): b is Block => b !== null)
        // Force `page` to match the bucket key (defense against corrupted data).
        .map(b => ({ ...b, page }))
        .sort((a, b) => a.sort_order - b.sort_order)
      out[page] = blocks.length > 0 ? blocks : derivedDefaults[page]
    } else {
      out[page] = derivedDefaults[page]
    }
  }
  return out
}

export function migrate(raw: any): PortfolioConfig {
  const isOldArray = Array.isArray(raw)
  const oldSections = isOldArray ? raw : (raw.sections || [])
  const oldWorks    = isOldArray ? raw : (raw.works_collections || [])

  const base = {
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
  // Derive `pages` from the now-migrated base fields; use persisted pages if
  // present, else fall back to defaults synthesized from base.
  const defaults = deriveDefaultPages(base)
  const knobs = migrateKnobsConfig(raw.knobs ?? null)
  return { ...base, pages: migratePages(raw, defaults), knobs }
}
