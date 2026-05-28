/**
 * Works-page lighting — per-mode knobs:
 *   - kelvin (2700K warm → 4500K neutral → 6500K cool daylight)
 *   - direction (0–360°, default 315° = top-left lit)
 *   - intensity (50–150 %, default 100)
 *
 * Renders as: wall tint (kelvin), rotated bevel inset offsets (direction),
 * and scaled bevel alpha / drop-shadow opacity (intensity).
 */
import type { LandingHeroBevelProfile } from '@/lib/landing-hero-bevel'
import {
  circadianShadowGeometry,
  type HourPeriod,
} from '@/lib/landing-text-shadow'

/** Re-evaluate circadian light when the local clock crosses a minute. */
export const WORKS_CIRCADIAN_TICK_MS = 60_000

export const WORKS_LIGHT_TEMP_MIN = 2700
export const WORKS_LIGHT_TEMP_MAX = 6500
export const WORKS_LIGHT_TEMP_DEFAULT = 4500

export const WORKS_LIGHT_DIRECTION_DEFAULT = 315
export const WORKS_LIGHT_INTENSITY_MIN = 50
export const WORKS_LIGHT_INTENSITY_MAX = 150
export const WORKS_LIGHT_INTENSITY_DEFAULT = 100

/** Cast shadow on works (carousel + vitrine). 0–40 px distance, 0–60 px blur. */
export const WORKS_CAST_SHADOW_DISTANCE_MIN = 0
export const WORKS_CAST_SHADOW_DISTANCE_MAX = 40
export const WORKS_CAST_SHADOW_DISTANCE_DEFAULT = 15
export const WORKS_CAST_SHADOW_BLUR_MIN = 0
export const WORKS_CAST_SHADOW_BLUR_MAX = 60
export const WORKS_CAST_SHADOW_BLUR_DEFAULT = 22

export function migrateWorksCastShadowDistancePx(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return WORKS_CAST_SHADOW_DISTANCE_DEFAULT
  return Math.min(WORKS_CAST_SHADOW_DISTANCE_MAX, Math.max(WORKS_CAST_SHADOW_DISTANCE_MIN, Math.round(n)))
}
export function migrateWorksCastShadowBlurPx(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return WORKS_CAST_SHADOW_BLUR_DEFAULT
  return Math.min(WORKS_CAST_SHADOW_BLUR_MAX, Math.max(WORKS_CAST_SHADOW_BLUR_MIN, Math.round(n)))
}

export function migrateWorksLightTempK(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return WORKS_LIGHT_TEMP_DEFAULT
  return Math.min(WORKS_LIGHT_TEMP_MAX, Math.max(WORKS_LIGHT_TEMP_MIN, Math.round(n)))
}

export function migrateWorksLightDirectionDeg(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return WORKS_LIGHT_DIRECTION_DEFAULT
  const wrapped = ((n % 360) + 360) % 360
  return Math.round(wrapped)
}

export function migrateWorksLightIntensityPct(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return WORKS_LIGHT_INTENSITY_DEFAULT
  return Math.min(WORKS_LIGHT_INTENSITY_MAX, Math.max(WORKS_LIGHT_INTENSITY_MIN, Math.round(n)))
}

export type WorksLightResolved = {
  kelvin: number
  /** Light direction in degrees (0 = from top, 90 = right, 180 = bottom, 270 = left). */
  directionDeg: number
  /** Intensity multiplier in [0.5, 1.5]. Scales bevel alpha + drop-shadow opacity. */
  intensity: number
  /** RGBA overlay applied over the wall — alpha is 0 at neutral, ramps up at extremes. */
  tintRgba: string
  /** Warm/cool-shifted color for the bevel's inner highlight. */
  bevelHighlightRgba: string
  /** Warm/cool-shifted color for the bevel's inner shadow. */
  bevelShadowRgba: string
  /** Pre-rotated bevel direction unit vector — highlight points along this. */
  highlightOffset: { x: number; y: number }
}

/** Linear interpolation between two RGB anchors based on a 0..1 t. */
function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/** Rough Tanner-Helland-style anchors at 2700K, 4500K, 6500K. */
const ANCHOR_WARM: [number, number, number] = [255, 169, 87]
const ANCHOR_NEUTRAL: [number, number, number] = [255, 252, 246]
const ANCHOR_COOL: [number, number, number] = [200, 220, 255]

export function resolveWorksLight(
  kelvin: number,
  directionDeg: number = WORKS_LIGHT_DIRECTION_DEFAULT,
  intensityPct: number = WORKS_LIGHT_INTENSITY_DEFAULT,
): WorksLightResolved {
  const k = migrateWorksLightTempK(kelvin)
  const dir = migrateWorksLightDirectionDeg(directionDeg)
  const intensity = migrateWorksLightIntensityPct(intensityPct) / 100
  let tint: [number, number, number]
  let tintAlpha: number
  if (k <= WORKS_LIGHT_TEMP_DEFAULT) {
    const t = (WORKS_LIGHT_TEMP_DEFAULT - k) / (WORKS_LIGHT_TEMP_DEFAULT - WORKS_LIGHT_TEMP_MIN)
    tint = lerpRgb(ANCHOR_NEUTRAL, ANCHOR_WARM, t)
    tintAlpha = +(0.18 * t).toFixed(3)
  } else {
    const t = (k - WORKS_LIGHT_TEMP_DEFAULT) / (WORKS_LIGHT_TEMP_MAX - WORKS_LIGHT_TEMP_DEFAULT)
    tint = lerpRgb(ANCHOR_NEUTRAL, ANCHOR_COOL, t)
    tintAlpha = +(0.14 * t).toFixed(3)
  }
  const highlight = tint
  const shadowBase: [number, number, number] = [22, 20, 17]
  // Direction → highlight unit vector in CSS coords (x right, y down).
  // θ=0 = light from top  → highlight at top    → offset (0, +1).
  // θ=315 (default top-left) → offset (+0.707, +0.707).
  const theta = (dir * Math.PI) / 180
  const ux = -Math.sin(theta)
  const uy = Math.cos(theta)
  return {
    kelvin: k,
    directionDeg: dir,
    intensity,
    tintRgba: `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${tintAlpha})`,
    bevelHighlightRgba: `rgba(${highlight[0]}, ${highlight[1]}, ${highlight[2]}, ${(0.42 * intensity).toFixed(3)})`,
    bevelShadowRgba: `rgba(${shadowBase[0]}, ${shadowBase[1]}, ${shadowBase[2]}, ${(0.18 * intensity).toFixed(3)})`,
    highlightOffset: { x: +ux.toFixed(4), y: +uy.toFixed(4) },
  }
}

/**
 * Resolve kelvin / direction / intensity from the visitor's local clock —
 * reuses {@link circadianShadowGeometry} from the landing-page system so the
 * sun arc is consistent across surfaces.
 *
 * Returns plain numbers so callers can either drive the light directly or
 * compare against manual settings before overriding them.
 */
export type WorksCircadianValues = {
  kelvin: number
  directionDeg: number
  intensityPct: number
  period: HourPeriod
}

const PERIOD_KELVIN: Record<HourPeriod, number> = {
  morning:   3200,
  midday:    5500,
  afternoon: 5000,
  evening:   2900,
  night:     4200,
}

export function resolveCircadianValues(date: Date = new Date()): WorksCircadianValues {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const { dirX, dirY, lengthFactor, period } = circadianShadowGeometry(minutes)
  // Landing shadow direction is where the shadow falls; light source is opposite.
  // CSS-angle convention: 0° = light from top, increasing clockwise.
  const lightX = -dirX
  const lightY = -dirY
  // atan2(x, -y) places top at 0 and rotates CW with increasing x.
  const rawDeg = (Math.atan2(lightX, -lightY) * 180) / Math.PI
  const directionDeg = ((rawDeg % 360) + 360) % 360
  // High sun (low lengthFactor) is brighter; long shadows (high lengthFactor) dim down.
  const dayIntensity = 150 - lengthFactor * 70
  const intensityPct = period === 'night' ? 55 : Math.round(dayIntensity)
  return {
    kelvin: PERIOD_KELVIN[period],
    directionDeg: Math.round(directionDeg),
    intensityPct,
    period,
  }
}

/**
 * Per-mode bevel — rotates the inset shadow offsets by `directionDeg` and
 * scales alphas by `intensity`. Mirrors the smooth/hard profiles from
 * {@link buildHeroBevelBoxShadow} but is direction-aware.
 *
 * px=0 returns null (caller should omit the rule entirely).
 */
export function buildWorksBevelBoxShadow(
  px: number,
  profile: LandingHeroBevelProfile,
  light: WorksLightResolved,
): string | null {
  if (px <= 0) return null
  const { x: ux, y: uy } = light.highlightOffset
  const i = light.intensity
  // Original hero bevel offsets are (half,half) / (px,px) — diagonal vectors with
  // magnitude half*√2 / px*√2. Use √2 here so a 315° light reproduces the original.
  const SQ2 = Math.SQRT2
  const half = Math.max(1, Math.round(px / 2))
  const hx = (n: number) => +(ux * n * SQ2).toFixed(2)
  const hy = (n: number) => +(uy * n * SQ2).toFixed(2)
  const sx = (n: number) => +(-ux * n * SQ2).toFixed(2)
  const sy = (n: number) => +(-uy * n * SQ2).toFixed(2)
  if (profile === 'hard') {
    return [
      `inset 0 0 0 1px rgba(255,255,255,${(0.55 * i).toFixed(3)})`,
      `inset ${hx(px)}px ${hy(px)}px 0 rgba(255,255,255,${(0.14 * i).toFixed(3)})`,
      `inset ${sx(px)}px ${sy(px)}px 0 rgba(12,10,8,${(0.24 * i).toFixed(3)})`,
    ].join(', ')
  }
  return [
    `inset 0 0 0 1px ${light.bevelHighlightRgba}`,
    `inset ${hx(half)}px ${hy(half)}px ${px + 1}px rgba(255,252,245,${(0.26 * i).toFixed(3)})`,
    `inset ${sx(half)}px ${sy(half)}px ${px + 1}px ${light.bevelShadowRgba}`,
    `inset ${hx(px)}px ${hy(px)}px ${px * 2.5}px rgba(255,250,240,${(0.14 * i).toFixed(3)})`,
    `inset ${sx(px)}px ${sy(px)}px ${px * 2.5}px rgba(18,16,14,${(0.16 * i).toFixed(3)})`,
  ].join(', ')
}

/**
 * Named light presets — purely a UI affordance, not persisted. Selecting a
 * preset fills the temp / direction / intensity / circadian fields with the
 * preset's values; the editor recognises a preset only when all four fields
 * match exactly.
 */
export type WorksLightPresetKey =
  | 'warm_indoor'
  | 'cool_indoor'
  | 'gallery'
  | 'daylight'
  | 'golden_hour'
  | 'circadian'

export type WorksLightPresetValues = {
  light_temp_k: number
  light_direction_deg: number
  light_intensity_pct: number
  light_circadian: boolean
}

export const WORKS_LIGHT_PRESETS: Record<WorksLightPresetKey, WorksLightPresetValues> = {
  warm_indoor: { light_temp_k: 2900, light_direction_deg: 315, light_intensity_pct: 90,  light_circadian: false },
  cool_indoor: { light_temp_k: 4200, light_direction_deg: 0,   light_intensity_pct: 100, light_circadian: false },
  gallery:     { light_temp_k: 4000, light_direction_deg: 315, light_intensity_pct: 120, light_circadian: false },
  daylight:    { light_temp_k: 5500, light_direction_deg: 0,   light_intensity_pct: 110, light_circadian: false },
  golden_hour: { light_temp_k: 3000, light_direction_deg: 270, light_intensity_pct: 80,  light_circadian: false },
  circadian:   {
    light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
    light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
    light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
    light_circadian: true,
  },
}

export const WORKS_LIGHT_PRESET_KEYS: WorksLightPresetKey[] = [
  'warm_indoor', 'cool_indoor', 'gallery', 'daylight', 'golden_hour', 'circadian',
]

/** Returns the matching preset key if all four fields equal one of the presets, else null. */
export function matchWorksLightPreset(values: WorksLightPresetValues): WorksLightPresetKey | null {
  if (values.light_circadian) return 'circadian'
  for (const k of WORKS_LIGHT_PRESET_KEYS) {
    const p = WORKS_LIGHT_PRESETS[k]
    if (p.light_circadian) continue
    if (
      p.light_temp_k === values.light_temp_k &&
      p.light_direction_deg === values.light_direction_deg &&
      p.light_intensity_pct === values.light_intensity_pct
    ) return k
  }
  return null
}

// ── Mobile fallback resolution ─────────────────────────────────────────────

import type { WorksLayout } from '@/lib/portfolio-config-types'

/**
 * Layouts that are too complex / 3D / unimplemented for a narrow mobile
 * viewport — automatically fall back to `grid` when `mobile_fallback = 'auto'`.
 * Simpler layouts (carousel, grid, procession, timeline, letter) keep their
 * desktop layout on mobile.
 */
const AUTO_MOBILE_FALLBACK: Partial<Record<WorksLayout, WorksLayout>> = {
  salon:         'grid',
  vitrine:       'grid',
  map:           'grid',
  constellation: 'grid',
  diptych:       'grid',
}

/** Layout values mirrored here to avoid a circular import with portfolio-config-types. */
const MOBILE_FALLBACK_LAYOUTS = new Set([
  'carousel', 'grid', 'procession', 'salon', 'vitrine', 'timeline', 'letter',
  'map', 'constellation', 'diptych',
])

/**
 * Coerce a raw config value to `WorksLayout | 'auto'`.
 * Unknown / missing values default to `'auto'`.
 */
export function migrateWorksMobileFallback(v: unknown): WorksLayout | 'auto' {
  if (v === 'auto') return 'auto'
  if (typeof v === 'string' && MOBILE_FALLBACK_LAYOUTS.has(v)) return v as WorksLayout
  return 'auto'
}

/**
 * Resolve the effective layout for a mobile visitor.
 *
 * @param desktopLayout - The mode's configured desktop layout.
 * @param mobileFallback - `'auto'` (table-driven) or an explicit override.
 * @returns The layout to use at < 768 px.
 */
export function resolveWorksMobileLayout(
  desktopLayout: WorksLayout,
  mobileFallback: WorksLayout | 'auto' = 'auto',
): WorksLayout {
  if (mobileFallback !== 'auto') return mobileFallback
  return AUTO_MOBILE_FALLBACK[desktopLayout] ?? desktopLayout
}
