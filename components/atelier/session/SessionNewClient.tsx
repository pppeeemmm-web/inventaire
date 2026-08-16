'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import {
  applyWorkSessionToOeuvre,
  openWorkSessionForDay,
  createWorkSessionItemAction,
  findWorksByTitleForSession,
  getSessionNewPageContext,
  getWorkSessionDraftFields,
  linkWorkSessionItemToOeuvre,
  linkWorkSessionToOeuvre,
  listWorkSessionsForAdminReview,
  rejectWorkSession,
  removeAppliedSessionImage,
  searchWorksForSession,
  updateWorkSessionMetadata,
  updateWorkSessionItemMetadata,
  uploadWorkSessionItemShot,
  removeWorkSessionItemShot,
  type SessionLookupOption,
  type WorkSessionWorkOption,
} from '@/app/atelier/session/actions'
import type { WorkSessionQueueRow } from '@/app/atelier/session/actions'
import { SessionPhotoCapture } from '@/components/atelier/session/SessionPhotoCapture'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import { surfaceError } from '@/lib/error-reporter/client'
import { captureFieldContext, type CaptureFieldContextErrorCode } from '@/lib/field-context'
import { imageUrl, thumbUrl } from '@/lib/data'
import type { WorkSessionFieldContext, WorkSessionItem, WorkSessionItemMode } from '@/lib/work-session-payload'
import { sessionItemHasContent } from '@/lib/work-session-payload'
import {
  calendarDayInParisFromIso,
  sessionAtIsoForCalendarDay,
  todayCalendarDayInParis,
} from '@/lib/session-calendar-day'

function dateInputToSessionIso(value: string): string | null {
  return sessionAtIsoForCalendarDay(value)
}

const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SESSION_WORK_EXCLUDED_STATUS_IDS = new Set([3, 5, 6, 11])

function workIsInProgress(work: WorkSessionWorkOption): boolean {
  return (
    (work.statusId == null || !SESSION_WORK_EXCLUDED_STATUS_IDS.has(work.statusId))
    && (work.statusId === 1 || work.statusId == null || !work.Catalogué || !!work.NeedsPhotograph)
  )
}

function sessionItemTitle(
  item: WorkSessionItem,
  index: number,
  t: (key: DictKey) => string,
): string {
  const named = item.oeuvre_title?.trim() || item.title_hint?.trim()
  if (named) return named
  return `${t('session_painting_label')} ${index + 1}`
}

function sessionItemThumbSrc(item: WorkSessionItem): string | null {
  if (item.work_thumb) return thumbUrl(item.work_thumb, 128)
  const shot = item.shots[0]
  if (!shot) return null
  return imageUrl(shot.thumb_r2_key ?? shot.r2_key)
}

/** Show placeholder slots only while they are the active tab (user just added one). */
function sessionItemIsShown(item: WorkSessionItem, activeItemId: string | null): boolean {
  if (sessionItemHasContent(item)) return true
  return Boolean(activeItemId && item.id === activeItemId)
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
  const [queuedLink, setQueuedLink] = useState<{ itemId: string; oid: string } | null>(null)
  const [pending, setPending] = useState<WorkSessionQueueRow[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [fieldContext, setFieldContext] = useState<WorkSessionFieldContext | null>(null)
  const [isDevAutoProfile, setIsDevAutoProfile] = useState(false)
  const [devProfileEmail, setDevProfileEmail] = useState<string | null>(null)
  const [sessionReadOnly, setSessionReadOnly] = useState(false)
  const [canCaptureSessions, setCanCaptureSessions] = useState(false)
  const [titleMatches, setTitleMatches] = useState<{ OeuvreID: number; Titre: string | null }[]>([])
  const [techniques, setTechniques] = useState<SessionLookupOption[]>([])
  const [supports, setSupports] = useState<SessionLookupOption[]>([])
  // `busy` is one shared useTransition flag, so it goes true for *any* action —
  // switching work mode used to make the commit button claim it was applying.
  const [applying, setApplying] = useState(false)
  // Tracks the real lifetime of a photo upload (see onUploadFiles).
  const [uploading, setUploading] = useState(false)
  const daySwitchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const workQ = sp.get('work')?.trim()
  const dateQ = sp.get('date')?.trim() ?? ''
  const sessionQ = sp.get('session')?.trim() ?? ''
  const initialSessionId = SESSION_ID_RE.test(sessionQ) ? sessionQ : null
  const initialOeuvre = workQ ? Number.parseInt(workQ, 10) : NaN
  const initialOk = Number.isFinite(initialOeuvre) && initialOeuvre > 0
  const initialCalendarDay = /^\d{4}-\d{2}-\d{2}$/.test(dateQ) ? dateQ : todayCalendarDayInParis()
  const visibleItems = items.filter((item) => sessionItemIsShown(item, activeItemId))
  const activeItem =
    (activeItemId ? visibleItems.find((item) => item.id === activeItemId) : null)
    ?? visibleItems[0]
    ?? null
  // Once committed the catalogue owns the work's fields — the session becomes a place
  // to check the day and correct a photo, not a second work form. Photos stay editable.
  const itemLocked = activeItem?.status === 'applied'
  const shotCount = visibleItems.reduce((sum, item) => sum + item.shots.length + (item.applied_shot_count ?? 0), 0)
  const stagedShotCount = visibleItems.reduce((sum, item) => sum + item.shots.length, 0)

  useEffect(() => {
    if (!activeItemId || visibleItems.some((item) => item.id === activeItemId)) return
    setActiveItemId(visibleItems[0]?.id ?? null)
  }, [activeItemId, visibleItems])

  useEffect(() => {
    if (busy || !queuedLink) return
    const item = items.find((i) => i.id === queuedLink.itemId)
    setQueuedLink(null)
    if (item && !item.oeuvre_id) linkOeuvre(item, queuedLink.oid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, queuedLink, items])

  const refreshPending = useCallback(() => {
    if (!isAdmin || narrow) return
    void listWorkSessionsForAdminReview().then(setPending)
  }, [isAdmin, narrow])

  const openDaySession = useCallback(
    async (calendarDay: string, opts?: { quiet?: boolean; preferredSessionId?: string | null }) => {
      const r = await openWorkSessionForDay(initialOk ? initialOeuvre : null, calendarDay, {
        preferredSessionId: opts?.preferredSessionId ?? null,
      })
      if ('error' in r) {
        toast.error(r.error)
        return null
      }
      setSessionId(r.id)
      setSessionReadOnly(r.readOnly)
      if (!opts?.quiet && r.reopened) toast.info(t('session_toast_reopened_same_day'))
      if (!opts?.quiet && r.readOnly) toast.info(t('session_readonly_notice'))
      return r.id
    },
    [initialOk, initialOeuvre, t],
  )

  // Overlapping refreshes (date debounce + saveItem/pushMeta/upload all fire their
  // own) used to resolve last-write-wins, so a slow read for the day you just left
  // could repaint its items over the day you switched to. Only the newest read wins.
  const draftSeq = useRef(0)

  const refreshDraft = useCallback(async (id: string) => {
    const seq = draftSeq.current + 1
    draftSeq.current = seq
    const df = await getWorkSessionDraftFields(id)
    if (seq !== draftSeq.current) return
    if ('error' in df) {
      toast.error(df.error)
      return
    }
    setSessionDate(df.fields.calendar_day || calendarDayInParisFromIso(df.fields.session_at))
    setNotes(df.fields.notes)
    setFieldContext(df.fields.field_context)
    setItems(df.items)
    setSessionReadOnly(df.readOnly)
    const shown = df.items.filter((item) => sessionItemHasContent(item))
    setActiveItemId((current) => {
      if (current && df.items.some((item) => item.id === current)) return current
      return shown[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    startBoot(() => {
      void (async () => {
        const ctx = await getSessionNewPageContext()
        setAuthed(ctx.authed)
        setIsAdmin(ctx.isAdmin)
        setIsDevAutoProfile(ctx.isDevAutoProfile)
        setDevProfileEmail(ctx.userEmail)
        setCanCaptureSessions(ctx.canCaptureSessions)
        setTechniques(ctx.techniques)
        setSupports(ctx.supports)
        if (!ctx.authed) {
          setSessionId(null)
          return
        }
        let openedId: string | null = null
        if (initialSessionId) {
          setSessionId(initialSessionId)
          await refreshDraft(initialSessionId)
          openedId = initialSessionId
        } else if (ctx.canCaptureSessions) {
          openedId = await openDaySession(initialCalendarDay, {
            quiet: true,
            preferredSessionId: initialSessionId,
          })
          if (!openedId) return
          await refreshDraft(openedId)
        }
        if (ctx.isAdmin && !narrow) {
          const rows = await listWorkSessionsForAdminReview()
          setPending(rows)
        }
      })().finally(() => setHydrated(true))
    })
  }, [initialCalendarDay, initialOk, initialSessionId, narrow, openDaySession, refreshDraft])

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

  // Debounced so it does not fire per keystroke; only for a new work, since an existing
  // one is already the record it would be duplicating.
  useEffect(() => {
    const title = activeItem?.mode === 'new' && !activeItem.oeuvre_id ? activeItem.title_hint?.trim() ?? '' : ''
    if (title.length < 2) {
      setTitleMatches([])
      return
    }
    const timer = window.setTimeout(() => {
      void findWorksByTitleForSession(title).then(setTitleMatches)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [activeItem?.mode, activeItem?.oeuvre_id, activeItem?.title_hint])

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
    if (sessionReadOnly) return
    if (!sessionId || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) return
    const dayId = await openDaySession(sessionDate, { quiet: true })
    if (!dayId) return
    await refreshDraft(dayId)
    const sessionAt = dateInputToSessionIso(sessionDate)
    const r = await updateWorkSessionMetadata(dayId, {
      ...(sessionAt ? { session_at: sessionAt } : {}),
      notes,
      ...(fieldContext != null ? { field_context: fieldContext } : {}),
    })
    if ('error' in r) toast.error(r.error)
    else {
      toast.success(t('session_toast_saved'))
      await refreshDraft(dayId)
    }
  }, [openDaySession, refreshDraft, sessionId, sessionDate, notes, fieldContext, t])

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
        technique_id: item.technique_id ?? '',
        support_id: item.support_id ?? '',
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

  // Awaited by the capture panel, which keeps the picked photos on screen until this
  // settles. `useTransition` cannot do that job: startBusy() ends the moment its
  // synchronous callback returns, so `busy` was false for the whole upload and the
  // screen showed nothing at all. A rejection here (aborted request, network drop)
  // used to vanish into an unhandled promise — now it toasts and is logged.
  const onUploadFiles = async (files: File[]) => {
    if (!sessionId || files.length === 0) return
    setUploading(true)
    try {
      let targetItemId = activeItem?.id ?? null
      if (!targetItemId) {
        const created = await createWorkSessionItemAction(sessionId, 'existing')
        if ('error' in created) {
          toast.error(created.error)
          return
        }
        targetItemId = created.item.id
        setItems((prev) => [...prev, created.item])
        setActiveItemId(created.item.id)
      }
      for (const file of files) {
        // 2100 to match what the server stores: sending more pixels than
        // normalizeImageToAvifPair keeps is upload time paid for nothing.
        const prepared = await downscaleImageFileForMobileIfNeeded(file, narrow, 2100)
        const fd = new FormData()
        fd.set('image', prepared)
        const r = await uploadWorkSessionItemShot(sessionId, targetItemId!, fd)
        if ('error' in r) {
          toast.error(r.error)
          return
        }
      }
      const applied = isAdmin && !!activeItem?.oeuvre_id
      if (applied) await autoApply(sessionId)
      await refreshDraft(sessionId)
      if (!applied) toast.success(t('session_toast_saved'))
    } catch (err) {
      surfaceError(t('session_toast_error'), err, {
        source: 'SessionNewClient.onUploadFiles',
        metadata: { sessionId, itemId: activeItem?.id ?? null, count: files.length },
      })
    } finally {
      setUploading(false)
    }
  }

  // Not a session-local undo: the photo belongs to the work once applied, so this is a
  // catalogue delete (R2 soft-deleted to recycle/ for 90 days). Name the work in the
  // confirm so it can never be mistaken for dropping a staged shot.
  const onRemoveAppliedShot = (imageId: number) => {
    if (!sessionId || !activeItem?.oeuvre_id) return
    const label = activeItem.oeuvre_title?.trim() || `#${activeItem.oeuvre_id}`
    if (!window.confirm(t('session_photo_remove_applied_confirm').replace('{work}', label))) return
    startBusy(() => {
      void removeAppliedSessionImage(sessionId, activeItem.id, imageId).then(async (r) => {
        if ('error' in r) toast.error(r.error)
        else {
          await refreshDraft(sessionId)
          toast.success(t('session_toast_saved'))
        }
      })
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

  // Apply fires from upload, link, create-and-link and the manual button. Two overlapping
  // runs used to race on the same staged photos: the loser read a shot the winner had
  // already consumed and deleted from R2, then aborted the whole session. One at a time.
  const applyInFlight = useRef(false)
  const runApply = async (sid: string): Promise<{ ok: true } | { error: string } | null> => {
    if (applyInFlight.current) return null
    applyInFlight.current = true
    setApplying(true)
    try {
      return await applyWorkSessionToOeuvre(sid)
    } finally {
      applyInFlight.current = false
      setApplying(false)
    }
  }

  // Owner feedback: the manual "Apply" tap was a needless extra step — once an
  // item is linked and has photos, apply immediately (admin only; the server
  // applies only actionable items, so unlinked items simply stay staged).
  const autoApply = async (sid: string) => {
    const r = await runApply(sid)
    if (!r) return
    if ('error' in r) toast.error(r.error)
    else {
      toast.success(t('session_toast_photos_applied'))
      refreshPending()
    }
  }

  // A result tap during an upload used to hit a disabled button and vanish
  // silently (photo left orphaned). Queue it and run when the transition ends.
  const requestLink = (item: WorkSessionItem, rawId: string) => {
    if (busy) {
      setQueuedLink({ itemId: item.id, oid: rawId })
      toast.success(t('session_link_queued'))
      return
    }
    linkOeuvre(item, rawId)
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
          const applied = isAdmin && item.shots.length > 0
          if (applied) await autoApply(sessionId)
          await refreshDraft(sessionId)
          if (!applied) toast.success(t('session_toast_saved'))
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

  const addItem =(mode: WorkSessionItemMode = 'existing') => {
    if (!sessionId) return
    // Every tap used to POST a brand-new empty item, but sessionItemIsShown hides a
    // content-less slot the moment it stops being the active tab — so the slot
    // disappeared, the tap read as a no-op, and the payload silently accumulated
    // orphans (four days in production carry them). Reuse the empty slot instead.
    const spare = items.find((item) => !sessionItemHasContent(item))
    if (spare) {
      setActiveItemId(spare.id)
      if (spare.mode !== mode) changeItemMode(spare, mode)
      return
    }
    startBusy(() => {
      void (async () => {
        let targetId = sessionId
        let r = await createWorkSessionItemAction(targetId, mode)
        if ('error' in r && r.error === 'Session non modifiable') {
          const day = /^\d{4}-\d{2}-\d{2}$/.test(sessionDate) ? sessionDate : todayCalendarDayInParis()
          const nextId = await openDaySession(day)
          if (!nextId) return
          targetId = nextId
          r = await createWorkSessionItemAction(targetId, mode)
        }
        if ('error' in r) {
          toast.error(r.error)
          return
        }
        // A reopen can hand back a different row than the one on screen; re-read it
        // rather than splicing the new item into the previous session's list.
        if (targetId !== sessionId) {
          await refreshDraft(targetId)
          setActiveItemId(r.item.id)
          return
        }
        setItems((prev) => [...prev, r.item])
        setActiveItemId(r.item.id)
      })()
    })
  }

  const applyNow = () => {
    if (!sessionId) return
    const unlinked = visibleItems.some(
      (i) => i.mode === 'existing' && !i.oeuvre_id && i.shots.length > 0,
    )
    if (unlinked) {
      toast.error(t('session_apply_blocked_unlinked'))
      return
    }
    // The per-item "create work & link" button is gone, so this single button is the
    // only path that turns a new-work slot into a catalogue entry — and the server
    // needs a title to do it. Refuse loudly rather than skipping the item silently.
    const untitled = visibleItems.some(
      (i) => i.mode === 'new' && !i.oeuvre_id && i.shots.length > 0 && !i.title_hint?.trim(),
    )
    if (untitled) {
      toast.error(t('session_err_title_required'))
      return
    }
    startBusy(() => {
      void runApply(sessionId).then(async (r) => {
        if (!r) return
        if ('error' in r) toast.error(r.error)
        else {
          toast.success(t('session_toast_photos_applied'))
          await refreshDraft(sessionId)
          refreshPending()
        }
      })
    })
  }

  const approveOther = (id: string) => {
    startBusy(() => {
      void runApply(id).then((r) => {
        if (!r) return
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

  // Must precede the !sessionId return below: a user without capture rights never
  // gets a session opened, so the bare "back" screen used to swallow this gate and
  // leave them at a dead end with no explanation.
  if (!canCaptureSessions && !initialSessionId) {
    return (
      <main
        data-testid="session-capture-admin-gate"
        style={{
          minHeight: '100dvh',
          padding:
            'max(20px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
          maxWidth: 440,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          justifyContent: 'center',
        }}
      >
        <h1 className="serif" style={{ fontSize: 22, margin: 0 }}>
          {t('session_new_title')}
        </h1>
        <p className="t-mono-sm" style={{ margin: 0, color: 'var(--tx2)', lineHeight: 1.5, fontSize: 13 }}>
          {t('session_capture_admin_only')}
        </p>
        <Link href="/atelier/journal" className="btn primary" style={{ minHeight: 48, textAlign: 'center' }}>
          {t('tab_journal')}
        </Link>
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
  const actionableItems = items.filter((item) => item.shots.length > 0 && (item.oeuvre_id || (item.mode === 'new' && item.title_hint?.trim())))
  const actionableCount = actionableItems.length
  const pendingApplyShots = actionableItems.reduce((n, item) => n + item.shots.length, 0)
  const stagedHintKey = isAdmin ? 'session_photos_staged_hint_admin' : 'session_photos_staged_hint'
  const oeuvreLabelKey = isAdmin ? 'session_oeuvre_id_label_admin' : 'session_oeuvre_id_label'

  const onSessionDateChange = (value: string) => {
    if (sessionReadOnly) return
    setSessionDate(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
    if (daySwitchTimer.current) clearTimeout(daySwitchTimer.current)
    daySwitchTimer.current = setTimeout(() => {
      startBusy(() => {
        void (async () => {
          const prevId = sessionId
          const id = await openDaySession(value, { quiet: true })
          if (!id) return
          await refreshDraft(id)
          if (id !== prevId) return
          const sessionAt = dateInputToSessionIso(value)
          if (!sessionAt) return
          const r = await updateWorkSessionMetadata(id, {
            session_at: sessionAt,
            notes,
            ...(fieldContext != null ? { field_context: fieldContext } : {}),
          })
          if ('error' in r) toast.error(r.error)
          else await refreshDraft(id)
        })()
      })
    }, 350)
  }

  const applyBar = (
    <div
      data-testid="session-apply-bar"
      style={{
        position: 'sticky',
        bottom: 0,
        marginTop: 8,
        paddingTop: 12,
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, var(--bg0) 72%, transparent)',
        borderTop: stagedShotCount > 0 ? '1px solid var(--bd)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {stagedShotCount > 0 && actionableCount > 0 ? (
        <p
          data-testid="session-photos-staged-hint"
          className="t-mono-sm"
          style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.45, margin: 0 }}
        >
          {t(stagedHintKey)}
        </p>
      ) : null}
      {isAdmin ? (
        <>
          <button
            type="button"
            className="btn primary"
            data-testid="session-apply-now"
            disabled={busy || uploading || actionableCount === 0}
            onClick={applyNow}
            style={{ minHeight: 48 }}
            aria-busy={applying}
          >
            {applying
              ? (pendingApplyShots > 0
                  ? t('session_apply_busy_count_fmt').replace('{count}', String(pendingApplyShots))
                  : t('session_apply_busy'))
              : t('session_apply_now')}
          </button>
          <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.4, margin: 0 }}>
            {t('session_apply_photos_hint')}
          </p>
        </>
      ) : null}
    </div>
  )

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Link
          href="/atelier/journal"
          className="t-mono-sm"
          data-testid="session-back-journal"
          style={{ fontSize: 11, color: 'var(--ac)', textDecoration: 'none', minHeight: 32, display: 'inline-flex', alignItems: 'center' }}
        >
          {t('session_back_journal')}
        </Link>
        <h1 className="serif" style={{ fontSize: 22, lineHeight: 1.2, margin: 0 }}>
          {sessionDate && !Number.isNaN(Date.parse(`${sessionDate}T12:00:00`))
            ? new Date(`${sessionDate}T12:00:00`).toLocaleDateString(locale, { dateStyle: 'full' })
            : t('session_new_title')}
        </h1>
        <p className="t-eyebrow" style={{ margin: 0, color: 'var(--tx3)' }}>
          {t('session_flow_steps')}
        </p>
      </div>

      <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>{t('session_date_label')}</span>
        <input
          className="input"
          data-testid="session-date-input"
          type="date"
          value={sessionDate}
          onChange={(e) => onSessionDateChange(e.target.value)}
          readOnly={sessionReadOnly}
          disabled={sessionReadOnly}
          style={{ minHeight: 44 }}
        />
        <span style={{ color: 'var(--tx3)', fontSize: 10, lineHeight: 1.4 }}>{t('session_date_hint')}</span>
      </label>

      {sessionReadOnly ? (
        <p
          className="t-mono-sm"
          data-testid="session-readonly-notice"
          style={{
            margin: 0,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
            color: 'var(--tx2)',
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          {t('session_readonly_notice')}
        </p>
      ) : null}

      {isDevAutoProfile && devProfileEmail ? (
        <p
          className="t-mono-sm"
          data-testid="session-dev-profile-notice"
          style={{
            margin: 0,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
            color: 'var(--tx2)',
            fontSize: 11,
            lineHeight: 1.45,
          }}
        >
          {t('session_dev_profile_notice').replace('{email}', devProfileEmail)}
        </p>
      ) : null}

      <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>{t('session_notes_label')}</span>
        <textarea
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void pushMeta()}
          readOnly={sessionReadOnly}
          disabled={sessionReadOnly}
        />
      </label>

      <section style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="t-eyebrow">{t('session_journal_items_heading')}</div>
            <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', marginTop: 4 }}>
              {visibleItems.length} {t('session_journal_items_count')} · {stagedShotCount} {t('drawer_work_sessions_shots')}
            </div>
          </div>
          <button
            type="button"
            className="btn ghost sm"
            disabled={busy || sessionReadOnly}
            onClick={() => addItem('existing')}
            data-testid="session-add-painting"
            style={{ minHeight: 44 }}
          >
            {t('session_add_painting')}
          </button>
        </div>
        {visibleItems.length === 0 ? (
          <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: 0, lineHeight: 1.45 }}>
            {t('session_no_painting_yet')}
          </p>
        ) : (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2, overscrollBehavior: 'contain' }}>
          {visibleItems.map((item, idx) => {
            const isActive = item.id === activeItem?.id
            const title = sessionItemTitle(item, idx, t)
            const thumbSrc = sessionItemThumbSrc(item)
            const photoCount = item.shots.length + (item.applied_shot_count ?? 0)
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`session-item-tab-${idx + 1}`}
                onClick={() => setActiveItemId(item.id)}
                aria-pressed={isActive}
                aria-label={title}
                style={{
                  flex: '0 0 auto',
                  width: 108,
                  minHeight: 132,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  border: `2px solid ${isActive ? 'var(--ac)' : 'var(--bd)'}`,
                  background: isActive ? 'var(--bg2)' : 'var(--bg1)',
                  color: 'var(--tx)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <span
                  className="serif"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: 30,
                  }}
                >
                  {item.mode === 'existing' && !item.oeuvre_id && item.shots.length > 0 ? (
                    <span aria-label={t('session_item_unlinked_warn')} style={{ color: 'var(--rust)' }}>⚠ </span>
                  ) : null}
                  {title}
                </span>
                {thumbSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbSrc}
                    alt=""
                    style={{
                      width: '100%',
                      height: 72,
                      objectFit: 'cover',
                      borderRadius: 6,
                      border: '1px solid var(--bd)',
                    }}
                  />
                ) : (
                  <div
                    aria-hidden
                    style={{
                      width: '100%',
                      height: 72,
                      borderRadius: 6,
                      border: '1px dashed var(--bd)',
                      background: 'var(--bg0)',
                    }}
                  />
                )}
                <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', lineHeight: 1.3 }}>
                  {photoCount} {t('drawer_work_sessions_shots').toLowerCase()}
                  {item.status === 'applied' ? ` · ${t('session_status_applied')}` : ''}
                </span>
              </button>
            )
          })}
        </div>
        )}
      </section>

      {activeItem ? (
        <section data-testid="session-active-item" style={{ border: '1px solid var(--bd)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(() => {
            const activeIdx = visibleItems.findIndex((item) => item.id === activeItem.id)
            const activeTitle = sessionItemTitle(activeItem, activeIdx >= 0 ? activeIdx : 0, t)
            const activeThumb = sessionItemThumbSrc(activeItem)
            return (
              <div
                data-testid="session-active-item-header"
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
              >
                {activeThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeThumb}
                    alt=""
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: 'cover',
                      borderRadius: 6,
                      border: '1px solid var(--bd)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    aria-hidden
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 6,
                      border: '1px dashed var(--bd)',
                      background: 'var(--bg2)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 className="serif" style={{ fontSize: 20, margin: 0, lineHeight: 1.2, fontWeight: 500 }}>
                    {activeTitle}
                  </h2>
                  {/* Committed work: the catalogue owns these fields now, so link out to
                      the work form rather than pretending the session can edit them. */}
                  {activeItem.oeuvre_id ? (
                    <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: '6px 0 0' }}>
                      <Link
                        href={`/atelier/inventory?work=${activeItem.oeuvre_id}`}
                        data-testid="session-item-work-link"
                        style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                      >
                        #{activeItem.oeuvre_id}
                      </Link>
                      {itemLocked ? ` · ${t('session_status_applied')}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })()}
          <div role="group" aria-label={t(oeuvreLabelKey)} className="row gap-sm" style={{ flexWrap: 'wrap' }}>
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

          {/* Photos come first: the owner names a work from looking at its picture,
              so the picker sits directly under the mode toggle rather than at the
              bottom of the scroll. Uploads always go to this painting. */}
          {/* Applied items stay open: coming back to a past day to swap a wrong photo
              is the whole point of reviewing it. itemIsActionable no longer gates on
              status, so a replacement staged here can still be committed. */}
          <SessionPhotoCapture
            disabled={sessionReadOnly}
            busy={busy || uploading}
            instantUpload
            stagedShots={activeItem.shots}
            appliedShots={activeItem.applied_shots ?? []}
            onUpload={onUploadFiles}
            onRemoveStaged={onRemoveStagedShot}
            onRemoveApplied={isAdmin && !sessionReadOnly ? onRemoveAppliedShot : undefined}
          />

          {activeItem.oeuvre_id ? (
            <p className="t-mono-sm" data-testid="session-linked-work" style={{ fontSize: 12, color: 'var(--tx2)', margin: 0 }}>
              {t('session_linked_work')}: #{activeItem.oeuvre_id}{activeItem.oeuvre_title ? ` · ${activeItem.oeuvre_title}` : ''}
            </p>
          ) : activeItem.mode === 'existing' ? (
            <>
              {activeItem.shots.length > 0 ? (
                <p
                  className="t-mono-sm"
                  data-testid="session-item-unlinked-warn"
                  role="alert"
                  style={{
                    margin: 0,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--rust)',
                    color: 'var(--tx)',
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
                >
                  ⚠ {t('session_item_unlinked_warn')}
                </p>
              ) : null}
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
                    onClick={() => requestLink(activeItem, String(work.OeuvreID))}
                    data-testid="session-work-search-result"
                    style={{ minHeight: 84, textAlign: 'left', justifyContent: 'flex-start', display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    {work.txtImageNameLink ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl(work.txtImageNameLink, 144) ?? ''}
                        alt=""
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)', flexShrink: 0 }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        style={{ width: 72, height: 72, borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bg2)', flexShrink: 0 }}
                      />
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        <span style={{ fontWeight: 700 }}>#{work.OeuvreID}</span> · {work.Titre || t('untitled')}
                      </span>
                      <span style={{ color: 'var(--tx3)', fontSize: 10 }}>
                        {work.Largeur || work.Hauteur ? `${work.Largeur ?? '?'} × ${work.Hauteur ?? '?'} cm` : work.Année?.slice(0, 4) ?? '—'}
                        {workIsInProgress(work) ? ` · ${t('stage_wip')}` : ''}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {!narrow ? (
                <>
                  <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>{t(oeuvreLabelKey)}</span>
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
              ) : null}
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
              {/* Advisory only — a series legitimately repeats a title. */}
              {titleMatches.length > 0 ? (
                <p
                  className="t-mono-sm"
                  data-testid="session-duplicate-title-warn"
                  style={{
                    margin: 0,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--bd)',
                    background: 'var(--bg1)',
                    color: 'var(--tx2)',
                    fontSize: 11,
                    lineHeight: 1.45,
                  }}
                >
                  {t('session_duplicate_title_warn')}{' '}
                  {titleMatches.map((m, idx) => (
                    <span key={m.OeuvreID}>
                      {idx > 0 ? ', ' : ''}
                      <Link
                        href={`/atelier/inventory?work=${m.OeuvreID}`}
                        style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }}
                      >
                        #{m.OeuvreID}
                      </Link>
                    </span>
                  ))}
                </p>
              ) : null}
            </>
          )}

          {/* Owner's stated order: picture, title, dimensions, support, technique,
              then notes. Dimensions therefore precede the notes box. */}
          <div className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>{t('session_dims_label')}</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <input
                className="input"
                aria-label={`${t('session_dims_label')} W`}
                value={activeItem.width_cm ?? ''}
                onChange={(e) => updateLocalItem(activeItem.id, { width_cm: e.target.value })}
                onBlur={(e) => void saveItem({ ...activeItem, width_cm: e.currentTarget.value })}
                readOnly={itemLocked}
                placeholder="W"
                style={{ height: 44, width: '100%', boxSizing: 'border-box' }}
              />
              <input
                className="input"
                aria-label={`${t('session_dims_label')} H`}
                value={activeItem.height_cm ?? ''}
                onChange={(e) => updateLocalItem(activeItem.id, { height_cm: e.target.value })}
                onBlur={(e) => void saveItem({ ...activeItem, height_cm: e.currentTarget.value })}
                readOnly={itemLocked}
                placeholder="H"
                style={{ height: 44, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* New works only: for an existing work these already live on the record, and
              the session is not the place to re-edit the catalogue. */}
          {activeItem.mode === 'new' && !activeItem.oeuvre_id ? (
            <>
              <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{t('support')}</span>
                <select
                  className="input"
                  data-testid="session-support-select"
                  value={activeItem.support_id ?? ''}
                  onChange={(e) => {
                    const support_id = e.target.value
                    updateLocalItem(activeItem.id, { support_id })
                    void saveItem({ ...activeItem, support_id })
                  }}
                  style={{ minHeight: 44 }}
                >
                  <option value="">—</option>
                  {supports.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{t('technique')}</span>
                <select
                  className="input"
                  data-testid="session-technique-select"
                  value={activeItem.technique_id ?? ''}
                  onChange={(e) => {
                    const technique_id = e.target.value
                    updateLocalItem(activeItem.id, { technique_id })
                    void saveItem({ ...activeItem, technique_id })
                  }}
                  style={{ minHeight: 44 }}
                >
                  <option value="">—</option>
                  {techniques.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>{t('session_item_notes_label')}</span>
            <textarea
              className="input"
              rows={3}
              value={activeItem.notes ?? ''}
              onChange={(e) => updateLocalItem(activeItem.id, { notes: e.target.value })}
              onBlur={(e) => void saveItem({ ...activeItem, notes: e.currentTarget.value })}
              readOnly={itemLocked}
            />
          </label>
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

      {/* Fallback only: with no painting yet there is nothing to attach to, and
          onUploadFiles creates the first slot itself. The per-painting picker
          above handles every other case. */}
      {!activeItem && canCaptureSessions && !sessionReadOnly ? (
        <SessionPhotoCapture
          disabled={sessionReadOnly}
          busy={busy || uploading}
          instantUpload
          stagedShots={[]}
          onUpload={onUploadFiles}
          onRemoveStaged={onRemoveStagedShot}
        />
      ) : null}
      <div className="t-mono-sm" style={{ opacity: 0.75 }}>
        {t('session_shots_label')}: {shotCount}
      </div>

      {!sessionReadOnly ? applyBar : null}

      {isAdmin && !narrow && pending.filter((row) => row.id !== sessionId).length > 0 ? (
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

      {!narrow ? (
        <Link href="/atelier" className="btn ghost" style={{ minHeight: 44, marginTop: 8 }}>
          {t('session_new_back_atelier')}
        </Link>
      ) : null}
      <FieldHubBackLink style={{ marginTop: 8 }} />
    </main>
  )
}
