/**
 * Physical cm → on-screen pixels for artworks.
 * Used by public Works carousel and Atelier Themes mosaic preview.
 */

export const CANVAS_REF_CM_DESKTOP = 70
export const CANVAS_REF_CM_MOBILE = 110
/** 1.0 = true linear area; lower values compress small/large spread. */
export const SIZE_COMPRESSION_DESKTOP = 0.88
export const SIZE_COMPRESSION_MOBILE = 0.78
/** Floor as a fraction of the viewport card — lower = more realistic small works. */
export const MIN_AREA_FRACTION_DESKTOP = 0.05
export const MIN_AREA_FRACTION_MOBILE = 0.1

export type PhysicalDisplayOverrides = {
  cardW?: number
  cardH?: number
  refCm?: number
  compressionExp?: number
  minAreaFraction?: number
}

/** Parse Hauteur / Largeur text (supports "70,5" and "70 cm"). */
export function parseDimensionCm(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).trim().replace(/\s*cm\s*/gi, '').replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function worksCardViewport(isMobile: boolean): { cardW: number; cardH: number } {
  if (typeof window === 'undefined') return { cardW: 400, cardH: 460 }
  return {
    cardW: isMobile ? Math.min(window.innerWidth * 0.86, 520) : Math.min(window.innerWidth * 0.25, 400),
    cardH: isMobile ? Math.min(window.innerHeight * 0.54, 540) : Math.min(window.innerHeight * 0.42, 460),
  }
}

/**
 * Largest recorded cm edge in a set — used so the biggest work in a mosaic fills its tile.
 */
export function collectionRefCm(
  dims: ReadonlyArray<{ hauteurCm: number | null; largeurCm: number | null }>,
  fallback = CANVAS_REF_CM_DESKTOP,
): number {
  let max = 0
  for (const d of dims) {
    if (d.hauteurCm != null) max = Math.max(max, d.hauteurCm)
    if (d.largeurCm != null) max = Math.max(max, d.largeurCm)
  }
  return max > 0 ? max : fallback
}

/**
 * 0.12–1 scale for artwork inside a square tile (linear vs collection ref).
 */
export function mosaicArtScaleFactor(
  hauteurCm: number | null,
  largeurCm: number | null,
  refCm: number,
): number {
  if (!refCm || refCm <= 0) return 0.55
  const h = hauteurCm ?? 0
  const l = largeurCm ?? 0
  if (h <= 0 && l <= 0) return 0.55
  const dominant = Math.max(h, l)
  return Math.max(0.12, Math.min(1, dominant / refCm))
}

export function physicalArtDisplaySize(
  hauteurCm: number,
  largeurCm: number,
  isMobile: boolean,
  naturalW?: number,
  naturalH?: number,
  overrides?: PhysicalDisplayOverrides,
): { w: number; h: number } {
  const { cardW, cardH } = worksCardViewport(isMobile)
  const viewportW = overrides?.cardW ?? cardW
  const viewportH = overrides?.cardH ?? cardH
  const refCm =
    overrides?.refCm ?? (isMobile ? CANVAS_REF_CM_MOBILE : CANVAS_REF_CM_DESKTOP)
  const compressionExp =
    overrides?.compressionExp ??
    (isMobile ? SIZE_COMPRESSION_MOBILE : SIZE_COMPRESSION_DESKTOP)
  const minFraction =
    overrides?.minAreaFraction ??
    (isMobile ? MIN_AREA_FRACTION_MOBILE : MIN_AREA_FRACTION_DESKTOP)

  const pxPerCm = viewportH / refCm
  const linearW = largeurCm * pxPerCm
  const linearH = hauteurCm * pxPerCm
  const linearArea = linearW * linearH
  const refAreaPx = (refCm * pxPerCm) * (refCm * pxPerCm)
  const unit = linearArea / refAreaPx
  let targetArea = refAreaPx * Math.pow(Math.max(unit, 1e-6), compressionExp)
  const minArea = viewportW * viewportH * minFraction
  if (targetArea < minArea) targetArea = minArea

  const aspect =
    naturalW && naturalH && naturalW > 0 && naturalH > 0
      ? naturalW / naturalH
      : largeurCm / hauteurCm

  let h = Math.sqrt(targetArea / aspect)
  let w = h * aspect
  const capScale = Math.min(1, viewportW / w, viewportH / h)
  return { w: Math.round(w * capScale), h: Math.round(h * capScale) }
}
