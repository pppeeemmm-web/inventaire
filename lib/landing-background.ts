export const LANDING_BG_BOTTOM_DEFAULT = '#edeae4'
export const LANDING_BG_TOP_DEFAULT = '#77B5FE'
/** @deprecated Legacy blend centre — used only when migrating to stops. */
export const LANDING_BG_BLEND_POSITION_DEFAULT = 38
/** @deprecated Legacy blend softness — used only when migrating to stops. */
export const LANDING_BG_BLEND_SOFTNESS_DEFAULT = 68

export const LANDING_GRADIENT_STOP_MIN = 2
export const LANDING_GRADIENT_STOP_MAX = 6

export type LandingGradientStop = {
  color: string
  position_pct: number
}

export const DEFAULT_LANDING_GRADIENT_STOPS: LandingGradientStop[] = [
  { color: LANDING_BG_TOP_DEFAULT, position_pct: 0 },
  { color: LANDING_BG_BOTTOM_DEFAULT, position_pct: 100 },
]

const HEX_RE = /^#?([0-9a-f]{6})$/i

/** Normalize to `#RRGGBB` or null if invalid. */
export function normalizeHexColor(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim()
  if (!raw) return null
  const m = raw.match(HEX_RE)
  if (!m) return null
  return `#${m[1].toLowerCase()}`
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, Math.round(n)))
}

function parsePct(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return clampPct(Number.isFinite(n) ? n : fallback)
}

/** Four-stop gradient from legacy top/bottom + blend sliders. */
export function getGradientEndpointColors(stops: LandingGradientStop[]): {
  topHex: string
  bottomHex: string
} {
  const sorted = [...stops].sort((a, b) => a.position_pct - b.position_pct)
  return {
    topHex: sorted[0]?.color ?? LANDING_BG_TOP_DEFAULT,
    bottomHex: sorted[sorted.length - 1]?.color ?? LANDING_BG_BOTTOM_DEFAULT,
  }
}

/** Rebuild 4-stop band from endpoint colours + transition position / hardness. */
export function applyLandingBlendTransition(
  stops: LandingGradientStop[],
  blendPositionPct: number,
  blendSoftnessPct: number,
): LandingGradientStop[] {
  const { topHex, bottomHex } = getGradientEndpointColors(stops)
  return buildLegacyLandingGradientStops(topHex, bottomHex, blendPositionPct, blendSoftnessPct)
}

export function buildLegacyLandingGradientStops(
  topHex: string,
  bottomHex: string,
  blendPositionPct: number,
  blendSoftnessPct: number,
): LandingGradientStop[] {
  if (topHex.toLowerCase() === bottomHex.toLowerCase()) {
    return [
      { color: topHex, position_pct: 0 },
      { color: bottomHex, position_pct: 100 },
    ]
  }
  const position = clampPct(blendPositionPct)
  const softness = clampPct(blendSoftnessPct)
  const halfSpan = (softness / 100) * 48
  let blendStart = clampPct(position - halfSpan)
  let blendEnd = clampPct(position + halfSpan)
  if (blendEnd <= blendStart + 4) blendEnd = Math.min(100, blendStart + 8)
  if (blendStart === blendEnd) blendEnd = Math.min(100, blendStart + 1)
  return [
    { color: topHex, position_pct: 0 },
    { color: topHex, position_pct: blendStart },
    { color: bottomHex, position_pct: blendEnd },
    { color: bottomHex, position_pct: 100 },
  ]
}

export function normalizeGradientStop(raw: unknown, fallback: LandingGradientStop): LandingGradientStop {
  if (!raw || typeof raw !== 'object') return fallback
  const o = raw as { color?: unknown; position_pct?: unknown }
  return {
    color: normalizeHexColor(String(o.color ?? '')) ?? fallback.color,
    position_pct: parsePct(o.position_pct, fallback.position_pct),
  }
}

export function migrateLandingGradientStops(landing?: {
  bg_gradient_stops?: unknown
  bg_top_hex?: unknown
  bg_bottom_hex?: unknown
  bg_blend_position_pct?: unknown
  bg_blend_softness_pct?: unknown
} | null): LandingGradientStop[] {
  const rawStops = landing?.bg_gradient_stops
  if (Array.isArray(rawStops) && rawStops.length >= LANDING_GRADIENT_STOP_MIN) {
    const stops = rawStops
      .slice(0, LANDING_GRADIENT_STOP_MAX)
      .map((s, i) => normalizeGradientStop(s, DEFAULT_LANDING_GRADIENT_STOPS[
        Math.min(i, DEFAULT_LANDING_GRADIENT_STOPS.length - 1)
      ]))
    if (stops.length >= LANDING_GRADIENT_STOP_MIN) return stops
  }

  const topHex = normalizeHexColor(String(landing?.bg_top_hex ?? '')) ?? LANDING_BG_TOP_DEFAULT
  const bottomHex = normalizeHexColor(String(landing?.bg_bottom_hex ?? '')) ?? LANDING_BG_BOTTOM_DEFAULT
  return buildLegacyLandingGradientStops(
    topHex,
    bottomHex,
    parsePct(landing?.bg_blend_position_pct, LANDING_BG_BLEND_POSITION_DEFAULT),
    parsePct(landing?.bg_blend_softness_pct, LANDING_BG_BLEND_SOFTNESS_DEFAULT),
  )
}

/** Build CSS linear-gradient from 2–6 stops (sorted by position). */
export function buildLandingGradientCss(stops: LandingGradientStop[]): string {
  const normalized = stops
    .map(s => ({
      color: normalizeHexColor(s.color) ?? LANDING_BG_BOTTOM_DEFAULT,
      position_pct: clampPct(s.position_pct),
    }))
    .sort((a, b) => a.position_pct - b.position_pct)

  if (normalized.length < LANDING_GRADIENT_STOP_MIN) {
    const fallback = DEFAULT_LANDING_GRADIENT_STOPS.map(s => `${s.color} ${s.position_pct}%`).join(', ')
    return `linear-gradient(to bottom, ${fallback})`
  }

  const unique = normalized.filter((s, i, arr) =>
    i === 0 || s.color !== arr[i - 1].color || s.position_pct !== arr[i - 1].position_pct,
  )

  if (unique.every(s => s.color === unique[0].color)) return unique[0].color

  const parts = unique.map(s => `${s.color} ${s.position_pct}%`).join(', ')
  return `linear-gradient(to bottom, ${parts})`
}

function relativeLuminance(hex: string): number {
  const m = hex.match(HEX_RE)
  if (!m) return 0.5
  const n = parseInt(m[1], 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

export type LandingBackgroundResolved = {
  gradientStops: LandingGradientStop[]
  topHex: string
  bottomHex: string
  backgroundCss: string
  toolbarBackground: string
  chromeText: string
  chromeTextHover: string
  chromeBorder: string
  bodyMutedText: string
  bodyText: string
}

export type LandingBackgroundFields = {
  bg_gradient_stops?: unknown
  bg_top_hex?: unknown
  bg_bottom_hex?: unknown
  bg_blend_position_pct?: unknown
  bg_blend_softness_pct?: unknown
}

export function resolveLandingBackground(
  landing?: Partial<LandingBackgroundFields> | null,
): LandingBackgroundResolved {
  const gradientStops = migrateLandingGradientStops(landing)
  const sorted = [...gradientStops].sort((a, b) => a.position_pct - b.position_pct)
  const topHex = sorted[0]?.color ?? LANDING_BG_TOP_DEFAULT
  const bottomHex = sorted[sorted.length - 1]?.color ?? LANDING_BG_BOTTOM_DEFAULT
  const backgroundCss = buildLandingGradientCss(gradientStops)

  const topIsLight = relativeLuminance(topHex) > 0.62
  const chromeText = topIsLight ? '#3a3834' : '#b0aca6'
  const chromeTextHover = topIsLight ? '#1a1a1a' : '#6b6760'
  const chromeBorder = topIsLight ? '#5a5650' : '#dedad4'

  return {
    gradientStops,
    topHex,
    bottomHex,
    backgroundCss,
    toolbarBackground: hexWithAlpha(bottomHex, 0.96),
    chromeText,
    chromeTextHover,
    chromeBorder,
    bodyMutedText: '#8a8680',
    bodyText: '#5a5650',
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const m = hex.match(HEX_RE)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
