/** Client-side image prep and upload helpers (mobile field tool). */

import { surfaceWarn } from '@/lib/error-reporter/client'

export const MOBILE_MAX_IMAGE_EDGE_PX = 3000

/**
 * Re-encode above this even when the pixel count is already fine.
 *
 * A Server Action body travels through the Vercel function, which caps a request at
 * 4.5 MB — under `bodySizeLimit` in next.config.ts, and under what Lightroom exports.
 * Over the cap the platform answers with an HTML 413 and Next reports "An unexpected
 * response was received from the server" before any of our code runs. A 2100px AVIF
 * at export quality clears the old pixel-only test untouched and still weighs 5 MB,
 * which is exactly how a session photo was lost.
 */
export const MOBILE_MAX_UPLOAD_BYTES = 2_500_000

export function isNetworkishFailure(err: unknown): boolean {
  if (!navigator.onLine) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|networkerror|load failed|aborted/i.test(msg)
}

/**
 * Shrink a phone upload so it clears the request cap: re-encode when the longest
 * edge exceeds `maxEdge` **or** the file exceeds `maxBytes`, whichever bites first.
 *
 * WebP rather than JPEG: it is materially smaller at the same visual quality, so it
 * survives the round trip with less generation loss before the server encodes the
 * stored AVIF. This is transport only — what ends up in storage is the server's
 * normalised AVIF either way.
 *
 * A file already inside both budgets is returned untouched, so nothing lean is
 * re-encoded for no reason. Returns the original on any failure.
 */
export async function downscaleImageFileForMobileIfNeeded(
  file: File,
  narrow: boolean,
  maxEdge: number = MOBILE_MAX_IMAGE_EDGE_PX,
  maxBytes: number = MOBILE_MAX_UPLOAD_BYTES,
): Promise<File> {
  if (!narrow || !file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  if (file.type === 'image/gif') return file // animated: a canvas redraw would flatten it
  let bmp: ImageBitmap | null = null
  try {
    bmp = await createImageBitmap(file)
    const w = bmp.width
    const h = bmp.height
    const longest = Math.max(w, h)
    const tooWide = longest > maxEdge
    const tooHeavy = file.size > maxBytes
    if (!tooWide && !tooHeavy) {
      bmp.close()
      return file
    }
    const scale = tooWide ? maxEdge / longest : 1
    const nw = Math.max(1, Math.round(w * scale))
    const nh = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = nw
    canvas.height = nh
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bmp.close()
      return file
    }
    ctx.drawImage(bmp, 0, 0, nw, nh)
    bmp.close()
    bmp = null

    const encode = (mime: string, quality?: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), mime, quality))

    // PNG only stays PNG when it is merely oversized; a heavy PNG has to change
    // codec to lose weight at all.
    const keepPng = file.type === 'image/png' && !tooHeavy
    let blob = keepPng ? await encode('image/png') : await encode('image/webp', 0.82)
    let ext = keepPng ? 'png' : 'webp'
    // Safari only gained canvas WebP output in 14; fall back rather than give up.
    if (!blob || (!keepPng && blob.type !== 'image/webp')) {
      blob = await encode('image/jpeg', 0.85)
      ext = 'jpg'
    }
    // Re-encoding an AVIF to WebP can come out *larger* — measured at 133% of the
    // source on a canvas-like image. Over budget that is not acceptable, so trade
    // quality until it fits rather than send something certain to be rejected.
    if (blob && blob.size > maxBytes) {
      const leaner = await encode('image/jpeg', 0.7)
      if (leaner && leaner.size < blob.size) {
        blob = leaner
        ext = 'jpg'
      }
    }
    if (!blob) return file
    // Keep the original only when it is both smaller and already within budget:
    // above the cap the original is a guaranteed 413, so the bigger re-encode is
    // still the better of two bad options.
    if (blob.size >= file.size && file.size <= maxBytes) return file
    const base = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${base}.${ext}`, { type: blob.type })
  } catch (err) {
    if (bmp) bmp.close()
    surfaceWarn('Image downscale skipped; using original file', err, {
      source: 'image-upload-client.downscaleImageFileForMobileIfNeeded',
    })
    return file
  }
}

export function startEstimatedUploadProgress(
  fileSize: number,
  onTick: (p: number) => void,
): () => void {
  const estMs = Math.min(90_000, Math.max(600, fileSize / 8000))
  const start = Date.now()
  const id = window.setInterval(() => {
    const elapsed = Date.now() - start
    const t = Math.min(1, elapsed / estMs)
    onTick(Math.min(0.92, t * 0.92))
  }, 100)
  return () => window.clearInterval(id)
}

export async function withUploadRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxExtraAttempts?: number; isRetryable?: (err: unknown) => boolean; onRetry?: () => void },
): Promise<T> {
  const maxExtra = opts?.maxExtraAttempts ?? 1
  const retryable = opts?.isRetryable ?? isNetworkishFailure
  const onRetry = opts?.onRetry
  let last: unknown
  for (let attempt = 0; attempt <= maxExtra; attempt++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (attempt < maxExtra && retryable(e)) {
        onRetry?.()
        continue
      }
      throw e
    }
  }
  throw last
}
