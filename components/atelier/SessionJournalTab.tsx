'use client'

import { WorkRef } from '@/components/atelier/WorkRef'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { imageUrl, thumbUrl } from '@/lib/data'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { toast } from '@/lib/ui/toast'
import {
  deleteWorkSessionItem,
  deleteWorkSessionJournalEntries,
  deleteWorkSessionJournalEntry,
  fetchSessionItemVersionCompare,
  loadJournalBootstrap,
  updateWorkSessionJournalMetadata,
  updateWorkSessionItemMetadata,
  type WorkSessionJournalItem,
  type WorkSessionJournalRow,
  type WorkSessionVersionCompare,
} from '@/app/atelier/session/actions'
import type { WorkSessionFieldContext } from '@/lib/work-session-payload'
import { JournalDayExtras } from '@/components/atelier/journal/JournalDayExtras'
import { SessionNewClient } from '@/components/atelier/session/SessionNewClient'
import type { JournalSourceDay } from '@/app/atelier/(portal)/journal/entry-actions'
import { foregroundSettled } from '@/lib/atelier/foreground-gate'
import {
  calendarDayInParisFromIso,
  sessionAtIsoForCalendarDay,
  todayCalendarDayInParis,
} from '@/lib/session-calendar-day'

/** A day with no field session (only entries, Création items, voice notes — or today). Not a DB row. */
const DAY_ONLY_PREFIX = 'day:'

function isSessionRow(row: WorkSessionJournalRow): boolean {
  return !row.id.startsWith(DAY_ONLY_PREFIX)
}

function dayOnlyRow(day: string): WorkSessionJournalRow {
  return {
    id: `${DAY_ONLY_PREFIX}${day}`,
    session_at: sessionAtIsoForCalendarDay(day) ?? `${day}T12:00:00.000Z`,
    calendar_day: day,
    journal_notes: null,
    field_context: null,
    item_count: 0,
    staged_shot_count: 0,
    applied_shot_count: 0,
    items: [],
  } as unknown as WorkSessionJournalRow
}

function rowDay(row: WorkSessionJournalRow): string {
  return row.calendar_day || calendarDayInParisFromIso(row.session_at)
}

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

function itemTitle(item: WorkSessionJournalItem, fallback: string): string {
  if (item.oeuvre_id) return item.oeuvre_title?.trim() || fallback
  return item.title_hint?.trim() || fallback
}

function atelierInventoryWorkHref(oeuvreId: number): string {
  // /atelier is the Overview route — deep links must target the Inventory route
  // so the user lands in the catalogue with the work drawer open (?work= is
  // handled globally in TeamPortalClient).
  return `/atelier/inventory?work=${oeuvreId}`
}

function JournalInventoryIdLink({
  oeuvreId,
  stopPropagation,
}: {
  oeuvreId: number
  stopPropagation?: boolean
}) {
  const { t } = useI18n()
  return (
    <WorkRef
      id={oeuvreId}
      href={atelierInventoryWorkHref(oeuvreId)}
      className="t-mono-sm"
      testId={`journal-inventory-link-${oeuvreId}`}
      stopPropagation={stopPropagation}
      style={{
        fontSize: 'inherit',
        color: 'var(--ac)',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
      ariaLabel={t('journal_inventory_link_aria').replace('{id}', String(oeuvreId))}
    />
  )
}

type SummaryT = ReturnType<typeof useI18n>['t']

function daySummaryLine(row: WorkSessionJournalRow, t: SummaryT, src?: JournalSourceDay, isAdmin = false): string {
  const works = row.item_count
  const photos = row.staged_shot_count + row.applied_shot_count
  const parts: string[] = []
  if (src?.entries) parts.push(src.entries === 1 ? t('je_sum_entry_one') : t('je_sum_entries').replace('{n}', String(src.entries)))
  if (src?.creation) parts.push(t('je_sum_creation').replace('{n}', String(src.creation)))
  if (src?.voices) parts.push(src.voices === 1 ? t('je_sum_voice_one') : t('je_sum_voices').replace('{n}', String(src.voices)))
  if (isAdmin && src?.proposals) parts.push(t('je_sum_proposals').replace('{n}', String(src.proposals)))
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
  const itemSessionId = item.source_session_id || sessionId
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
      const res = await updateWorkSessionItemMetadata(itemSessionId, item.id, {
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
    if (item.id === '__legacy_session_shots__') return
    if (!window.confirm(t('journal_item_delete_confirm'))) return
    startTransition(async () => {
      const res = await deleteWorkSessionItem(itemSessionId, item.id)
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h3 className="serif" style={{ fontSize: 17, margin: 0, lineHeight: 1.25, fontWeight: 500 }}>
            {item.oeuvre_id ? (
              <Link
                href={atelierInventoryWorkHref(item.oeuvre_id)}
                data-testid={`journal-painting-title-link-${item.oeuvre_id}`}
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {displayTitle}
              </Link>
            ) : (
              displayTitle
            )}
          </h3>
          {item.oeuvre_id ? (
            <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
              <JournalInventoryIdLink oeuvreId={item.oeuvre_id} />
            </div>
          ) : null}
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
        {item.work_thumb ? (
          // Press or tap → the picture full screen, staying on the day (Pem 2026-11-14).
          <ImageLoupe file={item.work_thumb} alt={displayTitle} tapOpens style={{ width: '100%', maxWidth: 280 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrl(item.work_thumb, 128) ?? ''}
              alt=""
              style={{ display: 'block', width: '100%', height: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--bd)' }}
            />
          </ImageLoupe>
        ) : item.staged_shots[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(item.staged_shots[0].thumb_r2_key ?? item.staged_shots[0].r2_key) ?? ''}
            alt=""
            style={{ width: '100%', maxWidth: 280, height: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--bd)' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              maxWidth: 280,
              height: 120,
              borderRadius: 6,
              border: '1px dashed var(--bd)',
              background: 'var(--bg2)',
            }}
          />
        )}
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
  source,
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
  composeSignal,
  captureSignal,
}: {
  row: WorkSessionJournalRow
  source?: JournalSourceDay
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
  composeSignal: number
  captureSignal: number
}) {
  const { t } = useI18n()
  const hasSession = isSessionRow(row)
  const day = rowDay(row)
  // Capture is a folded section of the day (owner 2026-11-12): the session form loads only
  // when opened, so a day without painting never waits for it or opens an empty session.
  const [captureOpen, setCaptureOpen] = useState(false)
  useEffect(() => setCaptureOpen(false), [day])

  const openCapture = () => {
    setCaptureOpen(true)
    window.setTimeout(() => {
      document.getElementById('journal-day-capture')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
  }

  useEffect(() => {
    if (captureSignal > 0 && isAdmin) openCapture()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureSignal])

  const captureSlot = (
    <section id="journal-day-capture" data-testid="journal-day-works">
      <h2 className="t-eyebrow" style={{ marginBottom: 12, color: 'var(--tx3)' }}>
        {t('je_works_heading')} ({row.items.length})
      </h2>
      {isAdmin ? (
        captureOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <button
              type="button"
              className="btn ghost sm"
              data-testid="journal-capture-close"
              onClick={() => {
                setCaptureOpen(false)
                onChanged()
              }}
              style={{ minHeight: 44, alignSelf: 'flex-start' }}
            >
              {t('je_capture_close')}
            </button>
            <Suspense fallback={<p className="t-mono-sm">{t('je_capture_loading')}</p>}>
              <SessionNewClient embed={{ day, sessionId: hasSession ? row.id : null }} />
            </Suspense>
          </div>
        ) : (
          <button
            type="button"
            className="btn ghost"
            data-testid="journal-capture-open"
            onClick={openCapture}
            style={{ minHeight: 44, width: '100%', marginBottom: 16 }}
          >
            {t('je_capture_open')}
          </button>
        )
      ) : null}
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
      ) : !isAdmin ? (
        // Admins see the capture button instead; the empty line only repeated it.
        <p className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.5, margin: 0 }}>
          {t('journal_no_items')}
        </p>
      ) : null}
    </section>
  )

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
          {daySummaryLine(row, t, source, isAdmin)}
        </p>
        {isAdmin && hasSession && !editingSession ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn ghost sm" disabled={sessionPending} onClick={onEditStart} style={{ minHeight: 44 }}>
              {t('journal_session_edit')}
            </button>
          </div>
        ) : null}
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
        <JournalDayExtras
          day={day}
          locale={locale}
          onCapture={isAdmin ? openCapture : undefined}
          captureSlot={captureSlot}
          composeSignal={composeSignal}
        />
      ) : null}
    </article>
  )
}

function requestedDayFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const day = params.get('day')
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day
  return params.get('today') === '1' ? todayCalendarDayInParis() : null
}

export function SessionJournalTab() {
  const { t, lang } = useI18n()
  const router = useRouter()
  const narrow = useMediaQuery('(max-width: 767px)')
  const todayDay = todayCalendarDayInParis()
  const [sessionRows, setSessionRows] = useState<WorkSessionJournalRow[]>([])
  const [sourceDays, setSourceDays] = useState<JournalSourceDay[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set())
  const [isAdmin, setIsAdmin] = useState(false)
  const [journalTeamReadAccess, setJournalTeamReadAccess] = useState(false)
  const [showManage, setShowManage] = useState(false)
  // Phone: the list of days OR one day, full screen (owner 2026-11-12: iPhone SE had ~270 px for the day).
  // `/atelier/journal?today=1` (Hub → Journal) opens today's page; `?day=YYYY-MM-DD` (search hit,
  // Constellation panel) opens that day. Read before the first paint (the tab is client-only), so the
  // phone opens straight on the day instead of flashing the list first (Pem 2026-11-14).
  const [openDay, setOpenDay] = useState<string | null>(() => requestedDayFromUrl())
  const [phoneView, setPhoneView] = useState<'list' | 'day'>(() => (requestedDayFromUrl() ? 'day' : 'list'))
  const [composeSignal, setComposeSignal] = useState(0)
  const [captureSignal, setCaptureSignal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editingSession, setEditingSession] = useState(false)
  const [sessionDateInput, setSessionDateInput] = useState('')
  const [sessionNotesInput, setSessionNotesInput] = useState('')
  const [sessionPending, startSessionTransition] = useTransition()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  // One request for the list, the days and the roles (see `loadJournalBootstrap`); the first one
  // also lets the Atelier shell start its background loads (`foregroundSettled`).
  const reload = useCallback(() => {
    setLoading(true)
    void loadJournalBootstrap()
      .then((b) => {
        setSessionRows(b.rows)
        setSourceDays(b.days)
        setIsAdmin(b.isAdmin)
        setJournalTeamReadAccess(b.journalTeamReadAccess)
        setLoading(false)
      })
      .finally(() => foregroundSettled())
  }, [])

  // One row per day: field-session days, plus days with only entries / Création items / voice notes,
  // plus today (so anyone can write today). Newest first.
  const rows = useMemo(() => {
    const byDay = new Map<string, WorkSessionJournalRow>()
    for (const row of sessionRows) byDay.set(rowDay(row), row)
    for (const d of [todayDay, ...sourceDays.map((x) => x.day)]) {
      if (!byDay.has(d)) byDay.set(d, dayOnlyRow(d))
    }
    return [...byDay.values()].sort((a, b) => rowDay(b).localeCompare(rowDay(a)))
  }, [sessionRows, sourceDays, todayDay])
  const sourceByDay = useMemo(() => new Map(sourceDays.map((d) => [d.day, d])), [sourceDays])
  // ✦ bar (admins): open AI link suggestions across all days, and the oldest day that still has some.
  const proposalsOpen = useMemo(() => {
    let total = 0
    let oldest: string | null = null
    for (const d of sourceDays) {
      if (!d.proposals) continue
      total += d.proposals
      if (!oldest || d.day < oldest) oldest = d.day
    }
    return { total, oldest }
  }, [sourceDays])

  useEffect(() => {
    setSelectedId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null))
  }, [rows])

  useEffect(() => {
    if (!openDay || loading) return
    const row = rows.find((r) => rowDay(r) === openDay)
    if (row) {
      setSelectedId(row.id)
      setPhoneView('day')
      // Bring the day into view in the list (date jump, ✦ bar, ?day=).
      requestAnimationFrame(() => document.getElementById(`journal-day-${openDay}`)?.scrollIntoView({ block: 'center' }))
    }
    setOpenDay(null)
  }, [openDay, loading, rows])

  // Date jump (owner 2026-11-13: "avoid long scrolling"): the picked day, or the nearest day that has something.
  const jumpToDate = (d: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || rows.length === 0) return
    const ms = (x: string) => new Date(`${x}T12:00:00Z`).getTime()
    let best = rowDay(rows[0])
    for (const r of rows) {
      if (Math.abs(ms(rowDay(r)) - ms(d)) < Math.abs(ms(best) - ms(d))) best = rowDay(r)
    }
    if (best !== d) {
      const fmt = (x: string) => new Date(`${x}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      toast.info(t('journal_jump_nearest').replace('{asked}', fmt(d)).replace('{shown}', fmt(best)))
    }
    setOpenDay(best)
  }
  const oldestDay = rows.length ? rowDay(rows[rows.length - 1]) : todayDay

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    setCheckedIds((prev) => {
      const valid = new Set(rows.filter(isSessionRow).map((row) => row.id))
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
    setSessionDateInput(selected.calendar_day || calendarDayInParisFromIso(selected.session_at))
    setSessionNotesInput(selected.journal_notes ?? '')
  }, [selected])

  const writeToday = () => {
    const row = rows.find((r) => rowDay(r) === todayDay)
    if (row) setSelectedId(row.id)
    setPhoneView('day')
    // The day page opens its form and focuses the text (phone: opens the keyboard).
    setComposeSignal((n) => n + 1)
  }

  const captureToday = () => {
    const row = rows.find((r) => rowDay(r) === todayDay)
    if (row) setSelectedId(row.id)
    setPhoneView('day')
    setCaptureSignal((n) => n + 1)
  }

  const selectDay = (row: WorkSessionJournalRow) => {
    if (narrow && showManage) {
      if (!isSessionRow(row)) return
      setCheckedIds((prev) => {
        const next = new Set(prev)
        if (next.has(row.id)) next.delete(row.id)
        else next.add(row.id)
        return next
      })
      return
    }
    setSelectedId(row.id)
    if (narrow) {
      setPhoneView('day')
      requestAnimationFrame(() => {
        document.getElementById('journal-day-panel')?.scrollTo({ top: 0 })
      })
    }
  }

  const saveSessionEdit = () => {
    if (!selected) return
    const sessionAt = sessionAtIsoForCalendarDay(sessionDateInput)
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
      const res = await deleteWorkSessionJournalEntry(selected.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setCheckedIds((prev) => {
        const next = new Set(prev)
        next.delete(selected.id)
        return next
      })
      const n = res.deletedCount ?? 0
      if (n === 0) {
        toast.error(t('journal_delete_failed'))
        return
      }
      toast.success(t('journal_bulk_deleted_toast').replace('{n}', String(n)))
      reload()
    })
  }

  const deleteCheckedSessions = () => {
    if (!isAdmin || checkedIds.size === 0) return
    const ids = Array.from(checkedIds)
    const confirmText = t('journal_delete_selected_confirm').replace('{n}', String(ids.length))
    if (!window.confirm(confirmText)) return
    startSessionTransition(async () => {
      const res = await deleteWorkSessionJournalEntries(ids)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      const n = res.deletedCount ?? 0
      if (n === 0) {
        toast.error(t('journal_delete_failed'))
        return
      }
      toast.success(t('journal_bulk_deleted_toast').replace('{n}', String(n)))
      setCheckedIds(new Set())
      reload()
    })
  }

  /** A requested day that is not today waits for the list (today's row exists before it loads). */
  const waitingForDay = loading && openDay != null && openDay !== todayDay
  const showPage = Boolean(selected) && (!narrow || phoneView === 'day') && !waitingForDay
  const showIndex = !narrow || phoneView === 'list'

  return (
    <div
      data-testid="session-journal-tab"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: narrow ? '1fr' : 'minmax(240px, 300px) minmax(0, 1fr)',
        gridTemplateRows: narrow ? 'minmax(0, 1fr)' : undefined,
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
            {journalTeamReadAccess && !isAdmin ? (
              <p
                className="t-mono-sm"
                data-testid="journal-team-readonly-intro"
                style={{
                  color: 'var(--tx2)',
                  fontSize: 10,
                  lineHeight: 1.45,
                  margin: '0 0 10px',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--bd)',
                  background: 'var(--bg0)',
                }}
              >
                {t('journal_team_readonly_intro')}
              </p>
            ) : null}
            <button
              type="button"
              className={isAdmin ? 'btn ghost sm' : 'btn primary sm'}
              data-testid="journal-write-today"
              onClick={writeToday}
              style={{ minHeight: 44, width: '100%', marginBottom: isAdmin ? 8 : 0 }}
            >
              {t('je_write_today')}
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="btn primary sm"
                data-testid="journal-capture-today"
                onClick={captureToday}
                style={{ minHeight: 44, width: '100%' }}
              >
                {t('journal_capture_today')}
              </button>
            ) : null}
            {isAdmin && proposalsOpen.total > 0 && proposalsOpen.oldest ? (
              <button
                type="button"
                className="btn ghost sm"
                data-testid="journal-proposals-bar"
                onClick={() => setOpenDay(proposalsOpen.oldest)}
                style={{ minHeight: 44, width: '100%', marginTop: 8, borderColor: 'var(--ac)', color: 'var(--ac)', justifyContent: 'center' }}
              >
                {t('je_proposals_bar').replace('{n}', String(proposalsOpen.total))}
              </button>
            ) : null}
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}
              data-testid="journal-date-jump"
            >
              <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', flexShrink: 0 }}>{t('journal_jump_label')}</span>
              <input
                type="date"
                min={oldestDay}
                max={todayDay}
                defaultValue=""
                onChange={(e) => jumpToDate(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 44,
                  padding: '6px 8px',
                  fontSize: 14,
                  background: 'var(--bg0)',
                  border: '1px solid var(--bd)',
                  color: 'var(--tx)',
                }}
              />
            </label>
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
              {isAdmin ? (
                <Link href="/atelier/session/new" className="btn ghost sm" style={{ marginTop: 12, minHeight: 40 }}>
                  {t('journal_empty_cta')}
                </Link>
              ) : null}
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
                        id={`journal-day-${rowDay(row)}`}
                        type="button"
                        data-testid={`journal-session-row-${row.id.slice(0, 8)}`}
                        onClick={() => selectDay(row)}
                        aria-label={formatDayShort(row.session_at, locale)}
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
                          {daySummaryLine(row, t, sourceByDay.get(rowDay(row)), isAdmin)}
                        </div>
                        {row.items.length > 0 ? (
                          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {row.items.slice(0, 3).map((item, idx) => (
                              <div
                                key={item.id}
                                className="t-mono-sm"
                                style={{ fontSize: 10, color: 'var(--tx2)', lineHeight: 1.35 }}
                              >
                                {itemTitle(item, `${t('session_painting_label')} ${idx + 1}`)}
                                {item.oeuvre_id ? (
                                  <>
                                    {' · '}
                                    <JournalInventoryIdLink oeuvreId={item.oeuvre_id} stopPropagation />
                                  </>
                                ) : null}
                              </div>
                            ))}
                            {row.items.length > 3 ? (
                              <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
                                +{row.items.length - 3}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
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

          {isAdmin && sessionRows.length > 0 ? (
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
                  <button type="button" className="btn ghost sm" disabled={sessionPending} onClick={() => setCheckedIds(new Set(sessionRows.map((r) => r.id)))}>
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
                      {sessionRows.map((row) => (
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

      {waitingForDay && (!narrow || phoneView === 'day') ? (
        <p className="t-mono-sm" data-testid="journal-day-waiting" style={{ padding: narrow ? '16px' : '32px 40px', color: 'var(--tx3)', margin: 0 }}>
          {t('loading')}
        </p>
      ) : null}
      {showPage ? (
        <main
          id="journal-day-panel"
          data-testid="journal-day-panel"
          style={{
            overflow: 'auto',
            minWidth: 0,
            minHeight: 0,
            borderTop: narrow ? '1px solid var(--bd)' : undefined,
          }}
        >
          <div style={{ padding: narrow ? '12px 16px 32px' : '32px 40px 48px' }}>
            {narrow ? (
              <button
                type="button"
                className="btn ghost sm"
                data-testid="journal-back-to-days"
                onClick={() => setPhoneView('list')}
                style={{ minHeight: 44, marginBottom: 12 }}
              >
                {t('je_back_days')}
              </button>
            ) : null}
            {selected ? (
              <JournalDayPage
                row={selected}
                source={sourceByDay.get(rowDay(selected))}
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
                composeSignal={composeSignal}
                captureSignal={captureSignal}
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
