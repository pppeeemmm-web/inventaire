/** Client-side image prep and upload helpers (mobile field tool). */

export const MOBILE_MAX_IMAGE_EDGE_PX = 3000

export function isNetworkishFailure(err: unknown): boolean {
  if (!navigator.onLine) return true
  const msg = err instanceof Error ? err.message : String(err)
  return /failed to fetch|networkerror|load failed|aborted/i.test(msg)
}

/**
 * If longest edge exceeds maxEdge, redraw to JPEG (or PNG if input was PNG without downscale need).
 * Returns original file when no resize needed or on failure.
 */
export async function downscaleImageFileForMobileIfNeeded(
  file: File,
  narrow: boolean,
  maxEdge: number = MOBILE_MAX_IMAGE_EDGE_PX,
): Promise<File> {
  if (!narrow || !file.type.startsWith('image/') || file.type === 'image/svg+xml') return file
  let bmp: ImageBitmap | null = null
  try {
    bmp = await createImageBitmap(file)
    const w = bmp.width
    const h = bmp.height
    const longest = Math.max(w, h)
    if (longest <= maxEdge) {
      bmp.close()
      return file
    }
    const scale = maxEdge / longest
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
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const quality = mime === 'image/jpeg' ? 0.9 : undefined
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, quality),
    )
    if (!blob) return file
    const base = file.name.replace(/\.[^.]+$/, '')
    const ext = mime === 'image/png' ? 'png' : 'jpg'
    return new File([blob], `${base}.${ext}`, { type: mime })
  } catch {
    if (bmp) bmp.close()
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
