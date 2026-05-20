'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { imageUrl, thumbUrl } from '@/lib/data'
import { toast } from '@/lib/ui/toast'
import {
  deleteWorkSessionAdmin,
  deleteWorkSessionItem,
  deleteWorkSessionsAdmin,
  fetchSessionItemVersionCompare,
  getSessionNewPageContext,
  listWorkSessionJournal,
  updateWorkSessionJournalMetadata,
  updateWorkSessionItemMetadata,
  type WorkSessionJournalItem,
  type WorkSessionJournalRow,
  type WorkSessionVersionCompare,
} from '@/app/atelier/session/actions'
import type { WorkSessionFieldContext } from '@/lib/work-session-payload'

function formatDayLong(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDayShort(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function monthGroupLabel(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

function sessionDayParam(sessionAt: string): string {
  const date = new Date(sessionAt)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

function itemTitle(item: WorkSessionJournalItem, fallback: string): string {
  if (item.oeuvre_id) return item.oeuvre_title?.trim() || fallback
  return item.title_hint?.trim() || fallback
}

function daySummaryLine(
  row: WorkSessionJournalRow,
  t: (key: DictKey) => string,
): string {
  const works = row.item_count
  const photos = row.staged_shot_count + row.applied_shot_count
  const parts: string[] = []
  if (works > 0) {
    parts.push(
      works === 1
        ? t('journal_day_one_work')
        : t('journal_day_works').replace('{n}', String(works)),
    )
  }
  if (photos > 0) {
    parts.push(
      photos === 1
        ? t('journal_day_one_photo')
        : t('journal_day_photos').replace('{n}', String(photos)),
    )
  }
  return parts.length > 0 ? parts.join(' · ') : t('journal_day_empty_summary')
}

function FieldContextLede({ ctx, locale, t }: { ctx: WorkSessionFieldContext; locale: string; t: (key: DictKey) => string }) {
  return (
    <p
      className="t-mono-sm"
      style={{
        fontSize: 12,
        color: 'var(--tx2)',
        lineHeight: 1.55,
        margin: 0,
        fontStyle: 'italic',
      }}
    >
      {t('journal_field_context_lede')}{' '}
      {new Date(ctx.captured_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
      {' — '}
      {ctx.latitude.toFixed(4)}, {ctx.longitude.toFixed(4)}
      {ctx.weather.temperature_c != null ? ` · ${ctx.weather.temperature_c} °C` : ''}
      {ctx.weather.wind_kmh != null ? ` · ${ctx.weather.wind_kmh} km/h` : ''}
    </p>
  )
}

function VersionCompare({ compare }: { compare: WorkSessionVersionCompare }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--bd)' }}>
      <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 8 }}>
        {t('journal_compare_before')}:{' '}
        {compare.before.changed_at
          ? new Date(compare.before.changed_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
          : '—'}{' '}
        · {t('journal_compare_after')}:{' '}
        {compare.after.changed_at
          ? new Date(compare.after.changed_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
          : t('journal_compare_current')}
      </div>
      {compare.changes.length === 0 ? (
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>
          {t('journal_compare_empty')}
        </div>
      ) : (
        <ul className="t-mono-sm" style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: 'var(--tx2)', lineHeight: 1.5 }}>
          {compare.changes.slice(0, 8).map((change) => (
            <li key={change.field}>
              <span style={{ color: 'var(--tx3)' }}>{change.field}</span>
              {' → '}
              <span style={{ color: 'var(--ac)' }}>{change.after == null || change.after === '' ? '—' : String(change.after)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function JournalPaintingEntry({
  item,
  sessionId,
  sessionDate,
  isAdmin,
  onChanged,
}: {
  item: WorkSessionJournalItem
  sessionId: string
  sessionDate: string
  isAdmin: boolean
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [showDetails, setShowDetails] = useState(false)
  const [compare, setCompare] = useState<WorkSessionVersionCompare | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [titleHint, setTitleHint] = useState(item.title_hint ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [widthCm, setWidthCm] = useState(item.width_cm ?? '')
  const [heightCm, setHeightCm] = useState(item.height_cm ?? '')
  const [pending, startTransition] = useTransition()
  const displayTitle = itemTitle(item, t('untitled'))
  const totalPhotos = item.staged_shots.length + item.applied_shot_count

  useEffect(() => {
    setTitleHint(item.title_hint ?? '')
    setNotes(item.notes ?? '')
    setWidthCm(item.width_cm ?? '')
    setHeightCm(item.height_cm ?? '')
    setEditing(false)
    setShowDetails(false)
    setCompare(null)
    setCompareError(null)
  }, [item.id, item.height_cm, item.notes, item.title_hint, item.width_cm])

  const loadCompare = () => {
    if (!item.oeuvre_id) return
    startTransition(async () => {
      const res = await fetchSessionItemVersionCompare(item.oeuvre_id!, sessionDate)
      if ('error' in res) {
        setCompareError(res.error)
        return
      }
      setCompareError(null)
      setCompare(res)
    })
  }

  const saveEdit = () => {
    startTransition(async () => {
      const res = await updateWorkSessionItemMetadata(sessionId, item.id, {
        title_hint: titleHint,
        notes,
        width_cm: widthCm,
        height_cm: heightCm,
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(t('session_toast_saved'))
      setEditing(false)
      onChanged()
    })
  }

  const deleteItem = () => {
    if (!window.confirm(t('journal_item_delete_confirm'))) return
    startTransition(async () => {
      const res = await deleteWorkSessionItem(sessionId, item.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(t('session_toast_saved'))
      onChanged()
    })
  }

  return (
    <article
      data-testid="journal-painting-entry"
      style={{
        borderLeft: '2px solid var(--bd)',
        paddingLeft: 16,
        marginLeft: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {item.work_thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(item.work_thumb, 128) ?? ''}
            alt=""
            style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 4,
              border: '1px dashed var(--bd)',
              background: 'var(--bg2)',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="serif" style={{ fontSize: 17, margin: 0, lineHeight: 1.25, fontWeight: 500 }}>
            {item.oeuvre_id ? (
              <>
                {displayTitle}
                <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 8 }}>
                  #{item.oeuvre_id}
                </span>
              </>
            ) : (
              displayTitle
            )}
          </h3>
          {(item.width_cm || item.height_cm) && (
            <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>
              {item.width_cm ?? '?'} × {item.height_cm ?? '?'} cm
            </div>
          )}
          {totalPhotos > 0 ? (
            <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>
              {totalPhotos === 1
                ? t('journal_day_one_photo')
                : t('journal_day_photos').replace('{n}', String(totalPhotos))}
            </div>
          ) : null}
        </div>
      </div>

      {item.notes ? (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--tx)', whiteSpace: 'pre-wrap' }}>
          {item.notes}
        </p>
      ) : null}

      {item.staged_shots.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {item.staged_shots.map((shot) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={shot.r2_key}
              src={imageUrl(shot.thumb_r2_key ?? shot.r2_key) ?? ''}
              alt=""
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)', flex: '0 0 auto' }}
            />
          ))}
        </div>
      ) : null}

      {isAdmin ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn ghost sm"
            disabled={pending}
            onClick={() => setShowDetails((v) => !v)}
            style={{ minHeight: 32, fontSize: 11 }}
          >
            {showDetails ? t('journal_hide_details') : t('journal_show_details')}
          </button>
        </div>
      ) : null}

      {showDetails && isAdmin ? (
        <div style={{ padding: 12, border: '1px solid var(--bd2)', borderRadius: 8, background: 'var(--bg1)' }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                {t('session_title_hint_label')}
                <input className="input" value={titleHint} onChange={(e) => setTitleHint(e.target.value)} style={{ minHeight: 36 }} />
              </label>
              <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
                {t('session_item_notes_label')}
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn primary sm" disabled={pending} onClick={saveEdit} style={{ minHeight: 36 }}>
                  {t('save')}
                </button>
                <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setEditing(false)} style={{ minHeight: 36 }}>
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setEditing(true)} style={{ minHeight: 32 }}>
                {t('edit')}
              </button>
              <button type="button" className="btn ghost sm" disabled={pending} onClick={deleteItem} style={{ minHeight: 32 }}>
                {t('delete')}
              </button>
              {item.oeuvre_id ? (
                <button type="button" className="btn ghost sm" disabled={pending} onClick={loadCompare} style={{ minHeight: 32 }}>
                  {pending ? t('loading') : t('journal_compare_cta')}
                </button>
              ) : null}
            </div>
          )}
          {compareError ? (
            <div className="t-mono-sm" style={{ color: 'var(--rust)', fontSize: 10, marginTop: 8 }}>
              {compareError}
            </div>
          ) : null}
          {compare ? <VersionCompare compare={compare} /> : null}
        </div>
      ) : null}
    </article>
  )
}

function JournalDayPage({
  row,
  locale,
  isAdmin,
  sessionPending,
  editingSession,
  sessionDateInput,
  sessionNotesInput,
  onEditStart,
  onEditCancel,
  onDateChange,
  onNotesChange,
  onSave,
  onDelete,
  onChanged,
}: {
  row: WorkSessionJournalRow
  locale: string
  isAdmin: boolean
  sessionPending: boolean
  editingSession: boolean
  sessionDateInput: string
  sessionNotesInput: string
  onEditStart: () => void
  onEditCancel: () => void
  onDateChange: (v: string) => void
  onNotesChange: (v: string) => void
  onSave: () => void
  onDelete: () => void
  onChanged: () => void
}) {
  const { t } = useI18n()

  return (
    <article data-testid="journal-day-page" style={{ maxWidth: 720 }}>
      <header style={{ marginBottom: 24 }}>
        <p className="t-eyebrow" style={{ color: 'var(--tx3)', marginBottom: 8 }}>
          {t('journal_tab_title')}
        </p>
        <h1 className="serif" style={{ fontSize: 32, margin: 0, lineHeight: 1.15, fontWeight: 500 }}>
          {formatDayLong(row.session_at, locale)}
        </h1>
        <p className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11, marginTop: 10 }}>
          {daySummaryLine(row, t)}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          <Link
            href={`/atelier/session/new?date=${sessionDayParam(row.session_at)}`}
            className="btn primary"
            data-testid="journal-continue-capture"
            style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
          >
            {t('journal_continue_capture')}
          </Link>
          {isAdmin && !editingSession ? (
            <button type="button" className="btn ghost sm" disabled={sessionPending} onClick={onEditStart} style={{ minHeight: 44 }}>
              {t('journal_session_edit')}
            </button>
          ) : null}
        </div>
      </header>

      {editingSession ? (
        <div
          style={{
            border: '1px solid var(--bd)',
            borderRadius: 10,
            padding: 14,
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            {t('session_date_label')}
            <input
              className="input"
              data-testid="journal-session-date-input"
              type="date"
              value={sessionDateInput}
              onChange={(e) => onDateChange(e.target.value)}
              style={{ minHeight: 40 }}
            />
          </label>
          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            {t('session_notes_label')}
            <textarea className="input" rows={4} value={sessionNotesInput} onChange={(e) => onNotesChange(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn primary sm" disabled={sessionPending} onClick={onSave} style={{ minHeight: 40 }}>
              {t('save')}
            </button>
            <button type="button" className="btn ghost sm" disabled={sessionPending} onClick={onEditCancel} style={{ minHeight: 40 }}>
              {t('cancel')}
            </button>
            <button type="button" className="btn ghost sm" disabled={sessionPending} onClick={onDelete} style={{ minHeight: 40, color: 'var(--rust)' }}>
              {t('journal_session_delete')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {row.field_context ? (
            <div style={{ marginBottom: 20 }}>
              <FieldContextLede ctx={row.field_context} locale={locale} t={t} />
            </div>
          ) : null}
          {row.journal_notes ? (
            <div
              style={{
                marginBottom: 28,
                padding: '16px 18px',
                borderLeft: '3px solid var(--ac)',
                background: 'var(--bg1)',
                borderRadius: '0 8px 8px 0',
              }}
            >
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: 'var(--tx)', whiteSpace: 'pre-wrap' }}>
                {row.journal_notes}
              </p>
            </div>
          ) : null}
        </>
      )}

      {!editingSession ? (
        <section>
          <h2 className="t-eyebrow" style={{ marginBottom: 16, color: 'var(--tx3)' }}>
            {t('journal_paintings_heading')}
          </h2>
          {row.items.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {row.items.map((item) => (
                <JournalPaintingEntry
                  key={item.id}
                  item={item}
                  sessionId={row.id}
                  sessionDate={row.session_at}
                  isAdmin={isAdmin}
                  onChanged={onChanged}
                />
              ))}
            </div>
          ) : (
            <p className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.5 }}>
              {t('journal_no_items')}{' '}
              <Link href={`/atelier/session/new?date=${sessionDayParam(row.session_at)}`} style={{ color: 'var(--ac)' }}>
                {t('journal_continue_capture')}
              </Link>
            </p>
          )}
        </section>
      ) : null}
    </article>
  )
}

export function SessionJournalTab() {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [rows, setRows] = useState<WorkSessionJournalRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())
  const [isAdmin, setIsAdmin] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [mobileShowDay, setMobileShowDay] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingSession, setEditingSession] = useState(false)
  const [sessionDateInput, setSessionDateInput] = useState('')
  const [sessionNotesInput, setSessionNotesInput] = useState('')
  const [sessionPending, startSessionTransition] = useTransition()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const reload = useCallback(() => {
    setLoading(true)
    void listWorkSessionJournal().then((data) => {
      setRows(data)
      setSelectedId((current) => (data.some((row) => row.id === current) ? current : data[0]?.id ?? null))
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    void getSessionNewPageContext().then((ctx) => setIsAdmin(ctx.isAdmin))
  }, [])

  useEffect(() => {
    setCheckedIds((prev) => {
      const valid = new Set(rows.map((row) => row.id))
      const next = new Set([...prev].filter((id) => valid.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [rows])

  const grouped = useMemo(() => {
    const groups = new Map<string, WorkSessionJournalRow[]>()
    for (const row of rows) {
      const key = monthGroupLabel(row.session_at, locale)
      groups.set(key, [...(groups.get(key) ?? []), row])
    }
    return Array.from(groups.entries())
  }, [locale, rows])

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null

  useEffect(() => {
    if (!selected) {
      setEditingSession(false)
      setSessionDateInput('')
      setSessionNotesInput('')
      return
    }
    setEditingSession(false)
    setSessionDateInput(toDateInputValue(selected.session_at))
    setSessionNotesInput(selected.journal_notes ?? '')
  }, [selected])

  const selectDay = (id: string) => {
    setSelectedId(id)
    if (narrow) setMobileShowDay(true)
  }

  const saveSessionEdit = () => {
    if (!selected) return
    const sessionAt = dateInputToSessionIso(sessionDateInput)
    if (!sessionAt) {
      toast.error(t('session_toast_error'))
      return
    }
    startSessionTransition(async () => {
      const res = await updateWorkSessionJournalMetadata(selected.id, {
        session_at: sessionAt,
        notes: sessionNotesInput,
      })
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(t('session_toast_saved'))
      setEditingSession(false)
      reload()
    })
  }

  const deleteSession = () => {
    if (!selected || !isAdmin) return
    if (!window.confirm(t('journal_session_delete_confirm'))) return
    startSessionTransition(async () => {
      const res = await deleteWorkSessionAdmin(selected.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setCheckedIds((prev) => {
        const next = new Set(prev)
        next.delete(selected.id)
        return next
      })
      toast.success(t('session_toast_saved'))
      if (narrow) setMobileShowDay(false)
      reload()
    })
  }

  const deleteCheckedSessions = () => {
    if (!isAdmin || checkedIds.size === 0) return
    const ids = Array.from(checkedIds)
    const confirmText = t('journal_delete_selected_confirm').replace('{n}', String(ids.length))
    if (!window.confirm(confirmText)) return
    startSessionTransition(async () => {
      const res = await deleteWorkSessionsAdmin(ids)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      const n = res.deletedCount ?? ids.length
      toast.success(t('journal_bulk_deleted_toast').replace('{n}', String(n)))
      setCheckedIds(new Set())
      reload()
    })
  }

  const showIndex = !narrow || !mobileShowDay
  const showPage = !narrow || mobileShowDay

  return (
    <div
      data-testid="session-journal-tab"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : 'minmax(240px, 300px) minmax(0, 1fr)',
        gap: 0,
        background: 'var(--bg0)',
      }}
    >
      {showIndex ? (
        <aside
          data-testid="journal-index"
          style={{
            borderRight: narrow ? 'none' : '1px solid var(--bd)',
            overflow: 'auto',
            background: 'var(--bg1)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div style={{ padding: narrow ? '16px 16px 12px' : '20px 20px 14px', borderBottom: '1px solid var(--bd)' }}>
            <h2 className="serif" style={{ margin: 0, fontSize: narrow ? 20 : 22 }}>
              {t('journal_tab_title')}
            </h2>
            <p className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 11, margin: '8px 0 12px' }}>
              {t('journal_tab_intro')}
            </p>
            <Link href="/atelier/session/new" className="btn primary sm" style={{ minHeight: 40, width: '100%' }}>
              {t('journal_new_day')}
            </Link>
          </div>

          {loading ? (
            <div className="t-mono-sm" style={{ padding: 20, color: 'var(--tx3)' }}>
              {t('loading')}
            </div>
          ) : grouped.length === 0 ? (
            <div style={{ padding: 20 }}>
              <p className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.5 }}>
                {t('journal_empty')}
              </p>
              <Link href="/atelier/session/new" className="btn ghost sm" style={{ marginTop: 12, minHeight: 40 }}>
                {t('journal_empty_cta')}
              </Link>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {grouped.map(([month, monthRows]) => (
                <section key={month}>
                  <div
                    className="t-eyebrow"
                    style={{
                      padding: '12px 20px 6px',
                      color: 'var(--tx3)',
                      position: 'sticky',
                      top: 0,
                      background: 'var(--bg1)',
                      zIndex: 1,
                    }}
                  >
                    {month}
                  </div>
                  {monthRows.map((row) => {
                    const isSelected = selected?.id === row.id
                    return (
                      <button
                        key={row.id}
                        type="button"
                        data-testid={`journal-session-row-${row.id.slice(0, 8)}`}
                        onClick={() => selectDay(row.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          borderTop: '1px solid var(--bd2)',
                          background: isSelected ? 'var(--bg2)' : 'transparent',
                          color: 'var(--tx)',
                          padding: '12px 20px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: isSelected ? 600 : 500, lineHeight: 1.3 }}>
                          {formatDayShort(row.session_at, locale)}
                        </div>
                        <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 5, lineHeight: 1.4 }}>
                          {daySummaryLine(row, t)}
                        </div>
                        {row.journal_notes ? (
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--tx2)',
                              marginTop: 6,
                              lineHeight: 1.4,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {row.journal_notes}
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                </section>
              ))}
            </div>
          )}

          {isAdmin && rows.length > 0 ? (
            <div style={{ borderTop: '1px solid var(--bd)', padding: 12, marginTop: 'auto' }}>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 36, width: '100%' }}
                onClick={() => setShowManage((v) => !v)}
              >
                {showManage ? t('journal_hide_manage') : t('journal_manage')}
              </button>
              {showManage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn ghost sm" disabled={sessionPending} onClick={() => setCheckedIds(new Set(rows.map((r) => r.id)))}>
                    {t('journal_select_all')}
                  </button>
                  {checkedIds.size > 0 ? (
                    <>
                      <button type="button" className="btn ghost sm" disabled={sessionPending} onClick={() => setCheckedIds(new Set())}>
                        {t('journal_clear_selection')}
                      </button>
                      <button
                        type="button"
                        className="btn sm"
                        data-testid="journal-delete-selected"
                        disabled={sessionPending}
                        onClick={deleteCheckedSessions}
                        style={{ background: 'var(--rust)22', color: 'var(--rust)', border: '1px solid var(--rust)44' }}
                      >
                        {t('journal_delete_selected').replace('{n}', String(checkedIds.size))}
                      </button>
                      {rows.map((row) => (
                        <label key={row.id} className="t-mono-sm" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10 }}>
                          <input
                            type="checkbox"
                            checked={checkedIds.has(row.id)}
                            onChange={() => {
                              setCheckedIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(row.id)) next.delete(row.id)
                                else next.add(row.id)
                                return next
                              })
                            }}
                          />
                          {formatDayShort(row.session_at, locale)}
                        </label>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      ) : null}

      {showPage ? (
        <main data-testid="journal-day-panel" style={{ overflow: 'auto', minWidth: 0, minHeight: 0 }}>
          {narrow && mobileShowDay ? (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)' }}>
              <button type="button" className="btn ghost sm" onClick={() => setMobileShowDay(false)} style={{ minHeight: 40 }}>
                ← {t('journal_back_to_days')}
              </button>
            </div>
          ) : null}
          <div style={{ padding: narrow ? '20px 16px 32px' : '32px 40px 48px' }}>
            {selected ? (
              <JournalDayPage
                row={selected}
                locale={locale}
                isAdmin={isAdmin}
                sessionPending={sessionPending}
                editingSession={editingSession}
                sessionDateInput={sessionDateInput}
                sessionNotesInput={sessionNotesInput}
                onEditStart={() => setEditingSession(true)}
                onEditCancel={() => setEditingSession(false)}
                onDateChange={setSessionDateInput}
                onNotesChange={setSessionNotesInput}
                onSave={saveSessionEdit}
                onDelete={deleteSession}
                onChanged={reload}
              />
            ) : (
              <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
                {t('journal_pick_day')}
              </div>
            )}
          </div>
        </main>
      ) : null}
    </div>
  )
}
