'use client'

// Logistics — shipments table, client-side fetch.
// Reads shipment + shipment_work from Supabase, resolves contact names via cM.

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markShipmentDelivered } from '@/app/atelier/logistics/actions'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { stringifyError } from '@/lib/error'

// ── Types ────────────────────────────────────────────────────

interface ShipmentRow {
  id:            string
  to_contact_id: number | null
  kind:          string | null
  scheduled_for: string | null
  shipped_at:    string | null
  delivered_at:  string | null
  status:        string
  note:          string | null
  work_count:    number
}

interface Props {
  cM: Record<number, string>
}

/** Chip colour class per known shipment status */
const STATUS_CHIP_COLOR: Record<string, string> = {
  packed:    'sage',
  ready:     'dust',
  scheduled: '',
  transit:   'cyan',
  delivered: 'sage',
}

const STATUS_LABEL_KEY: Record<string, DictKey> = {
  packed:    'logistics_status_packed',
  ready:     'logistics_status_ready',
  scheduled: 'logistics_status_scheduled',
  transit:   'logistics_status_transit',
  delivered: 'logistics_status_delivered',
}

// ── Component ────────────────────────────────────────────────

export function Logistics({ cM }: Props) {
  const { t } = useI18n()
  const [rows,    setRows]    = useState<ShipmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const fetchShipments = useCallback(async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data: shipments, error: err } = await supabase
      .from('shipment')
      .select('id, to_contact_id, kind, scheduled_for, shipped_at, delivered_at, status, note')
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .limit(200)

    if (err || !shipments) {
      setError(err?.message ?? t('error'))
      setLoading(false)
      return
    }

    const { data: workLinks } = await supabase.from('shipment_work').select('shipment_id, oeuvre_id')

    const countMap: Record<string, number> = {}
    for (const link of workLinks ?? []) {
      countMap[link.shipment_id] = (countMap[link.shipment_id] ?? 0) + 1
    }

    const enriched: ShipmentRow[] = shipments.map((s) => ({
      ...s,
      work_count: countMap[s.id] ?? 0,
    }))

    setRows(enriched)
    setLoading(false)
  }, [t])

  useEffect(() => {
    void fetchShipments()
  }, [fetchShipments])

  const upcoming = rows.filter((r) => !r.delivered_at && r.status !== 'delivered')
  const past     = rows.filter((r) =>  r.delivered_at || r.status === 'delivered')

  return (
    <div data-testid="atelier-logistics-root" style={{ padding: '20px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="t-label">{t('logistics')}</div>
          {!loading && (
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
              {upcoming.length} {t('logistics_upcoming_subtitle')}
            </div>
          )}
        </div>
        <button type="button" className="btn ghost sm" disabled style={{ opacity: 0.4 }}>
          + {t('logistics_new_movement')}
        </button>
      </div>

      {loading && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('loading')}</div>
      )}

      {error && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('error')}: {error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
          {t('logistics_empty')}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <ShipmentTable
              rows={upcoming}
              cM={cM}
              title={t('logistics_section_upcoming')}
              onMarkDelivered={fetchShipments}
            />
          )}

          {/* Past */}
          {past.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <ShipmentTable
                rows={past}
                cM={cM}
                title={t('logistics_section_history')}
                muted
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Shipment table ────────────────────────────────────────────

function ShipmentTable({
  rows, cM, title, muted = false, onMarkDelivered,
}: {
  rows:  ShipmentRow[]
  cM:    Record<number, string>
  title: string
  muted?: boolean
  onMarkDelivered?: () => void | Promise<void>
}) {
  const { t } = useI18n()
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 10, color: muted ? 'var(--tx3)' : undefined }}>
        {title}
      </div>
      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>{t('logistics_col_recipient')}</th>
              <th>{t('logistics_col_type')}</th>
              <th className="num">{t('logistics_col_works')}</th>
              <th className="num">{t('logistics_col_date')}</th>
              <th>{t('logistics_col_status')}</th>
              {!muted && onMarkDelivered ? <th>{t('logistics_col_action')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const color = STATUS_CHIP_COLOR[r.status] ?? ''
              const labelKey = STATUS_LABEL_KEY[r.status]
              const label = labelKey ? t(labelKey) : r.status
              const contactLabel = r.to_contact_id ? (cM[r.to_contact_id] ?? `#${r.to_contact_id}`) : '—'
              const dateStr = r.delivered_at ?? r.shipped_at ?? r.scheduled_for ?? '—'
              return (
                <tr key={r.id}>
                  <td style={{ color: 'var(--tx)' }}>{contactLabel}</td>
                  <td>{r.kind ?? '—'}</td>
                  <td className="num">{r.work_count || '—'}</td>
                  <td className="num" style={{ color: 'var(--tx2)' }}>{dateStr.slice(0, 10)}</td>
                  <td>
                    <span className={`chip ${color}`}>{label}</span>
                  </td>
                  {!muted && onMarkDelivered ? (
                    <td>
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ minHeight: 44 }}
                        onClick={async () => {
                          if (!confirm(t('logistics_mark_delivered_confirm'))) return
                          const res = await markShipmentDelivered(r.id)
                          if ('ok' in res) await onMarkDelivered()
                          else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                        }}
                      >
                        {t('logistics_mark_delivered')}
                      </button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
