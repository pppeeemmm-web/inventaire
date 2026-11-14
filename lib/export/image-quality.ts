/**
 * Export image quality (owner 2026-11-14): destination (screen / print, independent of PDF / HTML),
 * density (72 / 150 / 300 dpi), colour or black & white, and the image size each layout prints —
 * card images follow the cards per page. Browser-safe: the dialog shows the pixel size, the server
 * (`app/atelier/selection/actions.ts`) cuts each image to it and draws with the same boxes.
 */

import type { ExportConfig, ExportFields } from '@/app/atelier/selection/actions'

export type ExportDpi = 72 | 150 | 300
export type ExportColour = 'colour' | 'mono' | 'light'
export type ExportDestination = 'screen' | 'print'

export const EXPORT_DPIS: readonly ExportDpi[] = [72, 150, 300]
/** Used when a saved setup predates the setting. 150 keeps Grid as it was (~144 dpi). */
export const DEFAULT_EXPORT_DPI: ExportDpi = 150
/** Picking a destination sets this density (it can still be changed afterwards). */
export const DPI_FOR_DESTINATION: Record<ExportDestination, ExportDpi> = { screen: 72, print: 300 }
/** Light black & white: tones scaled to 65 % (the darkest prints as a 65 % grey) — measured
 *  ~35 % less image ink on 6 works, 2026-11-14 (owner: ink saving). */
export const LIGHT_TONE = 0.65
/** Stored thumbnails: 400 px on the long edge (`lib/image-upload.ts`). */
export const THUMB_EDGE = 400

type Cfg = Pick<ExportConfig, 'format' | 'layout' | 'paper' | 'orientation' | 'imageSize' | 'imageCrop' | 'cardsPerPage' | 'rowsPerPage' | 'fields' | 'dpi' | 'colour' | 'destination'>

export function destinationOf(cfg: Pick<ExportConfig, 'destination' | 'format'>): ExportDestination {
  return cfg.destination ?? (cfg.format === 'pdf' ? 'print' : 'screen')
}
export function dpiOf(cfg: Pick<ExportConfig, 'dpi'>): ExportDpi {
  return cfg.dpi && EXPORT_DPIS.includes(cfg.dpi) ? cfg.dpi : DEFAULT_EXPORT_DPI
}
export function colourOf(cfg: Pick<ExportConfig, 'colour'>): ExportColour {
  return cfg.colour === 'mono' || cfg.colour === 'light' ? cfg.colour : 'colour'
}

/** PDF: points (1/72 in) → image pixels. */
export function pxFromPt(pt: number, dpi: ExportDpi): number {
  return Math.max(1, Math.round((pt * dpi) / 72))
}
/** HTML: CSS pixels → image pixels. 72 = one image pixel per screen pixel, 150 = 2× (sharp on
 *  phones / Retina), 300 = print (a CSS pixel is 1/96 in on paper). */
export function pxFromCss(css: number, dpi: ExportDpi): number {
  const scale = dpi === 72 ? 1 : dpi === 150 ? 2 : 300 / 96
  return Math.max(1, Math.round(css * scale))
}

/** Page in points; HTML on screen uses A4 portrait as its baseline (as the grid columns did). */
export function exportPage(cfg: Pick<ExportConfig, 'paper' | 'orientation'>): { PW: number; PH: number; margin: number; usable: number } {
  const a3 = cfg.paper === 'a3'
  const pw = a3 ? 841 : 595
  const ph = a3 ? 1189 : 842
  const land = cfg.orientation === 'landscape'
  const PW = land ? ph : pw
  const PH = land ? pw : ph
  const margin = 50
  return { PW, PH, margin, usable: PW - margin * 2 }
}

/** Contact sheet geometry (PDF), unchanged from the original drawing code. */
export function gridGeometry(cfg: Cfg) {
  const { PH, margin, usable } = exportPage(cfg)
  const f = cfg.fields
  const rows = Math.max(1, cfg.rowsPerPage > 0 ? cfg.rowsPerPage : 4)
  const gap = 8
  const rowGap = 16
  const activeMetaCount = [f.year, f.technique, f.support, f.dims, f.price].filter(Boolean).length
  const textH = (f.title ? 12 : 0) + (f.id ? 10 : 0) + activeMetaCount * 8 + 4
  const availH = PH - margin * 2 - 60
  const cellH = Math.floor((availH - rowGap * (rows - 1)) / rows)
  const imgH = cfg.imageSize !== 'none' ? Math.max(20, cellH - textH - 3) : 0
  const cols = Math.max(1, Math.floor((usable + gap) / (imgH > 0 ? imgH + gap : cellH + gap)))
  const cellW = (usable - gap * (cols - 1)) / cols
  return { rows, cols, gap, rowGap, textH, cellH, imgH, cellW }
}

/** Height of a PDF card's text block for the ticked fields (non-public line not counted). */
export function cardTextHeight(f: ExportFields): number {
  return (f.title ? 20 : 0) + (f.year ? 13 : 0) + (f.technique || f.support ? 12 : 0) + (f.dims ? 12 : 0)
    + (f.price ? 12 : 0) + (f.status ? 12 : 0) + (f.id ? 10 : 0)
}

/**
 * Card image side in points, from the cards per page: each card gets 1/n of the page height.
 * Grande fills its slot (the page width at 1 per page, text below; otherwise up to 60 % of the
 * width, text beside); Petite is 60 % of Grande.
 */
export function cardImageBox(cfg: Cfg): { side: number; below: boolean; textH: number } {
  const textH = cardTextHeight(cfg.fields)
  if (!cfg.fields.image || cfg.imageSize === 'none') return { side: 0, below: false, textH }
  const { PH, margin, usable } = exportPage(cfg)
  const avail = PH - margin * 2 - 60 // first card at margin + 40, page ends at PH - margin - 20
  const n = Math.max(1, cfg.cardsPerPage ?? 1)
  const slot = avail / n - 24 // 24 = space between cards
  const besideCap = usable * 0.6
  const large = Math.max(40, Math.floor(n === 1 ? Math.min(usable, slot - textH - 12) : Math.min(besideCap, slot)))
  const side = cfg.imageSize === 'large' ? large : Math.max(40, Math.round(large * 0.6))
  return { side, below: side > besideCap + 1, textH }
}

/** HTML grid columns, from the rows per page on an A4 baseline (unchanged rule). */
export function htmlGridCols(cfg: Cfg): number {
  const r = cfg.rowsPerPage > 0 ? cfg.rowsPerPage : 4
  const { PW, PH } = exportPage(cfg)
  const usableW = PW - 100
  const availH = PH - 100 - 60
  const cellH = Math.floor((availH - 16 * (r - 1)) / r)
  const imgH = Math.max(20, cellH - 30)
  return Math.max(1, Math.floor((usableW + 8) / (imgH + 8)))
}

/** HTML card image side in CSS px: on screen today's 320 / 160; for print, the PDF card size. */
export function htmlCardSideCss(cfg: Cfg): { side: number; below: boolean } {
  if (destinationOf(cfg) === 'print') {
    const b = cardImageBox(cfg)
    return { side: Math.round((b.side * 96) / 72), below: b.below }
  }
  return { side: cfg.imageSize === 'large' ? 320 : 160, below: false }
}

/** Width of one HTML grid cell in CSS px: a 1280 px screen (body padding 2 × 80) or the printed page. */
export function htmlGridCellCss(cfg: Cfg): number {
  const base = destinationOf(cfg) === 'print' ? (exportPage(cfg).usable * 96) / 72 : 1120
  return Math.round(base / htmlGridCols(cfg))
}

/** The space an image takes: points on a PDF page, CSS pixels in HTML. Resolution never changes it. */
export type ImageFrame = { w: number; h: number; unit: 'pt' | 'css' }

export function exportImageFrame(cfg: Cfg): ImageFrame | null {
  if (!cfg.fields.image || cfg.imageSize === 'none' || cfg.layout === 'labels') return null
  if (cfg.format === 'pdf') {
    if (cfg.layout === 'list') return null // the PDF quick list prints no image
    if (cfg.layout === 'grid') {
      const g = gridGeometry(cfg)
      return g.imgH > 0 ? { w: g.cellW, h: g.imgH, unit: 'pt' } : null
    }
    const c = cardImageBox(cfg)
    return c.side > 0 ? { w: c.side, h: c.side, unit: 'pt' } : null
  }
  const css = cfg.layout === 'list' ? 48 : cfg.layout === 'grid' ? htmlGridCellCss(cfg) : htmlCardSideCss(cfg).side
  return { w: css, h: css, unit: 'css' }
}

/** Frame size on paper in cm (PDF, or HTML meant for print); null for HTML on screen (CSS px). */
export function frameCm(frame: ImageFrame, cfg: Pick<ExportConfig, 'destination' | 'format'>): { w: number; h: number } | null {
  if (frame.unit === 'pt') return { w: (frame.w / 72) * 2.54, h: (frame.h / 72) * 2.54 }
  if (destinationOf(cfg) === 'print') return { w: (frame.w / 96) * 2.54, h: (frame.h / 96) * 2.54 }
  return null
}

export type ImageTarget = { w: number; h: number; fit: 'cover' | 'inside' }

/** Pixels each image needs in this export (its frame at the chosen dpi), or null when it prints none. */
export function exportImageTarget(cfg: Cfg): ImageTarget | null {
  const frame = exportImageFrame(cfg)
  if (!frame) return null
  const dpi = dpiOf(cfg)
  const fit = cfg.layout === 'list' && cfg.format === 'html' ? 'cover' : cfg.imageCrop === 'native' ? 'inside' : 'cover'
  const px = (v: number) => (frame.unit === 'pt' ? pxFromPt(v, dpi) : pxFromCss(v, dpi))
  return { w: px(frame.w), h: px(frame.h), fit }
}
