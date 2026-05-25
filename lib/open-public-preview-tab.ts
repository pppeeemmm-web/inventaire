/** Open a public page in a new browser tab (not a sized popup). Optional cache-bust for config checks. */
export function openPublicPreviewTab(path: '/' | '/works' | '/about' | '/practice' | '/enquiry'): void {
  if (typeof window === 'undefined') return
  const url = new URL(path, window.location.origin)
  url.searchParams.set('_pem_preview', Date.now().toString(36))
  window.open(url.toString(), '_blank')
}
