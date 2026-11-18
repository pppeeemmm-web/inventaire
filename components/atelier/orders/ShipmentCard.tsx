'use client'

// R7b shipment card (docs/design/2026-11-18/R7b_OrderCascade.notes.md): the checklist of one trip —
// steps in order, the fields of each step, the works and their orders, claims. Used in the order
// (Commandes) and in Logistics. Phone: one column, 44 px taps, no fixed widths.

import { useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { SHIP_STEPS, nextShipStep, stepLabel, type ShipmentStatus } from '@/lib/orders/cascade'
import {
  addClaim, advanceShipment, cancelShipment, patchShipment, setClaimStatus, type CascadeShipment,
} from '@/app/atelier/(portal)/sales/cascade-actions'

type Field = Parameters<typeof patchShipment>[1]

/** Fields that belong to a step (shown once the shipment reaches the step before it). */
const STEP_FIELDS: Partial<Record<ShipmentStatus, Field[]>> = {
  packed: ['packed_dims', 'packed_weight_kg', 'packing_note'],
  insured: ['insured_value', 'insurer', 'policy_ref'],
  labelled: ['carrier', 'tracking_no', 'tracking_url', 'cost'],
}
const FIELD_LABEL: Record<Field, string> = {
  carrier: 'cas_f_carrier', tracking_no: 'cas_f_tracking_no', tracking_url: 'cas_f_tracking_url', packed_dims: 'cas_f_dims',
  packed_weight_kg: 'cas_f_weight', packing_note: 'cas_f_packing', insured_value: 'cas_f_insured_value', insurer: 'cas_f_insurer',
  policy_ref: 'cas_f_policy', cost: 'cas_f_cost', handed_to: 'cas_f_handed_to', pickup_process_id: 'cas_pickup_event',
}
const CLAIM_ST = ['open', 'paid', 'refused', 'withdrawn'] as const

export function ShipmentCard({ s, narrow, onChanged, events }: {
  s: CascadeShipment
  narrow: boolean
  onChanged: () => void
  events?: { id: string; nom: string }[]
}) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [claim, setClaim] = useState({ oeuvreId: s.works[0]?.oeuvre_id ?? 0, insurer: '', ref: '', police: '', amount: '' })
  const steps = SHIP_STEPS[s.kind]
  const at = steps.indexOf(s.status)
  const next = nextShipStep(s.kind, s.status)
  const finished = s.status === 'delivered' || s.status === 'cancelled'
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '')
  const stepDate = (st: ShipmentStatus): string | null =>
    ({ open: null, photos: s.photos_at, picked: s.picked_at, packed: s.packed_at, insured: s.insured_at, labelled: s.labelled_at,
      shipped: s.shipped_at, delivered: s.delivered_at, cancelled: s.cancelled_at } as Record<ShipmentStatus, string | null>)[st]

  async function step() {
    if (!next) return
    setBusy(true)
    const r = await advanceShipment(s.id, next)
    setBusy(false)
    if ('error' in r) {
      const m = r.error.match(/^cas_err_open_demands:(\d+)$/)
      toast.error(m ? t('cas_err_open_demands_fmt').replace('{n}', m[1]) : r.error.startsWith('cas_') ? t(r.error as never) : r.error)
      return
    }
    if (r.moved.length) toast.success(t('cas_delivered_orders_fmt').replace('{refs}', r.moved.join(', ')))
    if (r.waiting.length) toast.info(t('cas_delivered_waiting_fmt').replace('{refs}', r.waiting.join(', ')))
    onChanged()
  }

  async function save(f: Field, v: string) {
    const prev = (s as unknown as Record<string, unknown>)[f]
    if ((prev == null ? '' : String(prev)) === v.trim()) return
    const r = await patchShipment(s.id, f, v)
    if ('error' in r) toast.error(r.error)
    else onChanged()
  }

  async function cancel() {
    if (!window.confirm(t('cas_cancel_confirm'))) return
    const r = await cancelShipment(s.id)
    if ('error' in r) toast.error(r.error.startsWith('cas_') ? t(r.error as never) : r.error)
    else onChanged()
  }

  async function sendClaim() {
    const amount = claim.amount.trim() ? Number(claim.amount.replace(',', '.')) : null
    const r = await addClaim({
      oeuvreId: claim.oeuvreId, shipmentId: s.id, orderId: s.works.find((w) => w.oeuvre_id === claim.oeuvreId)?.order_id ?? null,
      insurer: claim.insurer, claimRef: claim.ref, policeRef: claim.police, amountClaimed: amount != null && Number.isFinite(amount) ? amount : null,
    })
    if ('error' in r) { toast.error(r.error.startsWith('cas_') ? t(r.error as never) : r.error); return }
    setClaimOpen(false)
    setClaim((c) => ({ ...c, insurer: '', ref: '', police: '', amount: '' }))
    onChanged()
  }

  async function claimStatus(id: string, st: (typeof CLAIM_ST)[number]) {
    let paid: number | null = null
    if (st === 'paid') {
      const v = window.prompt(t('cas_claim_paid'))
      if (v == null) return
      paid = Number(v.replace(',', '.'))
      if (!Number.isFinite(paid)) return
    }
    const r = await setClaimStatus(id, st, paid)
    if ('error' in r) toast.error(r.error)
    else onChanged()
  }

  const input: CSSProperties = { minHeight: 44, fontSize: 14, width: '100%', boxSizing: 'border-box' }
  const fieldsShown: Field[] = [
    ...(s.kind === 'pickup' ? (['pickup_process_id', 'handed_to'] as Field[]) : []),
    ...steps.slice(0, Math.min(at + 2, steps.length)).flatMap((st) => (s.kind === 'pickup' && st !== 'packed' ? [] : STEP_FIELDS[st] ?? [])),
  ]

  return (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 6, padding: narrow ? 10 : 12, marginBottom: 10, background: 'var(--bg1)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>{t(`cas_kind_${s.kind}` as never)}</span>
        <span style={{ fontSize: 13, color: 'var(--tx2)', minWidth: 0, overflowWrap: 'anywhere' }}>{s.party_name}</span>
        <span style={{ fontSize: 12, color: 'var(--tx3)', marginLeft: 'auto' }}>{t(stepLabel(s.kind, s.status))}</span>
      </div>

      {/* Steps */}
      <ol style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {steps.map((st, i) => {
          const reached = s.status !== 'cancelled' && i <= at
          return (
            <li key={st} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 12,
              border: `1px solid ${reached ? 'var(--sage)' : 'var(--bd)'}`,
              color: reached ? 'var(--tx)' : 'var(--tx3)',
              background: i === at ? 'color-mix(in srgb, var(--sage) 14%, transparent)' : 'transparent',
            }}>
              {reached && i > 0 ? '✓ ' : ''}{t(stepLabel(s.kind, st))}{stepDate(st) ? ` · ${day(stepDate(st))}` : ''}
            </li>
          )
        })}
      </ol>

      {/* Fields of the reached steps */}
      {!finished && fieldsShown.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
          {fieldsShown.map((f) => (
            <label key={f} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', minWidth: 0 }}>
              {t(FIELD_LABEL[f] as never)}
              {f === 'pickup_process_id' ? (
                <select defaultValue={s.pickup_process_id ?? ''} style={input} onChange={(e) => { void save(f, e.target.value) }}>
                  <option value="">{t('cas_to_place_studio')}</option>
                  {(events ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.nom}</option>)}
                </select>
              ) : (
                <input
                  defaultValue={((s as unknown as Record<string, unknown>)[f] as string | number | null) ?? ''}
                  inputMode={f === 'packed_weight_kg' || f === 'insured_value' || f === 'cost' ? 'decimal' : undefined}
                  style={input}
                  onBlur={(e) => { void save(f, e.currentTarget.value) }}
                />
              )}
            </label>
          ))}
        </div>
      )}
      {s.tracking_url && (
        <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, display: 'inline-block', marginBottom: 8 }}>{t('cas_track')} ↗</a>
      )}

      {/* Works + their orders */}
      <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 4 }}>{t('cas_works_on')}</div>
      <ul style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, fontSize: 13 }}>
        {s.works.map((w) => (
          <li key={w.oeuvre_id} style={{ display: 'flex', gap: 8, padding: '3px 0', borderTop: '1px solid var(--bd)', minWidth: 0 }}>
            <span style={{ flex: 'none' }}>#{w.oeuvre_id}</span>
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{w.title ?? '—'}</span>
            {w.order_ref && <span style={{ flex: 'none', color: 'var(--tx3)' }}>{w.order_ref}</span>}
          </li>
        ))}
      </ul>

      {/* Claims */}
      {(s.claims.length > 0 || claimOpen) && <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 4 }}>{t('cas_claims')}</div>}
      {s.claims.map((c) => (
        <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--bd)' }}>
          <span>#{c.oeuvre_id} · {c.insurer}{c.claim_ref ? ` · ${c.claim_ref}` : ''}{c.amount_claimed != null ? ` · ${c.amount_claimed} €` : ''}</span>
          <select value={c.status} onChange={(e) => { void claimStatus(c.id, e.target.value as (typeof CLAIM_ST)[number]) }} style={{ minHeight: 36, marginLeft: 'auto' }}>
            {CLAIM_ST.map((st) => <option key={st} value={st}>{t(`cas_claim_st_${st}` as never)}</option>)}
          </select>
        </div>
      ))}
      {claimOpen && (
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8, margin: '6px 0 10px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>{t('cas_claim_work')}
            <select value={claim.oeuvreId} onChange={(e) => setClaim((c) => ({ ...c, oeuvreId: Number(e.target.value) }))} style={input}>
              {s.works.map((w) => <option key={w.oeuvre_id} value={w.oeuvre_id}>#{w.oeuvre_id} {w.title ?? ''}</option>)}
            </select>
          </label>
          {([['insurer', 'cas_claim_insurer'], ['ref', 'cas_claim_ref'], ['police', 'cas_claim_police'], ['amount', 'cas_claim_amount']] as const).map(([k, l]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>{t(l)}
              <input value={claim[k]} inputMode={k === 'amount' ? 'decimal' : undefined} onChange={(e) => setClaim((c) => ({ ...c, [k]: e.target.value }))} style={input} />
            </label>
          ))}
          <button type="button" className="btn primary" onClick={() => { void sendClaim() }} style={{ minHeight: 44, alignSelf: 'end' }}>{t('cas_save')}</button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flexDirection: narrow ? 'column' : 'row' }}>
        {next && s.status !== 'cancelled' && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => { void step() }} style={{ minHeight: 44 }}>
            {t('cas_next_fmt').replace('{step}', t(stepLabel(s.kind, next)))}
          </button>
        )}
        {!claimOpen && s.works.length > 0 && s.status !== 'cancelled' && (
          <button type="button" className="btn ghost" onClick={() => setClaimOpen(true)} style={{ minHeight: 44 }}>{t('cas_claim_add')}</button>
        )}
        {!finished && s.status !== 'shipped' && (
          <button type="button" className="btn ghost" onClick={() => { void cancel() }} style={{ minHeight: 44 }}>{t('cas_cancel_shipment')}</button>
        )}
      </div>
    </div>
  )
}
