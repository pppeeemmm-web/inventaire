'use client'

// BroadcastTab — atelier command center for inventory broadcast (Phase 2).
// Three subtabs: Queue (in-flight), Posted (history), Activity (VIP/normal events).
// Admin-only. Reads from app/atelier/broadcast/actions.ts.

import { useEffect, useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n/context'
import {
  listBroadcastDashboard,
  clearStuckQueue,
  type BroadcastDashboard,
} from '@/app/atelier/broadcast/actions'

type SubTab = 'queue' | 'posted' | 'activity'

function rel(date: string | null, lang: string): string {
  if (!date) return '—'
  const t = new Date(date).getTime()
  if (!Number.isFinite(t)) return '—'
  const diff = (Date.now() - t) / 1000
  if (diff < 60) return lang === 'fr' ? 'à l’instant' : 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`
  return `${Math.floor(diff / 86400)} j`
}

export function BroadcastTab() {
  const { t, lang } = useI18n()
  const [sub, setSub] = useState<SubTab>('queue')
  const [data, setData] = useState<BroadcastDashboard | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [pending, startTransition] = useTransition()
  const [vipOnly, setVipOnly] = useState(true)

  function reload() {
    setBusy(true)
    listBroadcastDashboard().then((r) => {
      if ('error' in r) {
        setErr(r.error)
        setData(null)
      } else {
        setErr(null)
        setData(r.data)
      }
      setBusy(false)
    })
  }

  useEffect(() => { reload() }, [])

  const filteredEvents = useMemo(() => {
    if (!data) return []
    return vipOnly ? data.events.filter((e) => e.priority === 'vip') : data.events
  }, [data, vipOnly])

  function handleClearStuck(oeuvreId: number, platform: string) {
    if (!confirm(t('bc_clear_stuck_confirm'))) return
    startTransition(async () => {
      const r = await clearStuckQueue(oeuvreId, platform)
      if ('error' in r) alert(r.error)
      reload()
    })
  }

  if (err) {
    const adminGate = err === 'Accès réservé à l’administrateur'
    return (
      <div data-testid="broadcast-tab-root" style={{ padding: 40, fontSize: 12, color: 'var(--tx2)' }}>
        {adminGate ? (
          <span data-testid="broadcast-tab-admin-only">{t('bc_admin_only')}</span>
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
        <button
          type="button"
          data-testid="broadcast-reload"
          onClick={reload}
          disabled={busy || pending}
          style={{ padding: '8px 12px', fontSize: 10, border: '1px solid var(--bd)', background: 'var(--bg1)', color: 'var(--tx2)', cursor: 'pointer', minHeight: 44 }}
        >
          {busy ? '…' : '↻'}
        </button>
      </div>

      {busy && !data && <div style={{ opacity: 0.6 }}>{t('loading')}</div>}

      {sub === 'queue' && data && (
        <QueueView rows={data.queue} onClear={handleClearStuck} pending={pending} lang={lang} t={t} />
      )}

      {sub === 'posted' && data && (
        <PostedView rows={data.posted} lang={lang} t={t} />
      )}

      {sub === 'activity' && data && (
        <ActivityView
          rows={filteredEvents}
          vipOnly={vipOnly}
          setVipOnly={setVipOnly}
          lang={lang}
          t={t}
        />
      )}
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

function QueueView({
  rows, onClear, pending, lang, t,
}: {
  rows: import('@/app/atelier/broadcast/actions').BroadcastQueueRow[]
  onClear: (id: number, platform: string) => void
  pending: boolean
  lang: string
  t: ReturnType<typeof useI18n>['t']
}) {
  if (rows.length === 0) {
    return <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('bc_queue_empty')}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div
          key={r.broadcastId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 10,
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
          }}
        >
          <Thumb src={r.thumb} alt={r.titre} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-mono-sm" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              #{r.oeuvreId} {r.titre ?? '—'}{r.anneeYear ? ` · ${r.anneeYear}` : ''}
            </div>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx3)' }}>
              <PlatformChip p={r.platform} />
              <span>{t('bc_queued_at')} · {rel(r.queuedAt, lang)}</span>
              <span>· {r.attemptCount} {t('bc_attempts')}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onClear(r.oeuvreId, r.platform)}
            disabled={pending}
            style={{ padding: '8px 12px', fontSize: 10, border: '1px solid var(--bd)', background: 'var(--bg2)', color: 'var(--tx2)', cursor: 'pointer', minHeight: 44, flexShrink: 0 }}
          >
            {t('bc_clear_stuck')}
          </button>
        </div>
      ))}
    </div>
  )
}

function PostedView({
  rows, lang, t,
}: {
  rows: import('@/app/atelier/broadcast/actions').BroadcastPostedRow[]
  lang: string
  t: ReturnType<typeof useI18n>['t']
}) {
  if (rows.length === 0) {
    return <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('bc_posted_empty')}</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => (
        <div
          key={r.broadcastId}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: 10,
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
          }}
        >
          <Thumb src={r.thumb} alt={r.titre} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-mono-sm" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              #{r.oeuvreId} {r.titre ?? '—'}
            </div>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx3)' }}>
              <PlatformChip p={r.platform} />
              <span>{t('bc_posted_at')} · {rel(r.broadcastAt, lang)}</span>
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
        </div>
      ))}
    </div>
  )
}

function ActivityView({
  rows, vipOnly, setVipOnly, lang, t,
}: {
  rows: import('@/app/atelier/broadcast/actions').BroadcastEventRow[]
  vipOnly: boolean
  setVipOnly: (b: boolean) => void
  lang: string
  t: ReturnType<typeof useI18n>['t']
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="row gap-sm" style={{ alignItems: 'center' }}>
        <button
          type="button"
          data-testid="broadcast-filter-vip"
          onClick={() => setVipOnly(true)}
          style={{ padding: '6px 12px', fontSize: 10, minHeight: 44, border: '1px solid var(--bd)', background: vipOnly ? 'var(--ac)' : 'var(--bg1)', color: vipOnly ? 'var(--bg1)' : 'var(--tx2)', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('bc_filter_vip')}
        </button>
        <button
          type="button"
          data-testid="broadcast-filter-all"
          onClick={() => setVipOnly(false)}
          style={{ padding: '6px 12px', fontSize: 10, minHeight: 44, border: '1px solid var(--bd)', background: !vipOnly ? 'var(--ac)' : 'var(--bg1)', color: !vipOnly ? 'var(--bg1)' : 'var(--tx2)', cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {t('bc_filter_all')}
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ opacity: 0.5, fontStyle: 'italic' }}>{t('bc_activity_empty')}</div>
      ) : (
        rows.map((e) => (
          <div
            key={e.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 10,
              border: '1px solid var(--bd)',
              background: e.priority === 'vip' ? 'var(--bg2)' : 'var(--bg1)',
              borderLeft: e.priority === 'vip' ? '3px solid var(--ac)' : '1px solid var(--bd)',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center', fontSize: 10, color: 'var(--tx3)' }}>
                <PlatformChip p={e.platform} />
                <span style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{e.eventType}</span>
                <span>· {rel(e.createdAt, lang)}</span>
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
          </div>
        ))
      )}
    </div>
  )
}
