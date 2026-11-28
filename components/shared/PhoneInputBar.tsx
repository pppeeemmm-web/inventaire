'use client'

// R2 — the one sticky input bar on every phone screen (docs/design/2026-11-17/PhoneToday.notes.md,
// « Rules shown »): Écrire · Vocal · Œuvre · Photo. Replaces the old Atelier `MobileActionBar`
// (reminders stay in the menu and the pulse line).
// Tap = do, hold = choose (docs/design/2026-11-27/PhoneBarTapHold.md, Pem 2026-11-27): a tap does the first choice
// straight away; a hold stacks the others above the button — slide onto one and release, it opens; released, the
// stack goes. Every choice opens exactly what it opened before. « Tous les choix » (screen reader) opens the old sheet.
// Écrire opens a writing sheet over the page, saved on the day shown (PhoneNav.notes.md, option A):
// `?write=1` (empty) or `?write=#1234` (a mention) on the URL, or the PHONE_WRITE_EVENT, open it too.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { PEM_Z_INDEX, useBottomChromeHeight } from '@/components/shared/BottomStack'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'
import { INSPIRATION_SQL_LIVE } from '@/lib/inspiration-photo'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { PHONE_WRITE_EVENT } from '@/lib/phone-write-event'

const DayWriteSheet = dynamic(() => import('@/components/shared/DayWriteSheet').then((m) => m.DayWriteSheet), { ssr: false })

const DOC_CHOICES = [
  { href: '/atelier/capture?mode=doc', icon: '📄', label: 'today_doc_document', sub: 'today_doc_document_sub' },
  { href: '/atelier/capture?mode=card', icon: '👤', label: 'today_doc_card', sub: 'today_doc_card_sub' },
  { href: '/atelier/scan', icon: '🔍', label: 'today_doc_qr', sub: 'today_doc_qr_sub' },
] as const

/** Photo → Inspiration (R1 / R2; the tap for admins): admin only (the Journal is Pem's), once its SQL is live. */
const INSPIRATION_CHOICE = {
  href: '/atelier/capture?mode=inspiration',
  icon: '✦',
  label: 'insp_label',
  sub: 'insp_sub',
  testId: 'phone-doc-inspiration',
} as const

/** Today's session capture (Lightroom → Share). Callers pass it as `workHref` for admins only. */
const SESSION_CAPTURE_HREF = '/atelier/session/new'

// Œuvre: tap = Nouvelle, hold = Reprise · Session. Nouvelle / Reprise open the R3 phone recording screen (`WorkRecordPhone`) on that mode.
const WORK_CHOICES = [
  { href: '/atelier/works/new', icon: '✨', label: 'today_work_new', sub: 'today_work_new_sub', testId: 'phone-work-new' },
  { href: '/atelier/works/new?record=reprise', icon: '⟳', label: 'today_work_reprise', sub: 'today_work_reprise_sub', testId: 'phone-work-reprise' },
  { href: SESSION_CAPTURE_HREF, icon: '📷', label: 'today_work_session', sub: 'today_work_session_sub', testId: 'phone-work-session' },
] as const

type Choice = { href?: string; run?: () => void; icon: string; label: DictKey; sub?: DictKey; testId?: string }

/** Bottom sheet of all of a button's choices (« Tous les choix »: the way in without a hold). */
function ChoiceSheet({ title, choices, onClose, testId }: { title: string; choices: readonly Choice[]; onClose: () => void; testId: string }) {
  const { t } = useI18n()
  const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, borderTop: '1px solid var(--bd)', color: 'var(--tx)', textDecoration: 'none', background: 'none', borderLeft: 0, borderRight: 0, borderBottom: 0, padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }
  const inner = (c: Choice) => (
    <>
      <span aria-hidden="true" style={{ fontSize: 20, width: 24, textAlign: 'center', flexShrink: 0 }}>{c.icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15 }}>{t(c.label)}</span>
        {c.sub ? <span style={{ display: 'block', fontSize: 12, color: 'var(--tx3)' }}>{t(c.sub)}</span> : null}
      </span>
    </>
  )
  return (
    <PhoneSheet title={title} onClose={onClose} testId={testId}>
        {choices.map((c) => c.href ? (
          <Link key={c.label} href={c.href} onClick={onClose} data-testid={c.testId} style={row}>{inner(c)}</Link>
        ) : (
          <button key={c.label} type="button" onClick={() => { onClose(); c.run?.() }} data-testid={c.testId} style={row}>{inner(c)}</button>
        ))}
    </PhoneSheet>
  )
}

const HOLD_MS = 450
const CHIP_W = 200
const CHIP_STEP = 56

/**
 * One bar button: tap = `choices[0]`; hold ≈½ s = `choices[1…]` stacked straight above (the nearest one closest to
 * the thumb). Slide onto one and release → `onPick`; released anywhere, the stack goes. Safari's long-press menu is
 * blocked. A hidden « Tous les choix » button opens the full sheet (`onMore`) for the screen reader and the keyboard.
 */
function HoldButton({ choices, onPick, onMore, name, testId, style, hintBelow = false, children }: {
  choices: readonly Choice[]; onPick: (c: Choice) => void; onMore: () => void; name: string; testId: string
  style: CSSProperties; hintBelow?: boolean; children: ReactNode
}) {
  const { t } = useI18n()
  const more = choices.slice(1)
  const [stack, setStack] = useState<{ x: number; y: number } | null>(null)
  const [hot, setHot] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const stackRef = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const box = useRef<DOMRect | null>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const close = () => {
    window.clearTimeout(timer.current)
    stackRef.current = null
    setStack(null)
    setHot(null)
  }
  // Which chip the thumb is on, from the stack's geometry (the chips take no pointer events).
  const hit = (cx: number, cy: number): number | null => {
    const s = stackRef.current
    if (!s || Math.abs(cx - s.x) > CHIP_W / 2 + 24) return null
    for (let i = 0; i < more.length; i++) if (Math.abs(cy - (s.y - 40 - i * CHIP_STEP)) <= CHIP_STEP / 2) return i
    return null
  }
  const hint = more.length ? <span style={{ fontSize: 10, lineHeight: 1.1, color: 'var(--tx3)', textAlign: 'center', overflowWrap: 'anywhere' }}>{t('bar_hold_hint').replace('{n}', String(more.length))}</span> : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: hintBelow ? 'center' : 'stretch', justifyContent: 'center', minWidth: 0 }}>
      <button
        type="button"
        data-testid={testId}
        aria-label={hintBelow ? name : undefined}
        onClick={() => {
          if (held.current) { held.current = false; return }
          onPick(choices[0])
        }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          held.current = false
          if (!more.length || (e.pointerType === 'mouse' && e.button !== 0)) return
          const el = e.currentTarget
          el.setPointerCapture(e.pointerId)
          box.current = el.getBoundingClientRect()
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            const r = el.getBoundingClientRect()
            const s = { x: Math.min(window.innerWidth - CHIP_W / 2 - 8, Math.max(CHIP_W / 2 + 8, r.left + r.width / 2)), y: r.top }
            held.current = true
            stackRef.current = s
            setStack(s)
          }, HOLD_MS)
        }}
        onPointerMove={(e) => {
          if (stackRef.current) { setHot(hit(e.clientX, e.clientY)); return }
          // Off the button before the hold: no tap, no stack (as an ordinary button cancels).
          const b = box.current
          if (b && (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)) {
            window.clearTimeout(timer.current)
            box.current = null
            held.current = true
          }
        }}
        onPointerUp={(e) => {
          window.clearTimeout(timer.current)
          box.current = null
          // The click that follows (if any) is swallowed; a phone often sends none after a hold, so the flag lapses.
          if (held.current) window.setTimeout(() => { held.current = false }, 500)
          if (!stackRef.current) return
          const i = hit(e.clientX, e.clientY)
          close()
          if (i != null) onPick(more[i])
        }}
        onPointerCancel={() => { held.current = false; box.current = null; close() }}
        onLostPointerCapture={() => { if (stackRef.current) close() }}
        style={{
          ...style, WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'none',
          ...(stack && !hintBelow ? { background: 'color-mix(in srgb, var(--ac) 14%, transparent)', borderRadius: 12 } : null),
        }}
      >
        {children}
        {hintBelow ? null : hint}
      </button>
      {hintBelow ? hint : null}
      {more.length ? (
        <button type="button" onClick={onMore} data-testid={`${testId}-more`} style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
          {t('bar_all_choices').replace('{label}', name)}
        </button>
      ) : null}
      {stack ? (
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', background: 'rgba(0,0,0,.12)' }}>
          {more.map((c, i) => (
            <div
              key={c.label}
              style={{
                position: 'fixed', left: stack.x, top: stack.y - 40 - i * CHIP_STEP, transform: 'translate(-50%, -50%)',
                width: CHIP_W, minHeight: 48, padding: '8px 12px', borderRadius: 24, boxShadow: '0 6px 18px rgba(0,0,0,.18)',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden',
                background: hot === i ? 'color-mix(in srgb, var(--ac) 18%, var(--bg1))' : 'var(--bg1)',
                border: `1px solid ${hot === i ? 'var(--ac)' : 'var(--bd)'}`,
              }}
            >
              <span style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>{c.icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(c.label)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** `stream` (the Journal stream, design 2026-11-22): ✍️ · 📷 · 🎤 large in the middle · 🖼️ — same doors, ranked for the thumb. */
export function PhoneInputBar({ onVoice, onImportAudio, workHref, writeDay, stream = false }: { onVoice: () => void; /** « Importer un enregistrement » (Voice Memos): the picked file opens the voice sheet on it. */ onImportAudio?: (file: File) => void; workHref: string; writeDay?: string; stream?: boolean }) {
  const { t } = useI18n()
  const router = useRouter()
  /** The « Tous les choix » sheet open, if any. */
  const [sheet, setSheet] = useState<'photo' | 'voice' | 'work' | null>(null)
  /** Écrire sheet: null = closed, else the text it starts with. */
  const [writing, setWriting] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
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

  const pick = (c: Choice) => (c.run ? c.run() : c.href ? router.push(c.href) : undefined)
  const photoChoices: readonly Choice[] = workSheet && INSPIRATION_SQL_LIVE ? [INSPIRATION_CHOICE, ...DOC_CHOICES] : DOC_CHOICES
  const voiceChoices: readonly Choice[] = [
    { run: onVoice, icon: '🎙️', label: 'today_bar_voice', testId: 'phone-voice-record' },
    ...(onImportAudio ? [{ run: () => importRef.current?.click(), icon: '🎧', label: 'vc_import', sub: 'vc_import_sub', testId: 'phone-voice-import' } as const] : []),
  ]

  const btn: CSSProperties = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    minHeight: 56, minWidth: 0, fontSize: 12, color: 'var(--tx)', textDecoration: 'none',
    background: 'none', border: 0, cursor: 'pointer', padding: 4,
  }
  const icon: CSSProperties = { fontSize: 18, lineHeight: 1 }
  const photo = (
    <HoldButton choices={photoChoices} onPick={pick} onMore={() => setSheet('photo')} name={t('js_bar_photo')} testId="phone-bar-doc" style={btn}>
      <span aria-hidden="true" style={icon}>📷</span>{t('js_bar_photo')}
    </HoldButton>
  )

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
            {photo}
            <HoldButton
              choices={voiceChoices}
              onPick={pick}
              onMore={() => setSheet('voice')}
              name={t('today_bar_voice')}
              testId="phone-bar-voice"
              hintBelow
              style={{ ...btn, width: 68, height: 68, minHeight: 68, marginTop: -22, borderRadius: '50%', background: 'var(--ac)', color: 'var(--bg0)', boxShadow: '0 4px 16px rgba(0,0,0,.4)', fontSize: 26 }}
            >
              <span aria-hidden="true">🎙️</span>
            </HoldButton>
          </>
        ) : (
          <HoldButton choices={voiceChoices} onPick={pick} onMore={() => setSheet('voice')} name={t('today_bar_voice')} testId="phone-bar-voice" style={btn}>
            <span aria-hidden="true" style={icon}>🎙️</span>{t('today_bar_voice')}
          </HoldButton>
        )}
        {workSheet ? (
          <HoldButton choices={WORK_CHOICES} onPick={pick} onMore={() => setSheet('work')} name={t('today_bar_work')} testId="phone-bar-work" style={btn}>
            <span aria-hidden="true" style={icon}>🖼️</span>{t('today_bar_work')}
          </HoldButton>
        ) : (
          <Link href={workHref} data-testid="phone-bar-work" style={btn}><span aria-hidden="true" style={icon}>🖼️</span>{t('today_bar_work')}</Link>
        )}
        {stream ? null : photo}
      </nav>
      {/* Voice Memos import: one hidden picker, opened from Vocal's stack or its sheet (a tap, so Safari allows it). */}
      {onImportAudio ? (
        <input ref={importRef} type="file" accept="audio/*,.m4a" hidden data-testid="phone-voice-import-input" onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onImportAudio(f)
        }} />
      ) : null}

      {sheet === 'photo' ? <ChoiceSheet title={t('js_bar_photo')} choices={photoChoices} onClose={() => setSheet(null)} testId="phone-doc-sheet" /> : null}
      {sheet === 'voice' ? <ChoiceSheet title={t('today_bar_voice')} choices={voiceChoices} onClose={() => setSheet(null)} testId="phone-voice-sheet" /> : null}
      {sheet === 'work' ? <ChoiceSheet title={t('today_work_title')} choices={WORK_CHOICES} onClose={() => setSheet(null)} testId="phone-work-sheet" /> : null}
      {writing != null ? <DayWriteSheet day={writeDay ?? todayCalendarDayInParis()} initialText={writing} onClose={() => setWriting(null)} /> : null}
    </>
  )
}
