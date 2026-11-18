'use client'

// Work card R3 › Objet › Logistique (docs/design/2026-11-16/WorkCard.notes.md): the work's shipments
// (`shipment_work` → `shipment`, read as the Logistique tab reads them), the open one as a Top chip
// (« Planifié → Encadreur · 20 nov. »), and `Oeuvres.DateLivraison` / `ReturnDate`, edited here and
// saved with the card's own save (`date_livraison` / `return_date`).

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import type { DictKey } from '@/lib/i18n/dictionary'
import { Chip, EmptyValue, TapEdit, chipH } from './WorkCardParts'
import { FIS } from './drawer-widgets'
import { stepLabel, type ShipmentKind, type ShipmentStatus } from '@/lib/orders/cascade'

export type WorkShipment = {
  id: string
  kind: string | null
  status: string | null
  scheduled_for: string | null
  shipped_at: string | null
  delivered_at: string | null
  to_contact_id: number | null
  /** Recipient's display name ('' when unknown). */
  to_name: string
}

/** Labels of shipments made before the R7b checklist (none live on 2026-11-18). */
const STATUS_LABEL_KEY: Record<string, DictKey> = {
  packed: 'logistics_status_packed',
  ready: 'logistics_status_ready',
  scheduled: 'logistics_status_scheduled',
  transit: 'logistics_status_transit',
  delivered: 'logistics_status_delivered',
}

export const isShipmentOpen = (s: WorkShipment) => !s.delivered_at && s.status !== 'delivered' && s.status !== 'cancelled'

/** The work's shipments, open ones first (earliest date first). Read-only; null while loading. */
export function useWorkShipments(oeuvreId: number): WorkShipment[] | null {
  const [rows, setRows] = useState<WorkShipment[] | null>(null)
  useEffect(() => {
    let alive = true
    setRows(null)
    void (async () => {
      const sb = createClient()
      const { data: links } = await sb.from('shipment_work').select('shipment_id').eq('oeuvre_id', oeuvreId)
      const ids = Array.from(new Set((links ?? []).map((l) => l.shipment_id).filter((x): x is string => !!x)))
      if (!ids.length) {
        if (alive) setRows([])
        return
      }
      const { data: ships } = await sb
        .from('shipment')
        .select('id, kind, status, scheduled_for, shipped_at, delivered_at, to_contact_id')
        .in('id', ids)
      const cids = Array.from(new Set((ships ?? []).map((s) => s.to_contact_id).filter((x): x is number => x != null)))
      const names = new Map<number, string>()
      if (cids.length) {
        const { data: cs } = await sb.from('Contact').select('ContactID, NomInstitution, "Prénom", Nom').in('ContactID', cids)
        for (const c of cs ?? []) {
          names.set(c.ContactID, c.NomInstitution || [c.Prénom, c.Nom].filter(Boolean).join(' ') || '')
        }
      }
      const out: WorkShipment[] = (ships ?? []).map((s) => ({
        ...s,
        to_name: s.to_contact_id != null ? names.get(s.to_contact_id) ?? '' : '',
      }))
      const when = (s: WorkShipment) => s.delivered_at ?? s.shipped_at ?? s.scheduled_for ?? ''
      out.sort((a, b) => Number(isShipmentOpen(b)) - Number(isShipmentOpen(a)) || when(a).localeCompare(when(b)))
      if (alive) setRows(out)
    })().catch(() => {
      if (alive) setRows([])
    })
    return () => {
      alive = false
    }
  }, [oeuvreId])
  return rows
}

function useShipmentText() {
  const { t, lang } = useI18n()
  const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
  const day = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(loc, { day: 'numeric', month: 'short' }) : '')
  const status = (s: WorkShipment) => {
    // R7b checklist steps (ship / pickup / return) read like the Logistique cards.
    if (s.status && (s.kind === 'ship' || s.kind === 'pickup' || s.kind === 'return')) return t(stepLabel(s.kind as ShipmentKind, s.status as ShipmentStatus))
    const k = s.status ? STATUS_LABEL_KEY[s.status] : undefined
    return k ? t(k) : s.status || '—'
  }
  return { t, loc, day, status }
}

/** Top chip for the open shipment: « Planifié → Encadreur · 20 nov. ». */
export function ShipmentTopChip({ shipment, narrow, onClick }: { shipment: WorkShipment; narrow: boolean; onClick: () => void }) {
  const { t, day, status } = useShipmentText()
  const date = day(shipment.shipped_at ?? shipment.scheduled_for)
  const text = [
    status(shipment),
    shipment.to_name ? `→ ${shipment.to_name}` : '',
    date ? `· ${date}` : '',
  ].filter(Boolean).join(' ')
  return (
    <Chip narrow={narrow} tone="log" title={t('wc_ship_chip_tt')} onClick={onClick} testId="work-card-shipment-chip">
      {text}
    </Chip>
  )
}

/** Objet › Logistique body. */
export function WorkLogisticsPart({
  shipments,
  narrow,
  onOpenLogistics,
  dateLivraison,
  setDateLivraison,
  returnDate,
  setReturnDate,
}: {
  shipments: WorkShipment[] | null
  narrow: boolean
  onOpenLogistics: () => void
  dateLivraison: string
  setDateLivraison: (v: string) => void
  returnDate: string
  setReturnDate: (v: string) => void
}) {
  const { t, loc, day, status } = useShipmentText()
  const fullDay = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }) : '')
  const dateField = (value: string, set: (v: string) => void, label: string, empty: string, testId: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, minHeight: narrow ? 44 : chipH(false) }}>
      <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{label}</span>
      <TapEdit display={fullDay(value)} empty={!value} emptyLabel={empty} testId={testId}>
        <input
          type="date"
          className="input"
          aria-label={label}
          value={value.slice(0, 10)}
          onChange={(e) => set(e.target.value)}
          style={{ ...FIS, width: 150, height: narrow ? 44 : 26, padding: '0 6px', fontSize: 12 }}
        />
      </TapEdit>
    </span>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      {shipments === null ? (
        <span style={{ fontSize: 12, color: 'var(--tx3)' }}>…</span>
      ) : shipments.length === 0 ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <EmptyValue label={t('wc_ship_none')} />
        </span>
      ) : (
        shipments.map((s) => {
          const open = isShipmentOpen(s)
          const date = day(s.delivered_at ?? s.shipped_at ?? s.scheduled_for)
          return (
            <div key={s.id} data-testid="work-card-shipment" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, fontSize: 12, color: open ? 'var(--tx2)' : 'var(--tx3)', minWidth: 0 }}>
              <Chip narrow={narrow} tone={open ? 'log' : 'muted'} title={t('wc_ship_status_tt')}>
                {status(s)}
              </Chip>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {[s.kind, s.to_name ? `→ ${s.to_name}` : '', date].filter(Boolean).join(' · ')}
              </span>
            </div>
          )
        })
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 0 }}>
        {dateField(dateLivraison, setDateLivraison, t('wc_ship_delivery'), t('wc_ship_delivery_empty'), 'work-card-delivery-date')}
        {dateField(returnDate, setReturnDate, t('wc_ship_return'), t('wc_ship_return_empty'), 'work-card-return-date')}
        <button
          type="button"
          data-testid="work-card-open-logistics"
          onClick={onOpenLogistics}
          style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--bd3)', padding: 0, minHeight: narrow ? 44 : undefined, color: 'var(--tx2)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
        >
          {t('wc_ship_open_tab')}
        </button>
      </div>
    </div>
  )
}
