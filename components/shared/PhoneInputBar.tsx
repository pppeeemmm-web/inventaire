'use client'

// R2 — the one sticky input bar on every phone screen (docs/design/2026-11-17/PhoneToday.notes.md,
// « Rules shown »): Écrire · Vocal · Œuvre · Photo · doc. Replaces the old Atelier `MobileActionBar`
// (QR moved into Photo · doc; reminders stay in the menu and the pulse line).
import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PEM_Z_INDEX } from '@/components/shared/BottomStack'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'

const DOC_CHOICES = [
  { href: '/atelier/capture?mode=doc', icon: '📄', label: 'today_doc_document', sub: 'today_doc_document_sub' },
  { href: '/atelier/capture?mode=card', icon: '👤', label: 'today_doc_card', sub: 'today_doc_card_sub' },
  { href: '/atelier/scan', icon: '🔍', label: 'today_doc_qr', sub: 'today_doc_qr_sub' },
] as const

export function PhoneInputBar({ onVoice, workHref }: { onVoice: () => void; workHref: string }) {
  const { t } = useI18n()
  const [docOpen, setDocOpen] = useState(false)

  const btn: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    minHeight: 56, minWidth: 0, fontSize: 12, color: 'var(--tx)', textDecoration: 'none',
    background: 'none', border: 0, cursor: 'pointer', padding: 4,
  }
  const icon: CSSProperties = { fontSize: 18, lineHeight: 1 }

  return (
    <>
      <nav
        role="toolbar"
        aria-label={t('today_bar_aria')}
        data-testid="phone-input-bar"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: PEM_Z_INDEX.mobileActionBar,
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          paddingTop: 4,
          paddingLeft: 'max(6px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(6px, env(safe-area-inset-right, 0px))',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
          background: 'var(--bg1)', borderTop: '1px solid var(--bd)',
        }}
      >
        <Link href="/atelier/journal?today=1&write=1" data-testid="phone-bar-write" style={btn}><span aria-hidden="true" style={icon}>✍️</span>{t('today_bar_write')}</Link>
        <button type="button" onClick={onVoice} data-testid="phone-bar-voice" style={btn}><span aria-hidden="true" style={icon}>🎙️</span>{t('today_bar_voice')}</button>
        <Link href={workHref} data-testid="phone-bar-work" style={btn}><span aria-hidden="true" style={icon}>🖼️</span>{t('today_bar_work')}</Link>
        <button type="button" onClick={() => setDocOpen(true)} aria-expanded={docOpen} data-testid="phone-bar-doc" style={btn}><span aria-hidden="true" style={icon}>📄</span>{t('today_bar_doc')}</button>
      </nav>

      {docOpen ? (
        <PemModalOverlay
          onClose={() => setDocOpen(false)}
          panelStyle={{
            alignSelf: 'flex-end', width: '100%', borderRadius: '14px 14px 0 0',
            padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <h2 style={{ fontSize: 16, margin: 0, flex: 1 }}>{t('today_doc_title')}</h2>
            <button type="button" onClick={() => setDocOpen(false)} className="btn ghost sm" style={{ minHeight: 44 }}>{t('today_doc_close')}</button>
          </div>
          {DOC_CHOICES.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              onClick={() => setDocOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, borderTop: '1px solid var(--bd)', color: 'var(--tx)', textDecoration: 'none' }}
            >
              <span aria-hidden="true" style={{ fontSize: 20 }}>{c.icon}</span>
              <span>
                <span style={{ display: 'block', fontSize: 15 }}>{t(c.label)}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--tx3)' }}>{t(c.sub)}</span>
              </span>
            </Link>
          ))}
        </PemModalOverlay>
      ) : null}
    </>
  )
}
