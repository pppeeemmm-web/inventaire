import {
  LANDING_HERO_BEVEL_PX_MAX,
  migrateHeroBevelPx,
} from '@/lib/landing-hero-bevel'
import {
  getGradientEndpointColors,
  migrateLandingGradientStops,
  normalizeHexColor,
} from '@/lib/landing-background'

export type LandingShadowTuning = {
  /** Bottom gradient stop. */
  bottomTintHex: string
  /** Top gradient stop — chrome text sits here; drives shadow contrast. */
  topTintHex: string
  /** From site config — scales text shadow length only (disc rim is separate). */
  heroBevelPx: number
}

export type LandingChromeTextShadow = {
  chrome: string
  chromeSoft: string
  padInlineStart: number
  padInlineEnd: number
  /** `filter: drop-shadow(…)` on the warped paint layer — follows AVIF alpha. */
  heroDiscCastFilter: string
}

export type LandingChromeTextShadowOptions = {
  compact?: boolean
  reducedMotion?: boolean
  tuning?: LandingShadowTuning
}

type ContinuousShadowSpec = {
  lengthPx: number
  dirX: number
  dirY: number
  rgba: string
  layers?: number
}

type HourPeriod = 'night' | 'morning' | 'midday' | 'afternoon' | 'evening'

const SHADOW_COMPACT_SCALE = 0.58
const SHADOW_SOFT_LENGTH_RATIO = 0.78
const SHADOW_SOFT_LAYER_RATIO = 0.85
/** Stacked layers on chrome nodes — keep ≤7 for compositing. */
const TEXT_FADE_LAYERS = 7
const HERO_CAST_LAYERS = 5
const HERO_LENGTH_RATIO = 0.95
const SHADOW_ON_LIGHT_SKY = '#2c2a28'

function hourPeriod(hour: number): HourPeriod {
  const h = ((hour % 24) + 24) % 24
  if (h >= 21 || h < 6) return 'night'
  if (h >= 6 && h < 10) return 'morning'
  if (h >= 10 && h < 14) return 'midday'
  if (h >= 14 && h < 17) return 'afternoon'
  return 'evening'
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = normalizeHexColor(hex) ?? '#3a3834'
  const m = n.match(/^#([0-9a-f]{6})$/i)
  if (!m) return { r: 58, g: 56, b: 52 }
  const v = parseInt(m[1], 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

function relativeLuminance(hex: string): number {
  const m = (normalizeHexColor(hex) ?? '#888').match(/^#([0-9a-f]{6})$/i)
  if (!m) return 0.5
  const n = parseInt(m[1], 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/** Chrome sits on the sky (top stop) — use a dark cast on pale skies. */
function shadowRgba(
  period: HourPeriod,
  bottomTintHex: string,
  topTintHex: string,
  alpha: number,
): string {
  if (period === 'night') return `rgba(32, 38, 52, ${alpha})`
  const skyLight = relativeLuminance(topTintHex) > 0.58
  const baseHex = skyLight ? SHADOW_ON_LIGHT_SKY : bottomTintHex
  const { r, g, b } = hexToRgb(baseHex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Bevel depth only — gloss falloff controls highlight wash, not page shadows. */
function shadowLengthScale(tuning?: LandingShadowTuning): number {
  if (!tuning) return 1
  const bevel = migrateHeroBevelPx(tuning.heroBevelPx)
  return 0.88 + (bevel / LANDING_HERO_BEVEL_PX_MAX) * 0.28
}

function baseSpecsForPeriod(
  period: HourPeriod,
  bottomTintHex: string,
  topTintHex: string,
): { chrome: ContinuousShadowSpec; soft: ContinuousShadowSpec } {
  switch (period) {
    case 'night':
      return {
        chrome: { lengthPx: 40, dirX: -1, dirY: 1.2, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.32) },
        soft: { lengthPx: 30, dirX: -1, dirY: 1.2, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.26) },
      }
    case 'morning':
      return {
        chrome: { lengthPx: 58, dirX: -1, dirY: 1.45, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.42) },
        soft: { lengthPx: 44, dirX: -1, dirY: 1.45, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.34) },
      }
    case 'midday':
      return {
        chrome: { lengthPx: 26, dirX: 0, dirY: 1.2, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.34) },
        soft: { lengthPx: 20, dirX: 0, dirY: 1.2, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.28) },
      }
    case 'afternoon':
      return {
        chrome: { lengthPx: 48, dirX: 1, dirY: 1.35, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.4) },
        soft: { lengthPx: 36, dirX: 1, dirY: 1.35, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.32) },
      }
    case 'evening':
      return {
        chrome: { lengthPx: 56, dirX: 1, dirY: 1.45, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.44) },
        soft: { lengthPx: 42, dirX: 1, dirY: 1.45, rgba: shadowRgba(period, bottomTintHex, topTintHex, 0.34) },
      }
  }
}

function specForHour(hour: number, tuning?: LandingShadowTuning): { chrome: ContinuousShadowSpec; soft: ContinuousShadowSpec } {
  const period = hourPeriod(hour)
  const bottomTintHex = tuning?.bottomTintHex ?? '#3a3834'
  const topTintHex = tuning?.topTintHex ?? '#77b5fe'
  const scale = shadowLengthScale(tuning)
  const { chrome, soft } = baseSpecsForPeriod(period, bottomTintHex, topTintHex)
  return {
    chrome: { ...chrome, lengthPx: Math.round(chrome.lengthPx * scale) },
    soft: { ...soft, lengthPx: Math.round(soft.lengthPx * scale) },
  }
}

function parseRgba(base: string): { r: number; g: number; b: number; a: number } | null {
  const m = base.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i)
  if (!m) return null
  return { r: +m[1], g: +m[2], b: +m[3], a: +m[4] }
}

function rgbaWithAlpha(base: string, alpha: number): string {
  const c = parseRgba(base)
  if (!c) return base
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, Math.min(0.62, alpha))})`
}

function unitDir(dirX: number, dirY: number): { ux: number; uy: number } {
  const len = Math.hypot(dirX, dirY)
  if (len < 1e-6) return { ux: 0, uy: 1 }
  return { ux: dirX / len, uy: dirY / len }
}

/** Soft stacked shadows — continuous fading tail (screen west = left). */
export function buildContinuousFadingShadow(spec: ContinuousShadowSpec): string {
  const layers = Math.max(2, Math.min(TEXT_FADE_LAYERS, Math.round(spec.layers ?? TEXT_FADE_LAYERS)))
  const { ux, uy } = unitDir(spec.dirX, spec.dirY)
  const base = parseRgba(spec.rgba)
  if (!base) return 'none'

  const parts: string[] = []
  for (let i = 1; i <= layers; i++) {
    const t = i / layers
    const posT = Math.pow(t, 0.82)
    const x = ux * spec.lengthPx * posT
    const y = uy * spec.lengthPx * posT
    const blur = 0.5 + spec.lengthPx * 0.38 * t
    const alpha = base.a * Math.pow(1 - t, 1.65)
    if (alpha < 0.008) continue
    parts.push(
      `${x.toFixed(1)}px ${y.toFixed(1)}px ${blur.toFixed(1)}px ${rgbaWithAlpha(spec.rgba, alpha)}`,
    )
  }
  return parts.length > 0 ? parts.join(', ') : 'none'
}

function buildContinuousFadingDropShadow(spec: ContinuousShadowSpec): string {
  const layers = Math.max(2, Math.min(HERO_CAST_LAYERS, Math.round(spec.layers ?? HERO_CAST_LAYERS)))
  const { ux, uy } = unitDir(spec.dirX, spec.dirY)
  const base = parseRgba(spec.rgba)
  if (!base) return 'none'

  const parts: string[] = []
  for (let i = 1; i <= layers; i++) {
    const t = i / layers
    const posT = Math.pow(t, 0.82)
    const x = ux * spec.lengthPx * posT
    const y = uy * spec.lengthPx * posT
    const blur = 1 + spec.lengthPx * 0.4 * t
    const alpha = base.a * Math.pow(1 - t, 1.55)
    if (alpha < 0.01) continue
    parts.push(
      `drop-shadow(${x.toFixed(1)}px ${y.toFixed(1)}px ${blur.toFixed(1)}px ${rgbaWithAlpha(spec.rgba, alpha)})`,
    )
  }
  return parts.length > 0 ? parts.join(' ') : 'none'
}

function heroSpecFromChrome(chrome: ContinuousShadowSpec): ContinuousShadowSpec {
  const c = parseRgba(chrome.rgba)
  return {
    ...chrome,
    lengthPx: Math.max(14, Math.round(chrome.lengthPx * HERO_LENGTH_RATIO)),
    layers: HERO_CAST_LAYERS,
    rgba: c
      ? `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.min(0.48, c.a * 1.25)})`
      : chrome.rgba,
  }
}

function shadowPadding(spec: ContinuousShadowSpec): Pick<LandingChromeTextShadow, 'padInlineStart' | 'padInlineEnd'> {
  const { ux } = unitDir(spec.dirX, spec.dirY)
  const extentX = Math.abs(ux * spec.lengthPx)
  const pad = Math.round(extentX * 0.72)
  if (spec.dirX < 0) return { padInlineStart: pad, padInlineEnd: 0 }
  if (spec.dirX > 0) return { padInlineStart: 0, padInlineEnd: pad }
  return { padInlineStart: 0, padInlineEnd: 0 }
}

function scaleLength(lengthPx: number, compact?: boolean): number {
  const n = compact ? Math.round(lengthPx * SHADOW_COMPACT_SCALE) : lengthPx
  return Math.max(6, n)
}

function resolveSpec(spec: ContinuousShadowSpec, compact?: boolean): ContinuousShadowSpec {
  return { ...spec, lengthPx: scaleLength(spec.lengthPx, compact) }
}

function reducedTextShadow(spec: ContinuousShadowSpec): string {
  const { ux, uy } = unitDir(spec.dirX, spec.dirY)
  const x = ux * spec.lengthPx * 0.65
  const y = uy * spec.lengthPx * 0.65
  const blur = 4 + spec.lengthPx * 0.12
  return `${x.toFixed(1)}px ${y.toFixed(1)}px ${blur.toFixed(1)}px ${spec.rgba}`
}

function buildPair(
  chrome: ContinuousShadowSpec,
  soft: ContinuousShadowSpec,
  options?: LandingChromeTextShadowOptions,
): LandingChromeTextShadow {
  const chromeR = resolveSpec(chrome, options?.compact)
  const softR = resolveSpec(
    {
      ...soft,
      lengthPx: Math.max(6, Math.round(soft.lengthPx * SHADOW_SOFT_LENGTH_RATIO)),
      layers: Math.max(2, Math.round((soft.layers ?? TEXT_FADE_LAYERS) * SHADOW_SOFT_LAYER_RATIO)),
    },
    options?.compact,
  )
  const pad = shadowPadding(chromeR)
  const heroDiscCastFilter = buildContinuousFadingDropShadow(heroSpecFromChrome(chromeR))

  if (options?.reducedMotion) {
    return {
      chrome: reducedTextShadow(chromeR),
      chromeSoft: reducedTextShadow(softR),
      heroDiscCastFilter,
      ...pad,
    }
  }

  return {
    chrome: buildContinuousFadingShadow(chromeR),
    chromeSoft: buildContinuousFadingShadow(softR),
    heroDiscCastFilter,
    ...pad,
  }
}

const defaultTuning: LandingShadowTuning = {
  bottomTintHex: '#3a3834',
  topTintHex: '#77b5fe',
  heroBevelPx: 4,
}

const defaultBuilt = buildPair(
  ...(() => {
    const { chrome, soft } = specForHour(18, defaultTuning)
    return [chrome, soft] as const
  })(),
)

export const LANDING_CHROME_TEXT_SHADOW_DEFAULT = defaultBuilt.chrome
export const LANDING_CHROME_TEXT_SHADOW_SOFT_DEFAULT = defaultBuilt.chromeSoft

export function landingChromeTextShadowForHour(
  hour: number,
  options?: LandingChromeTextShadowOptions,
): LandingChromeTextShadow {
  const { chrome, soft } = specForHour(hour, options?.tuning)
  return buildPair(chrome, soft, options)
}

export function landingChromeTextShadowNow(
  date = new Date(),
  options?: LandingChromeTextShadowOptions,
): LandingChromeTextShadow {
  return landingChromeTextShadowForHour(date.getHours(), options)
}

export function landingShadowTuningFromLanding(
  landing: Partial<{
    hero_bevel_px?: unknown
    bg_gradient_stops?: unknown
  }> | null | undefined,
  bottomHex: string,
  topHex?: string,
): LandingShadowTuning {
  const stops = migrateLandingGradientStops(landing)
  const { topHex: topFromStops, bottomHex: bottomFromStops } = getGradientEndpointColors(stops)
  return {
    bottomTintHex: normalizeHexColor(bottomHex) ?? bottomFromStops,
    topTintHex: normalizeHexColor(topHex) ?? topFromStops,
    heroBevelPx: migrateHeroBevelPx(landing?.hero_bevel_px),
  }
}
