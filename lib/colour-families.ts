/** Colour-wheel families used by work palettes (`lib/image-palette.ts`) and the colour filter. Browser-safe. */
export const COLOUR_FAMILIES = [
  'red', 'red_orange', 'orange', 'yellow_orange', 'yellow', 'yellow_green',
  'green', 'blue_green', 'blue', 'blue_violet', 'violet', 'red_violet',
  'brown', 'black', 'grey', 'white',
] as const
export type ColourFamily = (typeof COLOUR_FAMILIES)[number]

/** Shade inside a family, from CIE Lab lightness (owner's "refine" step, 2026-11-03). */
export type ColourTone = 'light' | 'dark'
/** Lab L at or above which a pixel is a light shade; below `TONE_DARK_MAX` a dark one; mid otherwise. */
export const TONE_LIGHT_MIN = 65
export const TONE_DARK_MAX = 40

/**
 * `accent`: a small but vivid colour kept below the usual share threshold.
 * `tones`: fraction of this family's pixels that are light / dark ([light, dark], the rest is mid).
 */
export type PaletteSwatch = {
  hex: string
  share: number
  family: ColourFamily
  accent?: boolean
  tones?: [number, number]
}
