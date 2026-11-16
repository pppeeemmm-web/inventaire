'use client'

// One read per screen open (TODO 18, owner GO 2026-11-16). Next.js runs a page's Server Actions one
// at a time, so a work card whose sections each read on mount waited 8–10 round trips in a row.
// The screen now "primes" one combined read in a layout effect (layout effects run before any
// section's useEffect); each section `openReadOr`s its slice and falls back to its own action when
// there is none (another screen, a read that failed, a slice already used and expired).
//
// Freshness: a slice is served for 30 s while nobody took it, then for 2 s after its first take
// (React StrictMode runs mount effects twice). Reloads after an edit must call their action
// directly, never `openReadOr` — the slice is the state at open time.

import { afterForeground } from '@/lib/atelier/foreground-gate'
import {
  drawerOpenKeys,
  overviewOpenKeys,
  shellOpenKeys,
  type DrawerOpenOptions,
  type OpenReadBundle,
} from '@/lib/atelier/open-read-keys'
import { loadWorkDrawerOpen } from '@/app/atelier/works/drawer-open-actions'
import { loadAtelierShellOpen, loadOverviewOpen } from '@/app/atelier/atelier-open-actions'

const UNTAKEN_MS = 30_000
const AFTER_TAKE_MS = 2_000

type Hit = { v: unknown } | null
type Entry = { p: Promise<Hit>; primedAt: number; firstTakeAt: number | null }

const entries = new Map<string, Entry>()

function live(key: string, now = Date.now()): Entry | null {
  const e = entries.get(key)
  if (!e) return null
  const until = e.firstTakeAt == null ? e.primedAt + UNTAKEN_MS : e.firstTakeAt + AFTER_TAKE_MS
  if (now > until) {
    entries.delete(key)
    return null
  }
  return e
}

/** True while a slice is waiting for its section (does not take it). */
export function hasOpenRead(key: string): boolean {
  return live(key) != null
}

/**
 * Start one combined read for `keys`. No-op when every key already waits untaken (StrictMode runs
 * layout effects twice on mount); otherwise replaces those keys with a fresh read.
 */
export function primeOpenReads(keys: string[], load: () => Promise<OpenReadBundle>): void {
  const now = Date.now()
  if (keys.length > 0 && keys.every((k) => live(k, now)?.firstTakeAt === null)) return
  const all = load().catch((err: unknown) => {
    // Sections fall back to their own action and report errors there.
    console.warn('[open-read] combined read failed; sections read on their own', err)
    return null
  })
  for (const key of keys) {
    const p = all.then((bundle): Hit => {
      const s = bundle?.[key]
      return s && s.ok ? { v: s.v } : null
    })
    entries.set(key, { p, primedAt: now, firstTakeAt: null })
  }
}

/** The slice from the screen's combined read, or `read()` when there is none. Initial loads only. */
export async function openReadOr<T>(key: string, read: () => Promise<T>): Promise<T> {
  const e = live(key)
  if (e) {
    if (e.firstTakeAt == null) e.firstTakeAt = Date.now()
    const hit = await e.p
    if (hit) return hit.v as T
  }
  return read()
}

// ── Screens ──────────────────────────────────────────────────────────────────

/** Work card: call from a layout effect when the open work changes. */
export function primeWorkDrawerOpen(oeuvreId: number, opts: DrawerOpenOptions): void {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return
  primeOpenReads(drawerOpenKeys(oeuvreId, opts), () => loadWorkDrawerOpen(oeuvreId, opts))
}

/** Atelier frame on page open; waits for the foreground tab like the reads it replaces. */
export function primeAtelierShellOpen(since: string, overview: boolean): void {
  primeOpenReads(shellOpenKeys(since, overview), () =>
    afterForeground().then(() => loadAtelierShellOpen({ since, overview })),
  )
}

/** Overview tab, unless the frame's read already carries its slices. */
export function primeOverviewOpen(): void {
  const keys = overviewOpenKeys()
  if (keys.every((k) => hasOpenRead(k))) return
  primeOpenReads(keys, () => loadOverviewOpen())
}
