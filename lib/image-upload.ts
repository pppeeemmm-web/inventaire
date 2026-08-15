import crypto from 'crypto'
import sharp, { type Metadata } from 'sharp'

/** Sharp-reported format → safe storage extension + Content-Type for R2. */
const ALLOWED_FORMATS = new Map<
  string,
  { ext: string; mime: string }
>([
  ['jpeg', { ext: 'jpg', mime: 'image/jpeg' }],
  ['png', { ext: 'png', mime: 'image/png' }],
  ['webp', { ext: 'webp', mime: 'image/webp' }],
  ['gif', { ext: 'gif', mime: 'image/gif' }],
  ['avif', { ext: 'avif', mime: 'image/avif' }],
  ['heif', { ext: 'heic', mime: 'image/heic' }],
])

export type ValidatedWorkImage = { ext: string; mime: string }

/**
 * True when the bytes are already AVIF.
 *
 * libvips reports AVIF as HEIF carrying av1 compression, never as `'avif'`, so the
 * upload pass-throughs that tested `format === 'avif'` alone could not fire once:
 * every AVIF was re-encoded despite the optimisation being in place. Both upload
 * paths (session shot, work image) go through here so they cannot drift apart.
 */
export function isAvifBuffer(meta: Metadata): boolean {
  return meta.format === 'avif' || (meta.format === 'heif' && meta.compression === 'av1')
}

export type NormalizedAvifPair = { mainBuf: Buffer; thumbBuf: Buffer }

const AVIF_MAIN_OPTS = {
  quality: 50,
  effort: 4,
  chromaSubsampling: '4:4:4' as const,
}
const AVIF_THUMB_OPTS = {
  quality: 70,
  effort: 3,
  chromaSubsampling: '4:4:4' as const,
}

const TRANSPARENT_BG = { r: 0, g: 0, b: 0, alpha: 0 } as const

function imageExifTags(): { Artist: string; Copyright: string } {
  return {
    Artist: process.env.IMAGE_EXIF_ARTIST?.trim() || 'PierreEmmanuelMoulin',
    Copyright:
      process.env.IMAGE_EXIF_COPYRIGHT?.trim() ||
      '© PierreEmmanuelMoulin · pppeeemmm@gmail.com',
  }
}

/**
 * Resize + encode to AVIF (main + 400px thumb). Preserves alpha on PNG/WebP/GIF/AVIF inputs
 * via ensureAlpha and transparent resize background; opaque JPEG/HEIC get a fully-opaque alpha plane.
 */
export async function normalizeImageToAvifPair(
  buf: Buffer,
  opts: { maxEdge: number },
): Promise<NormalizedAvifPair> {
  const exif = imageExifTags()
  // Alpha plane only when the source actually has one: transparent PNG/WebP/AVIF
  // keep their transparency; opaque JPEG/HEIC/AVIF skip the (costly, inflating) plane.
  const { hasAlpha } = await sharp(buf).metadata()
  let pipeline = sharp(buf).rotate()
  if (hasAlpha) pipeline = pipeline.ensureAlpha()
  const mainBuf = await pipeline
    .resize({
      width: opts.maxEdge,
      height: opts.maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
      background: TRANSPARENT_BG,
    })
    .keepIccProfile()
    .withExif({ IFD0: exif })
    .avif(AVIF_MAIN_OPTS)
    .toBuffer()

  const thumbBuf = await makeAvifThumbFromMain(mainBuf)
  return { mainBuf, thumbBuf }
}

/** 400px long-edge AVIF thumb from an already-normalized main AVIF buffer. */
export async function makeAvifThumbFromMain(mainBuf: Buffer): Promise<Buffer> {
  const { hasAlpha } = await sharp(mainBuf).metadata()
  let pipeline = sharp(mainBuf)
  if (hasAlpha) pipeline = pipeline.ensureAlpha()
  return pipeline
    .resize({
      width: 400,
      height: 400,
      fit: 'inside',
      withoutEnlargement: true,
      background: TRANSPARENT_BG,
    })
    .avif(AVIF_THUMB_OPTS)
    .toBuffer()
}

/**
 * Decode bytes as an image and ensure format is allow-listed (magic bytes via Sharp).
 * Rejects SVG and other formats even if the client sends a permissive Content-Type.
 *
 * AVIF input is supported (Sharp/libheif). Upload paths use `normalizeImageToAvifPair` so
 * transparency survives main + thumb encoding. Mobile share may still reject some transparent files.
 */
export async function validateWorkImageBuffer(
  buf: Buffer,
): Promise<ValidatedWorkImage | { error: string }> {
  if (!buf?.length) return { error: 'Fichier vide.' }
  try {
    const meta = await sharp(buf).metadata()
    const fmt = meta.format
    if (!fmt || !ALLOWED_FORMATS.has(fmt)) {
      return {
        error:
          'Format image non autorisé (JPEG, PNG, WebP, GIF, AVIF ou HEIC uniquement).',
      }
    }
    const spec = ALLOWED_FORMATS.get(fmt)!
    return { ext: spec.ext, mime: spec.mime }
  } catch {
    return { error: 'Fichier image invalide ou corrompu.' }
  }
}

/**
 * Server-only: canonical R2 key for a work image (content hash + validated extension).
 * Pattern: W_{oid}_{seq:02}_{sha256-prefix8}.{ext}
 */
export function makeImageStorageFilename(
  oid: number,
  seq: number,
  contentBuf: Buffer,
  extWithoutDot: string,
): string {
  const seqStr = String(seq).padStart(2, '0')
  const hash8 = crypto.createHash('sha256').update(contentBuf).digest('hex').slice(0, 8)
  const safeExt = extWithoutDot.replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'jpg'
  return `W_${oid}_${seqStr}_${hash8}.${safeExt}`
}
