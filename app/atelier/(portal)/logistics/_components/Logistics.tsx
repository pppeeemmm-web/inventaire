'use client'

// Logistics — every shipment / pick-up / return under way, as R7b checklist cards
// (docs/design/2026-11-18/R7b_OrderCascade.notes.md). Shipments are opened from their orders;
// a shipment carries every order going to the same place. Finished ones on request.

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { fetchShipments, type CascadeShipment } from '@/app/atelier/(portal)/sales/cascade-actions'
import { ShipmentCard } from '@/components/atelier/orders/ShipmentCard'
import { foregroundSettled } from '@/lib/atelier/foreground-gate'

interface Props {
  /** Contact names (kept for the tab's props; names now come with each shipment). */
  cM: Record<number, string>
}

export function Logistics(_props: Props) {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [rows, setRows] = useState<CascadeShipment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    // Opened on Logistics: the Atelier shell's background loads wait for this first read (TODO 19).
    const r = await fetchShipments(showDone).finally(() => foregroundSettled())
    if ('error' in r) { setError(r.error); return }
    setError(null)
    setRows(r.shipments)
  }, [showDone])
  useEffect(() => { void load() }, [load])

  return (
    <div data-testid="atelier-logistics-root" style={{ padding: narrow ? '12px 12px 80px' : '20px 24px', maxWidth: 980 }}>
      <div className="t-label">{t('logistics')}</div>
      <div style={{ fontSize: 13, color: 'var(--tx3)', margin: '4px 0 14px' }}>{t('cas_logistics_intro')}</div>
      {rows == null && !error && <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('loading')}</div>}
      {error && <div role="alert" className="t-mono-sm" style={{ color: 'var(--rust)' }}>{t('error')}: {error}</div>}
      {rows && rows.length === 0 && <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 12 }}>{t('cas_logistics_empty')}</div>}
      {rows?.map((s) => <ShipmentCard key={s.id} s={s} narrow={narrow} onChanged={() => { void load() }} />)}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, color: 'var(--tx2)' }}>
        <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
        {t('cas_show_done')}
      </label>
    </div>
  )
}
