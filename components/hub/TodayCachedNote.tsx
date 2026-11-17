'use client'

// R2 speed, design rule 5 (docs/design/2026-11-17/PhoneToday.notes.md): the service worker may show the
// last copy of « Aujourd'hui » at once (app/sw.ts). This line tells it apart from a fresh page — the
// server stamps when it rendered the page — says how old it is, and refreshes the page in place
// (the input bar keeps what is being typed). It is gone once the fresh page is in.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

/**
 * Rendered longer ago than this: a cached copy, refreshed at once (a fresh page on slow 4G arrives within a
 * few seconds of its render). A signed-out phone then goes on to /login through the refresh.
 */
const REFRESH_MS = 10_000
/** The age line shows from one minute (room for a phone clock a little off). */
const SHOW_MS = 60_000
/** The copy already refreshed in this tab. Next falls back to a full reload when a refresh fails, and that
 * reload would come from the cache again: one try per copy, so an offline phone never loops. */
const REFRESHED_KEY = 'pem-today-refreshed'

function refreshedOnce(renderedAt: number): boolean {
  try {
    if (sessionStorage.getItem(REFRESHED_KEY) === String(renderedAt)) return true
    sessionStorage.setItem(REFRESHED_KEY, String(renderedAt))
    return false
    // eslint-disable-next-line pem-i18n/no-silent-catch -- no storage: no refresh rather than a possible loop; the next open is fresh.
  } catch {
    return true
  }
}

export function TodayCachedNote({ renderedAt }: { renderedAt: number }) {
  const { t } = useI18n()
  const router = useRouter()
  const [age, setAge] = useState<number | null>(null)

  useEffect(() => {
    const ms = Date.now() - renderedAt
    if (ms < REFRESH_MS) {
      setAge(null)
      return
    }
    setAge(ms >= SHOW_MS ? ms : null)
    // Offline: the copy stays, with its age line.
    if (navigator.onLine && !refreshedOnce(renderedAt)) router.refresh()
  }, [renderedAt, router])

  if (age == null) return null
  const min = Math.max(1, Math.round(age / 60_000))
  const text = min < 60 ? t('today_cached_min').replace('{n}', String(min)) : t('today_cached_h').replace('{n}', String(Math.round(min / 60)))
  return (
    <p data-testid="hub-today-cached" role="status" style={{ fontSize: 12, color: 'var(--tx3)', margin: 0, padding: '0 16px 6px' }}>
      {text}
    </p>
  )
}
