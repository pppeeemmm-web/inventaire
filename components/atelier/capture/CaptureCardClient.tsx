'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { ImportedContact } from '@/lib/contact-import-types'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import {
  commitBusinessCardCapture,
  previewBusinessCardCapture,
  type CardCaptureMeta,
} from '@/app/atelier/capture/card-actions'

type Shot = { id: string; file: File; preview: string }

function mapError(t: (k: DictKey) => string, code: string): string {
  if (code === 'empty') return t('capture_card_err_empty')
  if (code === 'ocr_failed') return t('capture_card_ocr_failed')
  if (code === 'no_identity') return t('capture_card_err_no_identity')
  if (code === 'duplicate') return t('capture_card_err_duplicate')
  if (code === 'auth' || code === 'forbidden') return `${t('error_prefix')} ${code}`
  return `${t('error_prefix')} ${code}`
}

function CardPreview({
  contact,
  t,
}: {
  contact: ImportedContact
  t: (k: DictKey) => string
}) {
  const name = [contact.prenom, contact.nom].filter(Boolean).join(' ') || '—'
  return (
    <div
      className="t-mono-sm"
      data-testid="capture-card-preview"
      style={{ color: 'var(--tx)', lineHeight: 1.85, borderTop: '1px solid var(--bd)', paddingTop: 12, marginTop: 12 }}
    >
      <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('capture_card_preview_heading')}</div>
      <div><strong>{name}</strong></div>
      <div>{contact.institution || '—'}</div>
      <div style={{ color: 'var(--tx3)', marginTop: 6 }}>
        {contact.emails.length > 0 && (
          <div>{t('contacts_url_preview_email')} {contact.emails.map((e) => e.email).join(', ')}</div>
        )}
        {contact.phones.length > 0 && (
          <div>{t('contacts_url_preview_phone')} {contact.phones.map((p) => p.phone).join(', ')}</div>
        )}
        {contact.websites.length > 0 && (
          <div>{t('contacts_url_preview_web')} {contact.websites.map((w) => w.url).join(', ')}</div>
        )}
        {contact.role && <div>{t('contacts_url_preview_role')} {contact.role}</div>}
        {contact.notes && (
          <div style={{ marginTop: 6, maxHeight: 100, overflow: 'auto' }}>
            {t('contacts_url_preview_notes')} {contact.notes}
          </div>
        )}
      </div>
    </div>
  )
}

function MetaLine({ meta, t }: { meta: CardCaptureMeta; t: (k: DictKey) => string }) {
  return (
    <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, lineHeight: 1.6, marginTop: 12 }}>
      <div>
        <strong>{t('contacts_url_sources')}</strong>: {meta.sources.length ? meta.sources.join(' · ') : '—'}
      </div>
      <div>
        <strong>{t('contacts_url_llm')}</strong>: {meta.llm}
        {meta.llmNote ? ` — ${meta.llmNote}` : ''}
      </div>
    </div>
  )
}

export function CaptureCardClient() {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [text, setText] = useState('')
  const [shot, setShot] = useState<Shot | null>(null)
  const [parsed, setParsed] = useState<ImportedContact | null>(null)
  const [meta, setMeta] = useState<CardCaptureMeta | null>(null)
  const [busy, startBusy] = useTransition()
  const [aiBusy, setAiBusy] = useState(false)
  const [shrinking, setShrinking] = useState(false)
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  const inputStyle: CSSProperties = {
    minHeight: 120,
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    background: 'var(--bg0)',
    color: 'var(--tx)',
    fontFamily: 'inherit',
  }

  const clearShot = useCallback(() => {
    setShot((s) => {
      if (s) URL.revokeObjectURL(s.preview)
      return null
    })
    setParsed(null)
    setMeta(null)
  }, [])

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked || !picked.type.startsWith('image/')) return
    // Shrink on the phone first, like work photos: a camera photo can pass the 4.5 MB upload cap.
    setShrinking(true)
    const f = await downscaleImageFileForMobileIfNeeded(picked, narrow).catch(() => picked)
    setShrinking(false)
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview)
      return { id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) }
    })
  }, [narrow])

  // « Analyser » reads the text only, with fixed rules: instant, works outdoors, never waits for an AI.
  const canAnalyze = Boolean(text.trim())
  const canImprove = Boolean(shot || text.trim())

  useEffect(() => {
    if (window.location.hash !== '#capture-card-live-text') return
    textRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const focusLiveText = () => {
    textRef.current?.focus()
  }

  const analyze = () => {
    if (!canAnalyze) {
      toast.error(t(shot ? 'cc_need_text' : 'capture_card_err_empty'))
      return
    }
    startBusy(async () => {
      const fd = new FormData()
      fd.set('text', text.trim())
      const res = await previewBusinessCardCapture(fd)
      if ('error' in res) {
        toast.error(mapError(t, res.error))
        return
      }
      setParsed(res.contact)
      setMeta(res.meta)
    })
  }

  // Optional AI pass (photo reading + tidy-up). The server gives up after ~30 s; whatever is already
  // on screen stays as it is when the AI can't be reached.
  const improve = async () => {
    if (!canImprove || aiBusy) return
    setAiBusy(true)
    try {
      const fd = new FormData()
      if (text.trim()) fd.set('text', text.trim())
      if (shot) fd.set('file', shot.file)
      fd.set('refineWithLlm', '1')
      const res = await previewBusinessCardCapture(fd)
      if ('error' in res || (res.meta.llm === 'none' && !res.meta.ocrUsed)) {
        toast.error(t('cc_ai_failed'))
        return
      }
      setParsed(res.contact)
      setMeta(res.meta)
      toast.success(t('cc_ai_done'))
      // eslint-disable-next-line pem-i18n/no-silent-catch -- not silent: the toast says the AI is out of reach
    } catch {
      toast.error(t('cc_ai_failed'))
    } finally {
      setAiBusy(false)
    }
  }

  const createContact = () => {
    if (!parsed) return
    startBusy(async () => {
      let photo: FormData | undefined
      if (shot) {
        photo = new FormData()
        photo.set('file', shot.file)
      }
      const res = await commitBusinessCardCapture(parsed, photo)
      if ('error' in res) {
        toast.error(mapError(t, res.error))
        return
      }
      if (res.photoKept === false) toast.error(t('cc_photo_not_saved'))
      else toast.success(t('capture_card_ok'))
      window.location.href = res.href
    })
  }

  return (
    <main
      data-testid="capture-card-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(80px, calc(24px + env(safe-area-inset-bottom)))',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22 }}>{t('capture_card_title')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 8 }}>
        {t('cc_intro')}
      </p>
      <label
        className="btn ghost"
        style={{
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <span>{shrinking ? t('cc_shrinking') : t('capture_card_add_photo')}</span>
        <input
          type="file"
          accept="image/*"
          capture={narrow ? 'environment' : undefined}
          onChange={onFile}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          aria-label={t('capture_card_add_photo')}
        />
      </label>
      {shot ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: 280, marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shot.preview}
            alt=""
            style={{ width: '100%', borderRadius: 6, objectFit: 'contain', maxHeight: 200 }}
          />
          <button
            type="button"
            aria-label={t('delete')}
            onClick={clearShot}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 32,
              height: 32,
              minHeight: 32,
              borderRadius: 999,
              border: 'none',
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontSize: 14,
            }}
          >
            ×
          </button>
          <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', lineHeight: 1.5, marginTop: 6 }}>
            {t('cc_photo_kept')}
          </div>
          {!text.trim() ? (
            <div data-testid="capture-card-photo-not-read" style={{ fontSize: 13, color: 'var(--ac)', lineHeight: 1.5, marginTop: 8 }}>
              {t('cc_photo_not_read')}
            </div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="btn ghost"
        data-testid="capture-card-live-text-focus"
        onClick={focusLiveText}
        style={{ minHeight: 44, width: '100%', marginBottom: 8 }}
      >
        {t('capture_card_live_text_focus')}
      </button>
      <textarea
        id="capture-card-live-text"
        ref={textRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setParsed(null)
          setMeta(null)
        }}
        placeholder={t('capture_card_placeholder')}
        rows={6}
        style={inputStyle}
        aria-label={t('capture_card_placeholder')}
      />
      <button
        type="button"
        className="btn primary"
        style={{ minHeight: 44, width: '100%', marginTop: 16 }}
        disabled={busy || aiBusy || !canAnalyze}
        data-testid="capture-card-analyze"
        onClick={analyze}
      >
        {busy && !parsed ? t('capture_card_analyzing') : t('capture_card_analyze')}
      </button>
      <button
        type="button"
        className="btn ghost"
        style={{ minHeight: 44, width: '100%', marginTop: 8 }}
        disabled={busy || aiBusy || !canImprove}
        data-testid="capture-card-ai"
        onClick={() => void improve()}
      >
        {aiBusy ? t('cc_ai_busy') : t('cc_ai')}
      </button>
      <p className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', lineHeight: 1.5, marginTop: 6 }}>
        {t('cc_ai_note')}
      </p>
      {meta ? <MetaLine meta={meta} t={t} /> : null}
      {parsed ? <CardPreview contact={parsed} t={t} /> : null}
      {parsed ? (
        <button
          type="button"
          className="btn primary"
          style={{
            minHeight: 44,
            width: '100%',
            marginTop: 16,
            position: 'sticky',
            bottom: 'max(12px, env(safe-area-inset-bottom))',
          }}
          disabled={busy || aiBusy}
          data-testid="capture-card-create"
          onClick={createContact}
        >
          {busy ? t('capture_card_creating') : t('capture_card_create')}
        </button>
      ) : null}
      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 12, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
