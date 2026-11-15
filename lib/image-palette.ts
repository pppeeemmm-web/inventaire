import sharp from 'sharp'

/**
 * Main colours of a work photo, by colour-wheel family (S6 / pic 9 "colour dropper").
 *
 * Owner's approach (2026-11-02): start from the painter's wheel — primary, secondary and
 * tertiary hues — then refine, rather than averaging clusters (averages missed a rust band,
 * and the greens and reds of #2366 altogether).
 *
 *  1. Every pixel goes into one family: the 12 hues of the red-yellow-blue wheel, or a neutral
 *     (black / grey / white) when it has little colour (Lab chroma < 10), or brown (a dark,
 *     less red warm tone — dark rust / brick / burnt sienna stays red-orange). Saturation is
 *     judged in CIE Lab (chroma), not RGB; only the hue angle comes from RGB.
 *  2. A family's share = its fraction of the image; every family ≥ MIN_SHARE is listed (no cap).
 *  3. Its swatch = the mean of its more saturated half (the colour you see, not a mud average).
 *
 *  4. Accents: a small vivid hue (under MIN_SHARE) is kept and flagged `accent`.
 *  5. Refine (2026-11-03): each main family records how much of it is a light shade
 *     (Lab L ≥ 65) and a dark one (L < 40) — `tones: [light, dark]` — so the filter can tell
 *     light blue from navy inside "blue".
 *
 *  Main colours, not area (Pem 2026-11-15, #2233 « black, grey, white and red »; TODO B9 #6,
 *  docs/TODO_NOTES.md « palette-main-colours »):
 *  6. White is judged against the picture: on a dark ground, chalk at L 65–80 is white, not
 *     light grey (neutral L ≥ max(65, median L + 30), and always above 82).
 *  7. In a near-neutral picture (≥ 90 % neutral pixels) a hue stands out at a lower chroma
 *     (QUIET_ACCENT_CHROMA), so a faint red in a grey work still counts.
 *  8. A small touch counts by its presence, not its exact hue: small hues are gathered by their
 *     main colour on Pem's wheel (red-orange, red-violet, dark red → red; brown → orange…) and kept as
 *     one accent of that colour, swatch = the average of its vivid pixels. Not in the border band
 *     of the shot (tape, table, wall).
 *  The sample is the 400 px thumb at full size (thin chalk lines blurred into grey at 160 px).
 *
 * Accuracy = the photo's own colours (Lightroom white balance / exposure); background, margin
 * or frame in the shot count too.
 */
// Type-only (erased at runtime), so `scripts/backfill-image-palette.mjs` can run this file in Node.
import type { ColourFamily, PaletteSwatch } from './colour-families'

export type { ColourFamily, PaletteSwatch }

// Same values as TONE_LIGHT_MIN / TONE_DARK_MAX in ./colour-families (value imports would break the
// Node backfill script, which can only take types from there).
const TONE_LIGHT_MIN = 65
const TONE_DARK_MAX = 40

/** The input is the 400 px thumb; read it whole (never enlarged). */
const SAMPLE_EDGE = 400
/** Families below this share of the image are left out — unless they qualify as an accent. */
const MIN_SHARE = 0.015
/**
 * Accent: a small but vivid colour (a blue eye on a brown ground). A hue family under
 * MIN_SHARE is still kept when at least ACCENT_MIN_SHARE of the picture is that hue at
 * Lab chroma ≥ ACCENT_CHROMA. Existence of the colour matters more than its area.
 */
const ACCENT_MIN_SHARE = 0.0015
const ACCENT_CHROMA = 35
const MAX_ACCENTS = 3
/** Dark warm pixel stays red-orange (rust) below this Lab hue angle and above this chroma. */
const RUST_HUE_MAX = 60
const RUST_CHROMA_MIN = 30
/** Lab chroma under which a pixel reads as neutral (black / grey / white). */
const NEUTRAL_CHROMA = 10
/** Neutral lightness: black under BLACK_L; white above WHITE_L, or relative to the picture (rule 6). */
const BLACK_L = 22
const WHITE_L = 82
const WHITE_REL_MIN_L = 65
const WHITE_REL_OFFSET = 30
/** Rule 7: a picture this neutral lowers the accent chroma to QUIET_ACCENT_CHROMA. */
const QUIET_NEUTRAL_SHARE = 0.9
const QUIET_ACCENT_CHROMA = 20
/**
 * Rule 8 — Pem's wheel (2026-11-15): red, yellow, blue; orange, green, violet where they meet;
 * an in-between hue is its primary with a lean — « primary always takes » (an orange-ish red is a
 * red, a greenish blue is a blue). Brown is a dark orange; a dark red filed as brown stays red.
 * Used to name small touches; main families keep their own names for now.
 */
const TOUCH_MAIN: Record<ColourFamily, ColourFamily> = {
  red: 'red', red_orange: 'red', red_violet: 'red', brown: 'orange',
  orange: 'orange',
  yellow_orange: 'yellow', yellow: 'yellow', yellow_green: 'yellow',
  green: 'green',
  blue_green: 'blue', blue: 'blue', blue_violet: 'blue',
  violet: 'violet',
  black: 'black', grey: 'grey', white: 'white',
}
const NEUTRALS = new Set<ColourFamily>(['black', 'grey', 'white'])
/** Rule 8: a touch in this border band of the shot is the setting, not the work (#1263's top edge). */
const TOUCH_EDGE_BAND = 0.03

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

function familyOf(r: number, g: number, b: number, lab: Lab, whiteMinL: number): ColourFamily {
  const [L, a, bb] = lab
  const chroma = Math.hypot(a, bb)
  if (chroma < NEUTRAL_CHROMA) return L < BLACK_L ? 'black' : L > whiteMinL ? 'white' : 'grey'
  const h = hueOf(r, g, b)
  const fam = HUE_FAMILIES.find(([max]) => h < max)?.[1] ?? 'red'
  // Dark warm tones: rust / brick / burnt sienna (reddish and saturated in Lab) stay red-orange;
  // the rest (sepia, umber, chocolate, dark wood) reads as brown. RGB hue alone put rust (~23°)
  // in orange → brown, so the red cloth of #2357 showed as brown.
  if ((fam === 'red_orange' || fam === 'orange' || fam === 'yellow_orange') && L < 45) {
    const hueAb = (Math.atan2(bb, a) * 180) / Math.PI
    return hueAb < RUST_HUE_MAX && chroma >= RUST_CHROMA_MIN ? 'red_orange' : 'brown'
  }
  return fam
}

/** Palette from raw image bytes (any format Sharp reads, AVIF included). */
export async function extractPalette(buf: Buffer): Promise<PaletteSwatch[]> {
  const { data, info } = await sharp(buf)
    .rotate()
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Pass 1: Lab of every pixel, the picture's median lightness and how neutral it is.
  // `edge`: in the border band of the shot (tape, table, wall) — never a touch (rule 8).
  const px: { r: number; g: number; b: number; lab: Lab; chroma: number; edge: boolean }[] = []
  const bandX = Math.max(2, Math.round(info.width * TOUCH_EDGE_BAND))
  const bandY = Math.max(2, Math.round(info.height * TOUCH_EDGE_BAND))
  for (let i = 0, k = 0; i + 2 < data.length; i += info.channels, k++) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const lab = rgbToLab(r, g, b)
    const x = k % info.width, y = Math.floor(k / info.width)
    const edge = x < bandX || y < bandY || x >= info.width - bandX || y >= info.height - bandY
    px.push({ r, g, b, lab, chroma: Math.hypot(lab[1], lab[2]), edge })
  }
  const total = px.length
  if (total === 0) return []
  const lights = px.map((p) => p.lab[0]).sort((a, b) => a - b)
  const medianL = lights[Math.floor(lights.length / 2)]
  // Rule 6: white relative to the picture (never stricter than the absolute WHITE_L).
  const whiteMinL = Math.min(WHITE_L, Math.max(WHITE_REL_MIN_L, medianL + WHITE_REL_OFFSET))
  // Rule 7: a near-neutral picture lets a fainter hue count as an accent.
  const neutralShare = px.filter((p) => p.chroma < NEUTRAL_CHROMA).length / total
  const accentChroma = neutralShare >= QUIET_NEUTRAL_SHARE ? QUIET_ACCENT_CHROMA : ACCENT_CHROMA

  // Pass 2: one family per pixel.
  const groups = new Map<ColourFamily, { lab: Lab; chroma: number; edge: boolean }[]>()
  for (const p of px) {
    const fam = familyOf(p.r, p.g, p.b, p.lab, whiteMinL)
    let list = groups.get(fam)
    if (!list) { list = []; groups.set(fam, list) }
    list.push({ lab: p.lab, chroma: p.chroma, edge: p.edge })
  }

  const swatches: PaletteSwatch[] = []
  const accents: (PaletteSwatch & { vivid: number })[] = []
  const meanHex = (pick: { lab: Lab }[]) => {
    const mean: Lab = [0, 0, 0]
    for (const p of pick) { mean[0] += p.lab[0]; mean[1] += p.lab[1]; mean[2] += p.lab[2] }
    return labToHex([mean[0] / pick.length, mean[1] / pick.length, mean[2] / pick.length])
  }
  // Refine step: how much of the family is a light or a dark shade (light blue vs navy).
  const tonesOf = (px: { lab: Lab }[]): [number, number] => {
    let light = 0
    let dark = 0
    for (const p of px) {
      if (p.lab[0] >= TONE_LIGHT_MIN) light++
      else if (p.lab[0] < TONE_DARK_MAX) dark++
    }
    return [Math.round((light / px.length) * 100) / 100, Math.round((dark / px.length) * 100) / 100]
  }
  // Small hues, gathered by their main colour on the wheel (rule 8).
  const touches = new Map<ColourFamily, { all: number; vivid: { lab: Lab }[] }>()
  for (const [family, fpx] of groups) {
    const share = fpx.length / total
    if (share < MIN_SHARE) {
      if (family === 'black' || family === 'grey' || family === 'white') continue
      for (const p of fpx) {
        if (p.edge) continue
        // Brown is a dark orange (Pem) — but a dark red filed as brown is still a red (#2233's red
        // is mostly that): split by Lab hue, like the rust rule in familyOf.
        const main = family === 'brown' && (Math.atan2(p.lab[2], p.lab[1]) * 180) / Math.PI < RUST_HUE_MAX
          ? 'red'
          : TOUCH_MAIN[family]
        let t = touches.get(main)
        if (!t) { t = { all: 0, vivid: [] }; touches.set(main, t) }
        t.all++
        if (p.chroma >= accentChroma) t.vivid.push(p)
      }
      continue
    }
    // Representative shade: the more saturated half of the family (neutrals: all of it).
    const sorted = [...fpx].sort((p, q) => q.chroma - p.chroma)
    const pick = family === 'black' || family === 'grey' || family === 'white'
      ? sorted
      : sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)))
    swatches.push({ family, hex: meanHex(pick), share: Math.round(share * 1000) / 1000, tones: tonesOf(fpx) })
  }
  // Rule 8: a touch is its presence, not its exact hue (#2233: red 0.23 % + red-orange 0.29 % +
  // dark red read as brown 0.36 % = « a touch of red »). Kept when enough of it is vivid, unless
  // that main colour is already one of the picture's main families; swatch = its vivid average.
  const present = new Set<ColourFamily>(
    swatches.filter((s) => s.family !== 'brown' && !NEUTRALS.has(s.family)).map((s) => TOUCH_MAIN[s.family]),
  )
  for (const [main, t] of touches) {
    if (present.has(main) || t.vivid.length / total < ACCENT_MIN_SHARE) continue
    accents.push({
      family: main,
      hex: meanHex(t.vivid),
      share: Math.round((t.all / total) * 1000) / 1000,
      accent: true,
      vivid: t.vivid.length,
    })
  }
  // No cap on main families: a family at ≥ MIN_SHARE is a real colour of the picture.
  const main = swatches.sort((a, b) => b.share - a.share)
  const extra = accents
    .sort((a, b) => b.vivid - a.vivid)
    .slice(0, MAX_ACCENTS)
    .map(({ vivid: _vivid, ...s }) => s)
  return [...main, ...extra]
}
