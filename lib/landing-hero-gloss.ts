import type { CSSProperties } from 'react'

export type LandingHeroGlossFields = {
  hero_gloss_blend?: unknown
  hero_gloss_strength_pct?: unknown
  hero_gloss_position_pct?: unknown
  hero_gloss_falloff_pct?: unknown
}

export const LANDING_HERO_GLOSS_BLEND_VALUES = [
  'off',
  'color-dodge',
  'soft-light',
  'overlay',
  'multiply',
  'screen',
] as const

export type LandingHeroGlossBlend = (typeof LANDING_HERO_GLOSS_BLEND_VALUES)[number]

export const LANDING_HERO_GLOSS_BLEND_DEFAULT: LandingHeroGlossBlend = 'color-dodge'
export const LANDING_HERO_GLOSS_STRENGTH_DEFAULT = 100
/** White-point height on disc (% from top); lower = higher on disc. */
export const LANDING_HERO_GLOSS_POSITION_DEFAULT = 26
/** How far gloss extends before transparent; lower = less wash on shadows. */
export const LANDING_HERO_GLOSS_FALLOFF_DEFAULT = 46

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function migrateHeroGlossBlend(v: unknown): LandingHeroGlossBlend {
  if (typeof v === 'string' && (LANDING_HERO_GLOSS_BLEND_VALUES as readonly string[]).includes(v)) {
    return v as LandingHeroGlossBlend
  }
  return LANDING_HERO_GLOSS_BLEND_DEFAULT
}

export function migrateHeroGlossPct(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return clampPct(Number.isFinite(n) ? n : fallback)
}

/** Tight radial highlight; does not extend into shadow areas of the artwork. */
export function buildHeroGlossGradient(
  strengthPct: number,
  positionPct: number,
  falloffPct: number,
): string {
  const strength = clampPct(strengthPct) / 100
  const centerAlpha = (0.72 * strength).toFixed(3)
  const midAlpha = (0.28 * strength).toFixed(3)
  const pos = clampPct(positionPct)
  const falloff = Math.max(28, clampPct(falloffPct))
  return [
    `radial-gradient(ellipse 52% 42% at 50% ${pos}%,`,
    `rgba(255,255,255,${centerAlpha}) 0%,`,
    `rgba(255,255,255,${midAlpha}) 22%,`,
    `transparent ${falloff}%)`,
  ].join(' ')
}

export type HeroGlossResolved = {
  enabled: boolean
  mixBlendMode: CSSProperties['mixBlendMode']
  background: string
}

export function resolveHeroGloss(landing?: Partial<LandingHeroGlossFields> | null): HeroGlossResolved {
  const blend = migrateHeroGlossBlend(landing?.hero_gloss_blend)
  const strength = migrateHeroGlossPct(
    landing?.hero_gloss_strength_pct,
    LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
  )
  const position = migrateHeroGlossPct(
    landing?.hero_gloss_position_pct,
    LANDING_HERO_GLOSS_POSITION_DEFAULT,
  )
  const falloff = migrateHeroGlossPct(
    landing?.hero_gloss_falloff_pct,
    LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
  )

  if (blend === 'off' || strength <= 0) {
    return { enabled: false, mixBlendMode: 'normal', background: 'transparent' }
  }

  return {
    enabled: true,
    mixBlendMode: blend,
    background: buildHeroGlossGradient(strength, position, falloff),
  }
}
