/**
 * Cross-panel notify: works came back from the bin (Audit « Corbeille » → `restoreSoftDeletedWorks`).
 * The Atelier shell (`TeamPortalClient`) re-reads them into its loaded catalogue, so a restored work
 * shows in the lists at once — `router.refresh()` alone only brings back works in the first chunk.
 */

const EVENT = 'pem:works-restored'

export function emitWorksRestored(oeuvreIds: number[]): void {
  if (typeof window === 'undefined' || oeuvreIds.length === 0) return
  window.dispatchEvent(new CustomEvent<number[]>(EVENT, { detail: oeuvreIds }))
}

export function subscribeWorksRestored(handler: (oeuvreIds: number[]) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => {
    const ids = (e as CustomEvent<number[]>).detail
    if (Array.isArray(ids) && ids.length) handler(ids)
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
