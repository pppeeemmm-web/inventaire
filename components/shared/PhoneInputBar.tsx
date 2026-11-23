'use client'

// R2 — the one sticky input bar on every phone screen (docs/design/2026-11-17/PhoneToday.notes.md,
// « Rules shown »): Écrire · Vocal · Œuvre · Photo · doc. Replaces the old Atelier `MobileActionBar`
// (QR moved into Photo · doc; reminders stay in the menu and the pulse line).
// Écrire opens a writing sheet over the page, saved on the day shown (PhoneNav.notes.md, option A):
// `?write=1` (empty) or `?write=#1234` (a mention) on the URL, or the PHONE_WRITE_EVENT, open it too.
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { PEM_Z_INDEX, useBottomChromeHeight } from '@/components/shared/BottomStack'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { INSPIRATION_SQL_LIVE } from '@/lib/inspiration-photo'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { PHONE_WRITE_EVENT } from '@/lib/phone-write-event'

const DayWriteSheet = dynamic(() => import('@/components/shared/DayWriteSheet').then((m) => m.DayWriteSheet), { ssr: false })

const DOC_CHOICES = [
  { href: '/atelier/capture?mode=doc', icon: '📄', label: 'today_doc_document', sub: 'today_doc_document_sub' },
  { href: '/atelier/capture?mode=card', icon: '👤', label: 'today_doc_card', sub: 'today_doc_card_sub' },
  { href: '/atelier/scan', icon: '🔍', label: 'today_doc_qr', sub: 'today_doc_qr_sub' },
] as const

/** Photo · doc → Inspiration (R1 / R2): admin only (the Journal is Pem's), once its SQL is live. */
const INSPIRATION_CHOICE = {
  href: '/atelier/capture?mode=inspiration',
  icon: '✦',
  label: 'insp_label',
  sub: 'insp_sub',
  testId: 'phone-doc-inspiration',
} as const

/** Today's session capture (Lightroom → Share). Callers pass it as `workHref` for admins only. */
const SESSION_CAPTURE_HREF = '/atelier/session/new'

// R2 phone 5 — the Œuvre sheet starts with the choice, so « Nouvelle / Ancienne » can't be skipped.
// Nouvelle / Reprise open the R3 phone recording screen (`WorkRecordPhone`) on that mode.
const WORK_CHOICES = [
  { href: '/atelier/works/new', icon: '✨', label: 'today_work_new', sub: 'today_work_new_sub', testId: 'phone-work-new' },
  { href: '/atelier/works/new?record=reprise', icon: '⟳', label: 'today_work_reprise', sub: 'today_work_reprise_sub', testId: 'phone-work-reprise' },
  { href: SESSION_CAPTURE_HREF, icon: '📷', label: 'today_work_session', sub: 'today_work_session_sub', testId: 'phone-work-session' },
] as const

type Choice = { href: string; icon: string; label: DictKey; sub: DictKey; testId?: string }

/** Bottom sheet of choices (Photo · doc, Œuvre). */
function ChoiceSheet({ title, choices, onClose, testId }: { title: string; choices: readonly Choice[]; onClose: () => void; testId: string }) {
  const { t } = useI18n()
  return (
    <PemModalOverlay
      onClose={onClose}
      panelStyle={{
        alignSelf: 'flex-end', width: '100%', borderRadius: '14px 14px 0 0',
        padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div data-testid={testId}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ fontSize: 16, margin: 0, flex: 1 }}>{title}</h2>
          <button type="button" onClick={onClose} className="btn ghost sm" style={{ minHeight: 44 }}>{t('today_doc_close')}</button>
        </div>
        {choices.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            onClick={onClose}
            data-testid={c.testId}
            style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, borderTop: '1px solid var(--bd)', color: 'var(--tx)', textDecoration: 'none' }}
          >
            <span aria-hidden="true" style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>{c.icon}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15 }}>{t(c.label)}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--tx3)' }}>{t(c.sub)}</span>
            </span>
          </Link>
        ))}
      </div>
    </PemModalOverlay>
  )
}

/** `stream` (the Journal stream, design 2026-11-22): ✍️ · 📷 · 🎤 large in the middle · 🖼️ — same doors, ranked for the thumb. */
export function PhoneInputBar({ onVoice, workHref, writeDay, stream = false }: { onVoice: () => void; workHref: string; writeDay?: string; stream?: boolean }) {
  const { t } = useI18n()
  const [docOpen, setDocOpen] = useState(false)
  const [workOpen, setWorkOpen] = useState(false)
  /** Écrire sheet: null = closed, else the text it starts with. */
  const [writing, setWriting] = useState<string | null>(null)
  // Its height (safe area included) → `--pem-phone-bar-h`: toasts, the selection bar and page padding sit above it.
  const barRef = useRef<HTMLElement>(null)
  useBottomChromeHeight(barRef, '--pem-phone-bar-h')

  useEffect(() => {
    const onWrite = (ev: Event) => setWriting(String((ev as CustomEvent<string>).detail ?? ''))
    window.addEventListener(PHONE_WRITE_EVENT, onWrite)
    const url = new URL(window.location.href)
    const w = url.searchParams.get('write')
    // On the Journal the phone goes on to the day screen, which opens the sheet (`?write=` is carried over).
    if (w && !url.pathname.startsWith('/atelier/journal')) {
      setWriting(w === '1' ? '' : /^(#\d+ ?)+$/.test(`${w.trim()} `) ? w : '')
      url.searchParams.delete('write')
      window.history.replaceState(window.history.state, '', url.toString())
    }
    // The sheet's code, fetched once the page is idle, so the tap never waits on it.
    const id = window.setTimeout(() => void import('@/components/shared/DayWriteSheet'), 1500)
    return () => {
      window.removeEventListener(PHONE_WRITE_EVENT, onWrite)
      window.clearTimeout(id)
    }
  }, [])
  // Capture is admin-only: only the session-capture href gets the sheet; anyone else keeps the plain link.
  const workSheet = workHref === SESSION_CAPTURE_HREF

  const btn: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    minHeight: 56, minWidth: 0, fontSize: 12, color: 'var(--tx)', textDecoration: 'none',
    background: 'none', border: 0, cursor: 'pointer', padding: 4,
  }
  const icon: CSSProperties = { fontSize: 18, lineHeight: 1 }

  return (
    <>
      <nav
        ref={barRef}
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
        <button type="button" onClick={() => setWriting('')} aria-expanded={writing != null} data-testid="phone-bar-write" style={btn}><span aria-hidden="true" style={icon}>✍️</span>{t('today_bar_write')}</button>
        {stream ? (
          <>
            <button type="button" onClick={() => setDocOpen(true)} aria-expanded={docOpen} data-testid="phone-bar-doc" style={btn}><span aria-hidden="true" style={icon}>📷</span>{t('js_bar_photo')}</button>
            <button
              type="button"
              onClick={onVoice}
              data-testid="phone-bar-voice"
              aria-label={t('today_bar_voice')}
              style={{ ...btn, alignSelf: 'start', justifySelf: 'center', width: 68, height: 68, minHeight: 68, marginTop: -22, borderRadius: '50%', background: 'var(--ac)', color: 'var(--bg0)', boxShadow: '0 4px 16px rgba(0,0,0,.4)', fontSize: 26 }}
            >
              <span aria-hidden="true">🎙️</span>
            </button>
          </>
        ) : (
          <button type="button" onClick={onVoice} data-testid="phone-bar-voice" style={btn}><span aria-hidden="true" style={icon}>🎙️</span>{t('today_bar_voice')}</button>
        )}
        {workSheet ? (
          <button type="button" onClick={() => setWorkOpen(true)} aria-expanded={workOpen} data-testid="phone-bar-work" style={btn}><span aria-hidden="true" style={icon}>🖼️</span>{t('today_bar_work')}</button>
        ) : (
          <Link href={workHref} data-testid="phone-bar-work" style={btn}><span aria-hidden="true" style={icon}>🖼️</span>{t('today_bar_work')}</Link>
        )}
        {stream ? null : <button type="button" onClick={() => setDocOpen(true)} aria-expanded={docOpen} data-testid="phone-bar-doc" style={btn}><span aria-hidden="true" style={icon}>📄</span>{t('today_bar_doc')}</button>}
      </nav>

      {docOpen ? (
        <ChoiceSheet
          title={t('today_doc_title')}
          choices={workSheet && INSPIRATION_SQL_LIVE ? [INSPIRATION_CHOICE, ...DOC_CHOICES] : DOC_CHOICES}
          onClose={() => setDocOpen(false)}
          testId="phone-doc-sheet"
        />
      ) : null}
      {writing != null ? <DayWriteSheet day={writeDay ?? todayCalendarDayInParis()} initialText={writing} onClose={() => setWriting(null)} /> : null}
      {workOpen ? <ChoiceSheet title={t('today_work_title')} choices={WORK_CHOICES} onClose={() => setWorkOpen(false)} testId="phone-work-sheet" /> : null}
    </>
  )
}
