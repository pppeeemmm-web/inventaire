/** Cross-screen notify: the list of themes / work groups, or which works sit in them, changed (Thèmes, exhibitions, …). */

export type CatalogueListsChangedDetail = { oeuvreIds?: number[] }

const EVENT = 'pem:catalogue-lists-changed'

export function emitCatalogueListsChanged(detail: CatalogueListsChangedDetail = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<CatalogueListsChangedDetail>(EVENT, { detail }))
}

export function subscribeCatalogueListsChanged(
  handler: (detail: CatalogueListsChangedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => {
    handler((e as CustomEvent<CatalogueListsChangedDetail>).detail ?? {})
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
