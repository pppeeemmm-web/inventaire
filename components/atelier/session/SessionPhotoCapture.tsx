'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl } from '@/lib/data'
import {
  fileListToPending,
  removePendingById,
  revokePending,
  SESSION_PHOTO_PENDING_MAX,
  type SessionPhotoPending,
} from '@/lib/mobile/session-photo-pending'
import type { WorkSessionShot } from '@/lib/work-session-payload'
import type { LightroomReturnContext } from '@/lib/mobile/lightroom-return'
import { setLightroomReturn } from '@/lib/mobile/lightroom-return'
import { LightroomCaptureGuide } from '@/components/shared/LightroomCaptureGuide'

export type SessionPhotoCaptureProps = {
  disabled?: boolean
  busy?: boolean
  /** When true, photos upload immediately after pick (no extra confirm step). */
  instantUpload?: boolean
  /** When set, "Open Lightroom" remembers this session for share-return. */
  lightroomReturn?: LightroomReturnContext | null
  stagedShots: WorkSessionShot[]
  onUpload: (files: File[]) => void | Promise<void>
  onRemoveStaged: (sha256: string) => void | Promise<void>
}

export function SessionPhotoCapture({
  disabled = false,
  busy = false,
  instantUpload = false,
  lightroomReturn = null,
  stagedShots,
  onUpload,
  onRemoveStaged,
}: SessionPhotoCaptureProps) {
  const { t } = useI18n()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<SessionPhotoPending[]>([])
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  useEffect(() => () => revokePending(pendingRef.current), [])

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    setPending((prev) => {
      const added = fileListToPending(files, prev.length + stagedShots.length)
      if (added.length === 0) return prev
      const next = [...prev, ...added]
      if (next.length > SESSION_PHOTO_PENDING_MAX) {
        const overflow = next.slice(SESSION_PHOTO_PENDING_MAX)
        revokePending(overflow)
        return next.slice(0, SESSION_PHOTO_PENDING_MAX)
      }
      return next
    })
  }, [stagedShots.length])

  const flushFiles = (files: FileList | null) => {
    if (!files?.length) return
    if (instantUpload) {
      void onUpload(Array.from(files))
      return
    }
    addFiles(files)
  }

  const onCameraChange = (e: ChangeEvent<HTMLInputElement>) => {
    flushFiles(e.target.files)
    e.target.value = ''
  }

  const onLibraryChange = (e: ChangeEvent<HTMLInputElement>) => {
    flushFiles(e.target.files)
    e.target.value = ''
  }

  const removePending = (id: string) => {
    setPending((prev) => removePendingById(prev, id))
  }

  const uploadPending = () => {
    if (pending.length === 0) return
    const files = pending.map((p) => p.file)
    revokePending(pending)
    setPending([])
    void onUpload(files)
  }

  const blocked = disabled || busy
  const accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,.heic'

  return (
    <div
      data-testid="session-photo-capture"
      className="t-mono-sm"
      style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <span>{t('session_upload_label')}</span>

      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        multiple
        style={{ display: 'none' }}
        onChange={onCameraChange}
        tabIndex={-1}
        aria-hidden
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept={accept}
        multiple
        style={{ display: 'none' }}
        onChange={onLibraryChange}
        tabIndex={-1}
        aria-hidden
      />

      <LightroomCaptureGuide
        testId="session-photo-lightroom"
        onPrepareReturn={
          lightroomReturn ? () => setLightroomReturn(lightroomReturn) : undefined
        }
      />

      <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn ghost"
          data-testid="session-photo-take"
          disabled={blocked}
          onClick={() => cameraInputRef.current?.click()}
          style={{ minHeight: 44, flex: '1 1 140px' }}
        >
          {t('session_photo_take')}
        </button>
        <button
          type="button"
          className="btn ghost"
          data-testid="session-photo-library"
          disabled={blocked}
          onClick={() => libraryInputRef.current?.click()}
          style={{ minHeight: 44, flex: '1 1 140px' }}
        >
          {t('session_photo_choose_library')}
        </button>
      </div>

      {busy && instantUpload ? (
        <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', margin: 0 }}>
          {t('session_photo_uploading')}
        </p>
      ) : null}

      {!instantUpload && pending.length > 0 ? (
        <div data-testid="session-photo-pending">
          <div className="t-eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
            {t('session_photo_pending_heading')}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, overscrollBehavior: 'contain' }}>
            {pending.map((p) => (
              <div key={p.id} style={{ position: 'relative', width: 72, height: 72, flex: '0 0 auto' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.preview}
                  alt=""
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }}
                />
                <button
                  type="button"
                  aria-label={t('session_photo_remove_aria')}
                  disabled={blocked}
                  onClick={() => removePending(p.id)}
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
            data-testid="session-photo-upload"
            disabled={blocked}
            onClick={uploadPending}
            style={{ minHeight: 44, width: '100%', marginTop: 10 }}
          >
            {t('session_photo_upload').replace('{n}', String(pending.length))}
          </button>
        </div>
      ) : null}

      {stagedShots.length > 0 ? (
        <div data-testid="session-photo-staged">
          <div className="t-eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
            {t('session_photo_staged_heading')}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, overscrollBehavior: 'contain' }}>
            {stagedShots.map((shot) => (
              <div key={shot.sha256} style={{ position: 'relative', width: 72, height: 72, flex: '0 0 auto' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(shot.thumb_r2_key ?? shot.r2_key) ?? ''}
                  alt=""
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }}
                />
                <button
                  type="button"
                  data-testid="session-photo-remove-staged"
                  aria-label={t('session_photo_remove_aria')}
                  disabled={blocked}
                  onClick={() => void onRemoveStaged(shot.sha256)}
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
        </div>
      ) : null}
    </div>
  )
}
