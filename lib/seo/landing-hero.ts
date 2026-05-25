/** Landing circle hero — shared by `LandingPage` and home `metadata.openGraph.images`. */
/** Full-size AVIF on R2 (not /thumbs/ — those are 400px and look soft when the hero fills the viewport). */
export const LANDING_HERO_IMAGE_URL =
  'https://pub-a352e674a992412fa243598ffd6b659c.r2.dev/W_2190_01_20260411-20260411-_PE16262_-_pe_moulin_-_pe_moulin.avif'

const FALLBACK_ARTIST = 'the pem workshop'

/** Prefer `https://…` from portfolio config; otherwise default hero asset. */
export function resolveLandingHeroImageUrl(heroUrl: string | null | undefined): string {
  const u = (heroUrl ?? '').trim()
  if (u && /^https:\/\//i.test(u)) return u
  return LANDING_HERO_IMAGE_URL
}

export function resolveArtistDisplayName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  return n || FALLBACK_ARTIST
}

/** Skip next/image resizing for R2 AVIF heroes (already optimized; avoids soft upscaling). */
export function isLandingHeroUnoptimized(url: string): boolean {
  const u = url.trim()
  return /r2\.dev\//i.test(u) || u.startsWith('/r2-proxy/')
}
