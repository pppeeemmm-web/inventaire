import {
  migrateLandingGradientStops,
  resolveLandingBackground,
  LANDING_BG_BLEND_POSITION_DEFAULT,
  LANDING_BG_BLEND_SOFTNESS_DEFAULT,
  type LandingBackgroundFields,
  type LandingBackgroundResolved,
  type LandingGradientStop,
} from '@/lib/landing-background'
import type { LandingConfig } from '@/lib/portfolio-config-types'

export type SiteBlockKind = 'hero' | 'identity' | 'about' | 'practice' | 'works_modes'

export type SiteBlockPageFields = {
  kind: SiteBlockKind
  page_bg?: PageBackgroundConfig
  nav_bar_style?: SiteBlockNavBarStyle
}

/** Per-public-page gradient (stored on site_blocks; falls back to landing). */
export type PageBackgroundConfig = {
  bg_gradient_stops: LandingGradientStop[]
  bg_blend_position_pct: number
  bg_blend_softness_pct: number
}

export type SiteBlockNavBarStyle = 'transparent' | 'bar'

export type PublicPageKey = 'landing' | 'works' | 'about' | 'practice' | 'enquiry'

const PAGE_TO_BLOCK: Partial<Record<PublicPageKey, SiteBlockKind>> = {
  works: 'works_modes',
  about: 'about',
  practice: 'practice',
}

function migratePct(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function migratePageBackground(raw: unknown): PageBackgroundConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const hasStops = Array.isArray(o.bg_gradient_stops) && o.bg_gradient_stops.length > 0
  const hasBlend = o.bg_blend_position_pct !== undefined || o.bg_blend_softness_pct !== undefined
  if (!hasStops && !hasBlend) return undefined
  return {
    bg_gradient_stops: migrateLandingGradientStops(o),
    bg_blend_position_pct: migratePct(o.bg_blend_position_pct, LANDING_BG_BLEND_POSITION_DEFAULT),
    bg_blend_softness_pct: migratePct(o.bg_blend_softness_pct, LANDING_BG_BLEND_SOFTNESS_DEFAULT),
  }
}

export function pageBackgroundFromLanding(landing: Partial<LandingConfig>): PageBackgroundConfig {
  return {
    bg_gradient_stops: migrateLandingGradientStops(landing),
    bg_blend_position_pct: migratePct(
      landing.bg_blend_position_pct,
      LANDING_BG_BLEND_POSITION_DEFAULT,
    ),
    bg_blend_softness_pct: migratePct(
      landing.bg_blend_softness_pct,
      LANDING_BG_BLEND_SOFTNESS_DEFAULT,
    ),
  }
}

export function resolveBlockPageBackgroundFields(
  block: Pick<SiteBlockPageFields, 'page_bg'> | undefined,
  landing: Partial<LandingConfig> | null | undefined,
): LandingBackgroundFields {
  if (block?.page_bg) return block.page_bg
  return landing ?? {}
}

export function resolvePublicPageTheme(
  page: PublicPageKey,
  landing: Partial<LandingConfig> | null | undefined,
  blocks?: SiteBlockPageFields[],
): LandingBackgroundResolved {
  const blockKind = PAGE_TO_BLOCK[page]
  const block = blockKind ? blocks?.find(b => b.kind === blockKind) : undefined
  return resolveLandingBackground(resolveBlockPageBackgroundFields(block, landing))
}

export function resolveNavBarStyle(
  page: PublicPageKey,
  blocks?: SiteBlockPageFields[],
): SiteBlockNavBarStyle {
  if (page === 'works') {
    const b = blocks?.find(x => x.kind === 'works_modes')
    return b?.nav_bar_style === 'bar' ? 'bar' : 'transparent'
  }
  return 'bar'
}

export function migrateNavBarStyle(
  kind: SiteBlockKind,
  raw: unknown,
): SiteBlockNavBarStyle | undefined {
  if (raw === 'transparent' || raw === 'bar') return raw
  if (kind === 'works_modes') return 'transparent'
  return undefined
}
