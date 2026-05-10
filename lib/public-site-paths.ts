/**
 * Paths passed to trackView() on the public marketing site.
 * Used to scope atelier “Public” tab analytics to real visitor pages (not stray URLs).
 */
export const PUBLIC_SITE_PATHS = new Set([
  '/',
  '/works',
  '/about',
  '/practice',
  '/enquiry',
])

export function normalizeTrackedPath(path: string): string {
  const p = path.trim() || '/'
  if (p === '/') return '/'
  return p.replace(/\/+$/, '') || '/'
}

export function isPublicSiteTrackedPath(path: string): boolean {
  return PUBLIC_SITE_PATHS.has(normalizeTrackedPath(path))
}
