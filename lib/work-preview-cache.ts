// Work previews for `WorkRef` / `WorkChip`, cached for the session. Numbers asked for in the same moment
// (one render of a list) go to the server in one call (R4, Pem 2026-11-17).

import { fetchWorkPreviews, type WorkPreview } from '@/app/atelier/works/preview-actions'

const cache = new Map<number, Promise<WorkPreview | null>>()
let pending: { id: number; resolve: (p: WorkPreview | null) => void }[] = []
let scheduled = false

function flush() {
  scheduled = false
  const batch = pending
  pending = []
  const ids = batch.map((b) => b.id)
  fetchWorkPreviews(ids).then(
    (rows) => {
      const byId = new Map(rows.map((r) => [r.id, r]))
      for (const b of batch) b.resolve(byId.get(b.id) ?? null)
    },
    () => {
      for (const b of batch) {
        cache.delete(b.id)
        b.resolve(null)
      }
    },
  )
}

export function loadWorkPreview(id: number): Promise<WorkPreview | null> {
  let p = cache.get(id)
  if (!p) {
    p = new Promise<WorkPreview | null>((resolve) => {
      pending.push({ id, resolve })
      if (!scheduled) {
        scheduled = true
        setTimeout(flush, 0)
      }
    })
    cache.set(id, p)
  }
  return p
}

/** Seed the cache from data a screen already has (no request). */
export function primeWorkPreview(p: WorkPreview) {
  if (!cache.has(p.id)) cache.set(p.id, Promise.resolve(p))
}

/** « Sans titre · 2024 · huile » — never the number alone (912 works have no title). */
export function untitledLine(p: Pick<WorkPreview, 'year' | 'technique'> | null | undefined, untitled: string): string {
  return [untitled, p?.year, p?.technique?.toLowerCase()].filter(Boolean).join(' · ')
}
