/** Canonical origin for metadataBase, OG URLs, and sitemap (see CLAUDE.md: NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL). */
export function getMetadataBase(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  const normalized = raw.endsWith('/') ? raw.slice(0, -1) : raw
  try {
    return new URL(normalized)
  } catch {
    return new URL('http://localhost:3000')
  }
}
