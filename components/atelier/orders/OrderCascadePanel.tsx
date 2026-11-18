'use client'

// R7b — the chain under one order (docs/design/2026-11-18/R7b_OrderCascade.notes.md):
// delivery choice + shipping line, prep demands per work, its shipment(s), COA, invoice.
// Rendered in the order view (Commandes). Phone: one column, 44 px taps.

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { DEMAND_KINDS, DEMAND_LABEL, INVOICE_FROM_STATUS, INVOICE_VAT_MENTION, type DemandKind } from '@/lib/orders/cascade'
import { getSignedUrl } from '@/app/atelier/(portal)/vault/actions'
import {
  addDemand, creditInvoice, fetchOrderCascade, issueInvoice, makeOrderCoas, openShipmentForOrder, pushOrderToCalendars, removeDemand,
  setDemandDone, setOrderDelivery, type OrderCascadeView,
} from '@/app/atelier/(portal)/sales/cascade-actions'
import { ShipmentCard } from '@/components/atelier/orders/ShipmentCard'

const FINISHED = ['cancelled', 'closed', 'delivered', 'handed_over']

export function OrderCascadePanel({ orderId, narrow, onOrderChanged }: { orderId: string; narrow: boolean; onOrderChanged: () => void }) {
  const { t } = useI18n()
  const [v, setV] = useState<OrderCascadeView | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'ship' | 'pickup'>('ship')
  const [charge, setCharge] = useState('')
  const [draft, setDraft] = useState<{ lineId: string; kind: DemandKind; note: string; price: string } | null>(null)
  const [pickupAt, setPickupAt] = useState('')

  const load = useCallback(async () => {
    const r = await fetchOrderCascade(orderId)
    if ('error' in r) { toast.error(r.error); return }
    setV(r)
    setMode(r.delivery_mode ?? 'ship')
    setCharge(r.shipping_charge != null ? String(r.shipping_charge) : '')
  }, [orderId])
  useEffect(() => { void load() }, [load])

  const msg = (e: string) => (e.startsWith('cas_') ? t(e as never) : e)
  async function run(fn: () => Promise<{ error: string } | object>, okText?: string, alsoOrder = false) {
    setBusy(true)
    const r = await fn()
    setBusy(false)
    if ('error' in r) { toast.error(msg((r as { error: string }).error)); return }
    if (okText) toast.success(okText)
    await load()
    if (alsoOrder) onOrderChanged()
  }
  async function openDoc(path: string | null) {
    if (!path) return
    const res = await getSignedUrl(path)
    if ('url' in res) window.open(res.url, '_blank', 'noopener')
    else toast.error(res.error)
  }

  if (!v) return null
  const isSale = v.kind === 'sale'
  const finished = FINISHED.includes(v.status)
  const input: CSSProperties = { minHeight: 44, fontSize: 14, width: '100%', boxSizing: 'border-box' }
  const onShipment = new Set(v.shipments.filter((s) => s.status !== 'cancelled').flatMap((s) => s.works.map((w) => w.oeuvre_id)))
  const unshipped = v.lines.filter((l) => !onShipment.has(l.oeuvre_id)).length
  const isOut = v.status === 'out'
  const canOpen = !finished && (isOut || unshipped > 0) && v.status !== 'draft'
  const invoicable = isSale && (INVOICE_FROM_STATUS as readonly string[]).includes(v.status)
  const liveInvoice = v.invoices.some((i) => i.kind === 'invoice' && !i.credited)

  return (
    <>
      {/* Delivery (sale) */}
      {isSale && !finished && (
        <Block label={t('cas_delivery')}>
          <div style={{ display: 'flex', gap: 8, flexDirection: narrow ? 'column' : 'row', marginBottom: 8 }}>
            {(['ship', 'pickup'] as const).map((m) => (
              <button key={m} type="button" className={mode === m ? 'btn primary' : 'btn ghost'} onClick={() => setMode(m)} style={{ minHeight: 44 }}>
                {t(m === 'ship' ? 'cas_mode_ship' : 'cas_mode_pickup')}
              </button>
            ))}
          </div>
          {mode === 'ship' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', marginBottom: 8 }}>
              {t('cas_shipping_charge')}
              <input value={charge} inputMode="decimal" placeholder={t('cas_shipping_charge_ph')} onChange={(e) => setCharge(e.target.value)} style={input} />
            </label>
          )}
          <button type="button" className="btn" disabled={busy} style={{ minHeight: 44 }}
            onClick={() => { void run(() => setOrderDelivery(orderId, mode, charge.trim() ? Number(charge.replace(',', '.')) : null), t('cas_saved')) }}>
            {t('cas_save')}
          </button>
        </Block>
      )}

      {/* Prep demands (sale) */}
      {isSale && (
        <Block label={t('cas_prep')}>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 8 }}>{t('cas_prep_hint')}</div>
          {v.demands.length === 0 && <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 8 }}>{t('cas_no_demand')}</div>}
          {v.demands.map((d) => (
            <div key={d.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderTop: '1px solid var(--bd)', minHeight: 44, fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', textDecoration: d.done_at ? 'line-through' : undefined }}>
                #{d.oeuvre_id} · {t(DEMAND_LABEL[d.kind])}{d.note ? ` — ${d.note}` : ''}{d.price != null ? ` · ${d.price} €` : ''}
              </span>
              <button type="button" className="btn ghost" disabled={busy} style={{ minHeight: 44 }}
                onClick={() => { void run(() => setDemandDone(d.id, !d.done_at)) }}>
                {d.done_at ? t('cas_demand_undo') : t('cas_demand_done')}
              </button>
              {v.isAdmin && !d.done_at && (
                <button type="button" className="btn ghost" disabled={busy} style={{ minHeight: 44 }} onClick={() => { void run(() => removeDemand(d.id)) }}>
                  {t('cas_demand_remove')}
                </button>
              )}
            </div>
          ))}
          {!finished && (draft ? (
            <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
              <select value={draft.lineId} onChange={(e) => setDraft({ ...draft, lineId: e.target.value })} style={input}>
                {v.lines.map((l) => <option key={l.id} value={l.id}>#{l.oeuvre_id} {l.title ?? ''}</option>)}
              </select>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DemandKind })} style={input}>
                {DEMAND_KINDS.map((k) => <option key={k} value={k}>{t(DEMAND_LABEL[k])}</option>)}
              </select>
              <input value={draft.note} placeholder={t('cas_demand_note_ph')} onChange={(e) => setDraft({ ...draft, note: e.target.value })} style={input} />
              <input value={draft.price} inputMode="decimal" placeholder={t('cas_demand_price_ph')} onChange={(e) => setDraft({ ...draft, price: e.target.value })} style={input} />
              <button type="button" className="btn primary" disabled={busy} style={{ minHeight: 44 }}
                onClick={() => {
                  const price = draft.price.trim() ? Number(draft.price.replace(',', '.')) : null
                  void run(() => addDemand(draft.lineId, draft.kind, draft.note, price != null && Number.isFinite(price) ? price : null)).then(() => setDraft(null))
                }}>
                {t('cas_save')}
              </button>
            </div>
          ) : (
            v.lines.length > 0 && (
              <button type="button" className="btn ghost" style={{ minHeight: 44, marginTop: 8 }}
                onClick={() => setDraft({ lineId: v.lines[0].id, kind: 'framing', note: '', price: '' })}>
                {t('cas_demand_add')}
              </button>
            )
          ))}
        </Block>
      )}

      {/* Shipments */}
      <Block label={t('cas_shipments')}>
        {v.shipments.length === 0 && <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 8 }}>{t('cas_no_shipment')}</div>}
        {v.shipments.map((s) => <ShipmentCard key={s.id} s={s} narrow={narrow} events={v.events} onChanged={() => { void load(); onOrderChanged() }} />)}
        {canOpen && (
          <div style={{ display: 'flex', gap: 8, flexDirection: narrow ? 'column' : 'row' }}>
            {!isOut && v.delivery_mode === 'pickup' && (
              <select value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} style={{ ...input, width: narrow ? '100%' : 'auto' }} aria-label={t('cas_pickup_event')}>
                <option value="">{t('cas_to_place_studio')}</option>
                {v.events.map((ev) => <option key={ev.id} value={ev.id}>{ev.nom}</option>)}
              </select>
            )}
            <button type="button" className="btn" disabled={busy} style={{ minHeight: 44 }}
              onClick={() => { void run(() => openShipmentForOrder(orderId, pickupAt || null)) }}>
              {t(isOut ? 'cas_kind_return' : v.delivery_mode === 'pickup' ? 'cas_open_pickup' : 'cas_open_shipment')}
            </button>
          </div>
        )}
      </Block>

      {/* Calendar */}
      {v.status !== 'cancelled' && (
        <Block label={t('cas_cal_title')}>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 6 }}>{t('cas_cal_hint')}</div>
          <button type="button" className="btn ghost" disabled={busy} style={{ minHeight: 44 }}
            onClick={() => {
              void (async () => {
                setBusy(true)
                const r = await pushOrderToCalendars(orderId)
                setBusy(false)
                if ('error' in r) toast.error(msg(r.error))
                else toast.success(r.pushed > 0 ? t('cas_cal_pushed_fmt').replace('{n}', String(r.pushed)) : t('cas_cal_none'))
              })()
            }}>
            {t('cas_cal_push')}
          </button>
        </Block>
      )}

      {/* COA (sale) */}
      {isSale && (
        <Block label={t('cas_coa')}>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 6 }}>{t('cas_coa_auto')}</div>
          {v.coas.length === 0 && <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 6 }}>{t('cas_coa_none')}</div>}
          {v.coas.map((c) => (
            <div key={c.document_id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, borderTop: '1px solid var(--bd)', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>#{c.oeuvre_id}{c.cert_id ? ` · ${c.cert_id}` : ''}</span>
              <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={() => { void openDoc(c.storage_path) }}>{t('cas_open')}</button>
            </div>
          ))}
          {invoicable && v.coas.length < v.lines.length && (
            <button type="button" className="btn ghost" disabled={busy} style={{ minHeight: 44, marginTop: 6 }} onClick={() => { void run(() => makeOrderCoas(orderId)) }}>
              {t('cas_coa_make')}
            </button>
          )}
        </Block>
      )}

      {/* Invoice (sale) */}
      {isSale && (
        <Block label={t('cas_invoice')}>
          {v.invoices.map((i) => (
            <div key={i.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, minHeight: 44, borderTop: '1px solid var(--bd)', fontSize: 13 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {i.number} · {i.issued_on} · {i.total.toLocaleString('fr-FR')} €{i.credited ? ` · ${t('cas_invoice_credited')}` : ''}
              </span>
              <button type="button" className="btn ghost" style={{ minHeight: 44 }} onClick={() => { void openDoc(i.paper_path) }}>{t('cas_open')}</button>
              {v.isAdmin && i.kind === 'invoice' && !i.credited && (
                <button type="button" className="btn ghost" disabled={busy} style={{ minHeight: 44 }}
                  onClick={() => { if (window.confirm(t('cas_invoice_credit_confirm'))) void run(() => creditInvoice(i.id)) }}>
                  {t('cas_invoice_credit')}
                </button>
              )}
            </div>
          ))}
          {!liveInvoice && !invoicable && <div style={{ fontSize: 13, color: 'var(--tx3)' }}>{t('cas_invoice_wait')}</div>}
          {!liveInvoice && invoicable && (v.isAdmin ? (
            <div style={{ display: 'flex', gap: 8, flexDirection: narrow ? 'column' : 'row', marginTop: 6 }}>
              <button type="button" className="btn primary" disabled={busy} style={{ minHeight: 44 }}
                onClick={() => { if (window.confirm(t('cas_invoice_confirm'))) void run(() => issueInvoice([orderId])) }}>
                {t('cas_invoice_issue')}
              </button>
              {v.uninvoicedSameBuyer.length > 1 && (
                <button type="button" className="btn ghost" disabled={busy} style={{ minHeight: 44 }}
                  onClick={() => { if (window.confirm(t('cas_invoice_confirm'))) void run(() => issueInvoice(v.uninvoicedSameBuyer.map((o) => o.id))) }}>
                  {t('cas_invoice_issue_many_fmt').replace('{n}', String(v.uninvoicedSameBuyer.length))}
                </button>
              )}
            </div>
          ) : <div style={{ fontSize: 13, color: 'var(--tx3)' }}>{t('cas_admin_only')}</div>)}
          {INVOICE_VAT_MENTION == null && <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 6 }}>{t('cas_invoice_vat_todo')}</div>}
        </Block>
      )}
    </>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--bd)', padding: '10px 18px' }}>
      <div className="t-label" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}
