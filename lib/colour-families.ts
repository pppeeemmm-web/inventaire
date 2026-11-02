/** Colour-wheel families used by work palettes (`lib/image-palette.ts`) and the colour filter. Browser-safe. */
export const COLOUR_FAMILIES = [
  'red', 'red_orange', 'orange', 'yellow_orange', 'yellow', 'yellow_green',
  'green', 'blue_green', 'blue', 'blue_violet', 'violet', 'red_violet',
  'brown', 'black', 'grey', 'white',
] as const
export type ColourFamily = (typeof COLOUR_FAMILIES)[number]

/** `accent`: a small but vivid colour kept below the usual share threshold. */
export type PaletteSwatch = { hex: string; share: number; family: ColourFamily; accent?: boolean }
