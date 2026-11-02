import sharp from 'sharp'

/**
 * Main colours of a work photo, by colour-wheel family (S6 / pic 9 "colour dropper").
 *
 * Owner's approach (2026-11-02): start from the painter's wheel — primary, secondary and
 * tertiary hues — then refine, rather than averaging clusters (averages missed a rust band,
 * and the greens and reds of #2366 altogether).
 *
 *  1. Every pixel goes into one family: the 12 hues of the red-yellow-blue wheel, or a neutral
 *     (black / grey / white) when it has little colour, or brown (a dark red-orange-yellow).
 *  2. A family's share = its fraction of the image, so a small but present colour still counts.
 *  3. Its swatch = the mean of its more saturated half (the colour you see, not a mud average).
 *
 *  4. Accents: a small vivid hue (under MIN_SHARE) is kept and flagged `accent`.
 *
 * Accuracy = the photo's own colours (Lightroom white balance / exposure); background, margin
 * or frame in the shot count too.
 */
// Type-only (erased at runtime), so `scripts/backfill-image-palette.mjs` can run this file in Node.
import type { ColourFamily, PaletteSwatch } from './colour-families'

export type { ColourFamily, PaletteSwatch }

const SAMPLE_EDGE = 160
/** Families below this share of the image are left out — unless they qualify as an accent. */
const MIN_SHARE = 0.015
const MAX_SWATCHES = 8
/**
 * Accent: a small but vivid colour (a blue eye on a brown ground). A hue family under
 * MIN_SHARE is still kept when at least ACCENT_MIN_SHARE of the picture is that hue at
 * Lab chroma ≥ ACCENT_CHROMA. Existence of the colour matters more than its area.
 */
const ACCENT_MIN_SHARE = 0.0015
const ACCENT_CHROMA = 35
const MAX_ACCENTS = 3
/** Lab chroma under which a pixel reads as neutral (black / grey / white). */
const NEUTRAL_CHROMA = 10

type Lab = [number, number, number]

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, c)) * 255)
}

const D65 = [0.95047, 1, 1.08883] as const
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116)
const fInv = (t: number) => (t * t * t > 216 / 24389 ? t * t * t : (116 * t - 16) / (24389 / 27))

function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / D65[0]
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / D65[1]
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / D65[2]
  const fx = f(x), fy = f(y), fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function labToHex([L, a, b]: Lab): string {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const x = fInv(fx) * D65[0], y = fInv(fy) * D65[1], z = fInv(fz) * D65[2]
  const R = x * 3.2406 + y * -1.5372 + z * -0.4986
  const G = x * -0.9689 + y * 1.8758 + z * 0.0415
  const B = x * 0.0557 + y * -0.204 + z * 1.057
  return '#' + [R, G, B].map((v) => linearToSrgb(v).toString(16).padStart(2, '0')).join('')
}

/** HSV hue in degrees (0–360). */
function hueOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return 0
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return h < 0 ? h + 360 : h
}

/**
 * HSV hue → painter's (red-yellow-blue) wheel. On the RGB wheel yellow sits at 60° and green
 * spans a wide arc; these bounds give each RYB family its usual look.
 */
const HUE_FAMILIES: [number, ColourFamily][] = [
  [8, 'red'], [20, 'red_orange'], [35, 'orange'], [48, 'yellow_orange'], [65, 'yellow'],
  [95, 'yellow_green'], [150, 'green'], [190, 'blue_green'], [235, 'blue'],
  [260, 'blue_violet'], [290, 'violet'], [345, 'red_violet'], [360, 'red'],
]

function familyOf(r: number, g: number, b: number, lab: Lab): ColourFamily {
  const [L, a, bb] = lab
  const chroma = Math.hypot(a, bb)
  if (chroma < NEUTRAL_CHROMA) return L < 22 ? 'black' : L > 82 ? 'white' : 'grey'
  const h = hueOf(r, g, b)
  const fam = HUE_FAMILIES.find(([max]) => h < max)?.[1] ?? 'red'
  // Earth tones: a dark red-orange → yellow-orange reads as brown.
  if ((fam === 'red_orange' || fam === 'orange' || fam === 'yellow_orange') && L < 45) return 'brown'
  return fam
}

/** Palette from raw image bytes (any format Sharp reads, AVIF included). */
export async function extractPalette(buf: Buffer): Promise<PaletteSwatch[]> {
  const { data, info } = await sharp(buf)
    .rotate()
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const groups = new Map<ColourFamily, { lab: Lab; chroma: number }[]>()
  let total = 0
  for (let i = 0; i + 2 < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const lab = rgbToLab(r, g, b)
    const fam = familyOf(r, g, b, lab)
    let list = groups.get(fam)
    if (!list) { list = []; groups.set(fam, list) }
    list.push({ lab, chroma: Math.hypot(lab[1], lab[2]) })
    total++
  }
  if (total === 0) return []

  const swatches: PaletteSwatch[] = []
  const accents: (PaletteSwatch & { vivid: number })[] = []
  const meanHex = (pick: { lab: Lab }[]) => {
    const mean: Lab = [0, 0, 0]
    for (const p of pick) { mean[0] += p.lab[0]; mean[1] += p.lab[1]; mean[2] += p.lab[2] }
    return labToHex([mean[0] / pick.length, mean[1] / pick.length, mean[2] / pick.length])
  }
  for (const [family, px] of groups) {
    const share = px.length / total
    if (share < MIN_SHARE) {
      if (family === 'black' || family === 'grey' || family === 'white') continue
      const vivid = px.filter((p) => p.chroma >= ACCENT_CHROMA)
      if (vivid.length / total < ACCENT_MIN_SHARE) continue
      accents.push({
        family,
        hex: meanHex(vivid),
        share: Math.round(share * 1000) / 1000,
        accent: true,
        vivid: vivid.length,
      })
      continue
    }
    // Representative shade: the more saturated half of the family (neutrals: all of it).
    const sorted = [...px].sort((p, q) => q.chroma - p.chroma)
    const pick = family === 'black' || family === 'grey' || family === 'white'
      ? sorted
      : sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)))
    swatches.push({ family, hex: meanHex(pick), share: Math.round(share * 1000) / 1000 })
  }
  const main = swatches.sort((a, b) => b.share - a.share).slice(0, MAX_SWATCHES)
  const extra = accents
    .sort((a, b) => b.vivid - a.vivid)
    .slice(0, MAX_ACCENTS)
    .map(({ vivid: _vivid, ...s }) => s)
  return [...main, ...extra]
}
