/** Public preview paths opened from Atelier → Site / Portfolio (not PWA popup windows). */

export type PublicPreviewPath = '/' | '/works' | '/about' | '/practice' | '/enquiry'

/** Cache-bust query so a normal browser refresh picks up latest portfolio JSON. */
export function buildPublicPreviewUrl(path: PublicPreviewPath): string {
  if (typeof window === 'undefined') return path
  const url = new URL(path, window.location.origin)
  url.searchParams.set('_pem_preview', Date.now().toString(36))
  return url.toString()
}

/**
 * Open in a new browsing tab via a synthetic `<a target="_blank">` click.
 * Avoid `window.open(..., features)` — that opens a sized popup / second PWA window on some platforms.
 */
export function openPublicPreviewTab(path: PublicPreviewPath): void {
  if (typeof document === 'undefined') return
  const url = buildPublicPreviewUrl(path)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  a.referrerPolicy = 'no-referrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
