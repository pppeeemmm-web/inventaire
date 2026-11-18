'use client'

// « What's new » where it happened (TODO 24, Pem 2026-11-18: « dots + voice card »). Seen ids live in this
// browser (localStorage): no SQL. A change fires an event so the menu dot and the tab's notice stay in step.

import { useEffect, useState } from 'react'
import { WHATS_NEW_DOT_DAYS, whatsNewItemsFor, type WhatsNewItem } from '@/lib/whats-new'

const SEEN_KEY = 'pem_wn_dots_seen'
const EVENT = 'pem-wn-dots'

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked: every dot shows, nothing else depends on it
  } catch {
    return new Set()
  }
}

/** Marks items seen in this browser and tells the menu. */
export function markWhatsNewSeen(ids: string[]): void {
  const seen = readSeen()
  ids.forEach((id) => seen.add(id))
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked: the dot may come back next visit
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT))
}

function recent(item: WhatsNewItem, now: number): boolean {
  return now - new Date(`${item.day}T12:00:00`).getTime() <= WHATS_NEW_DOT_DAYS * 86_400_000
}

/**
 * Unseen recent items per tab key, for this viewer: admins get the admin-only items too (Pem 2026-11-18: « nothing for
 * the admin » — Claude makes the changes, Pem needs to see them). `null` = viewer not known yet: no dots.
 */
export function useWhatsNewDots(viewer: 'admin' | 'team' | null): Map<string, WhatsNewItem[]> {
  const [map, setMap] = useState<Map<string, WhatsNewItem[]>>(new Map())
  useEffect(() => {
    if (viewer === null) {
      setMap(new Map())
      return
    }
    const compute = () => {
      const seen = readSeen()
      const now = Date.now()
      const next = new Map<string, WhatsNewItem[]>()
      for (const i of whatsNewItemsFor(viewer === 'admin')) {
        if (!i.spot || seen.has(i.id) || !recent(i, now)) continue
        next.set(i.spot, [...(next.get(i.spot) ?? []), i])
      }
      setMap(next)
    }
    compute()
    window.addEventListener(EVENT, compute)
    return () => window.removeEventListener(EVENT, compute)
  }, [viewer])
  return map
}
