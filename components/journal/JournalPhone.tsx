'use client'

// The phone face of the Journal stream (design 2026-11-22): the app opens here, today first. Header:
// ☰ · « Journal » · the scale (tap: Jours → Mois → Années; or pinch the list). The record bar comes from
// TodayFrame (same doors as before). Shown while the switch is on: `/hub?stream=1` once on the phone
// (a cookie keeps it), `/hub?stream=0` goes back to the day page.

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PhoneMenuButton } from '@/components/shared/PhoneMenu'
import { JournalStream } from '@/components/journal/JournalStream'
import type { JournalStreamPage } from '@/lib/journal/stream'
import { JOURNAL_STREAM_COOKIE } from '@/lib/journal/stream-switch'


/** Keeps the switch: `?stream=1` / `?stream=0` sets the cookie, then the address is cleaned. */
export function JournalStreamSwitchKeeper() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const v = url.searchParams.get('stream')
    if (v !== '1' && v !== '0') return
    document.cookie = `${JOURNAL_STREAM_COOKIE}=${v}; path=/; max-age=${v === '1' ? 31536000 : 0}; samesite=lax`
    url.searchParams.delete('stream')
    window.history.replaceState(window.history.state, '', url.toString())
  }, [])
  return null
}

export function JournalPhone({ initial }: { initial: JournalStreamPage }) {
  const { t } = useI18n()
  const [scale, setScale] = useState<0 | 1 | 2>(0)
  const labels = [t('js_scale_days'), t('js_scale_months'), t('js_scale_years')]
  return (
    <div data-testid="journal-phone">
      <JournalStreamSwitchKeeper />
      <header style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 8px 2px' }}>
        <PhoneMenuButton />
        <h1 style={{ fontSize: 20, margin: '0 4px', flex: 1 }}>{t('js_title')}</h1>
        <button
          type="button"
          aria-label={t('js_scale_aria')}
          data-testid="journal-phone-scale"
          onClick={() => setScale(((scale + 1) % 3) as 0 | 1 | 2)}
          style={{ minHeight: 44, padding: '0 12px', border: '1px solid var(--bd2)', borderRadius: 999, background: 'none', color: 'var(--tx2)', fontSize: 13, cursor: 'pointer' }}
        >
          {labels[scale]} ▾
        </button>
      </header>
      {scale === 0 ? <p style={{ margin: '0 12px 2px', fontSize: 11, color: 'var(--tx3)' }}>{t('js_pinch_hint')}</p> : null}
      <JournalStream initial={initial} narrow scale={scale} onScaleChange={setScale} />
    </div>
  )
}
