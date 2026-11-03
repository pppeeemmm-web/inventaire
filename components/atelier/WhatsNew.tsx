'use client'

// "www.thepemworkshop.com 3.0" (owner 2026-11-03): the list of new features, shown as a popup when
// the Atelier opens (until "Don't show again" is ticked) and in Kaizen → What's new.
// Dismissal is per browser (localStorage); closing without ticking hides it for this visit only.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import {
  WHATS_NEW_DISMISSED_KEY,
  WHATS_NEW_ITEMS,
  WHATS_NEW_RELEASE,
  WHATS_NEW_SEEN_SESSION_KEY,
} from '@/lib/whats-new'

type MsgKey = Parameters<ReturnType<typeof useI18n>['t']>[0]

export function WhatsNewList() {
  const { t, lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const days = [...new Set(WHATS_NEW_ITEMS.map((i) => i.day))]
  return (
    <div data-testid="whats-new-list" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {days.map((day) => (
        <section key={day}>
          <div className="t-eyebrow" style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 6 }}>
            {new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {WHATS_NEW_ITEMS.filter((i) => i.day === day).map((i) => (
              <li key={i.id} style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--tx2)' }}>
                <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>{t(`wn_${i.id}_t` as MsgKey)}</strong>
                {' — '}
                {t(`wn_${i.id}_d` as MsgKey)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function readStorage(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? window.localStorage : window.sessionStorage).getItem(key)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked: showing the popup is the safe fallback
  } catch {
    return null // private mode / blocked storage: just show the popup
  }
}

function writeStorage(store: 'local' | 'session', key: string, value: string): void {
  try {
    ;(store === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked: the popup may reappear, nothing else depends on it
  } catch {
    /* storage unavailable: the popup may show again next time, nothing else depends on it */
  }
}

/** Popup on Atelier open. Hidden on Kaizen, which shows the same list in place. */
export function WhatsNewDialog({ suppressed = false }: { suppressed?: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [dontShow, setDontShow] = useState(false)

  useEffect(() => {
    if (suppressed) return
    if (readStorage('local', WHATS_NEW_DISMISSED_KEY) === WHATS_NEW_RELEASE) return
    if (readStorage('session', WHATS_NEW_SEEN_SESSION_KEY) === WHATS_NEW_RELEASE) return
    setOpen(true)
  }, [suppressed])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function close() {
    writeStorage('session', WHATS_NEW_SEEN_SESSION_KEY, WHATS_NEW_RELEASE)
    if (dontShow) writeStorage('local', WHATS_NEW_DISMISSED_KEY, WHATS_NEW_RELEASE)
    setOpen(false)
  }

  if (!open) return null
  return (
    <div
      role="presentation"
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        data-testid="whats-new-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg1)', border: '1px solid var(--bd2)', width: 'min(620px, 100%)',
          maxHeight: 'min(86vh, 760px)', display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ padding: '20px 22px 10px', borderBottom: '1px solid var(--bd)' }}>
          <div id="whats-new-title" className="serif" style={{ fontSize: 22, color: 'var(--ac)' }}>{t('wn_title')}</div>
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '4px 0 0' }}>{t('wn_intro')}</p>
        </div>
        <div style={{ padding: '14px 22px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <WhatsNewList />
        </div>
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
            padding: '12px 22px max(12px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--bd)',
          }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--tx2)', minHeight: 44, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              data-testid="whats-new-dont-show"
              style={{ width: 18, height: 18 }}
            />
            {t('wn_dont_show')}
          </label>
          <Link href="/atelier/kaizen?whatsnew=1" onClick={close} className="t-mono-sm" style={{ fontSize: 11, color: 'var(--ac)' }}>
            {t('wn_open_kaizen')}
          </Link>
          <button
            type="button"
            className="btn primary sm"
            onClick={close}
            data-testid="whats-new-close"
            style={{ marginLeft: 'auto', minHeight: 44, minWidth: 96 }}
          >
            {t('wn_close')}
          </button>
        </div>
      </div>
    </div>
  )
}
