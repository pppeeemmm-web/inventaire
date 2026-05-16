'use client'

// BroadcastTab — atelier command center for inventory broadcast operations.

import { useCallback, useEffect, useMemo, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import {
  appendBroadcastEvent,
  clearStuckQueue,
  confirmBroadcastPost,
  listBroadcastDashboard,
  queueBroadcastWork,
  updateBroadcastPost,
  type BroadcastCandidateRow,
  type BroadcastDashboard,
  type BroadcastEventRow,
  type BroadcastPostedRow,
  type BroadcastQueueRow,
} from '@/app/atelier/broadcast/actions'
import { useAtelierTabResource } from '@/hooks/useAtelierTabResource'
import { ATELIER_TAB_CACHE_POLICY, atelierTabCacheKey } from '@/lib/atelier/tab-cache-policy'

type SubTab = 'queue' | 'posted' | 'activity'
type ActivityFilter = 'vip' | 'all'
type Selection =
  | { kind: 'queue'; id: string }
  | { kind: 'posted'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'candidate'; id: number }

function broadcastRelTime(date: string | null, t: (key: DictKey) => string): string {
  if (!date) return '-'
  const ts = new Date(date).getTime()
  if (!Number.isFinite(ts)) return '-'
  const diff = (Date.now() - ts) / 1000
  if (diff < 60) return t('bc_rel_just_now')
  if (diff < 3600) return t('bc_rel_minutes_fmt').replace('{n}', String(Math.floor(diff / 60)))
  if (diff < 86400) return t('bc_rel_hours_fmt').replace('{n}', String(Math.floor(diff / 3600)))
  return t('bc_rel_days_fmt').replace('{n}', String(Math.floor(diff / 86400)))
}

const panelStyle: CSSProperties = {
  border: '1px solid var(--bd)',
  background: 'var(--bg1)',
}

const buttonStyle: CSSProperties = {
  padding: '8px 12px',
  minHeight: 44,
  fontSize: 10,
  border: '1px solid var(--bd)',
  background: 'var(--bg1)',
  color: 'var(--tx2)',
  cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  border: '1px solid var(--bd)',
  background: 'var(--bg0)',
  color: 'var(--tx)',
  padding: '8px 10px',
  fontSize: 12,
}

export function BroadcastTab({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useI18n()
  const [sub, setSub] = useState<SubTab>('queue')
  const [pending, startTransition] = useTransition()
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('vip')
  const [platform, setPlatform] = useState('instagram')
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)

  const loadDashboard = useCallback(async () => {
    const r = await listBroadcastDashboard({ platform })
    if ('error' in r) throw new Error(r.error)
    setPlatform(r.data.selectedPlatform)
    return r.data
  }, [platform])

  const dashboard = useAtelierTabResource<BroadcastDashboard>({
    cacheKey: atelierTabCacheKey('broadcast', platform),
    staleMs: ATELIER_TAB_CACHE_POLICY.broadcast.staleMs,
    load: loadDashboard,
  })
  const data = dashboard.data
  const err = dashboard.error
  const busy = dashboard.loading
  const reload = useCallback(() => {
    void dashboard.refresh({ force: true })
  }, [dashboard])

  const query = search.trim().toLowerCase()

  const matchesQuery = useCallback((parts: Array<string | number | null | undefined>) => {
    if (!query) return true
    return parts.some((part) => String(part ?? '').toLowerCase().includes(query))
  }, [query])

  const filteredQueue = useMemo(() => {
    if (!data) return []
    return data.queue.filter((row) =>
      (platform === 'all' || row.platform === platform) &&
      matchesQuery([row.oeuvreId, row.titre, row.platform, row.captionSeed]),
    )
  }, [data, matchesQuery, platform])

  const filteredPosted = useMemo(() => {
    if (!data) return []
    return data.posted.filter((row) =>
      (platform === 'all' || row.platform === platform) &&
      matchesQuery([row.oeuvreId, row.titre, row.platform, row.captionFinal, row.externalUrl]),
    )
  }, [data, matchesQuery, platform])

  const filteredEvents = useMemo(() => {
    if (!data) return []
    return data.events.filter((row) =>
      (platform === 'all' || row.platform === platform) &&
      (activityFilter === 'all' || row.priority === 'vip') &&
      matchesQuery([row.oeuvreId, row.titre, row.platform, row.eventType, row.summary]),
    )
  }, [activityFilter, data, matchesQuery, platform])

  const filteredCandidates = useMemo(() => {
    if (!data || platform === 'all') return []
    return data.candidates.filter((row) => matchesQuery([row.oeuvreId, row.titre, row.captionSeed]))
  }, [data, matchesQuery, platform])

  const selectedRow = useMemo(() => {
    if (!data || !selection) return null
    if (selection.kind === 'queue') return data.queue.find((row) => row.broadcastId === selection.id) ?? null
    if (selection.kind === 'posted') return data.posted.find((row) => row.broadcastId === selection.id) ?? null
    if (selection.kind === 'event') return data.events.find((row) => row.id === selection.id) ?? null
    return data.candidates.find((row) => row.oeuvreId === selection.id) ?? null
  }, [data, selection])

  function handleClearStuck(oeuvreId: number, platform: string) {
    if (!confirm(t('bc_clear_stuck_confirm'))) return
    startTransition(async () => {
      const r = await clearStuckQueue(oeuvreId, platform)
      if ('error' in r) alert(t('bc_error_fmt').replace('{msg}', typeof r.error === 'string' ? r.error : String(r.error)))
      reload()
    })
  }

  function runMutation(fn: () => Promise<{ error: string } | { ok: true }>) {
    startTransition(async () => {
      const r = await fn()
      if ('error' in r) {
        alert(t('bc_error_fmt').replace('{msg}', r.error))
        return
      }
      alert(t('bc_action_ok'))
      reload()
    })
  }

  if (err) {
    const accessGate = err === 'Accès réservé à l’administrateur' || err === 'Accès réservé à l’équipe'
    return (
      <div data-testid="broadcast-tab-root" style={{ padding: 40, fontSize: 12, color: 'var(--tx2)' }}>
        {accessGate ? (
          <span data-testid="broadcast-tab-admin-only">{t('bc_team_only')}</span>
        ) : (
          err
        )}
      </div>
    )
  }

  const SUBTABS: Array<[SubTab, string, number]> = [
    ['queue', t('bc_subtab_queue'), data?.counts.queued ?? 0],
    ['posted', t('bc_subtab_posted'), data?.counts.posted ?? 0],
    ['activity', t('bc_subtab_activity'), data?.counts.vipUnseen ?? 0],
  ]

  return (
    <div
      data-testid="broadcast-tab-root"
      style={{ padding: '20px max(16px, env(safe-area-inset-right)) 20px max(16px, env(safe-area-inset-left))', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 12, color: 'var(--tx)' }}
    >
      <section data-testid="broadcast-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <Metric label={t('bc_count_queued')} value={data?.counts.queued ?? 0} />
        <Metric label={t('bc_count_posted')} value={data?.counts.posted ?? 0} />
        <Metric label={t('bc_count_vip')} value={data?.counts.vipUnseen ?? 0} />
        <Metric label={t('bc_count_candidates')} value={data?.counts.candidates ?? 0} />
      </section>

      <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {SUBTABS.map(([id, label, count]) => {
          const active = sub === id
          return (
            <button
              key={id}
              type="button"
              data-testid={`broadcast-subtab-${id}`}
              onClick={() => setSub(id)}
              style={{
                padding: '8px 14px',
                minHeight: 44,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                border: '1px solid var(--bd)',
                background: active ? 'var(--ac)' : 'var(--bg1)',
                color: active ? 'var(--bg1)' : 'var(--tx2)',
                cursor: 'pointer',
              }}
            >
              {label} <span style={{ opacity: 0.6, marginLeft: 6 }}>{count}</span>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <select
          data-testid="broadcast-platform-filter"
          value={platform}
          onChange={(e) => {
            setSelection(null)
            setPlatform(e.target.value)
          }}
          style={{ ...buttonStyle, minWidth: 140 }}
          aria-label={t('bc_platform_filter')}
        >
          <option value="all">{t('bc_filter_all')}</option>
          {(data?.platforms ?? [platform]).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input
          data-testid="broadcast-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('bc_search_placeholder')}
          style={{ ...inputStyle, width: 220 }}
        />
        <button
          type="button"
          data-testid="broadcast-reload"
          onClick={reload}
          disabled={busy || pending}
          style={buttonStyle}
        >
          {busy ? '...' : t('bc_refresh')}
        </button>
      </div>

      {busy && !data && <div style={{ opacity: 0.6 }}>{t('loading')}</div>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 12 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {platform !== 'all' && (
              <CandidateView
                rows={filteredCandidates}
                pending={pending}
                t={t}
                onSelect={(row) => setSelection({ kind: 'candidate', id: row.oeuvreId })}
                onQueue={(row) => runMutation(() => queueBroadcastWork(row.oeuvreId, platform))}
              />
            )}

            {sub === 'queue' && (
              <QueueView
                rows={filteredQueue}
                onClear={handleClearStuck}
                pending={pending}
                t={t}
                canClear={isAdmin || data.isAdmin}
                onSelect={(row) => setSelection({ kind: 'queue', id: row.broadcastId })}
              />
            )}

            {sub === 'posted' && (
              <PostedView
                rows={filteredPosted}
                t={t}
                onSelect={(row) => setSelection({ kind: 'posted', id: row.broadcastId })}
              />
            )}

            {sub === 'activity' && (
              <ActivityView
                rows={filteredEvents}
                activityFilter={activityFilter}
                setActivityFilter={setActivityFilter}
                t={t}
                onSelect={(row) => setSelection({ kind: 'event', id: row.id })}
              />
            )}
          </div>

          <DetailPanel
            t={t}
            selection={selection}
            row={selectedRow}
            platform={platform === 'all' ? data.selectedPlatform : platform}
            canClear={isAdmin || data.isAdmin}
            pending={pending}
            onClose={() => setSelection(null)}
            onClear={handleClearStuck}
            onQueue={(row) => runMutation(() => queueBroadcastWork(row.oeuvreId, platform))}
            onConfirm={(row, externalUrl, captionFinal) =>
              runMutation(() => confirmBroadcastPost({
                oeuvreId: row.oeuvreId,
                platform: row.platform,
                externalUrl,
                captionFinal,
              }))
            }
            onUpdate={(row, externalUrl, captionFinal) =>
              runMutation(() => updateBroadcastPost({
                broadcastId: row.broadcastId,
                externalUrl,
                captionFinal,
              }))
            }
            onNote={(payload) => runMutation(() => appendBroadcastEvent(payload))}
          />
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...panelStyle, padding: 12 }}>
      <div className="t-eyebrow" style={{ fontSize: 9, color: 'var(--tx3)' }}>{label}</div>
      <div className="t-mono-sm" style={{ fontSize: 22, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function PlatformChip({ p }: { p: string }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        fontSize: 9,
        letterSpacing: 1,
        textTransform: 'uppercase',
        border: '1px solid var(--bd)',
        background: 'var(--bg2)',
        color: 'var(--tx2)',
      }}
    >
      {p}
    </span>
  )
}

function Thumb({ src, alt }: { src: string | null; alt: string | null }) {
  if (!src) {
    return <div style={{ width: 48, height: 48, background: 'var(--bg2)', border: '1px solid var(--bd)' }} />
  }
  return (
    <div style={{ position: 'relative', width: 48, height: 48, background: 'var(--bg2)', border: '1px solid var(--bd)', flexShrink: 0 }}>
      <Image src={src} alt={alt ?? ''} fill style={{ objectFit: 'cover' }} sizes="48px" />
    </div>
  )
}

function WorkTitle({ oeuvreId, titre, anneeYear }: { oeuvreId: number; titre: string | null; anneeYear?: number | null }) {
  return (
    <div className="t-mono-sm" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      #{oeuvreId} {titre ?? '-'}{anneeYear ? ` · ${anneeYear}` : ''}
    </div>
  )
}

function CardButton({
  children,
  onClick,
  selected = false,
  testId,
}: {
  children: ReactNode
  onClick: () => void
  selected?: boolean
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick()
      }}
      style={{
        ...panelStyle,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        textAlign: 'left',
        color: 'var(--tx)',
        cursor: 'pointer',
        borderColor: selected ? 'var(--ac)' : 'var(--bd)',
      }}
    >
      {children}
    </div>
  )
}

function CandidateView({
  rows, pending, t, onSelect, onQueue,
}: {
  rows: BroadcastCandidateRow[]
  pending: boolean
  t: ReturnType<typeof useI18n>['t']
  onSelect: (row: BroadcastCandidateRow) => void
  onQueue: (row: BroadcastCandidateRow) => void
}) {
  return (
    <section data-testid="broadcast-candidates" style={{ ...panelStyle, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="t-eyebrow">{t('bc_candidates_title')}</div>
        <span style={{ color: 'var(--tx3)', fontSize: 10 }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('bc_candidates_empty')}</div>
      ) : (
        rows.slice(0, 8).map((row) => (
          <div key={row.oeuvreId} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              data-testid="broadcast-candidate-row"
              onClick={() => onSelect(row)}
              style={{ ...buttonStyle, flex: 1, display: 'flex', gap: 8, alignItems: 'center', textAlign: 'left' }}
            >
              <Thumb src={row.thumb} alt={row.titre} />
              <span style={{ minWidth: 0 }}><WorkTitle oeuvreId={row.oeuvreId} titre={row.titre} anneeYear={row.anneeYear} /></span>
            </button>
            <button type="button" disabled={pending} onClick={() => onQueue(row)} style={buttonStyle}>
              {t('bc_queue_now')}
            </button>
          </div>
        ))
      )}
    </section>
  )
}

function QueueView({
  rows, onClear, pending, t, canClear, onSelect,
}: {
  rows: BroadcastQueueRow[]
  onClear: (id: number, platform: string) => void
  pending: boolean
  t: ReturnType<typeof useI18n>['t']
  canClear: boolean
  onSelect: (row: BroadcastQueueRow) => void
}) {
  if (rows.length === 0) {
    return <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('bc_queue_empty')}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <CardButton key={r.broadcastId} testId="broadcast-queue-row" onClick={() => onSelect(r)}>
          <Thumb src={r.thumb} alt={r.titre} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <WorkTitle oeuvreId={r.oeuvreId} titre={r.titre} anneeYear={r.anneeYear} />
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx3)' }}>
              <PlatformChip p={r.platform} />
              <span>{t('bc_queued_at')} · {broadcastRelTime(r.queuedAt, t)}</span>
              <span>· {r.attemptCount} {t('bc_attempts')}</span>
            </div>
          </div>
          {canClear && (
            <button
              type="button"
              onClick={() => onClear(r.oeuvreId, r.platform)}
              disabled={pending}
              style={{ padding: '8px 12px', fontSize: 10, border: '1px solid var(--bd)', background: 'var(--bg2)', color: 'var(--tx2)', cursor: 'pointer', minHeight: 44, flexShrink: 0 }}
            >
              {t('bc_clear_stuck')}
            </button>
          )}
        </CardButton>
      ))}
    </div>
  )
}

function PostedView({
  rows, t, onSelect,
}: {
  rows: BroadcastPostedRow[]
  t: ReturnType<typeof useI18n>['t']
  onSelect: (row: BroadcastPostedRow) => void
}) {
  if (rows.length === 0) {
    return <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('bc_posted_empty')}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <CardButton key={r.broadcastId} testId="broadcast-posted-row" onClick={() => onSelect(r)}>
          <Thumb src={r.thumb} alt={r.titre} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <WorkTitle oeuvreId={r.oeuvreId} titre={r.titre} />
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx3)' }}>
              <PlatformChip p={r.platform} />
              <span>{t('bc_posted_at')} · {broadcastRelTime(r.broadcastAt, t)}</span>
            </div>
            {r.captionFinal && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--tx2)', lineHeight: 1.45, whiteSpace: 'pre-wrap', maxHeight: 64, overflow: 'hidden' }}>
                {r.captionFinal}
              </div>
            )}
          </div>
          {r.externalUrl && (
            <a
              href={r.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ padding: '8px 12px', fontSize: 10, border: '1px solid var(--bd)', background: 'var(--bg2)', color: 'var(--ac)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
            >
              {t('bc_open_post')} ↗
            </a>
          )}
        </CardButton>
      ))}
    </div>
  )
}

function ActivityView({
  rows, activityFilter, setActivityFilter, t, onSelect,
}: {
  rows: BroadcastEventRow[]
  activityFilter: ActivityFilter
  setActivityFilter: (value: ActivityFilter) => void
  t: ReturnType<typeof useI18n>['t']
  onSelect: (row: BroadcastEventRow) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <button
          type="button"
          data-testid="broadcast-filter-vip"
          onClick={() => setActivityFilter('vip')}
          style={{ padding: '6px 12px', fontSize: 10, minHeight: 44, border: '1px solid var(--bd)', background: activityFilter === 'vip' ? 'var(--ac)' : 'var(--bg1)', color: activityFilter === 'vip' ? 'var(--bg1)' : 'var(--tx2)', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('bc_filter_vip')}
        </button>
        <button
          type="button"
          data-testid="broadcast-filter-all"
          onClick={() => setActivityFilter('all')}
          style={{ padding: '6px 12px', fontSize: 10, minHeight: 44, border: '1px solid var(--bd)', background: activityFilter === 'all' ? 'var(--ac)' : 'var(--bg1)', color: activityFilter === 'all' ? 'var(--bg1)' : 'var(--tx2)', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('bc_filter_all')}
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('bc_activity_empty')}</div>
      ) : (
        rows.map((e) => (
          <button
            type="button"
            data-testid="broadcast-event-row"
            key={e.id}
            onClick={() => onSelect(e)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 10,
              border: '1px solid var(--bd)',
              background: e.priority === 'vip' ? 'var(--bg2)' : 'var(--bg1)',
              borderLeft: e.priority === 'vip' ? '3px solid var(--ac)' : '1px solid var(--bd)',
              color: 'var(--tx)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center', fontSize: 10, color: 'var(--tx3)' }}>
                <PlatformChip p={e.platform} />
                <span style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{e.eventType}</span>
                <span>· {broadcastRelTime(e.createdAt, t)}</span>
                {e.titre && <span>· #{e.oeuvreId} {e.titre}</span>}
              </div>
              {e.summary && (
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--tx2)', lineHeight: 1.45 }}>
                  {e.summary}
                </div>
              )}
            </div>
            {e.externalUrl && (
              <a
                href={e.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '8px 12px', fontSize: 10, border: '1px solid var(--bd)', background: 'var(--bg1)', color: 'var(--ac)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
              >
                {t('bc_open_post')} ↗
              </a>
            )}
          </button>
        ))
      )}
    </div>
  )
}

function DetailPanel({
  t,
  selection,
  row,
  platform,
  canClear,
  pending,
  onClose,
  onClear,
  onQueue,
  onConfirm,
  onUpdate,
  onNote,
}: {
  t: ReturnType<typeof useI18n>['t']
  selection: Selection | null
  row: BroadcastQueueRow | BroadcastPostedRow | BroadcastEventRow | BroadcastCandidateRow | null
  platform: string
  canClear: boolean
  pending: boolean
  onClose: () => void
  onClear: (id: number, platform: string) => void
  onQueue: (row: BroadcastCandidateRow) => void
  onConfirm: (row: BroadcastQueueRow, externalUrl: string, captionFinal: string) => void
  onUpdate: (row: BroadcastPostedRow, externalUrl: string, captionFinal: string) => void
  onNote: (payload: { oeuvreId?: number | null; platform: string; priority?: 'vip' | 'normal'; summary: string; externalUrl?: string | null }) => void
}) {
  const [externalUrl, setExternalUrl] = useState('')
  const [captionFinal, setCaptionFinal] = useState('')
  const [note, setNote] = useState('')
  const [notePriority, setNotePriority] = useState<'vip' | 'normal'>('normal')

  useEffect(() => {
    if (selection?.kind === 'posted' && row && 'externalUrl' in row && 'captionFinal' in row) {
      setExternalUrl(row.externalUrl ?? '')
      setCaptionFinal(row.captionFinal ?? '')
    } else {
      setExternalUrl('')
      setCaptionFinal('')
    }
    setNote('')
    setNotePriority('normal')
  }, [row, selection])

  if (!selection || !row) {
    return (
      <aside data-testid="broadcast-detail-panel" style={{ ...panelStyle, padding: 16, minHeight: 240 }}>
        <div className="t-eyebrow">{t('bc_detail_title')}</div>
        <p style={{ color: 'var(--tx3)', lineHeight: 1.5 }}>{t('bc_detail_empty')}</p>
      </aside>
    )
  }

  const oeuvreId = 'oeuvreId' in row ? row.oeuvreId : null
  const rowPlatform = 'platform' in row ? row.platform : platform
  const title = 'titre' in row ? row.titre : null

  return (
    <aside data-testid="broadcast-detail-panel" style={{ ...panelStyle, padding: 16, minHeight: 240, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row gap-sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="t-eyebrow">{t('bc_detail_title')}</div>
        <button type="button" onClick={onClose} style={buttonStyle}>{t('bc_close')}</button>
      </div>

      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        {'thumb' in row ? <Thumb src={row.thumb} alt={title} /> : null}
        <div style={{ minWidth: 0 }}>
          {oeuvreId ? <WorkTitle oeuvreId={oeuvreId} titre={title} anneeYear={'anneeYear' in row ? row.anneeYear : null} /> : null}
          <div style={{ marginTop: 6 }}><PlatformChip p={rowPlatform} /></div>
        </div>
      </div>

      {oeuvreId ? (
        <Link href={`/atelier?work=${oeuvreId}`} style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          {t('bc_open_work')}
        </Link>
      ) : null}

      {'captionSeed' in row && row.captionSeed ? (
        <section style={{ color: 'var(--tx2)', lineHeight: 1.5 }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('bc_caption_seed')}</div>
          {row.captionSeed}
        </section>
      ) : null}

      {selection.kind === 'candidate' && 'oeuvreId' in row ? (
        <button type="button" disabled={pending} onClick={() => onQueue(row as BroadcastCandidateRow)} style={{ ...buttonStyle, background: 'var(--ac)', color: 'var(--bg1)' }}>
          {t('bc_queue_now')}
        </button>
      ) : null}

      {selection.kind === 'queue' && 'queuedAt' in row ? (
        <>
          <div style={{ color: 'var(--tx3)' }}>
            {t('bc_queued_at')} · {broadcastRelTime(row.queuedAt, t)} · {row.attemptCount} {t('bc_attempts')}
          </div>
          <Field label={t('bc_external_url')}>
            <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={t('bc_caption_final')}>
            <textarea value={captionFinal} onChange={(e) => setCaptionFinal(e.target.value)} style={{ ...inputStyle, minHeight: 120 }} />
          </Field>
          <button type="button" disabled={pending} onClick={() => onConfirm(row, externalUrl, captionFinal)} style={{ ...buttonStyle, background: 'var(--ac)', color: 'var(--bg1)' }}>
            {t('bc_confirm_post')}
          </button>
          {canClear ? (
            <button type="button" disabled={pending} onClick={() => onClear(row.oeuvreId, row.platform)} style={buttonStyle}>
              {t('bc_clear_stuck')}
            </button>
          ) : null}
        </>
      ) : null}

      {selection.kind === 'posted' && 'broadcastAt' in row ? (
        <>
          <div style={{ color: 'var(--tx3)' }}>{t('bc_posted_at')} · {broadcastRelTime(row.broadcastAt, t)}</div>
          <Field label={t('bc_external_url')}>
            <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={t('bc_caption_final')}>
            <textarea value={captionFinal} onChange={(e) => setCaptionFinal(e.target.value)} style={{ ...inputStyle, minHeight: 140 }} />
          </Field>
          <button type="button" disabled={pending} onClick={() => onUpdate(row, externalUrl, captionFinal)} style={{ ...buttonStyle, background: 'var(--ac)', color: 'var(--bg1)' }}>
            {t('bc_save_post')}
          </button>
          {row.externalUrl ? (
            <a href={row.externalUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle, textDecoration: 'none', textAlign: 'center' }}>
              {t('bc_open_post')} ↗
            </a>
          ) : null}
        </>
      ) : null}

      {selection.kind === 'event' && 'eventType' in row ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="t-eyebrow">{t('bc_event_type_label')}</div>
          <div>{row.eventType} · {row.priority}</div>
          {row.summary ? <div style={{ color: 'var(--tx2)', lineHeight: 1.5 }}>{row.summary}</div> : null}
        </section>
      ) : null}

      <section style={{ borderTop: '1px solid var(--bd)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="t-eyebrow">{t('bc_note_title')}</div>
        <select value={notePriority} onChange={(e) => setNotePriority(e.target.value === 'vip' ? 'vip' : 'normal')} style={inputStyle}>
          <option value="normal">{t('bc_priority_normal')}</option>
          <option value="vip">{t('bc_priority_vip')}</option>
        </select>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('bc_note_placeholder')} style={{ ...inputStyle, minHeight: 100 }} />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => {
            onNote({ oeuvreId, platform: rowPlatform, priority: notePriority, summary: note })
            setNote('')
          }}
          style={buttonStyle}
        >
          {t('bc_add_note')}
        </button>
      </section>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="t-eyebrow">{label}</span>
      {children}
    </label>
  )
}
