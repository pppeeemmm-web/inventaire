'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import {
  applyWorkSessionToOeuvre,
  createAndLinkWorkFromSession,
  createWorkSessionDraft,
  getSessionNewPageContext,
  getWorkSessionDraftFields,
  getWorkSessionShotCount,
  linkWorkSessionToOeuvre,
  listWorkSessionsForAdminReview,
  rejectWorkSession,
  submitWorkSessionForReview,
  updateWorkSessionMetadata,
  uploadWorkSessionShot,
} from '@/app/atelier/session/actions'
import type { WorkSessionQueueRow } from '@/app/atelier/session/actions'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'
import { captureFieldContext, type CaptureFieldContextErrorCode } from '@/lib/field-context'
import { parseWorkSessionPayload, type WorkSessionFieldContext } from '@/lib/work-session-payload'

export function SessionNewClient() {
  const { t, lang } = useI18n()
  const sp = useSearchParams()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [, startBoot] = useTransition()
  const [busy, startBusy] = useTransition()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [oeuvreInput, setOeuvreInput] = useState('')
  const [notes, setNotes] = useState('')
  const [titleHint, setTitleHint] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [shotCount, setShotCount] = useState(0)
  const [pending, setPending] = useState<WorkSessionQueueRow[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [fieldContext, setFieldContext] = useState<WorkSessionFieldContext | null>(null)
  const [workMode, setWorkMode] = useState<'existing' | 'new'>('existing')
  const [linkedOeuvreId, setLinkedOeuvreId] = useState<number | null>(null)

  const workQ = sp.get('work')?.trim()
  const initialOeuvre = workQ ? Number.parseInt(workQ, 10) : NaN
  const initialOk = Number.isFinite(initialOeuvre) && initialOeuvre > 0

  const refreshPending = useCallback(() => {
    if (!isAdmin) return
    void listWorkSessionsForAdminReview().then(setPending)
  }, [isAdmin])

  useEffect(() => {
    startBoot(() => {
      void (async () => {
        const ctx = await getSessionNewPageContext()
        setAuthed(ctx.authed)
        setIsAdmin(ctx.isAdmin)
        if (!ctx.authed) {
          setSessionId(null)
          return
        }
        const r = await createWorkSessionDraft(initialOk ? initialOeuvre : null)
        if ('error' in r) {
          toast.error(r.error)
          return
        }
        setSessionId(r.id)
        if (initialOk) {
          setOeuvreInput(String(initialOeuvre))
          setLinkedOeuvreId(initialOeuvre)
        }
        const df = await getWorkSessionDraftFields(r.id)
        if ('ok' in df && df.ok) {
          setNotes(df.fields.notes)
          setTitleHint(df.fields.title_hint)
          setWidthCm(df.fields.width_cm)
          setHeightCm(df.fields.height_cm)
          setFieldContext(df.fields.field_context)
          if (df.oeuvre_id) {
            setLinkedOeuvreId(df.oeuvre_id)
            setOeuvreInput(String(df.oeuvre_id))
          }
        }
        const n = await getWorkSessionShotCount(r.id)
        setShotCount(n)
        if (ctx.isAdmin) {
          const rows = await listWorkSessionsForAdminReview()
          setPending(rows)
        }
      })().finally(() => setHydrated(true))
    })
  }, [initialOk, initialOeuvre])

  useEffect(() => {
    refreshPending()
  }, [refreshPending])

  const fieldContextErrorToast = useCallback(
    (code: CaptureFieldContextErrorCode) => {
      const key: Record<CaptureFieldContextErrorCode, DictKey> = {
        geo_denied: 'session_field_context_geo_denied',
        geo_unavailable: 'session_field_context_geo_unavailable',
        geo_timeout: 'session_field_context_geo_timeout',
        weather_failed: 'session_field_context_weather_failed',
      }
      toast.error(t(key[code]))
    },
    [t],
  )

  const pushMeta = useCallback(async () => {
    if (!sessionId) return
    const r = await updateWorkSessionMetadata(sessionId, {
      notes,
      title_hint: titleHint,
      width_cm: widthCm,
      height_cm: heightCm,
      ...(fieldContext != null ? { field_context: fieldContext } : {}),
    })
    if ('error' in r) toast.error(r.error)
    else toast.success(t('session_toast_saved'))
  }, [sessionId, notes, titleHint, widthCm, heightCm, fieldContext, t])

  const captureEnv = () => {
    if (!sessionId) return
    startBusy(() => {
      void (async () => {
        const r = await captureFieldContext()
        if (!r.ok) {
          fieldContextErrorToast(r.code)
          return
        }
        setFieldContext(r.snapshot)
        const save = await updateWorkSessionMetadata(sessionId, {
          notes,
          title_hint: titleHint,
          width_cm: widthCm,
          height_cm: heightCm,
          field_context: r.snapshot,
        })
        if ('error' in save) {
          toast.error(save.error)
          return
        }
        toast.success(t('session_toast_saved'))
      })()
    })
  }

  const onUploadFiles = (files: FileList | null) => {
    if (!sessionId || !files?.length) return
    startBusy(() => {
      void (async () => {
        for (const file of Array.from(files)) {
          const fd = new FormData()
          fd.set('image', file)
          const r = await uploadWorkSessionShot(sessionId, fd)
          if ('error' in r) {
            toast.error(r.error)
            return
          }
        }
        const n = await getWorkSessionShotCount(sessionId)
        setShotCount(n)
        toast.success(t('session_toast_saved'))
      })()
    })
  }

  const linkOeuvre = () => {
    if (!sessionId) return
    const oid = Number.parseInt(oeuvreInput.trim(), 10)
    if (!Number.isFinite(oid) || oid <= 0) {
      toast.error(t('session_toast_error'))
      return
    }
    startBusy(() => {
      void linkWorkSessionToOeuvre(sessionId, oid).then((r) => {
        if ('error' in r) toast.error(r.error)
        else {
          setLinkedOeuvreId(oid)
          toast.success(t('session_toast_saved'))
        }
      })
    })
  }

  const createAndLink = () => {
    if (!sessionId) return
    const titre = titleHint.trim()
    if (!titre) {
      toast.error(t('session_err_title_required'))
      return
    }
    startBusy(() => {
      void createAndLinkWorkFromSession(sessionId, {
        title_hint: titre,
        notes,
        width_cm: widthCm,
        height_cm: heightCm,
        field_context: fieldContext,
      }).then((r) => {
        if ('error' in r) toast.error(r.error)
        else {
          setLinkedOeuvreId(r.oeuvreId)
          setOeuvreInput(String(r.oeuvreId))
          setWorkMode('existing')
          toast.success(t('session_toast_saved'))
        }
      })
    })
  }

  const submitReview = () => {
    if (!sessionId) return
    startBusy(() => {
      void submitWorkSessionForReview(sessionId).then((r) => {
        if ('error' in r) toast.error(r.error)
        else {
          toast.success(t('session_submit_sent_audit'))
          refreshPending()
        }
      })
    })
  }

  const applyNow = () => {
    if (!sessionId) return
    startBusy(() => {
      void applyWorkSessionToOeuvre(sessionId).then((r) => {
        if ('error' in r) toast.error(r.error)
        else {
          toast.success(t('session_toast_saved'))
          setShotCount(0)
          refreshPending()
        }
      })
    })
  }

  const approveOther = (id: string) => {
    startBusy(() => {
      void applyWorkSessionToOeuvre(id).then((r) => {
        if ('error' in r) toast.error(r.error)
        else {
          toast.success(t('session_toast_saved'))
          refreshPending()
        }
      })
    })
  }

  const rejectOther = (id: string) => {
    const reason =
      typeof window !== 'undefined' ? window.prompt(t('session_reject_prompt'), '') : null
    if (reason === null) return
    startBusy(() => {
      void rejectWorkSession(id, reason || '—').then((r) => {
        if ('error' in r) toast.error(r.error)
        else {
          toast.success(t('session_toast_saved'))
          refreshPending()
        }
      })
    })
  }

  if (!hydrated) {
    return (
      <main data-testid="session-new-root" className="t-mono-sm" style={{ padding: 24 }}>
        {t('session_new_creating')}
      </main>
    )
  }

  if (!authed) {
    const next = encodeURIComponent('/atelier/session/new')
    return (
      <main data-testid="session-new-root" className="t-mono-sm" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href={`/login?next=${next}`} className="btn primary" style={{ minHeight: 44 }}>
          {t('session_new_sign_in')}
        </Link>
        <FieldHubBackLink style={{ marginTop: 0 }} />
      </main>
    )
  }

  if (!sessionId) {
    return (
      <main data-testid="session-new-root" className="t-mono-sm" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link href="/atelier" className="btn primary" style={{ minHeight: 44 }}>
          {t('session_new_back_atelier')}
        </Link>
        <FieldHubBackLink style={{ marginTop: 0 }} />
      </main>
    )
  }

  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  return (
    <main
      data-testid="session-new-root"
      style={{
        minHeight: '100dvh',
        padding:
          'max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        maxWidth: 440,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <h1 className="serif" style={{ fontSize: 22, lineHeight: 1.2 }}>
        {t('session_new_title')}
      </h1>
      <p className="t-mono-sm" style={{ color: 'var(--tx2)', fontSize: 12, lineHeight: 1.5 }}>
        {t('session_new_intro')}
      </p>

      <div role="group" aria-label={t('session_oeuvre_id_label')} className="row gap-sm" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className={workMode === 'existing' ? 'btn primary' : 'btn ghost'}
          data-testid="session-work-mode-existing"
          disabled={busy || linkedOeuvreId != null}
          onClick={() => setWorkMode('existing')}
          style={{ minHeight: 44, flex: 1 }}
        >
          {t('session_work_mode_existing')}
        </button>
        <button
          type="button"
          className={workMode === 'new' ? 'btn primary' : 'btn ghost'}
          data-testid="session-work-mode-new"
          disabled={busy || linkedOeuvreId != null}
          onClick={() => setWorkMode('new')}
          style={{ minHeight: 44, flex: 1 }}
        >
          {t('session_work_mode_new')}
        </button>
      </div>

      {linkedOeuvreId != null ? (
        <p className="t-mono-sm" data-testid="session-linked-work" style={{ fontSize: 12, color: 'var(--tx2)', margin: 0 }}>
          {t('session_linked_work')}: #{linkedOeuvreId}
        </p>
      ) : workMode === 'existing' ? (
        <>
          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>{t('session_oeuvre_id_label')}</span>
            <input
              className="input"
              inputMode="numeric"
              value={oeuvreInput}
              onChange={(e) => setOeuvreInput(e.target.value)}
              placeholder={t('session_oeuvre_id_placeholder')}
              style={{ minHeight: 44 }}
            />
          </label>
          <button type="button" className="btn ghost" disabled={busy} onClick={linkOeuvre} style={{ minHeight: 44 }}>
            {t('session_oeuvre_link')}
          </button>
        </>
      ) : (
        <>
          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>{t('session_title_required_label')}</span>
            <input
              className="input"
              value={titleHint}
              onChange={(e) => setTitleHint(e.target.value)}
              style={{ minHeight: 44 }}
            />
          </label>
          <button
            type="button"
            className="btn ghost"
            data-testid="session-create-work-link"
            disabled={busy}
            onClick={createAndLink}
            style={{ minHeight: 44 }}
          >
            {t('session_create_work_link')}
          </button>
        </>
      )}

      <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>{t('session_notes_label')}</span>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => void pushMeta()} />
      </label>
      {workMode === 'existing' && linkedOeuvreId == null ? (
        <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>{t('session_title_hint_label')}</span>
          <input
            className="input"
            value={titleHint}
            onChange={(e) => setTitleHint(e.target.value)}
            onBlur={() => void pushMeta()}
            style={{ minHeight: 44 }}
          />
        </label>
      ) : null}
      <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
        <label className="t-mono-sm" style={{ flex: 1, minWidth: 120 }}>
          {t('session_dims_label')}
          <input
            className="input"
            value={widthCm}
            onChange={(e) => setWidthCm(e.target.value)}
            onBlur={() => void pushMeta()}
            placeholder="W"
            style={{ minHeight: 44, marginTop: 6 }}
          />
        </label>
        <label className="t-mono-sm" style={{ flex: 1, minWidth: 120 }}>
          <span style={{ opacity: 0 }}>.</span>
          <input
            className="input"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            onBlur={() => void pushMeta()}
            placeholder="H"
            style={{ minHeight: 44, marginTop: 6 }}
          />
        </label>
      </div>

      <div className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ color: 'var(--tx2)', fontSize: 11, lineHeight: 1.4, margin: 0 }}>{t('session_field_context_hint')}</p>
        <button
          type="button"
          className="btn ghost"
          data-testid="session-field-context-capture"
          disabled={busy}
          onClick={captureEnv}
          style={{ minHeight: 44 }}
        >
          {t('session_field_context_cta')}
        </button>
        {fieldContext ? (
          <div
            data-testid="session-field-context-summary"
            style={{
              border: '1px solid var(--bd)',
              borderRadius: 8,
              padding: 12,
              fontSize: 11,
              lineHeight: 1.5,
              color: 'var(--tx2)',
            }}
          >
            <div>
              <span style={{ color: 'var(--tx3)' }}>{t('session_field_context_captured_at_label')}:</span>{' '}
              {new Date(fieldContext.captured_at).toLocaleString(locale)}
            </div>
            <div>
              <span style={{ color: 'var(--tx3)' }}>{t('session_field_context_coords_label')}:</span>{' '}
              {fieldContext.latitude.toFixed(5)}, {fieldContext.longitude.toFixed(5)}
            </div>
            <div>
              <span style={{ color: 'var(--tx3)' }}>{t('session_field_context_weather_label')}:</span>{' '}
              {fieldContext.weather.temperature_c != null ? `${fieldContext.weather.temperature_c} °C` : '—'}
              {fieldContext.weather.wind_kmh != null ? ` · ${fieldContext.weather.wind_kmh} km/h` : ''}
            </div>
            {fieldContext.weather.relative_humidity_pct != null ? (
              <div>
                <span style={{ color: 'var(--tx3)' }}>{t('session_field_context_humidity_label')}:</span>{' '}
                {fieldContext.weather.relative_humidity_pct}%
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span>{t('session_upload_label')}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,.heic"
          multiple
          capture={narrow ? 'environment' : undefined}
          disabled={busy}
          onChange={(e) => {
            onUploadFiles(e.target.files)
            e.target.value = ''
          }}
          style={{ minHeight: 44 }}
        />
      </label>
      <div className="t-mono-sm" style={{ opacity: 0.75 }}>
        {t('session_shots_label')}: {shotCount}
      </div>

      {shotCount > 0 && linkedOeuvreId != null ? (
        <p
          data-testid="session-photos-staged-hint"
          className="t-mono-sm"
          style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.45, margin: 0 }}
        >
          {t('session_photos_staged_hint')}
        </p>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!isAdmin ? (
          <button
            type="button"
            className="btn primary"
            disabled={busy || linkedOeuvreId == null || shotCount === 0}
            onClick={submitReview}
            style={{ minHeight: 44 }}
          >
            {t('session_submit_review')}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn primary"
              data-testid="session-apply-now"
              disabled={busy || linkedOeuvreId == null || shotCount === 0}
              onClick={applyNow}
              style={{ minHeight: 44 }}
            >
              {t('session_apply_now')}
            </button>
            <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.4, margin: 0 }}>
              {t('session_apply_photos_hint')}
            </p>
          </>
        )}
      </div>

      {isAdmin && pending.filter((row) => row.id !== sessionId).length > 0 ? (
        <section style={{ borderTop: '1px solid var(--bd)', paddingTop: 16 }}>
          <h2 className="serif" style={{ fontSize: 16 }}>
            {t('session_admin_pending_heading')}
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending
              .filter((row) => row.id !== sessionId)
              .map((row) => (
                <li
                  key={row.id}
                  style={{
                    border: '1px solid var(--bd)',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <span className="t-mono-sm" style={{ fontSize: 11 }}>
                    #{row.oeuvre_id ?? '—'} · {row.oeuvre_title || '—'} · {row.shot_count}{' '}
                    {t('drawer_work_sessions_shots')} · {t(row.status === 'pending_review' ? 'session_status_pending_review' : 'session_status_draft')}
                  </span>
                  <div className="row gap-sm">
                    <button type="button" className="btn primary" style={{ minHeight: 44 }} disabled={busy} onClick={() => approveOther(row.id)}>
                      {t('session_admin_apply')}
                    </button>
                    {row.status === 'pending_review' ? (
                      <button type="button" className="btn ghost" style={{ minHeight: 44 }} disabled={busy} onClick={() => rejectOther(row.id)}>
                        {t('session_admin_reject')}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <Link href="/atelier" className="btn ghost" style={{ minHeight: 44, marginTop: 8 }}>
        {t('session_new_back_atelier')}
      </Link>
      <FieldHubBackLink style={{ marginTop: 8 }} />
    </main>
  )
}
