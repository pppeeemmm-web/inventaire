'use client'

// "www.thepemworkshop.com 3.0" (owner 2026-11-03): the list of new features, shown as a popup when
// the Atelier opens (until "Don't show again" is ticked) and in Kaizen → What's new.
// Dismissal is per browser (localStorage); closing without ticking hides it for this visit only.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import {
  WHATS_NEW_DISMISSED_KEY,
  whatsNewItemsFor,
  WHATS_NEW_POPUP,
  WHATS_NEW_RELEASE,
  WHATS_NEW_SEEN_SESSION_KEY,
} from '@/lib/whats-new'


type ItemCopy = Record<string, { fr: string; en?: string } | undefined>

export function WhatsNewList({ isAdmin = false }: { isAdmin?: boolean }) {
  const { lang } = useI18n()
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const items = whatsNewItemsFor(isAdmin)
  const days = [...new Set(items.map((i) => i.day))]
  // The items' copy is loaded on open, never in the page's i18n catalog (whats-new-items.messages.ts).
  const [copy, setCopy] = useState<ItemCopy | null>(null)
  useEffect(() => {
    let alive = true
    void import('@/lib/i18n/messages/whats-new-items.messages').then((m) => {
      if (alive) setCopy(m.whatsNewItemMessages as unknown as ItemCopy)
    })
    return () => {
      alive = false
    }
  }, [])
  const text = (key: string) => {
    const m = copy?.[key]
    return m ? (lang === 'en' ? m.en ?? m.fr : m.fr) : ''
  }
  if (!copy) return <div data-testid="whats-new-list" style={{ minHeight: 40 }} />
  return (
    <div data-testid="whats-new-list" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {days.map((day) => (
        <section key={day}>
          <div className="t-eyebrow" style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 6 }}>
            {new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.filter((i) => i.day === day).map((i) => (
              <li key={i.id} style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--tx2)' }}>
                <strong style={{ color: 'var(--tx)', fontWeight: 600 }}>{text(`wn_${i.id}_t`)}</strong>
                {' — '}
                {text(`wn_${i.id}_d`)}
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
export function WhatsNewDialog({ suppressed = false, isAdmin = false }: { suppressed?: boolean; isAdmin?: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [dontShow, setDontShow] = useState(false)

  useEffect(() => {
    if (suppressed || !WHATS_NEW_POPUP) return
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
          <div id="whats-new-title" className="serif" style={{ fontSize: 22, color: 'var(--ac)' }}>{t('wn_title').replace('{v}', WHATS_NEW_RELEASE)}</div>
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '4px 0 0' }}>{t('wn_intro')}</p>
        </div>
        <div style={{ padding: '14px 22px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <WhatsNewList isAdmin={isAdmin} />
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
          <Link href="/atelier/kaizen-ops?whatsnew=1" onClick={close} className="t-mono-sm" style={{ fontSize: 11, color: 'var(--ac)' }}>
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
