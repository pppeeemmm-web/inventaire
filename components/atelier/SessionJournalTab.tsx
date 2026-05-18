'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { imageUrl, thumbUrl } from '@/lib/data'
import { toast } from '@/lib/ui/toast'
import {
  deleteWorkSessionItem,
  fetchSessionItemVersionCompare,
  listWorkSessionJournal,
  updateWorkSessionItemMetadata,
  type WorkSessionJournalItem,
  type WorkSessionJournalRow,
  type WorkSessionVersionCompare,
} from '@/app/atelier/session/actions'

function statusKey(status: string): DictKey {
  if (status === 'pending_review') return 'session_status_pending_review'
  if (status === 'applied') return 'session_status_applied'
  if (status === 'rejected') return 'session_status_rejected'
  if (status === 'abandoned') return 'session_status_abandoned'
  return 'session_status_draft'
}

function itemTitle(item: WorkSessionJournalItem, fallback: string): string {
  if (item.oeuvre_id) return `#${item.oeuvre_id} · ${item.oeuvre_title ?? fallback}`
  return item.title_hint?.trim() || fallback
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}

function FieldValue({ value }: { value: unknown }) {
  return <>{value == null || value === '' ? '—' : String(value)}</>
}

function VersionCompare({
  compare,
}: {
  compare: WorkSessionVersionCompare
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  return (
    <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 10, marginTop: 10 }}>
      <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 8 }}>
        {t('journal_compare_before')}: {formatDate(compare.before.changed_at, locale)} · {t('journal_compare_after')}:{' '}
        {compare.after.changed_at ? formatDate(compare.after.changed_at, locale) : t('journal_compare_current')}
      </div>
      {compare.changes.length === 0 ? (
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>
          {t('journal_compare_empty')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ width: '100%', fontSize: 10 }}>
            <thead>
              <tr>
                <th>{t('history_field')}</th>
                <th>{t('history_before')}</th>
                <th>{t('history_after')}</th>
              </tr>
            </thead>
            <tbody>
              {compare.changes.slice(0, 16).map((change) => (
                <tr key={change.field}>
                  <td style={{ color: 'var(--tx2)' }}>{change.field}</td>
                  <td style={{ color: 'var(--tx3)' }}><FieldValue value={change.before} /></td>
                  <td style={{ color: 'var(--ac)' }}><FieldValue value={change.after} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function JournalItemCard({
  item,
  sessionId,
  sessionDate,
  onChanged,
}: {
  item: WorkSessionJournalItem
  sessionId: string
  sessionDate: string
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [compare, setCompare] = useState<WorkSessionVersionCompare | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [titleHint, setTitleHint] = useState(item.title_hint ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const [widthCm, setWidthCm] = useState(item.width_cm ?? '')
  const [heightCm, setHeightCm] = useState(item.height_cm ?? '')
  const [pending, startTransition] = useTransition()
  const displayTitle = itemTitle(item, t('untitled'))
  const stagedCount = item.staged_shots.length
  const totalPhotos = stagedCount + item.applied_shot_count

  useEffect(() => {
    setTitleHint(item.title_hint ?? '')
    setNotes(item.notes ?? '')
    setWidthCm(item.width_cm ?? '')
    setHeightCm(item.height_cm ?? '')
    setEditing(false)
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
      style={{
        border: '1px solid var(--bd)',
        borderRadius: 10,
        padding: 14,
        background: 'var(--bg1)',
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
            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--bd)', flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: 6, border: '1px dashed var(--bd)', background: 'var(--bg2)', flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayTitle}
          </div>
          <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>
            {t(statusKey(item.status))} · {totalPhotos} {t('drawer_work_sessions_shots')}
            {item.width_cm || item.height_cm ? ` · ${item.width_cm ?? '?'} × ${item.height_cm ?? '?'} cm` : ''}
          </div>
          {item.notes ? (
            <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.45, margin: '8px 0 0' }}>
              {item.notes}
            </p>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            {t('session_title_hint_label')}
            <input className="input" value={titleHint} onChange={(e) => setTitleHint(e.target.value)} style={{ minHeight: 36 }} />
          </label>
          <label className="t-mono-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
            {t('session_item_notes_label')}
            <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="t-mono-sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              W
              <input className="input" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} style={{ minHeight: 36 }} />
            </label>
            <label className="t-mono-sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              H
              <input className="input" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} style={{ minHeight: 36 }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <button type="button" className="btn ghost sm" disabled={pending} onClick={() => setEditing(true)} style={{ minHeight: 36 }}>
            {t('edit')}
          </button>
          <button type="button" className="btn ghost sm" disabled={pending} onClick={deleteItem} style={{ minHeight: 36 }}>
            {t('delete')}
          </button>
        </div>
      )}

      {item.staged_shots.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {item.staged_shots.map((shot) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={shot.r2_key}
              src={imageUrl(shot.thumb_r2_key ?? shot.r2_key) ?? ''}
              alt=""
              style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)', flex: '0 0 auto' }}
            />
          ))}
        </div>
      ) : null}

      {item.oeuvre_id ? (
        <div>
          <button
            type="button"
            className="btn ghost sm"
            disabled={pending}
            onClick={loadCompare}
            style={{ minHeight: 36 }}
          >
            {pending ? t('loading') : t('journal_compare_cta')}
          </button>
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

export function SessionJournalTab() {
  const { t, lang } = useI18n()
  const [rows, setRows] = useState<WorkSessionJournalRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const reload = useCallback(() => {
    setLoading(true)
    void listWorkSessionJournal().then((data) => {
      setRows(data)
      setSelectedId((current) => data.some((row) => row.id === current) ? current : data[0]?.id ?? null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const grouped = useMemo(() => {
    const groups = new Map<string, WorkSessionJournalRow[]>()
    for (const row of rows) {
      const key = new Date(row.session_at).toLocaleDateString(locale, { dateStyle: 'medium' })
      groups.set(key, [...(groups.get(key) ?? []), row])
    }
    return Array.from(groups.entries())
  }, [locale, rows])

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null

  return (
    <div
      data-testid="session-journal-tab"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 340px) minmax(0, 1fr)',
        gap: 0,
      }}
    >
      <aside style={{ borderRight: '1px solid var(--bd)', overflow: 'auto', background: 'var(--bg1)' }}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--bd)' }}>
          <h2 className="serif" style={{ margin: 0, fontSize: 22 }}>{t('journal_tab_title')}</h2>
          <p className="t-mono-sm" style={{ color: 'var(--tx2)', lineHeight: 1.5, fontSize: 11, margin: '8px 0 0' }}>
            {t('journal_tab_intro')}
          </p>
        </div>
        {loading ? (
          <div className="t-mono-sm" style={{ padding: 20, color: 'var(--tx3)' }}>{t('loading')}</div>
        ) : grouped.length === 0 ? (
          <div className="t-mono-sm" style={{ padding: 20, color: 'var(--tx3)' }}>{t('journal_empty')}</div>
        ) : (
          grouped.map(([date, dateRows]) => (
            <section key={date} style={{ borderBottom: '1px solid var(--bd)' }}>
              <div className="t-eyebrow" style={{ padding: '14px 20px 6px', color: 'var(--tx3)' }}>{date}</div>
              {dateRows.map((row) => {
                const isSelected = selected?.id === row.id
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
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
                    <div style={{ fontSize: 12 }}>{formatDate(row.session_at, locale)}</div>
                    <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>
                      {row.item_count} {t('session_journal_items_count')} · {row.staged_shot_count + row.applied_shot_count}{' '}
                      {t('drawer_work_sessions_shots')} · {t(statusKey(row.status))}
                    </div>
                  </button>
                )
              })}
            </section>
          ))
        )}
      </aside>

      <main style={{ overflow: 'auto', minWidth: 0 }}>
        {selected ? (
          <div style={{ padding: 28, maxWidth: 980 }}>
            <div className="t-eyebrow" style={{ color: 'var(--tx3)', marginBottom: 8 }}>{t('journal_session_date')}</div>
            <h1 className="serif" style={{ fontSize: 28, margin: 0 }}>{formatDate(selected.session_at, locale)}</h1>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11, marginTop: 8 }}>
              {selected.item_count} {t('session_journal_items_count')} · {selected.staged_shot_count + selected.applied_shot_count}{' '}
              {t('drawer_work_sessions_shots')} · {t(statusKey(selected.status))}
            </div>
            {selected.field_context ? (
              <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 8 }}>
                {selected.field_context.latitude.toFixed(5)}, {selected.field_context.longitude.toFixed(5)}
                {selected.field_context.weather.temperature_c != null ? ` · ${selected.field_context.weather.temperature_c} °C` : ''}
              </div>
            ) : null}
            {selected.journal_notes ? (
              <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.6, marginTop: 18 }}>
                {selected.journal_notes}
              </p>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 24 }}>
              {selected.items.map((item) => (
                <JournalItemCard
                  key={item.id}
                  item={item}
                  sessionId={selected.id}
                  sessionDate={selected.session_at}
                  onChanged={reload}
                />
              ))}
              {selected.items.length === 0 ? (
                <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('journal_no_items')}</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="t-mono-sm" style={{ padding: 28, color: 'var(--tx3)' }}>{t('journal_empty')}</div>
        )}
      </main>
    </div>
  )
}
