/**
 * Circadian knob application.
 *
 * Provides a 9-period keyframe table (pre-dawn → night) and
 * `applyCircadianToKnobs` which patches only the families selected in
 * `knobs.circ.drives`. The resolver (resolve-knobs.ts) stays pure; this
 * function is called by client components that hold the circadian tick state.
 */

import type { KnobValues } from '@/lib/site-blocks'

// ── Snapshot type ──────────────────────────────────────────────────────────

export type CircadianSnapshot = {
  light: Partial<KnobValues['light']>
  shadow: Partial<KnobValues['shadow']>
  bg: Partial<KnobValues['bg']>
  atm: Partial<KnobValues['atm']>
}

// ── 9-period keyframe table ────────────────────────────────────────────────

/** Minutes since local midnight [0, 1440). */
export type CircadianPeriod =
  | 'pre-dawn'    // 00:00–05:00
  | 'dawn'        // 05:00–07:00
  | 'morning'     // 07:00–10:00
  | 'midday'      // 10:00–13:00
  | 'afternoon'   // 13:00–16:00
  | 'golden-hour' // 16:00–19:00
  | 'dusk'        // 19:00–21:00
  | 'evening'     // 21:00–23:00
  | 'night'       // 23:00–00:00

type Keyframe = {
  minuteStart: number
  snapshot: CircadianSnapshot
}

const KEYFRAMES: Keyframe[] = [
  // 00:00 pre-dawn — deep blue cold
  {
    minuteStart: 0,
    snapshot: {
      light:  { temp_k: 3200, direction_deg: 195, intensity_pct: 55 },
      shadow: { opacity_pct: 55, distance_px: 22, blur_px: 28 },
      bg:     { blend_position: 62, blend_softness: 40, opacity: 0.92 },
      atm:    { sky_top: '#060810', sky_bottom: '#0d1220', tint_opacity: 0.18, work_glow_pct: 8 },
    },
  },
  // 05:00 dawn — first light, warm rose
  {
    minuteStart: 5 * 60,
    snapshot: {
      light:  { temp_k: 3800, direction_deg: 105, intensity_pct: 65 },
      shadow: { opacity_pct: 70, distance_px: 36, blur_px: 32 },
      bg:     { blend_position: 58, blend_softness: 44, opacity: 0.88 },
      atm:    { sky_top: '#1a0e18', sky_bottom: '#3b2230', tint_opacity: 0.22, work_glow_pct: 14 },
    },
  },
  // 07:00 morning — clear cool light
  {
    minuteStart: 7 * 60,
    snapshot: {
      light:  { temp_k: 5500, direction_deg: 80, intensity_pct: 90 },
      shadow: { opacity_pct: 80, distance_px: 42, blur_px: 26 },
      bg:     { blend_position: 50, blend_softness: 50, opacity: 0.82 },
      atm:    { sky_top: '#0e1828', sky_bottom: '#1c2a3a', tint_opacity: 0.12, work_glow_pct: 10 },
    },
  },
  // 10:00 midday — bright neutral
  {
    minuteStart: 10 * 60,
    snapshot: {
      light:  { temp_k: 6200, direction_deg: 315, intensity_pct: 110 },
      shadow: { opacity_pct: 65, distance_px: 18, blur_px: 22 },
      bg:     { blend_position: 48, blend_softness: 55, opacity: 0.76 },
      atm:    { sky_top: '#0a0c12', sky_bottom: '#141824', tint_opacity: 0.06, work_glow_pct: 4 },
    },
  },
  // 13:00 afternoon — warm daylight
  {
    minuteStart: 13 * 60,
    snapshot: {
      light:  { temp_k: 5800, direction_deg: 260, intensity_pct: 105 },
      shadow: { opacity_pct: 72, distance_px: 26, blur_px: 24 },
      bg:     { blend_position: 50, blend_softness: 52, opacity: 0.80 },
      atm:    { sky_top: '#0c0e14', sky_bottom: '#181c28', tint_opacity: 0.08, work_glow_pct: 6 },
    },
  },
  // 16:00 golden hour — amber warmth
  {
    minuteStart: 16 * 60,
    snapshot: {
      light:  { temp_k: 3600, direction_deg: 240, intensity_pct: 95 },
      shadow: { opacity_pct: 85, distance_px: 48, blur_px: 30 },
      bg:     { blend_position: 55, blend_softness: 42, opacity: 0.86 },
      atm:    { sky_top: '#1a1008', sky_bottom: '#2e1c10', tint_opacity: 0.28, work_glow_pct: 22 },
    },
  },
  // 19:00 dusk — violet transition
  {
    minuteStart: 19 * 60,
    snapshot: {
      light:  { temp_k: 3000, direction_deg: 220, intensity_pct: 78 },
      shadow: { opacity_pct: 78, distance_px: 38, blur_px: 34 },
      bg:     { blend_position: 58, blend_softness: 38, opacity: 0.90 },
      atm:    { sky_top: '#120d1c', sky_bottom: '#1e1428', tint_opacity: 0.32, work_glow_pct: 28 },
    },
  },
  // 21:00 evening — deep indigo
  {
    minuteStart: 21 * 60,
    snapshot: {
      light:  { temp_k: 2800, direction_deg: 200, intensity_pct: 65 },
      shadow: { opacity_pct: 60, distance_px: 28, blur_px: 30 },
      bg:     { blend_position: 60, blend_softness: 38, opacity: 0.92 },
      atm:    { sky_top: '#080a14', sky_bottom: '#10121e', tint_opacity: 0.20, work_glow_pct: 16 },
    },
  },
  // 23:00 night — darkest, cold blue
  {
    minuteStart: 23 * 60,
    snapshot: {
      light:  { temp_k: 3200, direction_deg: 195, intensity_pct: 55 },
      shadow: { opacity_pct: 50, distance_px: 20, blur_px: 26 },
      bg:     { blend_position: 62, blend_softness: 36, opacity: 0.94 },
      atm:    { sky_top: '#060810', sky_bottom: '#0d1220', tint_opacity: 0.16, work_glow_pct: 6 },
    },
  },
]

// ── Interpolation ──────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpSnapshot(a: CircadianSnapshot, b: CircadianSnapshot, t: number): CircadianSnapshot {
  return {
    light: {
      temp_k:        lerp(a.light.temp_k!,        b.light.temp_k!,        t),
      direction_deg: lerp(a.light.direction_deg!, b.light.direction_deg!, t),
      intensity_pct: lerp(a.light.intensity_pct!, b.light.intensity_pct!, t),
    },
    shadow: {
      opacity_pct:  lerp(a.shadow.opacity_pct!,  b.shadow.opacity_pct!,  t),
      distance_px:  lerp(a.shadow.distance_px!,  b.shadow.distance_px!,  t),
      blur_px:      lerp(a.shadow.blur_px!,       b.shadow.blur_px!,       t),
    },
    bg: {
      blend_position: lerp(a.bg.blend_position!, b.bg.blend_position!, t),
      blend_softness: lerp(a.bg.blend_softness!, b.bg.blend_softness!, t),
      opacity:        lerp(a.bg.opacity!,         b.bg.opacity!,         t),
    },
    atm: {
      tint_opacity:  lerp(a.atm.tint_opacity!,  b.atm.tint_opacity!,  t),
      work_glow_pct: lerp(a.atm.work_glow_pct!, b.atm.work_glow_pct!, t),
      // colour channels: blend dominant keyframe (interpolating hex is complex)
      sky_top:    t < 0.5 ? a.atm.sky_top!    : b.atm.sky_top!,
      sky_bottom: t < 0.5 ? a.atm.sky_bottom! : b.atm.sky_bottom!,
    },
  }
}

export function interpolateCircadianSnapshot(minuteOfDay: number): CircadianSnapshot {
  const m = ((minuteOfDay % 1440) + 1440) % 1440

  // Find surrounding keyframes (table wraps midnight → pre-dawn)
  let lo = KEYFRAMES[KEYFRAMES.length - 1]
  let hi = KEYFRAMES[0]

  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (m >= KEYFRAMES[i].minuteStart && m < KEYFRAMES[i + 1].minuteStart) {
      lo = KEYFRAMES[i]
      hi = KEYFRAMES[i + 1]
      break
    }
  }

  const span = (hi.minuteStart - lo.minuteStart + 1440) % 1440 || 1440
  const t = (m - lo.minuteStart + 1440) % 1440 / span

  return lerpSnapshot(lo.snapshot, hi.snapshot, Math.max(0, Math.min(1, t)))
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Apply circadian variation to `knobs` for `minuteOfDay` [0, 1439].
 * Only patches families selected in `knobs.circ.drives`. Returns a new
 * KnobValues; does not mutate the input.
 */
export function applyCircadianToKnobs(knobs: KnobValues, minuteOfDay: number): KnobValues {
  const { drives } = knobs.circ
  if (!drives.light && !drives.shadow && !drives.bg && !drives.atm) return knobs

  const snap = interpolateCircadianSnapshot(minuteOfDay)
  return {
    ...knobs,
    light:  drives.light  ? { ...knobs.light,  ...snap.light  } : knobs.light,
    shadow: drives.shadow ? { ...knobs.shadow, ...snap.shadow } : knobs.shadow,
    bg:     drives.bg     ? { ...knobs.bg,     ...snap.bg     } : knobs.bg,
    atm:    drives.atm    ? { ...knobs.atm,    ...snap.atm    } : knobs.atm,
  }
}

// ── Philosophy presets ─────────────────────────────────────────────────────

export type CircadianPreset = 'sun' | 'gallery' | 'theatre' | 'custom'

export type CircadianPresetValues = Pick<KnobValues['circ'], 'auto' | 'drives'>

export const CIRCADIAN_PRESETS: Record<CircadianPreset, CircadianPresetValues> = {
  sun:     { auto: true,  drives: { light: true,  shadow: true,  bg: true,  atm: true  } },
  gallery: { auto: true,  drives: { light: true,  shadow: false, bg: false, atm: false } },
  theatre: { auto: true,  drives: { light: true,  shadow: true,  bg: false, atm: true  } },
  custom:  { auto: false, drives: { light: false, shadow: false, bg: false, atm: false } },
}
