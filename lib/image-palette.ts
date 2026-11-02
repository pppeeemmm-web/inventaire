import sharp from 'sharp'

/**
 * Main colours of a work photo (S6 / pic 9 "colour dropper").
 *
 * k-means in CIELAB (perceptual distance) on a 64px copy of the image. Deterministic:
 * the seeds are picked farthest-first from the most common colour, so the same file
 * always gives the same palette. Accuracy = the photo's own colours (white balance and
 * exposure from Lightroom); any wall / margin / frame in the shot counts too.
 */
export type PaletteSwatch = { hex: string; share: number }

const SAMPLE_EDGE = 64
const DEFAULT_K = 12
/** Swatches kept after merging, largest first. */
const MAX_SWATCHES = 6
const ITERATIONS = 12
/** Clusters below this share of the image are dropped (noise, specks). */
const MIN_SHARE = 0.02
/** CIELAB ΔE below which two clusters are shades of one colour family and get merged. */
const SAME_FAMILY_DE = 14

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

function dist2(p: Lab, q: Lab): number {
  const d0 = p[0] - q[0], d1 = p[1] - q[1], d2 = p[2] - q[2]
  return d0 * d0 + d1 * d1 + d2 * d2
}

/** Palette from raw image bytes (any format Sharp reads, AVIF included). */
export async function extractPalette(buf: Buffer, k = DEFAULT_K): Promise<PaletteSwatch[]> {
  const { data, info } = await sharp(buf)
    .rotate()
    .resize(SAMPLE_EDGE, SAMPLE_EDGE, { fit: 'inside' })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pts: Lab[] = []
  for (let i = 0; i + 2 < data.length; i += info.channels) pts.push(rgbToLab(data[i], data[i + 1], data[i + 2]))
  if (pts.length === 0) return []

  // Seeds: the point nearest the mean, then farthest-first (deterministic k-means++ variant).
  const mean: Lab = [0, 0, 0]
  for (const p of pts) { mean[0] += p[0]; mean[1] += p[1]; mean[2] += p[2] }
  mean[0] /= pts.length; mean[1] /= pts.length; mean[2] /= pts.length
  let first = 0
  for (let i = 1; i < pts.length; i++) if (dist2(pts[i], mean) < dist2(pts[first], mean)) first = i
  const centers: Lab[] = [[...pts[first]] as Lab]
  const nearest = pts.map((p) => dist2(p, centers[0]))
  while (centers.length < Math.min(k, pts.length)) {
    let far = 0
    for (let i = 1; i < pts.length; i++) if (nearest[i] > nearest[far]) far = i
    if (nearest[far] === 0) break
    centers.push([...pts[far]] as Lab)
    for (let i = 0; i < pts.length; i++) nearest[i] = Math.min(nearest[i], dist2(pts[i], centers[centers.length - 1]))
  }

  const assign = new Int32Array(pts.length)
  for (let it = 0; it < ITERATIONS; it++) {
    for (let i = 0; i < pts.length; i++) {
      let best = 0
      for (let c = 1; c < centers.length; c++) if (dist2(pts[i], centers[c]) < dist2(pts[i], centers[best])) best = c
      assign[i] = best
    }
    const sums = centers.map(() => [0, 0, 0, 0])
    for (let i = 0; i < pts.length; i++) {
      const s = sums[assign[i]]
      s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; s[3] += 1
    }
    for (let c = 0; c < centers.length; c++) {
      if (sums[c][3] > 0) centers[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]]
    }
  }

  const counts: number[] = new Array(centers.length).fill(0)
  for (let i = 0; i < pts.length; i++) counts[assign[i]]++

  // k-means splits one painted area into several shades (a rust band came out as four ~3 %
  // oranges and fell below the cut while five blues took every slot). Merge the closest pair
  // of clusters, repeatedly, while they are still the same colour family — so each family is
  // ranked by its whole area.
  const merged = centers
    .map((c, i) => ({ c, n: counts[i] }))
    .filter((m) => m.n > 0)
  for (;;) {
    let bi = -1, bj = -1, best = SAME_FAMILY_DE * SAME_FAMILY_DE
    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const d = dist2(merged[i].c, merged[j].c)
        if (d < best) { best = d; bi = i; bj = j }
      }
    }
    if (bi < 0) break
    const a = merged[bi], b = merged[bj], n = a.n + b.n
    a.c = [0, 1, 2].map((d) => (a.c[d] * a.n + b.c[d] * b.n) / n) as Lab
    a.n = n
    merged.splice(bj, 1)
  }
  return merged
    .map(({ c, n }) => ({ hex: labToHex(c), share: Math.round((n / pts.length) * 1000) / 1000 }))
    .filter((s) => s.share >= MIN_SHARE)
    .sort((a, b) => b.share - a.share)
    .slice(0, MAX_SWATCHES)
}
