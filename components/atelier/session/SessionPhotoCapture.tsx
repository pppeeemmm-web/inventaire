'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl } from '@/lib/data'
import {
  fileListToPending,
  removePendingById,
  revokePending,
  SESSION_PHOTO_PENDING_MAX,
  type SessionPhotoPending,
} from '@/lib/mobile/session-photo-pending'
import { surfaceError, surfaceWarn } from '@/lib/error-reporter/client'
import type { WorkSessionAppliedShot, WorkSessionShot } from '@/lib/work-session-payload'

export type SessionPhotoCaptureProps = {
  disabled?: boolean
  busy?: boolean
  /** When true, photos upload immediately after pick (no extra confirm step). */
  instantUpload?: boolean
  stagedShots: WorkSessionShot[]
  /** Photos already committed to the work. Shown so a past day can be checked, and
   *  a wrong picture corrected — removing one deletes it from the catalogue. */
  appliedShots?: WorkSessionAppliedShot[]
  onUpload: (files: File[]) => void | Promise<void>
  onRemoveStaged: (sha256: string) => void | Promise<void>
  onRemoveApplied?: (imageId: number) => void | Promise<void>
}

export function SessionPhotoCapture({
  disabled = false,
  busy = false,
  instantUpload = false,
  stagedShots,
  appliedShots = [],
  onUpload,
  onRemoveStaged,
  onRemoveApplied,
}: SessionPhotoCaptureProps) {
  const { t } = useI18n()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<SessionPhotoPending[]>([])
  // Photos handed to onUpload and not yet acknowledged by the server. In instant mode
  // nothing was rendered between the pick and the round-trip, so a slow phone upload
  // looked like a dead button — this is the missing feedback.
  const [inFlight, setInFlight] = useState<SessionPhotoPending[]>([])
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const inFlightRef = useRef(inFlight)
  inFlightRef.current = inFlight

  useEffect(
    () => () => {
      revokePending(pendingRef.current)
      revokePending(inFlightRef.current)
    },
    [],
  )

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return
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

  const flushFiles = async (files: File[]) => {
    if (files.length === 0) return
    if (!instantUpload) {
      addFiles(files)
      return
    }
    const previews = fileListToPending(files, stagedShots.length)
    setInFlight((prev) => [...prev, ...previews])
    try {
      await onUpload(files)
    } finally {
      revokePending(previews)
      setInFlight((prev) => prev.filter((p) => !previews.some((q) => q.id === p.id)))
    }
  }

  /**
   * Copy the picked bytes into memory before anything else touches the input.
   *
   * A File from the picker is a handle onto a file the browser owns, not the bytes.
   * The upload path reads it twice, seconds apart (`createImageBitmap`, then the
   * FormData send), and iOS can revoke that handle in between — input reset, tab
   * backgrounded, picker temp file reclaimed. The read then fails after the fact,
   * which is how a photo disappeared with no request and no error. Snapshotting
   * here removes the whole class of failure: everything downstream works on bytes
   * we own.
   */
  const snapshotPicked = async (list: FileList | null): Promise<File[]> => {
    const picked = list ? Array.from(list) : []
    const out: File[] = []
    for (const f of picked) {
      const buf = await f.arrayBuffer()
      out.push(new File([buf], f.name || 'photo', { type: f.type || 'image/jpeg' }))
    }
    return out
  }

  const onPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    let snapshot: File[] = []
    try {
      snapshot = await snapshotPicked(input.files)
    } catch (err) {
      surfaceError(t('session_photo_read_failed'), err, {
        source: 'SessionPhotoCapture.snapshotPicked',
      })
      input.value = ''
      return
    }
    // The picker handing back nothing is a real failure mode (iOS does it for formats
    // it will not map). It used to return silently, which reads as a dead button.
    if (snapshot.length === 0) {
      surfaceWarn(t('session_photo_none_picked'), undefined, {
        source: 'SessionPhotoCapture.onPicked',
      })
      input.value = ''
      return
    }
    // Safe to reset now: we no longer depend on the input holding the files.
    input.value = ''
    await flushFiles(snapshot)
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
  // Broad on purpose: a narrow MIME allow-list makes the iOS picker hand back an
  // empty selection for formats it does not map (AVIF), which reads as "nothing
  // happened". The server still validates by magic bytes and rejects the rest.
  const accept = 'image/*,.heic,.heif,.avif'

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
        onChange={onPicked}
        tabIndex={-1}
        aria-hidden
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept={accept}
        multiple
        style={{ display: 'none' }}
        onChange={onPicked}
        tabIndex={-1}
        aria-hidden
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

      {inFlight.length > 0 ? (
        <div data-testid="session-photo-inflight">
          <div className="t-eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
            {t('session_photo_uploading')}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, overscrollBehavior: 'contain' }}>
            {inFlight.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.preview}
                alt=""
                style={{
                  width: 72,
                  height: 72,
                  flex: '0 0 auto',
                  objectFit: 'cover',
                  borderRadius: 4,
                  border: '1px dashed var(--ac)',
                  opacity: 0.55,
                }}
              />
            ))}
          </div>
        </div>
      ) : busy && instantUpload ? (
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

      {appliedShots.length > 0 ? (
        <div data-testid="session-photo-applied">
          <div className="t-eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
            {t('session_photo_applied_heading')}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, overscrollBehavior: 'contain' }}>
            {appliedShots.map((shot) => (
              <div key={shot.image_id} style={{ position: 'relative', width: 72, height: 72, flex: '0 0 auto' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl(shot.r2_key, 144) ?? ''}
                  alt=""
                  style={{
                    width: 72,
                    height: 72,
                    objectFit: 'cover',
                    borderRadius: 4,
                    border: shot.is_cover ? '2px solid var(--ac)' : '1px solid var(--bd)',
                  }}
                />
                {onRemoveApplied ? (
                  <button
                    type="button"
                    data-testid="session-photo-remove-applied"
                    aria-label={t('session_photo_remove_applied_aria')}
                    disabled={busy}
                    onClick={() => void onRemoveApplied(shot.image_id)}
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
                ) : null}
              </div>
            ))}
          </div>
          <p className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', margin: '6px 0 0', lineHeight: 1.4 }}>
            {t('session_photo_applied_hint')}
          </p>
        </div>
      ) : null}
    </div>
  )
}
