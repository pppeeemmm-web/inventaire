/**
 * Who goes first when the Atelier opens (Pem 2026-11-14: the Journal was "very long to load" on the
 * phone). Next.js runs a page's Server Actions one at a time, so the shell's background loads
 * (catalogue pages, tags, badges, contact conflicts) used to queue ahead of the Journal's own read.
 * When the shell opens on such a tab it calls `holdBackground()`; the tab calls `foregroundSettled()`
 * once it has drawn; the shell waits on `afterForeground()` before its background calls — never longer than `maxMs`, so nothing is lost
 * if the tab never signals. Browser-only; module state lives for the page.
 */

let holding = false
let settled = false
const waiters = new Set<() => void>()

/** The shell opened on a tab that signals (the Journal): background loads wait for it. */
export function holdBackground(): void {
  if (typeof window !== 'undefined' && !settled) holding = true
}

export function foregroundSettled(): void {
  if (settled) return
  settled = true
  for (const w of [...waiters]) w()
  waiters.clear()
}

export function afterForeground(maxMs = 6000): Promise<void> {
  if (!holding || settled) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer)
      waiters.delete(done)
      resolve()
    }
    const timer = window.setTimeout(done, maxMs)
    waiters.add(done)
  })
}
