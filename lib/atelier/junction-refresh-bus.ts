/** Cross-route notify: theme/group junction changed for an œuvre (after saveWork). */

export type JunctionSavedDetail = {
  oeuvreId: number
  themeIds: number[]
  groupIds: string[]
}

const EVENT = 'pem:junction-saved'

export function emitJunctionSaved(detail: JunctionSavedDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<JunctionSavedDetail>(EVENT, { detail }))
}

export function subscribeJunctionSaved(
  handler: (detail: JunctionSavedDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => {
    const d = (e as CustomEvent<JunctionSavedDetail>).detail
    if (d?.oeuvreId) handler(d)
  }
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
