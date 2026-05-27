'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { WORK_IMAGE_ZIP_MAX_IDS } from '@/lib/export/work-image-zip'

type Mode = 'cover' | 'all'

interface Props {
  ids: number[]
  onClose: () => void
}

export function SelectionImagesDownloadModal({ ids, onClose }: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('cover')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overLimit = ids.length > WORK_IMAGE_ZIP_MAX_IDS

  async function handleDownload() {
    if (overLimit || busy || ids.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/export/work-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, mode }),
      })
      if (!res.ok) {
        let msg = `${res.status}`
        try {
          const j = (await res.json()) as { error?: string }
          if (j.error) msg = j.error
        } catch {
          /* ignore */
        }
        setError(msg)
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const m = cd.match(/filename="([^"]+)"/)
      const filename = m?.[1] ?? `pem-works-images.zip`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PemModalOverlay
      onClose={() => {
        if (!busy) onClose()
      }}
      panelStyle={{
        width: 'min(420px, calc(100vw - 32px))',
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        padding: 24,
        boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
      }}
    >
      <div
        aria-labelledby="selection-images-download-title"
        data-testid="selection-images-download-modal"
      >
        <div id="selection-images-download-title" className="t-eyebrow" style={{ marginBottom: 8 }}>
          {t('selection_images_download_title')}
        </div>
        <p style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, margin: '0 0 16px' }}>
          {t('selection_images_download_blurb').replace('{count}', String(ids.length))}
        </p>

        <fieldset style={{ border: 'none', margin: 0, padding: 0, marginBottom: 16 }}>
          <legend className="t-label" style={{ marginBottom: 8 }}>
            {t('selection_images_mode_label')}
          </legend>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="radio"
              name="zip-mode"
              checked={mode === 'cover'}
              disabled={busy}
              onChange={() => setMode('cover')}
            />
            <span style={{ fontSize: 12, color: 'var(--tx)' }}>{t('selection_images_cover_only')}</span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="radio"
              name="zip-mode"
              checked={mode === 'all'}
              disabled={busy}
              onChange={() => setMode('all')}
            />
            <span style={{ fontSize: 12, color: 'var(--tx)' }}>{t('selection_images_all_slots')}</span>
          </label>
        </fieldset>

        {overLimit ? (
          <p style={{ fontSize: 11, color: 'var(--rust)', marginBottom: 12 }}>
            {t('selection_images_max_fmt').replace('{max}', String(WORK_IMAGE_ZIP_MAX_IDS))}
          </p>
        ) : null}

        {error ? (
          <p style={{ fontSize: 11, color: 'var(--rust)', marginBottom: 12 }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn primary sm"
            data-testid="selection-images-download-confirm"
            disabled={busy || overLimit || ids.length === 0}
            onClick={() => void handleDownload()}
          >
            {busy ? t('selection_images_downloading') : t('selection_images_download_confirm')}
          </button>
        </div>
      </div>
    </PemModalOverlay>
  )
}
