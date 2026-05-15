'use client'

import Link from 'next/link'
import { useCallback, useState, useTransition, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { submitDocScanCapture } from '@/app/atelier/capture/actions'

type Shot = { id: string; file: File; preview: string }

export function CaptureDocClient() {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [busy, startBusy] = useTransition()
  const [title, setTitle] = useState('')
  const [shots, setShots] = useState<Shot[]>([])

  const onFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list?.length) return
    const added: Shot[] = []
    for (const f of Array.from(list)) {
      if (!f.type.startsWith('image/')) continue
      added.push({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) })
    }
    setShots((prev) => [...prev, ...added].slice(0, 24))
    e.target.value = ''
  }, [])

  const removeShot = (id: string) => {
    setShots((prev) => {
      const s = prev.find((x) => x.id === id)
      if (s) URL.revokeObjectURL(s.preview)
      return prev.filter((x) => x.id !== id)
    })
  }

  const submit = () => {
    if (shots.length === 0) {
      toast.error(t('capture_doc_err_empty'))
      return
    }
    startBusy(async () => {
      const fd = new FormData()
      fd.set('title', title)
      for (const s of shots) fd.append('files', s.file)
      const res = await submitDocScanCapture(fd)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      toast.success(t('capture_doc_ok'))
      window.location.href = res.href
    })
  }

  const inputStyle: CSSProperties = {
    minHeight: 44,
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    background: 'var(--bg0)',
    color: 'var(--tx)',
  }

  return (
    <main
      data-testid="capture-doc-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(80px, calc(24px + env(safe-area-inset-bottom)))',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22, marginBottom: 8 }}>{t('capture_doc_title')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('capture_doc_intro')}
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 12 }}>
        <span>{t('capture_doc_title_label')}</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} style={inputStyle} />
      </label>

      <label
        className="btn ghost"
        style={{
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <span>{t('capture_doc_add_shot')}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture={narrow ? 'environment' : undefined}
          onChange={onFiles}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          aria-label={t('capture_doc_add_shot')}
        />
      </label>

      {shots.length > 0 ? (
        <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('capture_doc_shots_heading')}</div>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {shots.map((s) => (
          <div key={s.id} style={{ position: 'relative', width: 72, height: 72 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.preview} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4 }} />
            <button
              type="button"
              aria-label={t('delete')}
              onClick={() => removeShot(s.id)}
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 28,
                height: 28,
                minHeight: 28,
                borderRadius: 999,
                border: 'none',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                fontSize: 14,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn primary"
        style={{
          minHeight: 44,
          width: '100%',
          position: 'sticky',
          bottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
        disabled={busy || shots.length === 0}
        data-testid="capture-doc-submit"
        onClick={submit}
      >
        {t('capture_doc_submit')}
      </button>

      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 12, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
