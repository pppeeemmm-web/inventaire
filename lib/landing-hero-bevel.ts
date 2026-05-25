export const LANDING_HERO_BEVEL_PROFILE_VALUES = ['smooth', 'hard'] as const

export type LandingHeroBevelProfile = (typeof LANDING_HERO_BEVEL_PROFILE_VALUES)[number]

export const LANDING_HERO_BEVEL_PX_DEFAULT = 4
export const LANDING_HERO_BEVEL_PROFILE_DEFAULT: LandingHeroBevelProfile = 'smooth'
export const LANDING_HERO_BEVEL_PX_MAX = 12

export type LandingHeroBevelFields = {
  hero_bevel_px?: unknown
  hero_bevel_profile?: unknown
}

export function migrateHeroBevelPx(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return LANDING_HERO_BEVEL_PX_DEFAULT
  return Math.min(LANDING_HERO_BEVEL_PX_MAX, Math.max(0, Math.round(n)))
}

export function migrateHeroBevelProfile(v: unknown): LandingHeroBevelProfile {
  if (v === 'hard' || v === 'smooth') return v
  return LANDING_HERO_BEVEL_PROFILE_DEFAULT
}

/** Inset lip on the painted disc — px scales all shadow layers. */
export function buildHeroBevelBoxShadow(
  px: number,
  profile: LandingHeroBevelProfile,
): string | null {
  if (px <= 0) return null
  const half = Math.max(1, Math.round(px / 2))
  if (profile === 'hard') {
    return [
      'inset 0 0 0 1px rgba(255,255,255,0.55)',
      `inset ${px}px ${px}px 0 rgba(255,255,255,0.14)`,
      `inset -${px}px -${px}px 0 rgba(12,10,8,0.24)`,
    ].join(', ')
  }
  return [
    'inset 0 0 0 1px rgba(255,252,246,0.42)',
    `inset ${half}px ${half}px ${px + 1}px rgba(255,252,245,0.26)`,
    `inset -${half}px -${half}px ${px + 1}px rgba(22,20,17,0.18)`,
    `inset ${px}px ${px}px ${px * 2.5}px rgba(255,250,240,0.14)`,
    `inset -${px}px -${px}px ${px * 2.5}px rgba(18,16,14,0.16)`,
  ].join(', ')
}

export type HeroBevelResolved = {
  px: number
  profile: LandingHeroBevelProfile
  enabled: boolean
  boxShadow: string
}

export function resolveHeroBevel(
  landing?: Partial<LandingHeroBevelFields> | null,
): HeroBevelResolved {
  const px = migrateHeroBevelPx(landing?.hero_bevel_px)
  const profile = migrateHeroBevelProfile(landing?.hero_bevel_profile)
  const built = buildHeroBevelBoxShadow(px, profile)
  return {
    px,
    profile,
    enabled: built !== null,
    boxShadow: built ?? 'none',
  }
}
