'use client'

// Review tool (docs/design/2026-11-28/ReviewTool.md, steps 2–3): « ⚑ Revue » in the Atelier header (or Ctrl+Shift+K)
// opens a small window that stays on top of Chrome (Document Picture-in-Picture; elsewhere a panel in the page).
// Bug → a Kaizen item in « App » (createKaizen + addKaizenScreenshot); Idée → a note on today's Journal page
// (createJournalEntry). Context (page, build, device, pointed element) is filled by itself. No new door.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n/context'
import { addKaizenScreenshot, createKaizen } from '@/app/atelier/(portal)/kaizen/actions'
import { createJournalEntry } from '@/app/atelier/(portal)/journal/entry-actions'
import { todayCalendarDayInParis } from '@/lib/session-calendar-day'
import { getLiveDictationAvailability, startLiveDictation, type LiveDictationSession } from '@/lib/voice/web-speech'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'

type Kind = 'bug' | 'idea'
type Pointed = { label: string; rect: DOMRect }
type Shot = { file: File; url: string }
type PipWindow = Window & { document: Document }
type PipApi = { requestWindow: (o: { width: number; height: number }) => Promise<PipWindow> }

const MAX_SHOTS = 6

function pipApi(): PipApi | null {
  return typeof window !== 'undefined' ? ((window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture ?? null) : null
}

/** The app's styles and theme into the pop-out, so it looks like the app. */
function copyStyles(to: Document) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = to.createElement('style')
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
      to.head.appendChild(style)
      // eslint-disable-next-line pem-i18n/no-silent-catch -- a cross-origin sheet has no readable rules: linked instead
    } catch {
      if (sheet.href) {
        const link = to.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        to.head.appendChild(link)
      }
    }
  }
  for (const a of Array.from(document.documentElement.attributes)) to.documentElement.setAttribute(a.name, a.value)
  to.body.style.margin = '0'
  to.body.style.background = 'var(--bg0)'
}

/** What a pointed element is called: its test id, else its visible text, else its tag. */
function labelOf(el: Element): string {
  const tid = el.closest('[data-testid]')?.getAttribute('data-testid')
  if (tid) return tid
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 60) : el.tagName.toLowerCase()
}

async function readBuild(): Promise<string> {
  const host = window.location.hostname
  const where = host === 'www.thepemworkshop.com' ? 'live' : host.endsWith('.vercel.app') ? 'preview' : 'dev'
  const r = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' }).catch(() => null)
  const sha = r?.headers.get('x-build-sha') ?? ''
  return `${where} ${sha.slice(0, 7)}`.trim()
}

/** One frame of this tab (Chrome asks « share this tab » once per capture), the pointed box drawn on it. */
async function captureTab(pointed: Pointed | null): Promise<File> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true } as DisplayMediaStreamOptions)
  try {
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play()
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const g = canvas.getContext('2d')
    if (!g) throw new Error('canvas')
    g.drawImage(video, 0, 0)
    if (pointed) {
      const k = video.videoWidth / window.innerWidth
      g.strokeStyle = '#e0352b'
      g.lineWidth = Math.max(3, 3 * k)
      g.strokeRect(pointed.rect.left * k - 4, pointed.rect.top * k - 4, pointed.rect.width * k + 8, pointed.rect.height * k + 8)
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
    if (!blob) throw new Error('blob')
    return new File([blob], `revue-${Date.now()}.jpg`, { type: 'image/jpeg' })
  } finally {
    stream.getTracks().forEach((tr) => tr.stop())
  }
}

export function ReviewButton({ style }: { style?: CSSProperties }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [pip, setPip] = useState<PipWindow | null>(null)

  const close = useCallback(() => {
    pip?.close()
    setPip(null)
    setOpen(false)
  }, [pip])

  const openWindow = useCallback(async () => {
    if (open) return
    const api = pipApi()
    if (api) {
      try {
        const w = await api.requestWindow({ width: 380, height: 560 })
        copyStyles(w.document)
        w.addEventListener('pagehide', () => { setPip(null); setOpen(false) })
        setPip(w)
        // eslint-disable-next-line pem-i18n/no-silent-catch -- pop-out refused: the panel opens in the page instead
      } catch {
        setPip(null)
      }
    }
    setOpen(true)
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        void openWindow()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openWindow])

  const panel = open ? <ReviewPanel onClose={close} inPip={!!pip} /> : null
  return (
    <>
      <button type="button" className="btn ghost sm" data-testid="atelier-header-review" title={`${t('review_open')} (Ctrl+Shift+K)`} onClick={() => void openWindow()} style={style}>
        ⚑ {t('review_button')}
      </button>
      {panel && pip ? createPortal(panel, pip.document.body) : null}
      {panel && !pip ? (
        <div style={{ position: 'fixed', right: 16, bottom: 16, width: 360, zIndex: 9000, border: '1px solid var(--bd)', background: 'var(--bg0)', boxShadow: '0 8px 30px rgba(0,0,0,.25)' }}>{panel}</div>
      ) : null}
    </>
  )
}

/**
 * Phone (ReviewTool.md step 5): ⚑ in the phone menu opens the same panel as a sheet. No pointing and no tab capture
 * (Safari cannot capture the screen): « Joindre une capture » takes screenshots from Photos.
 */
export function PhoneReviewSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
    <PhoneSheet title={`⚑ ${t('review_title')}`} onClose={onClose} testId="phone-review-sheet">
      <ReviewPanel onClose={onClose} inPip={false} phone />
    </PhoneSheet>
  )
}

function ReviewPanel({ onClose, inPip, phone = false }: { onClose: () => void; inPip: boolean; phone?: boolean }) {
  const { t, lang } = useI18n()
  const [kind, setKind] = useState<Kind>('bug')
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  /** Words came from dictation: the Journal keeps them « voice, unverified » until checked. */
  const [dictated, setDictated] = useState(false)
  const [pointing, setPointing] = useState(false)
  const [pointed, setPointed] = useState<Pointed | null>(null)
  const [shots, setShots] = useState<Shot[]>([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const session = useRef<LiveDictationSession | null>(null)

  useEffect(() => () => { session.current?.stop() }, [])
  useEffect(() => () => { shots.forEach((s) => URL.revokeObjectURL(s.url)) }, [shots])

  const toggleVoice = async () => {
    if (listening) { session.current?.stop(); session.current = null; setListening(false); return }
    if (getLiveDictationAvailability() !== 'ready') { setResult({ ok: false, text: t('review_voice_unavailable') }); return }
    setListening(true)
    const s = await startLiveDictation(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      onInterim: () => {},
      onFinal: (chunk) => { setDictated(true); setText((x) => `${x} ${chunk}`.trim()) },
      onError: () => setListening(false),
    })
    session.current = s
    if (!s.ok) setListening(false)
  }

  // 🎯 Point: hover outlines an element of the app page; a click picks it (and does nothing else); Esc cancels.
  useEffect(() => {
    if (!pointing) return
    let last: HTMLElement | null = null
    const unmark = () => { if (last) { last.style.outline = ''; last = null } }
    const over = (e: MouseEvent) => {
      unmark()
      last = e.target as HTMLElement
      last.style.outline = '2px solid #e0352b'
    }
    const pick = (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const el = e.target as Element
      unmark()
      setPointed({ label: labelOf(el), rect: el.getBoundingClientRect() })
      setPointing(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { unmark(); setPointing(false) } }
    document.addEventListener('mouseover', over, true)
    document.addEventListener('click', pick, true)
    document.addEventListener('keydown', esc, true)
    return () => {
      unmark()
      document.removeEventListener('mouseover', over, true)
      document.removeEventListener('click', pick, true)
      document.removeEventListener('keydown', esc, true)
    }
  }, [pointing])

  // Phone: screenshots picked from Photos, shrunk on the device before upload (the Server Action body limit).
  const attach = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, MAX_SHOTS - shots.length)
    const ready = await Promise.all(picked.map((f) => downscaleImageFileForMobileIfNeeded(f, true)))
    setShots((s) => [...s, ...ready.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_SHOTS))
  }

  const shoot = async () => {
    if (shots.length >= MAX_SHOTS) return
    try {
      const file = await captureTab(pointed)
      setShots((s) => [...s, { file, url: URL.createObjectURL(file) }])
      // eslint-disable-next-line pem-i18n/no-silent-catch -- shown in the window (review_shot_failed)
    } catch {
      setResult({ ok: false, text: t('review_shot_failed') })
    }
  }

  const send = async () => {
    const clean = text.trim()
    if (!clean || busy) return
    setBusy(true)
    setResult(null)
    const page = `${window.location.pathname}${window.location.search}`
    if (kind === 'idea') {
      const r = await createJournalEntry({ day: todayCalendarDayInParis(), kind: 'note', body: `${clean}\n\n${page}`, dictated })
      setBusy(false)
      if ('error' in r) { setResult({ ok: false, text: t('review_refused_fmt').replace('{e}', r.error) }); return }
      setResult({ ok: true, text: t('review_sent_idea') })
      setText('')
      setDictated(false)
      return
    }
    const [first, ...rest] = clean.split('\n')
    const context = {
      page,
      build: await readBuild(),
      device: `${window.innerWidth}×${window.innerHeight} · ${navigator.userAgent.match(/(Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? ''}`,
      pointed: pointed?.label,
    }
    const r = await createKaizen({ title: first ?? clean, body: rest.join('\n'), section: 'app', context })
    if ('error' in r) { setBusy(false); setResult({ ok: false, text: t('review_refused_fmt').replace('{e}', r.error) }); return }
    let failedShots = 0
    for (const s of shots) {
      const fd = new FormData()
      fd.append('file', s.file)
      const up = await addKaizenScreenshot(r.item.id, fd)
      if ('error' in up) failedShots++
    }
    setBusy(false)
    setResult({
      ok: failedShots === 0,
      text: t('review_sent_bug_fmt').replace('{id}', String(r.item.id)) + (failedShots ? ` · ${t('review_shots_failed_fmt').replace('{n}', String(failedShots))}` : ''),
    })
    setText('')
    setDictated(false)
    setShots([])
    setPointed(null)
  }

  const seg = (k: Kind, label: string) => (
    <button type="button" aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`review-kind-${k}`}
      style={{ flex: 1, minHeight: 44, border: 0, cursor: 'pointer', font: 'inherit', fontSize: 13, background: kind === k ? 'var(--tx)' : 'transparent', color: kind === k ? 'var(--bg0)' : 'var(--tx2)' }}>
      {label}
    </button>
  )

  return (
    <div data-testid="review-panel" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: phone ? '4px 0' : 14, color: 'var(--tx)', background: 'var(--bg0)', minHeight: inPip ? '100vh' : undefined, boxSizing: 'border-box' }}>
      {phone ? null : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="serif" style={{ fontSize: 18, flex: 1 }}>⚑ {t('review_title')}</div>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label={t('review_close')} style={{ minWidth: 40, minHeight: 40 }}>✕</button>
        </div>
      )}
      <div role="group" style={{ display: 'flex', border: '1px solid var(--bd)' }}>
        {seg('bug', t('review_kind_bug'))}
        {seg('idea', t('review_kind_idea'))}
      </div>
      <textarea className="input" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('review_text_ph')} aria-label={t('review_text_ph')} data-testid="review-text" style={{ resize: 'vertical', fontSize: phone ? 16 : 14 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" className="btn sm" aria-pressed={listening} onClick={() => void toggleVoice()} style={{ minHeight: 44, borderColor: listening ? 'var(--rust)' : undefined }}>
          🎙 {listening ? t('review_voice_stop') : t('review_voice')}
        </button>
        {kind === 'bug' && phone ? (
          <label className="btn sm" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', opacity: shots.length >= MAX_SHOTS ? 0.5 : 1 }} data-testid="review-attach">
            📷 {t('review_attach_fmt').replace('{n}', String(shots.length)).replace('{max}', String(MAX_SHOTS))}
            <input type="file" accept="image/*" multiple hidden disabled={shots.length >= MAX_SHOTS} onChange={(e) => { void attach(e.target.files); e.target.value = '' }} />
          </label>
        ) : null}
        {kind === 'bug' && !phone ? (
          <>
            <button type="button" className="btn sm" aria-pressed={pointing} onClick={() => setPointing((p) => !p)} style={{ minHeight: 40 }} data-testid="review-point">
              🎯 {pointing ? t('review_point_cancel') : t('review_point')}
            </button>
            <button type="button" className="btn sm" disabled={shots.length >= MAX_SHOTS} onClick={() => void shoot()} style={{ minHeight: 40 }} data-testid="review-shot">
              📷 {t('review_shot_fmt').replace('{n}', String(shots.length)).replace('{max}', String(MAX_SHOTS))}
            </button>
          </>
        ) : null}
      </div>
      {pointing ? <p className="t-mono-sm" style={{ margin: 0, color: 'var(--rust)' }}>{t('review_point_hint')}</p> : null}
      {kind === 'bug' && pointed ? (
        <div className="t-mono-sm" style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--tx2)' }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎯 {pointed.label}</span>
          <button type="button" className="btn ghost sm" onClick={() => setPointed(null)} aria-label={t('review_point_clear')}>✕</button>
        </div>
      ) : null}
      {kind === 'bug' && shots.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {shots.map((s, i) => (
            <button key={s.url} type="button" onClick={() => setShots((all) => all.filter((_, j) => j !== i))} aria-label={t('review_shot_remove')} style={{ padding: 0, border: '1px solid var(--bd)', background: 'none', cursor: 'pointer' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, never a stored image */}
              <img src={s.url} alt="" style={{ width: 72, height: 48, objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      ) : null}
      <p className="t-mono-sm" style={{ margin: 0, color: 'var(--tx3)' }}>{kind === 'bug' ? t('review_bug_hint') : t('review_idea_hint')}</p>
      <button type="button" className="btn primary" disabled={busy || !text.trim()} onClick={() => void send()} data-testid="review-send" style={{ minHeight: 44 }}>
        {busy ? t('review_sending') : t('review_send')}
      </button>
      {result ? (
        <p role="status" className="t-mono-sm" data-testid="review-result" style={{ margin: 0, color: result.ok ? 'var(--sage)' : 'var(--rust)' }}>{result.text}</p>
      ) : null}
    </div>
  )
}
