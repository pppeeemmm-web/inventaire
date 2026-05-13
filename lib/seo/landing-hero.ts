/** Landing circle hero — shared by `LandingPage` and home `metadata.openGraph.images`. */
export const LANDING_HERO_IMAGE_URL =
  'https://pub-a352e674a992412fa243598ffd6b659c.r2.dev/thumbs/W_2190_01_20260411-20260411-_PE16262_-_pe_moulin_-_pe_moulin.avif'

const FALLBACK_ARTIST = 'Pierre Emmanuel Moulin'

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
