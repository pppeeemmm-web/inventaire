/**
 * Colour filter over each work's cover-image palette (`tblImage.palette`, see `lib/image-palette.ts`).
 * Pure functions, shared by Inventory and the drawer's swatch → filter link.
 *
 * - A colour counts as present from PRESENT_MIN of the picture, or when the palette flags it as an
 *   accent (small but vivid, e.g. a blue eye) — a dull speck does not match.
 * - Included colours must all be present; excluded colours must all be absent.
 * - "Nearby shades" widens each colour to its wheel neighbours (orange → red-orange, yellow-orange,
 *   brown), catching boundary colours such as rust.
 * - Match score = how much of the picture the chosen colours cover.
 * - Refine (2026-11-03): an included colour can be narrowed to its light or dark shades
 *   (`tones` on each palette swatch); the colour then counts only for that part of it.
 * - Monochrome = share of the dominant hue among all hues (with its neighbours when "nearby
 *   shades" is on); a picture with almost no hue (greys, black, white) counts as monochrome.
 */
import { COLOUR_FAMILIES, type ColourFamily, type ColourTone } from '@/lib/colour-families'

export const PRESENT_MIN = 0.03
export const MAX_INCLUDED = 5
/** Below this much hue the picture counts as achromatic (greyscale) → monochrome. */
const ACHROMATIC_MAX = 0.1

const WHEEL: ColourFamily[] = [
  'red', 'red_orange', 'orange', 'yellow_orange', 'yellow', 'yellow_green',
  'green', 'blue_green', 'blue', 'blue_violet', 'violet', 'red_violet',
]
const HUES = new Set<ColourFamily>([...WHEEL, 'brown'])

/** Chip colour per family (a typical tone, not a measured one). */
export const FAMILY_SWATCH: Record<ColourFamily, string> = {
  red: '#c8302c', red_orange: '#d9542a', orange: '#e8862a', yellow_orange: '#efad2e',
  yellow: '#ecd23a', yellow_green: '#a6c23c', green: '#4f9a48', blue_green: '#2f9488',
  blue: '#3266b8', blue_violet: '#4f4aa8', violet: '#7f4aa0', red_violet: '#a8386f',
  brown: '#7a4a2a', black: '#141414', grey: '#8a8a8a', white: '#f2f0ea',
}

export const FILTER_FAMILIES: readonly ColourFamily[] = COLOUR_FAMILIES

function neighbours(f: ColourFamily): ColourFamily[] {
  const i = WHEEL.indexOf(f)
  if (i >= 0) {
    const n = [WHEEL[(i + WHEEL.length - 1) % WHEEL.length], WHEEL[(i + 1) % WHEEL.length]]
    if (f === 'red_orange' || f === 'orange' || f === 'yellow_orange') n.push('brown')
    return n
  }
  if (f === 'brown') return ['red_orange', 'orange', 'yellow_orange']
  if (f === 'grey') return ['black', 'white']
  if (f === 'black' || f === 'white') return ['grey']
  return []
}

export function familyGroup(f: ColourFamily, nearby: boolean): ColourFamily[] {
  return nearby ? [f, ...neighbours(f)] : [f]
}

/** Family → share of the picture, from a palette row (unknown families ignored). */
export type FamilyShares = Partial<Record<ColourFamily, number>>
/** `s`: shares; `a`: accent families (small but vivid); `t`: [light, dark] fractions per family.
 *  Compact: sent for the whole catalogue. */
export type ColourProfile = { s: FamilyShares; a?: ColourFamily[]; t?: Partial<Record<ColourFamily, [number, number]>> }

export function toColourProfile(palette: unknown): ColourProfile | null {
  if (!Array.isArray(palette)) return null
  const s: FamilyShares = {}
  const a: ColourFamily[] = []
  const t: Partial<Record<ColourFamily, [number, number]>> = {}
  for (const sw of palette as { family?: unknown; share?: unknown; accent?: unknown; tones?: unknown }[]) {
    if (typeof sw?.family !== 'string' || typeof sw.share !== 'number') continue
    if (!(COLOUR_FAMILIES as readonly string[]).includes(sw.family)) continue
    const f = sw.family as ColourFamily
    s[f] = (s[f] ?? 0) + sw.share
    if (sw.accent === true) a.push(f)
    if (Array.isArray(sw.tones) && typeof sw.tones[0] === 'number' && typeof sw.tones[1] === 'number') {
      t[f] = [sw.tones[0], sw.tones[1]]
    }
  }
  const out: ColourProfile = { s }
  if (a.length) out.a = a
  if (Object.keys(t).length) out.t = t
  return out
}

/** Share of the picture covered by the light (or dark) shades of these families. Families
 *  without tone data (palette computed before the refine step) count for nothing. */
function toneCoverage(p: ColourProfile, fams: Iterable<ColourFamily>, tone: ColourTone): number {
  let sum = 0
  for (const f of new Set(fams)) {
    const tt = p.t?.[f]
    if (!tt) continue
    sum += (p.s[f] ?? 0) * (tone === 'light' ? tt[0] : tt[1])
  }
  return sum
}

function coverage(shares: FamilyShares, fams: Iterable<ColourFamily>): number {
  let sum = 0
  for (const f of new Set(fams)) sum += shares[f] ?? 0
  return sum
}

export type ColourQuery = {
  include: ColourFamily[]
  exclude: ColourFamily[]
  nearby: boolean
  /** Refine: an included family narrowed to its light or dark shades. Missing = any shade. */
  tones?: Partial<Record<ColourFamily, ColourTone>>
}

function present(p: ColourProfile, group: ColourFamily[]): boolean {
  return coverage(p.s, group) >= PRESENT_MIN || group.some((f) => p.a?.includes(f))
}

/** null = no match; otherwise the share of the picture the included colours cover (0 when none chosen). */
export function matchScore(p: ColourProfile, q: ColourQuery): number | null {
  for (const f of q.exclude) {
    if (present(p, familyGroup(f, q.nearby))) return null
  }
  const union: ColourFamily[] = []
  let toned = 0
  for (const f of q.include) {
    const g = familyGroup(f, q.nearby)
    const tone = q.tones?.[f]
    if (tone) {
      const c = toneCoverage(p, g, tone)
      if (c < PRESENT_MIN) return null
      toned += c
      continue
    }
    if (!present(p, g)) return null
    union.push(...g)
  }
  return coverage(p.s, union) + toned
}

/**
 * `purity`: share of the dominant hue (with its wheel neighbours when `nearby`) among all hues;
 * 1 for a picture with almost no hue. `strength`: how much of the picture that hue covers —
 * the tie-break, so a strong one-colour work ranks before a greyscale one.
 */
export function monochromeScore(shares: FamilyShares, nearby: boolean): { purity: number; strength: number } {
  let hueTotal = 0
  for (const f of HUES) hueTotal += shares[f] ?? 0
  if (hueTotal < ACHROMATIC_MAX) return { purity: 1, strength: 0 }
  let best = 0
  for (const f of HUES) {
    const c = coverage(shares, familyGroup(f, nearby).filter((x) => HUES.has(x)))
    if (c > best) best = c
  }
  return { purity: Math.min(1, best / hueTotal), strength: best }
}

export function isColourQueryActive(q: ColourQuery): boolean {
  return q.include.length > 0 || q.exclude.length > 0
}
