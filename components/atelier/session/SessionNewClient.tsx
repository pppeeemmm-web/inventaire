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
  createAndLinkWorkFromSessionItem,
  createWorkSessionDraft,
  createWorkSessionItemAction,
  getSessionNewPageContext,
  getWorkSessionDraftFields,
  linkWorkSessionItemToOeuvre,
  linkWorkSessionToOeuvre,
  listWorkSessionsForAdminReview,
  rejectWorkSession,
  searchWorksForSession,
  submitWorkSessionForReview,
  updateWorkSessionMetadata,
  updateWorkSessionItemMetadata,
  uploadWorkSessionItemShot,
  removeWorkSessionItemShot,
  type WorkSessionWorkOption,
} from '@/app/atelier/session/actions'
import type { WorkSessionQueueRow } from '@/app/atelier/session/actions'
import { SessionPhotoCapture } from '@/components/atelier/session/SessionPhotoCapture'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import { captureFieldContext, type CaptureFieldContextErrorCode } from '@/lib/field-context'
import { thumbUrl } from '@/lib/data'
import type { WorkSessionFieldContext, WorkSessionItem, WorkSessionItemMode } from '@/lib/work-session-payload'

function toDateInputValue(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInputToSessionIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const SESSION_WORK_EXCLUDED_STATUS_IDS = new Set([3, 5, 6, 11])

function workIsInProgress(work: WorkSessionWorkOption): boolean {
  return (
    (work.statusId == null || !SESSION_WORK_EXCLUDED_STATUS_IDS.has(work.statusId))
    && (work.statusId === 1 || work.statusId == null || !work.Catalogué || !!work.NeedsPhotograph)
  )
}

export function SessionNewClient() {
  const { t, lang } = useI18n()
  const sp = useSearchParams()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [, startBoot] = useTransition()
  const [busy, startBusy] = useTransition()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sessionDate, setSessionDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<WorkSessionItem[]>([])
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [workSearch, setWorkSearch] = useState('')
  const [workResults, setWorkResults] = useState<WorkSessionWorkOption[]>([])
  const [workIdFallback, setWorkIdFallback] = useState('')
  const [pending, setPending] = useState<WorkSessionQueueRow[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [fieldContext, setFieldContext] = useState<WorkSessionFieldContext | null>(null)

  const workQ = sp.get('work')?.trim()
  const initialOeuvre = workQ ? Number.parseInt(workQ, 10) : NaN
  const initialOk = Number.isFinite(initialOeuvre) && initialOeuvre > 0
  const activeItem = items.find((item) => item.id === activeItemId) ?? items[0] ?? null
  const shotCount = items.reduce((sum, item) => sum + item.shots.length + (item.applied_shot_count ?? 0), 0)
  const stagedShotCount = items.reduce((sum, item) => sum + item.shots.length, 0)

  const refreshPending = useCallback(() => {
    if (!isAdmin) return
    void listWorkSessionsForAdminReview().then(setPending)
  }, [isAdmin])

  const refreshDraft = useCallback(async (id: string) => {
    const df = await getWorkSessionDraftFields(id)
    if ('error' in df) {
      toast.error(df.error)
      return
    }
    setSessionDate(toDateInputValue(df.fields.session_at))
    setNotes(df.fields.notes)
    setFieldContext(df.fields.field_context)
    if (df.items.length === 0) {
      const created = await createWorkSessionItemAction(id, 'existing')
      if ('error' in created) {
        toast.error(created.error)
        return
      }
      setItems([created.item])
      setActiveItemId(created.item.id)
      return
    }
    setItems(df.items)
    setActiveItemId((current) => current && df.items.some((item) => item.id === current) ? current : df.items[0]?.id ?? null)
  }, [])

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
        await refreshDraft(r.id)
        if (ctx.isAdmin) {
          const rows = await listWorkSessionsForAdminReview()
          setPending(rows)
        }
      })().finally(() => setHydrated(true))
    })
  }, [initialOk, initialOeuvre, refreshDraft])

  useEffect(() => {
    refreshPending()
  }, [refreshPending])

  useEffect(() => {
    setWorkSearch('')
    setWorkIdFallback(activeItem?.oeuvre_id ? String(activeItem.oeuvre_id) : '')
  }, [activeItem?.id, activeItem?.oeuvre_id])

  useEffect(() => {
    if (!activeItem || activeItem.mode !== 'existing' || activeItem.oeuvre_id) {
      setWorkResults([])
      return
    }
    const timer = window.setTimeout(() => {
      void searchWorksForSession(workSearch).then(setWorkResults)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [activeItem, workSearch])

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
    const sessionAt = dateInputToSessionIso(sessionDate)
    const r = await updateWorkSessionMetadata(sessionId, {
      ...(sessionAt ? { session_at: sessionAt } : {}),
      notes,
      ...(fieldContext != null ? { field_context: fieldContext } : {}),
    })
    if ('error' in r) toast.error(r.error)
    else toast.success(t('session_toast_saved'))
  }, [sessionId, sessionDate, notes, fieldContext, t])

  const updateLocalItem = (itemId: string, patch: Partial<WorkSessionItem>) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)))
  }

  const saveItem = useCallback(
    async (item: WorkSessionItem) => {
      if (!sessionId) return
      const r = await updateWorkSessionItemMetadata(sessionId, item.id, {
        mode: item.mode,
        notes: item.notes ?? '',
        title_hint: item.title_hint ?? '',
        width_cm: item.width_cm ?? '',
        height_cm: item.height_cm ?? '',
      })
      if ('error' in r) toast.error(r.error)
    },
    [sessionId],
  )

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
        const sessionAt = dateInputToSessionIso(sessionDate)
        const save = await updateWorkSessionMetadata(sessionId, {
          ...(sessionAt ? { session_at: sessionAt } : {}),
          notes,
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

  const onUploadFiles = (files: File[]) => {
    if (!sessionId || !activeItem || files.length === 0) return
    startBusy(() => {
      void (async () => {
        for (const file of files) {
          const prepared = await downscaleImageFileForMobileIfNeeded(file, narrow)
          const fd = new FormData()
          fd.set('image', prepared)
          const r = await uploadWorkSessionItemShot(sessionId, activeItem.id, fd)
          if ('error' in r) {
            toast.error(r.error)
            return
          }
        }
        await refreshDraft(sessionId)
        toast.success(t('session_toast_saved'))
      })()
    })
  }

  const onRemoveStagedShot = (sha256: string) => {
    if (!sessionId || !activeItem) return
    startBusy(() => {
      void removeWorkSessionItemShot(sessionId, activeItem.id, sha256).then(async (r) => {
        if ('error' in r) toast.error(r.error)
        else {
          await refreshDraft(sessionId)
          toast.success(t('session_toast_saved'))
        }
      })
    })
  }

  const linkOeuvre = (item: WorkSessionItem, rawId: string) => {
    if (!sessionId) return
    const oid = Number.parseInt(rawId.trim(), 10)
    if (!Number.isFinite(oid) || oid <= 0) {
      toast.error(t('session_toast_error'))
      return
    }
    startBusy(() => {
      const action = item.id ? linkWorkSessionItemToOeuvre(sessionId, item.id, oid) : linkWorkSessionToOeuvre(sessionId, oid)
      void action.then(async (r) => {
        if ('error' in r) toast.error(r.error)
        else {
          await refreshDraft(sessionId)
          toast.success(t('session_toast_saved'))
        }
      })
    })
  }

  const changeItemMode = (item: WorkSessionItem, mode: WorkSessionItemMode) => {
    if (!sessionId) return
    updateLocalItem(item.id, { mode, oeuvre_id: mode === 'new' ? null : item.oeuvre_id })
    startBusy(() => {
      void updateWorkSessionItemMetadata(sessionId, item.id, { mode }).then((r) => {
        if ('error' in r) toast.error(r.error)
        else void refreshDraft(sessionId)
      })
    })
  }

  const createAndLink = (item: WorkSessionItem) => {
    if (!sessionId) return
    const titre = item.title_hint?.trim()
    if (!titre) {
      toast.error(t('session_err_title_required'))
      return
    }
    startBusy(() => {
      void createAndLinkWorkFromSessionItem(sessionId, item.id).then(async (r) => {
        if ('error' in r) toast.error(r.error)
        else {
          await refreshDraft(sessionId)
          toast.success(t('session_toast_saved'))
        }
      })
    })
  }

  const addItem = (mode: WorkSessionItemMode = 'existing') => {
    if (!sessionId) return
    startBusy(() => {
      void createWorkSessionItemAction(sessionId, mode).then((r) => {
        if ('error' in r) toast.error(r.error)
        else {
          setItems((prev) => [...prev, r.item])
          setActiveItemId(r.item.id)
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
          void refreshDraft(sessionId)
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
  const actionableCount = items.filter((item) => item.shots.length > 0 && (item.oeuvre_id || (item.mode === 'new' && item.title_hint?.trim()))).length

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

      <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>{t('session_date_label')}</span>
        <input
          className="input"
          data-testid="session-date-input"
          type="date"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          onBlur={() => void pushMeta()}
          style={{ minHeight: 44 }}
        />
        <span style={{ color: 'var(--tx3)', fontSize: 10, lineHeight: 1.4 }}>{t('session_date_hint')}</span>
      </label>

      <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>{t('session_notes_label')}</span>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => void pushMeta()} />
      </label>

      <section style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="t-eyebrow">{t('session_journal_items_heading')}</div>
            <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 4 }}>
              {items.length} {t('session_journal_items_count')} · {stagedShotCount} {t('drawer_work_sessions_shots')}
            </div>
          </div>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => addItem('existing')} style={{ minHeight: 44 }}>
            {t('session_add_painting')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {items.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeItem?.id ? 'btn primary sm' : 'btn ghost sm'}
              data-testid={`session-item-tab-${idx + 1}`}
              onClick={() => setActiveItemId(item.id)}
              style={{ minHeight: 44, flex: '0 0 auto' }}
            >
              {t('session_painting_label')} {idx + 1} · {item.shots.length + (item.applied_shot_count ?? 0)}
            </button>
          ))}
        </div>
      </section>

      {activeItem ? (
        <section data-testid="session-active-item" style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="t-eyebrow">{t('session_painting_label')} {items.findIndex((item) => item.id === activeItem.id) + 1}</div>
          <div role="group" aria-label={t('session_oeuvre_id_label')} className="row gap-sm" style={{ flexWrap: 'wrap' }}>
            <button
              type="button"
              className={activeItem.mode === 'existing' ? 'btn primary' : 'btn ghost'}
              data-testid="session-work-mode-existing"
              disabled={busy || activeItem.status === 'applied'}
              onClick={() => changeItemMode(activeItem, 'existing')}
              style={{ minHeight: 44, flex: 1 }}
            >
              {t('session_work_mode_existing')}
            </button>
            <button
              type="button"
              className={activeItem.mode === 'new' ? 'btn primary' : 'btn ghost'}
              data-testid="session-work-mode-new"
              disabled={busy || activeItem.status === 'applied'}
              onClick={() => changeItemMode(activeItem, 'new')}
              style={{ minHeight: 44, flex: 1 }}
            >
              {t('session_work_mode_new')}
            </button>
          </div>

          {activeItem.oeuvre_id ? (
            <p className="t-mono-sm" data-testid="session-linked-work" style={{ fontSize: 12, color: 'var(--tx2)', margin: 0 }}>
              {t('session_linked_work')}: #{activeItem.oeuvre_id}{activeItem.oeuvre_title ? ` · ${activeItem.oeuvre_title}` : ''}
            </p>
          ) : activeItem.mode === 'existing' ? (
            <>
              <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{t('session_work_search_label')}</span>
                <input
                  className="input"
                  data-testid="session-work-search-input"
                  value={workSearch}
                  onChange={(e) => setWorkSearch(e.target.value)}
                  placeholder={t('session_work_search_placeholder')}
                  style={{ minHeight: 44 }}
                />
              </label>
              <div
                data-testid="session-work-search-results"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: narrow ? 'min(44dvh, 360px)' : 360,
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  paddingRight: 2,
                }}
              >
                {workResults.map((work) => (
                  <button
                    key={work.OeuvreID}
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => linkOeuvre(activeItem, String(work.OeuvreID))}
                    data-testid="session-work-search-result"
                    style={{ minHeight: 56, textAlign: 'left', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    {work.txtImageNameLink ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl(work.txtImageNameLink, 96) ?? ''}
                        alt=""
                        style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)', flexShrink: 0 }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        style={{ width: 44, height: 44, borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bg2)', flexShrink: 0 }}
                      />
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{work.OeuvreID} · {work.Titre || t('untitled')}
                      </span>
                      <span style={{ color: 'var(--tx3)', fontSize: 10 }}>
                        {work.Largeur || work.Hauteur ? `${work.Largeur ?? '?'} × ${work.Hauteur ?? '?'} cm` : work.Année?.slice(0, 4) ?? '—'}
                        {workIsInProgress(work) ? ` · ${t('stage_wip')}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{t('session_oeuvre_id_label')}</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={workIdFallback}
                  onChange={(e) => setWorkIdFallback(e.target.value)}
                  placeholder={t('session_oeuvre_id_placeholder')}
                  style={{ minHeight: 44 }}
                />
              </label>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => linkOeuvre(activeItem, workIdFallback)} style={{ minHeight: 44 }}>
                {t('session_oeuvre_link')}
              </button>
            </>
          ) : (
            <>
              <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{t('session_title_required_label')}</span>
                <input
                  className="input"
                  value={activeItem.title_hint ?? ''}
                  onChange={(e) => updateLocalItem(activeItem.id, { title_hint: e.target.value })}
                  onBlur={(e) => void saveItem({ ...activeItem, title_hint: e.currentTarget.value })}
                  style={{ minHeight: 44 }}
                />
              </label>
              <button
                type="button"
                className="btn ghost"
                data-testid="session-create-work-link"
                disabled={busy}
                onClick={() => createAndLink(activeItem)}
                style={{ minHeight: 44 }}
              >
                {t('session_create_work_link')}
              </button>
            </>
          )}

          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>{t('session_item_notes_label')}</span>
            <textarea
              className="input"
              rows={3}
              value={activeItem.notes ?? ''}
              onChange={(e) => updateLocalItem(activeItem.id, { notes: e.target.value })}
              onBlur={(e) => void saveItem({ ...activeItem, notes: e.currentTarget.value })}
            />
          </label>
          <div className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>{t('session_dims_label')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <input
                className="input"
                aria-label={`${t('session_dims_label')} W`}
                value={activeItem.width_cm ?? ''}
                onChange={(e) => updateLocalItem(activeItem.id, { width_cm: e.target.value })}
                onBlur={(e) => void saveItem({ ...activeItem, width_cm: e.currentTarget.value })}
                placeholder="W"
                style={{ height: 44, width: '100%', boxSizing: 'border-box' }}
              />
              <input
                className="input"
                aria-label={`${t('session_dims_label')} H`}
                value={activeItem.height_cm ?? ''}
                onChange={(e) => updateLocalItem(activeItem.id, { height_cm: e.target.value })}
                onBlur={(e) => void saveItem({ ...activeItem, height_cm: e.currentTarget.value })}
                placeholder="H"
                style={{ height: 44, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </section>
      ) : null}

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

      {activeItem ? (
        <SessionPhotoCapture
          disabled={activeItem.status === 'applied'}
          busy={busy}
          stagedShots={activeItem.shots}
          onUpload={onUploadFiles}
          onRemoveStaged={onRemoveStagedShot}
        />
      ) : null}
      <div className="t-mono-sm" style={{ opacity: 0.75 }}>
        {t('session_shots_label')}: {shotCount}
      </div>

      {stagedShotCount > 0 && actionableCount > 0 ? (
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
            disabled={busy || actionableCount === 0}
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
              disabled={busy || actionableCount === 0}
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
                    {row.item_count} {t('session_journal_items_count')} · {row.shot_count}{' '}
                    {t('drawer_work_sessions_shots')} · {row.oeuvre_title || '—'} · {t(row.status === 'pending_review' ? 'session_status_pending_review' : 'session_status_draft')}
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
