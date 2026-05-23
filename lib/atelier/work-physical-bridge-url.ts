/** Absolute URL encoded on work QR labels (scan → open in Atelier). */

const DEFAULT_ORIGIN = 'http://localhost:3000'

function publicOrigin(): string {
  const raw = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ''
  ).replace(/\/$/, '')
  if (raw) return raw
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return DEFAULT_ORIGIN
}

/** Path shape matched by `parseWorkIdFromScanText` (see `lib/mobile/parse-work-id-from-scan.ts`). */
export function workPhysicalBridgePath(oeuvreId: number): string {
  return `/atelier/works/${oeuvreId}`
}

export function workPhysicalBridgeUrl(oeuvreId: number): string {
  return `${publicOrigin()}${workPhysicalBridgePath(oeuvreId)}`
}
