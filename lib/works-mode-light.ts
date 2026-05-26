/**
 * Works-page lighting — single kelvin scalar per mode.
 *
 * 2700K (warm tungsten) ─ 4500K (neutral) ─ 6500K (cool daylight)
 *
 * Renders as an RGBA wall tint (overlay) and a bevel-highlight color shift.
 * Light direction / intensity are out of scope for this first pass.
 */

export const WORKS_LIGHT_TEMP_MIN = 2700
export const WORKS_LIGHT_TEMP_MAX = 6500
export const WORKS_LIGHT_TEMP_DEFAULT = 4500

export function migrateWorksLightTempK(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return WORKS_LIGHT_TEMP_DEFAULT
  return Math.min(WORKS_LIGHT_TEMP_MAX, Math.max(WORKS_LIGHT_TEMP_MIN, Math.round(n)))
}

export type WorksLightResolved = {
  kelvin: number
  /** RGBA overlay applied over the wall — alpha is 0 at neutral, ramps up at extremes. */
  tintRgba: string
  /** Warm/cool-shifted color for the bevel's inner highlight (top-left lit edge). */
  bevelHighlightRgba: string
  /** Warm/cool-shifted color for the bevel's inner shadow (bottom-right shaded edge). */
  bevelShadowRgba: string
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

export function resolveWorksLight(kelvin: number): WorksLightResolved {
  const k = migrateWorksLightTempK(kelvin)
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
  // Bevel highlight (the lit edge) takes the full light color; the shadow side
  // gets a complementary cold/warm shift so the painting feels under one source.
  const highlight = tint
  const shadowBase: [number, number, number] = [22, 20, 17]
  return {
    kelvin: k,
    tintRgba: `rgba(${tint[0]}, ${tint[1]}, ${tint[2]}, ${tintAlpha})`,
    bevelHighlightRgba: `rgba(${highlight[0]}, ${highlight[1]}, ${highlight[2]}, 0.42)`,
    bevelShadowRgba: `rgba(${shadowBase[0]}, ${shadowBase[1]}, ${shadowBase[2]}, 0.18)`,
  }
}
