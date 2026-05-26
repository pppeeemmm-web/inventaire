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

export const WORKS_LIGHT_TEMP_MIN = 2700
export const WORKS_LIGHT_TEMP_MAX = 6500
export const WORKS_LIGHT_TEMP_DEFAULT = 4500

export const WORKS_LIGHT_DIRECTION_DEFAULT = 315
export const WORKS_LIGHT_INTENSITY_MIN = 50
export const WORKS_LIGHT_INTENSITY_MAX = 150
export const WORKS_LIGHT_INTENSITY_DEFAULT = 100

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
