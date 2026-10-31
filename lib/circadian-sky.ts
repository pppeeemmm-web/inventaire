/**
 * Circadian sky: the visitor's real sun/moon position → page palette + hero light.
 *
 * Replaces the old near-black "atmosphere veil" (which could only dim the page)
 * with a tint of the owner's own gradient plus an explicit light specification
 * for the hero disc.
 *
 * Two hard guarantees, both enforced here rather than left to the keyframes:
 *
 *  1. **The hero is lit at all times.** `discFilter` never drops below
 *     `DISC_FLOOR`. Night is moonlight — cooler and quieter than day, never
 *     unlit. Moon phase modulates *within* the floor-to-ceiling band; a new
 *     moon is the dimmest the disc ever gets, and that floor is still lit.
 *
 *  2. **Contrast is maintained at all times.** Chrome and body colours are not
 *     picked from a luminance threshold — they are measured against the sky
 *     actually rendered behind them and pushed until they clear
 *     `CONTRAST_TARGET`. Any keyframe palette is therefore legible by
 *     construction.
 */

import {
  buildLandingGradientCss,
  normalizeHexColor,
  relativeLuminance,
  type LandingGradientStop,
} from '@/lib/landing-background'
import type { MoonState } from '@/lib/solar-position'

// ── Tunables ───────────────────────────────────────────────────────────────

/**
 * WCAG AA. This floor is *always* reachable: the worst background for text is
 * luminance 0.179 (where black and white are equally readable) and even there
 * the best extreme still returns 4.58:1. No sky this module can produce can
 * push text below AA.
 */
const CONTRAST_MIN = 4.5
/**
 * Preferred chrome contrast. Unlike CONTRAST_MIN this is aspirational — a sky
 * sitting near the 0.179 crossover physically cannot offer it, and
 * `ensureContrast` returns the best available (never worse than CONTRAST_MIN).
 * Chrome also carries `landing-chrome-shadow`, which adds separation on top.
 */
const CONTRAST_TARGET_CHROME = 5.2
/** Hero light can never fall below this, whatever the hour or moon phase. */
const DISC_FLOOR = { brightness: 0.82, saturate: 0.62 }

// ── Colour helpers ─────────────────────────────────────────────────────────

type Rgb = { r: number; g: number; b: number }

function toRgb(hex: string): Rgb {
  const n = parseInt((normalizeHexColor(hex) ?? '#808080').slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function mixHex(a: string, b: string, t: number): string {
  const x = toRgb(a)
  const y = toRgb(b)
  const k = Math.max(0, Math.min(1, t))
  return toHex({
    r: x.r + (y.r - x.r) * k,
    g: x.g + (y.g - x.g) * k,
    b: x.b + (y.b - x.b) * k,
  })
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function contrastRatio(aHex: string, bHex: string): number {
  const la = relativeLuminance(aHex)
  const lb = relativeLuminance(bHex)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Which extreme a background can be read against. Not an eyeballed threshold:
 * black reaches (L+0.05)/0.05 and white reaches 1.05/(L+0.05), and those cross
 * at L = 0.179. Picking the wrong side of that crossover is how a mid-blue sky
 * ends up with white text at 2:1 when black would have given 10:1.
 */
function inkDirection(bgHex: string): '#000000' | '#ffffff' {
  return relativeLuminance(bgHex) > 0.179 ? '#000000' : '#ffffff'
}

/**
 * Push `fgHex` toward whichever extreme the background allows until it clears
 * `target`. Since black and white bracket every luminance, a target of 4.5:1
 * is always reachable — the loop converges rather than bottoming out.
 */
function ensureContrast(fgHex: string, bgHex: string, target: number): string {
  if (contrastRatio(fgHex, bgHex) >= target) return fgHex
  const toward = inkDirection(bgHex)
  for (let step = 1; step <= 32; step++) {
    const candidate = mixHex(fgHex, toward, step / 32)
    if (contrastRatio(candidate, bgHex) >= target) return candidate
  }
  return toward
}

// ── Sky keyframes, keyed to solar elevation ────────────────────────────────

type SkyKeyframe = {
  /** Sun elevation in degrees at which this frame is exact. */
  elevationDeg: number
  /** Sky colours the owner's gradient is tinted toward. */
  skyTop: string
  skyBottom: string
  /** How far the owner's palette moves toward this frame, 0…1. */
  tint: number
  /** Hero light at this elevation. */
  brightness: number
  saturate: number
  /** Positive = warmer (low sun), negative = cooler (twilight, moonlight). */
  warmth: number
}

/**
 * Ordered by elevation. Colours are real skies, not veils — a black overlay
 * can only ever grey the page down, which is what the previous implementation
 * did at every hour.
 */
const SKY: SkyKeyframe[] = [
  // Deep night — moonlight only. Still lit; see DISC_FLOOR and the moon bonus.
  { elevationDeg: -18, skyTop: '#121a2e', skyBottom: '#1b2232', tint: 0.86,
    brightness: 0.84, saturate: 0.66, warmth: -0.30 },
  // Astronomical twilight — the first hint of colour.
  { elevationDeg: -12, skyTop: '#1d2a46', skyBottom: '#2b3043', tint: 0.78,
    brightness: 0.88, saturate: 0.74, warmth: -0.24 },
  // Nautical twilight — blue hour proper.
  { elevationDeg: -6, skyTop: '#2f4a7a', skyBottom: '#4a4a63', tint: 0.64,
    brightness: 0.93, saturate: 0.84, warmth: -0.14 },
  // Civil twilight — rose and violet at the horizon.
  { elevationDeg: 0, skyTop: '#6b6ea8', skyBottom: '#c99a86', tint: 0.46,
    brightness: 0.97, saturate: 0.94, warmth: 0.10 },
  // Golden hour.
  { elevationDeg: 6, skyTop: '#8fa8cc', skyBottom: '#e8c49a', tint: 0.30,
    brightness: 1.00, saturate: 1.02, warmth: 0.22 },
  // Low sun, still warm.
  { elevationDeg: 15, skyTop: '#a9c6e2', skyBottom: '#f0e2cc', tint: 0.16,
    brightness: 1.01, saturate: 1.01, warmth: 0.10 },
  // Full day — the owner's palette, essentially untouched.
  { elevationDeg: 32, skyTop: '#bcdce8', skyBottom: '#f2efe9', tint: 0.05,
    brightness: 1.00, saturate: 1.00, warmth: 0.02 },
  // High sun.
  { elevationDeg: 60, skyTop: '#cfe6f2', skyBottom: '#faf7f1', tint: 0.08,
    brightness: 1.02, saturate: 0.99, warmth: 0.00 },
]

function interpolateSky(elevationDeg: number): SkyKeyframe {
  if (elevationDeg <= SKY[0].elevationDeg) return SKY[0]
  const last = SKY[SKY.length - 1]
  if (elevationDeg >= last.elevationDeg) return last

  let lo = SKY[0]
  let hi = SKY[1]
  for (let i = 0; i < SKY.length - 1; i++) {
    if (elevationDeg >= SKY[i].elevationDeg && elevationDeg < SKY[i + 1].elevationDeg) {
      lo = SKY[i]
      hi = SKY[i + 1]
      break
    }
  }
  const t = (elevationDeg - lo.elevationDeg) / (hi.elevationDeg - lo.elevationDeg)
  return {
    elevationDeg,
    // Blend the colours continuously — the old table hard-switched at t < 0.5,
    // so even correct colours would have stepped rather than drifted.
    skyTop: mixHex(lo.skyTop, hi.skyTop, t),
    skyBottom: mixHex(lo.skyBottom, hi.skyBottom, t),
    tint: lerp(lo.tint, hi.tint, t),
    brightness: lerp(lo.brightness, hi.brightness, t),
    saturate: lerp(lo.saturate, hi.saturate, t),
    warmth: lerp(lo.warmth, hi.warmth, t),
  }
}

// ── Moonlight ──────────────────────────────────────────────────────────────

/**
 * How strongly the moon is lighting the scene, 0…1. Needs the moon to be both
 * up and lit; a full moon below the horizon contributes nothing. Fades in over
 * the first 10° of altitude so moonrise is gradual rather than a switch.
 */
export function moonlightStrength(moon: MoonState, sunElevationDeg: number): number {
  if (sunElevationDeg > -6) return 0 // daylight and civil twilight drown it out
  if (moon.elevationDeg <= 0) return 0
  const altitude = Math.min(1, moon.elevationDeg / 10)
  const nightness = Math.min(1, (-6 - sunElevationDeg) / 12)
  return moon.illuminatedFraction * altitude * nightness
}

// ── Public render ──────────────────────────────────────────────────────────

export type SkyRender = {
  /** Full `background` value for the stage and body. */
  gradientCss: string
  topHex: string
  bottomHex: string
  toolbarBackground: string
  chromeText: string
  chromeTextHover: string
  chromeBorder: string
  bodyText: string
  bodyMutedText: string
  /** `filter` prefix for the hero disc — colour only, no shadows. */
  discFilter: string
  /** 0…1, for callers that want to soften the cast shadow at night. */
  moonlight: number
}

export type SkyInput = {
  /** The owner's configured gradient — tinted, never replaced. */
  stops: LandingGradientStop[]
  sunElevationDeg: number
  moon: MoonState
}

function rgbaHex(hex: string, alpha: number): string {
  const { r, g, b } = toRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Build the hero's light. Warmth is applied as a sepia/hue pair rather than a
 * colour overlay so the paint keeps its own values; the floor is applied last
 * so no keyframe or moon phase can drive the disc dark.
 */
function buildDiscFilter(brightness: number, saturate: number, warmth: number): string {
  const b = Math.max(DISC_FLOOR.brightness, brightness)
  const s = Math.max(DISC_FLOOR.saturate, saturate)
  const parts = [`brightness(${b.toFixed(3)})`, `saturate(${s.toFixed(3)})`]
  if (warmth > 0.01) parts.push(`sepia(${(warmth * 0.42).toFixed(3)})`)
  else if (warmth < -0.01) parts.push(`hue-rotate(${(warmth * 26).toFixed(1)}deg)`)
  return parts.join(' ')
}

/**
 * Luminance band in which *no* ink reaches CONTRAST_TARGET_CHROME: black tops
 * out at (L+0.05)/0.05 and white at 1.05/(L+0.05), so for a 5.2:1 chrome
 * target the unusable window is L ∈ (0.152, 0.210). A twilight sky drifts
 * straight through it, which is how the wordmark ends up pure black and still
 * only ~4.8:1.
 *
 * Rather than accept that, nudge the whole gradient to the nearer edge of the
 * band — the smallest change to the owner's colour that buys comfortable
 * contrast — and keep the gradient's shape by applying one mix factor to every
 * stop.
 */
const CHROME_BAND_LOW = 0.152
const CHROME_BAND_HIGH = 0.210

function clearChromeBand(stops: LandingGradientStop[]): LandingGradientStop[] {
  const sorted = [...stops].sort((a, b) => a.position_pct - b.position_pct)
  const topHex = sorted[0]?.color
  if (!topHex) return stops
  const lum = relativeLuminance(topHex)
  if (lum <= CHROME_BAND_LOW || lum >= CHROME_BAND_HIGH) return stops

  const toward = lum - CHROME_BAND_LOW < CHROME_BAND_HIGH - lum ? '#000000' : '#ffffff'
  const edge = toward === '#000000' ? CHROME_BAND_LOW : CHROME_BAND_HIGH
  let k = 0
  for (let step = 1; step <= 24; step++) {
    k = step / 24
    const shifted = relativeLuminance(mixHex(topHex, toward, k))
    if (toward === '#000000' ? shifted <= edge : shifted >= edge) break
  }
  return stops.map(stop => ({ ...stop, color: mixHex(stop.color, toward, k) }))
}

export function renderSky({ stops, sunElevationDeg, moon }: SkyInput): SkyRender {
  const frame = interpolateSky(sunElevationDeg)
  const moonlight = moonlightStrength(moon, sunElevationDeg)

  // A lit moon lifts the night a little — brighter, slightly less desaturated,
  // and the sky picks up a touch of silver. It can only ever add.
  const brightness = frame.brightness + moonlight * 0.10
  const saturate = frame.saturate + moonlight * 0.10
  const skyTop = moonlight > 0 ? mixHex(frame.skyTop, '#8ea2c4', moonlight * 0.22) : frame.skyTop
  const skyBottom = moonlight > 0 ? mixHex(frame.skyBottom, '#9aa6bd', moonlight * 0.16) : frame.skyBottom

  // Tint the owner's stops toward the sky. Each stop keeps its position, so the
  // shape of his gradient survives; only the colours drift with the hour.
  const tinted = stops.map((stop, i) => {
    const towardTop = stops.length <= 1 ? 0 : i / (stops.length - 1)
    const target = mixHex(skyTop, skyBottom, towardTop)
    return {
      color: mixHex(normalizeHexColor(stop.color) ?? '#edeae4', target, frame.tint),
      position_pct: stop.position_pct,
    }
  })

  const cleared = clearChromeBand(tinted)
  const sorted = [...cleared].sort((a, b) => a.position_pct - b.position_pct)
  const topHex = sorted[0]?.color ?? skyTop
  const bottomHex = sorted[sorted.length - 1]?.color ?? skyBottom

  // Contrast is measured against the sky actually behind each element: chrome
  // sits on the top stop, body copy near the bottom.
  const chromeSeed = inkDirection(topHex) === '#000000' ? '#2e2c29' : '#d7d3cc'
  const bodySeed = inkDirection(bottomHex) === '#000000' ? '#55514b' : '#c6c2bb'
  const chromeText = ensureContrast(chromeSeed, topHex, CONTRAST_TARGET_CHROME)
  const bodyText = ensureContrast(bodySeed, bottomHex, CONTRAST_MIN)

  return {
    gradientCss: buildLandingGradientCss(cleared),
    topHex,
    bottomHex,
    toolbarBackground: rgbaHex(bottomHex, 0.96),
    chromeText,
    chromeTextHover: ensureContrast(chromeText, topHex, CONTRAST_TARGET_CHROME + 1.6),
    chromeBorder: mixHex(chromeText, topHex, 0.55),
    bodyText,
    bodyMutedText: ensureContrast(mixHex(bodyText, bottomHex, 0.3), bottomHex, CONTRAST_MIN),
    discFilter: buildDiscFilter(brightness, saturate, frame.warmth),
    moonlight,
  }
}
