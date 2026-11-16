/** Absolute URL encoded on work QR labels (scan → open in Atelier). */

/** Never the page's own address (localhost / LAN on dev): a printed label must open the live site (TODO B9, Pem 2026-11-15). */
const DEFAULT_ORIGIN = 'https://www.thepemworkshop.com'

function publicOrigin(): string {
  const raw = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    ''
  ).replace(/\/$/, '')
  return raw || DEFAULT_ORIGIN
}

/** Path shape matched by `parseWorkIdFromScanText` (see `lib/mobile/parse-work-id-from-scan.ts`). */
export function workPhysicalBridgePath(oeuvreId: number): string {
  return `/atelier/works/${oeuvreId}`
}

export function workPhysicalBridgeUrl(oeuvreId: number): string {
  return `${publicOrigin()}${workPhysicalBridgePath(oeuvreId)}`
}
