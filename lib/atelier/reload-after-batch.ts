/**
 * Hard navigation after batch junction writes (theme / working group).
 * `router.refresh()` does not reset TeamPortalClient junction cache when
 * `shellPersistsAcrossTabs` is true; a full load re-hydrates oeuvre_theme links.
 */
export function reloadAtelierAfterBatchSuccess(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('batch', 'success')
  window.location.assign(url.toString())
}
