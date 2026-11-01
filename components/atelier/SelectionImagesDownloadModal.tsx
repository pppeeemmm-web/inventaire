'use client'

import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { WORK_IMAGE_ZIP_MAX_IDS } from '@/lib/export/work-image-zip'

type Mode = 'cover' | 'all'

interface Props {
  ids: number[]
  onClose: () => void
  /** Set when the list comes from a partly loaded catalogue (Inventory): "{loaded} of {total}". */
  loadedOfTotal?: { loaded: number; total: number }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Full-size image ZIPs for any number of works. The server packs at most
 * `WORK_IMAGE_ZIP_MAX_IDS` works per request, so larger lists download as numbered
 * archives one after another (`…-01-of-12.zip`). Each archive carries `_manifest.txt`.
 */
export function SelectionImagesDownloadModal({ ids, onClose, loadedOfTotal }: Props) {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('cover')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const stopRef = useRef(false)

  const batches: number[][] = []
  for (let i = 0; i < ids.length; i += WORK_IMAGE_ZIP_MAX_IDS) batches.push(ids.slice(i, i + WORK_IMAGE_ZIP_MAX_IDS))

  async function handleDownload() {
    if (busy || ids.length === 0) return
    setBusy(true)
    setError(null)
    setSummary(null)
    stopRef.current = false
    const stamp = new Date().toISOString().slice(0, 10)
    let saved = 0
    let empty = 0
    try {
      for (let i = 0; i < batches.length; i++) {
        if (stopRef.current) break
        setProgress({ done: i, total: batches.length })
        const res = await fetch('/api/export/work-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batches[i], mode }),
        })
        if (res.status === 404) {
          // No image for any work in this batch — nothing to save, keep going.
          empty += 1
          continue
        }
        if (!res.ok) {
          let msg = `${res.status}`
          try {
            const j = (await res.json()) as { error?: string }
            if (j.error) msg = j.error
          // eslint-disable-next-line pem-i18n/no-silent-catch -- error body may not be JSON; the status is shown instead
          } catch {
            /* non-JSON error body: keep the status code */
          }
          setError(msg)
          return
        }
        const blob = await res.blob()
        const filename = batches.length === 1
          ? `pem-works-images-${stamp}-${ids.length}.zip`
          : `pem-works-images-${stamp}-${pad2(i + 1)}-of-${pad2(batches.length)}.zip`
        saveBlob(blob, filename)
        saved += 1
      }
      setProgress(null)
      if (batches.length === 1 && saved === 1) {
        onClose()
        return
      }
      setSummary(
        t('selection_images_done_fmt')
          .replace('{saved}', String(saved))
          .replace('{total}', String(batches.length))
          .replace('{empty}', String(empty)),
      )
    // eslint-disable-next-line pem-i18n/no-silent-catch -- surfaced in the dialog via setError
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      setProgress(null)
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
        <p style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, margin: '0 0 8px' }}>
          {t('selection_images_download_blurb').replace('{count}', String(ids.length))}
        </p>
        {batches.length > 1 ? (
          <p data-testid="selection-images-batches" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, margin: '0 0 8px' }}>
            {t('selection_images_batches_fmt')
              .replace('{batches}', String(batches.length))
              .replace('{max}', String(WORK_IMAGE_ZIP_MAX_IDS))}
          </p>
        ) : null}
        {loadedOfTotal && loadedOfTotal.loaded < loadedOfTotal.total ? (
          <p style={{ fontSize: 11, color: 'var(--rust)', lineHeight: 1.5, margin: '0 0 8px' }}>
            {t('selection_images_partial_fmt')
              .replace('{loaded}', String(loadedOfTotal.loaded))
              .replace('{total}', String(loadedOfTotal.total))}
          </p>
        ) : null}

        <fieldset style={{ border: 'none', margin: '8px 0 16px', padding: 0 }}>
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

        {progress ? (
          <p data-testid="selection-images-progress" style={{ fontSize: 11, color: 'var(--tx2)', marginBottom: 12 }} aria-live="polite">
            {t('selection_images_progress_fmt')
              .replace('{n}', String(progress.done + 1))
              .replace('{total}', String(progress.total))}
          </p>
        ) : null}

        {summary ? (
          <p data-testid="selection-images-summary" style={{ fontSize: 11, color: 'var(--tx2)', marginBottom: 12 }} aria-live="polite">
            {summary}
          </p>
        ) : null}

        {error ? (
          <p style={{ fontSize: 11, color: 'var(--rust)', marginBottom: 12 }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
          {busy && batches.length > 1 ? (
            <button type="button" className="btn ghost sm" onClick={() => { stopRef.current = true }}>
              {t('selection_images_stop')}
            </button>
          ) : (
            <button type="button" className="btn ghost sm" disabled={busy} onClick={onClose}>
              {summary ? t('close') : t('cancel')}
            </button>
          )}
          <button
            type="button"
            className="btn primary sm"
            data-testid="selection-images-download-confirm"
            disabled={busy || ids.length === 0}
            onClick={() => void handleDownload()}
          >
            {busy ? t('selection_images_downloading') : t('selection_images_download_confirm')}
          </button>
        </div>
      </div>
    </PemModalOverlay>
  )
}
