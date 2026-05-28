/**
 * Phase 2 — knob controller types.
 *
 * KnobValues is the flat, fully-specified shape for all knob families at one
 * scope (site, page, or block). KnobFamilyOverrides is the sparse variant used
 * for page-level and block-level overrides (each family is optional; present
 * families merge field-by-field over the base via mergeKnobFamilies).
 *
 * Adding a new knob:
 *   1. Add to the appropriate family below.
 *   2. Add a sensible default to DEFAULT_KNOB_VALUES.
 *   3. migrateKnobValues / migrateKnobFamilyOverrides pick it up automatically
 *      (they merge over the default, so older persisted data defaults gracefully).
 */

import type { LandingGradientStop } from '@/lib/landing-background'
import type { LandingHeroBevelProfile } from '@/lib/landing-hero-bevel'
import {
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  LANDING_HERO_BEVEL_PX_DEFAULT,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_CAST_SHADOW_BLUR_DEFAULT,
  WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
} from '@/lib/works-mode-light'

// ── KnobFamily ─────────────────────────────────────────────────────────────

/**
 * Knob families — the 8 groups surfaced in the knobs panel. `circ` and `a11y`
 * live in KnobValues but are not surfaced as panel families (they're a
 * controller and a11y settings respectively).
 */
export type KnobFamily =
  | 'light'  // wall light: temperature, direction, intensity
  | 'shadow' // cast shadow: enabled, distance, blur, opacity
  | 'frame'  // work mount: bevel depth + profile
  | 'bg'     // background: gradient stops, blend, angle, opacity
  | 'mat'    // surface texture: grain, voile, vignette
  | 'type'   // typography: scale, weight
  | 'atm'    // atmosphere: sky tint, work glow
  | 'motion' // movement: parallax, sway, reduce-motion

// ── KnobValues ─────────────────────────────────────────────────────────────

export type KnobValues = {
  /** Wall light — temperature, angle, intensity, + future exposition/contrast/warmth. */
  light: {
    temp_k:         number   // 2700–6500 K
    direction_deg:  number   // 0–360, 315 = top-left
    intensity_pct:  number   // 50–150
    exposition_pct: number   // 0–200; future: controls overall exposure multiplier
    contrast_pct:   number   // 0–200; future: work contrast boost
    warmth_pct:     number   // 0–100; future: warm-tint blend on work
  }
  /** Drop shadow cast by the work onto the wall. */
  shadow: {
    enabled:     boolean
    distance_px: number
    blur_px:     number
    opacity_pct: number // 0–100
  }
  /** Work mount bevel / lip. */
  frame: {
    bevel_px:     number
    bevel_profile: LandingHeroBevelProfile
  }
  /**
   * Page background gradient.
   * `stops` mirrors `landing.bg_gradient_stops`; page/block overrides will
   * normally leave this unset and inherit the site value.
   */
  bg: {
    stops:          LandingGradientStop[]
    blend_position: number  // pct 0–100 from top
    blend_softness: number  // pct 0–100
    angle:          number  // degrees (for future linear-gradient variants)
    opacity:        number  // 0–1 overlay opacity
  }
  /** Surface texture overlays (not yet rendered — schema reserved). */
  mat: {
    grain_pct:    number // 0–100
    voile_pct:    number // 0–100 white voile
    vignette_pct: number // 0–100
  }
  /** Typography scale + weight (not yet rendered — schema reserved). */
  type: {
    scale_pct: number             // 100 = base; 125/150/200 for larger
    weight:    'light' | 'regular' | 'bold'
  }
  /** Atmosphere: sky tints + work glow. */
  atm: {
    sky_top:       string // hex; top-of-page tint colour
    sky_bottom:    string // hex; bottom-of-page tint colour
    tint_opacity:  number // 0–1
    work_glow_pct: number // 0–100; ambient glow behind mounted works
  }
  /** Animation multipliers (not yet rendered — schema reserved). */
  motion: {
    parallax_mult:   number  // 1 = default; 0 = none
    sway_speed_mult: number  // 1 = default
    reduce_motion:   boolean // when true, disable all parallax + sway
  }
  /**
   * Circadian controller — not a knob family but stored here so the full
   * resolved state is one object. `auto` drives values from the visitor's
   * clock; `manual_minute` is used when `auto = false` for the scrubber
   * preview in the editor. `drives` selects which families the circadian
   * controller writes.
   */
  circ: {
    auto:          boolean
    manual_minute: number // 0–1439
    drives: {
      light:  boolean
      shadow: boolean
      bg:     boolean
      atm:    boolean
    }
  }
  /**
   * Accessibility settings (not yet rendered — schema slots reserved for
   * Phase 5). Persisted in localStorage, not in KnobsConfig. Declared here
   * so the full shape exists at compile time.
   */
  a11y: {
    type_size_step: number  // 1 | 1.25 | 1.5 | 2.0
    high_contrast:  boolean
  }
}

// ── KnobFamilyOverrides ────────────────────────────────────────────────────

/**
 * Sparse knob overrides used at page level (KnobsConfig.pages) and block
 * level (Block.knob_override). Each family present here is shallow-merged
 * over the parent scope's KnobValues via mergeKnobFamilies. Absent families
 * inherit unchanged.
 */
export type KnobFamilyOverrides = {
  light?:  Partial<KnobValues['light']>
  shadow?: Partial<KnobValues['shadow']>
  frame?:  Partial<KnobValues['frame']>
  bg?:     Partial<KnobValues['bg']>
  mat?:    Partial<KnobValues['mat']>
  type?:   Partial<KnobValues['type']>
  atm?:    Partial<KnobValues['atm']>
  motion?: Partial<KnobValues['motion']>
  circ?:   Partial<KnobValues['circ']>
  a11y?:   Partial<KnobValues['a11y']>
}

// ── KnobsConfig ────────────────────────────────────────────────────────────

/**
 * Top-level knob configuration stored in PortfolioConfig.
 * `site` is fully specified; `pages` carries sparse per-page overrides.
 */
export type KnobsConfig = {
  site:  KnobValues
  pages: Partial<Record<'landing' | 'works' | 'about', KnobFamilyOverrides>>
}

// ── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_KNOB_VALUES: KnobValues = {
  light: {
    temp_k:         WORKS_LIGHT_TEMP_DEFAULT,
    direction_deg:  WORKS_LIGHT_DIRECTION_DEFAULT,
    intensity_pct:  WORKS_LIGHT_INTENSITY_DEFAULT,
    exposition_pct: 100,
    contrast_pct:   100,
    warmth_pct:     0,
  },
  shadow: {
    enabled:     true,
    distance_px: WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
    blur_px:     WORKS_CAST_SHADOW_BLUR_DEFAULT,
    opacity_pct: 100,
  },
  frame: {
    bevel_px:     LANDING_HERO_BEVEL_PX_DEFAULT,
    bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  },
  bg: {
    stops:          [],
    blend_position: 50,
    blend_softness: 50,
    angle:          0,
    opacity:        1,
  },
  mat:    { grain_pct: 0, voile_pct: 0, vignette_pct: 0 },
  type:   { scale_pct: 100, weight: 'regular' },
  atm:    { sky_top: '#0a0c12', sky_bottom: '#1a1c24', tint_opacity: 0, work_glow_pct: 0 },
  motion: { parallax_mult: 1, sway_speed_mult: 1, reduce_motion: false },
  circ: {
    auto:          false,
    manual_minute: 720,
    drives:        { light: true, shadow: true, bg: true, atm: true },
  },
  a11y: { type_size_step: 1, high_contrast: false },
}

export const DEFAULT_KNOBS_CONFIG: KnobsConfig = {
  site:  DEFAULT_KNOB_VALUES,
  pages: {},
}

// ── Migration helpers ──────────────────────────────────────────────────────

/**
 * Merge raw (unknown) with a typed default, returning the default when raw is
 * absent or non-object. Result is always valid: present keys from raw overwrite
 * matching defaults; extra keys are discarded by TypeScript's spread semantics.
 */
function mergeWithDefault<T extends object>(raw: unknown, def: T): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def
  return { ...def, ...(raw as Partial<T>) }
}

/**
 * Migrate a raw (persisted JSON) KnobValues object. Missing families default
 * gracefully so old configs round-trip cleanly.
 */
export function migrateKnobValues(raw: unknown): KnobValues {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_KNOB_VALUES }
  const r = raw as Record<string, unknown>
  const d = DEFAULT_KNOB_VALUES
  return {
    light:  mergeWithDefault<KnobValues['light']>(r.light, d.light),
    shadow: mergeWithDefault<KnobValues['shadow']>(r.shadow, d.shadow),
    frame:  mergeWithDefault<KnobValues['frame']>(r.frame, d.frame),
    bg:     mergeWithDefault<KnobValues['bg']>(r.bg, d.bg),
    mat:    mergeWithDefault<KnobValues['mat']>(r.mat, d.mat),
    type:   mergeWithDefault<KnobValues['type']>(r.type, d.type),
    atm:    mergeWithDefault<KnobValues['atm']>(r.atm, d.atm),
    motion: mergeWithDefault<KnobValues['motion']>(r.motion, d.motion),
    circ:   mergeWithDefault<KnobValues['circ']>(r.circ, d.circ),
    a11y:   mergeWithDefault<KnobValues['a11y']>(r.a11y, d.a11y),
  }
}

function migrateFamilyOverride<T extends object>(raw: unknown): Partial<T> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  return raw as Partial<T>
}

/**
 * Migrate a raw (persisted JSON) KnobFamilyOverrides object. Returns empty {}
 * when raw is absent/malformed — the caller can pass this directly to
 * mergeKnobFamilies as "no overrides".
 */
export function migrateKnobFamilyOverrides(raw: unknown): KnobFamilyOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const r = raw as Record<string, unknown>
  const out: KnobFamilyOverrides = {}
  const l = migrateFamilyOverride<KnobValues['light']>(r.light);   if (l) out.light  = l
  const s = migrateFamilyOverride<KnobValues['shadow']>(r.shadow); if (s) out.shadow = s
  const f = migrateFamilyOverride<KnobValues['frame']>(r.frame);   if (f) out.frame  = f
  const b = migrateFamilyOverride<KnobValues['bg']>(r.bg);         if (b) out.bg     = b
  const m = migrateFamilyOverride<KnobValues['mat']>(r.mat);       if (m) out.mat    = m
  const t = migrateFamilyOverride<KnobValues['type']>(r.type);     if (t) out.type   = t
  const a = migrateFamilyOverride<KnobValues['atm']>(r.atm);       if (a) out.atm    = a
  const mo = migrateFamilyOverride<KnobValues['motion']>(r.motion); if (mo) out.motion = mo
  const c = migrateFamilyOverride<KnobValues['circ']>(r.circ);     if (c) out.circ   = c
  const a11 = migrateFamilyOverride<KnobValues['a11y']>(r.a11y);  if (a11) out.a11y  = a11
  return out
}

function migratePageOverrides(raw: unknown): KnobFamilyOverrides | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const overrides = migrateKnobFamilyOverrides(raw)
  // If no family keys were present, treat as absent (inherit from site).
  return Object.keys(overrides).length > 0 ? overrides : undefined
}

/** Migrate a raw KnobsConfig, defaulting gracefully. */
export function migrateKnobsConfig(raw: unknown): KnobsConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_KNOBS_CONFIG }
  const r = raw as Record<string, unknown>
  const pages = r.pages && typeof r.pages === 'object' && !Array.isArray(r.pages)
    ? r.pages as Record<string, unknown>
    : {}
  return {
    site: migrateKnobValues(r.site),
    pages: {
      landing: migratePageOverrides(pages.landing),
      works:   migratePageOverrides(pages.works),
      about:   migratePageOverrides(pages.about),
    },
  }
}
