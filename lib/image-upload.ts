import crypto from 'crypto'
import sharp from 'sharp'

/** Sharp-reported format → safe storage extension + Content-Type for R2. */
const ALLOWED_FORMATS = new Map<
  string,
  { ext: string; mime: string }
>([
  ['jpeg', { ext: 'jpg', mime: 'image/jpeg' }],
  ['png', { ext: 'png', mime: 'image/png' }],
  ['webp', { ext: 'webp', mime: 'image/webp' }],
  ['gif', { ext: 'gif', mime: 'image/gif' }],
])

export type ValidatedWorkImage = { ext: string; mime: string }

/**
 * Decode bytes as an image and ensure format is allow-listed (magic bytes via Sharp).
 * Rejects SVG and other formats even if the client sends a permissive Content-Type.
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
          'Format image non autorisé (JPEG, PNG, WebP ou GIF uniquement).',
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
