'use client'

// Orders — read side (TODO R7, docs/design/2026-11-17/R7_Orders.notes.md + R7_Orders.mockup.html).
// One list for sale / consignment / loan / gift. Desktop: list + the order side by side.
// Phone (< 768 px): cards, tap → the order, « ‹ Commandes » back.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useSearchParams } from 'next/navigation'
import { ENTRUSTED_LIVE, REFUNDED_AT_LIVE } from '@/lib/orders/kinds'
import { VatLine } from '@/app/atelier/(portal)/sales/_components/VatLine'
import { WorkLoupeThumb, WorkThumbLabel } from '@/components/atelier/WorkThumbLabel'
import { advanceWorkOrder, attachSignedCopy, cancelWorkOrder, fetchWorkOrders, listPartyAddresses, makeOrderPaper, markSaleRefunded, recordOrderPayment, returnSaleOrder, setOrderAddress, updateOrderLineValue, type PartyAddress, type WorkOrderKind, type WorkOrderView } from '@/app/atelier/(portal)/sales/orders-actions'
import { sharePaperFile } from '@/lib/orders/share-paper-client'
import { returnDaysLeft, returnLastDay, saleMoneyState } from '@/lib/sales/sale-money'
import { addCalendarDaysIso } from '@/lib/sale-return-window'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import { NewOrderForm, orderErrorText, type NewOrderInitial, type OrderContact } from '@/app/atelier/(portal)/sales/_components/NewOrderForm'
import { getSignedUrl } from '@/app/atelier/(portal)/vault/actions'
import { OrderCascadePanel } from '@/components/atelier/orders/OrderCascadePanel'

const KINDS: WorkOrderKind[] = ['sale', 'consignment', 'loan', 'gift', ...(ENTRUSTED_LIVE ? ['entrusted' as const] : [])]
const KIND_LETTER: Record<WorkOrderKind, string> = { sale: 'V', consignment: 'D', loan: 'P', gift: 'G', entrusted: 'C' }
const KIND_LABEL: Record<WorkOrderKind, DictKey> = {
  sale: 'ord_kind_sale', consignment: 'ord_kind_consignment', loan: 'ord_kind_loan', gift: 'ord_kind_gift', entrusted: 'ord_kind_entrusted',
}
const KIND_COLOR: Record<WorkOrderKind, string> = {
  sale: 'var(--sage)', consignment: 'var(--cyan)', loan: 'var(--yellow, var(--ac))', gift: 'var(--ac)', entrusted: 'var(--tx2)',
}
const STEPS: Record<WorkOrderKind, string[]> = {
  sale: ['draft', 'signed', 'deposit_paid', 'paid', 'delivered'],
  consignment: ['draft', 'signed', 'out', 'closed'],
  loan: ['draft', 'signed', 'out', 'closed'],
  gift: ['draft', 'signed', 'handed_over'],
  entrusted: ['draft', 'out', 'closed'],
}
const VALUE_LABEL: Partial<Record<WorkOrderKind, DictKey>> = {
  sale: 'ord_line_value_sale', consignment: 'ord_line_value_consignment', loan: 'ord_line_value_loan', gift: 'ord_line_value_gift', entrusted: 'ord_line_value_entrusted',
}
/** Denser cells than the shared .tbl, so seven columns fit beside the order panel. */
const CELL = { padding: '8px 10px' } as const
const FINISHED = new Set(['closed', 'cancelled', 'delivered', 'handed_over'])
/** Same steps as the server (`updateOrderLineValue`): a line's value changes on a draft or a signed order only. */
const VALUE_EDITABLE = ['draft', 'signed']

function stepLabelKey(kind: WorkOrderKind, step: string): DictKey {
  if (kind === 'gift' && step === 'signed') return 'ord_st_gift_signed'
  if ((kind === 'consignment' || kind === 'loan') && step === 'signed') return 'ord_st_signed_m'
  if ((kind === 'consignment' || kind === 'loan' || kind === 'entrusted') && step === 'closed') return 'ord_st_closed_m'
  if (kind === 'entrusted' && step === 'out') return 'ord_st_entrusted_out'
  return `ord_st_${step}` as DictKey
}

function stepDate(o: WorkOrderView, step: string): string | null {
  switch (step) {
    case 'draft': return o.reconstituted ? null : o.created_at
    case 'signed': return o.signed_at
    case 'paid': return o.paid_at
    case 'delivered':
    case 'out':
    case 'handed_over': return o.delivered_at
    case 'closed': return o.returned_at
    default: return null
  }
}

/** The step buttons: same allowed moves as the server (orders-actions.ts NEXT / CANCEL_FROM). */
const NEXT: Record<WorkOrderKind, Record<string, string[]>> = {
  sale: { draft: ['signed'], signed: ['deposit_paid', 'paid'], deposit_paid: ['paid'], paid: ['delivered'] },
  consignment: { draft: ['signed'], signed: ['out'], out: ['closed'] },
  loan: { draft: ['signed'], signed: ['out'], out: ['closed'] },
  gift: { draft: ['signed'], signed: ['handed_over'] },
  entrusted: { draft: ['out'], out: ['closed'] },
}
const CANCEL_FROM: Record<WorkOrderKind, string[]> = {
  sale: ['draft', 'signed', 'deposit_paid'], consignment: ['draft', 'signed'], loan: ['draft', 'signed'], gift: ['draft', 'signed'], entrusted: ['draft'],
}
function actionKey(kind: WorkOrderKind, to: string): DictKey {
  if (kind === 'sale') return `ord_do_sale_${to}` as DictKey
  if (kind === 'gift') return `ord_do_gift_${to}` as DictKey
  if (kind === 'entrusted') return `ord_do_entrusted_${to}` as DictKey
  if (to === 'out') return kind === 'loan' ? 'ord_do_loan_out' : 'ord_do_cons_out'
  return `ord_do_cons_${to}` as DictKey
}

/** Same list as the phone sale (`SaleNewClient`), stored as written. */
const PAY_METHODS: [string, DictKey][] = [
  ['Virement bancaire', 'sale_mobile_method_bank'],
  ['Card terminal', 'sale_mobile_method_card'],
  ['Espèces', 'sale_mobile_method_cash'],
  ['Chèque', 'sale_mobile_method_cheque'],
  ['PayPal', 'sale_mobile_method_paypal'],
]

/** `?order=<id>` selects an order; `?new=<kind>&works=1,2&party=<id>&process=<id>&start=&end=` opens the form filled in. */
function readUrlIntent(): { orderId: string | null; initial: NewOrderInitial | null } {
  const sp = new URLSearchParams(window.location.search)
  const orderId = sp.get('order')
  const k = sp.get('new') as WorkOrderKind | null
  if (!k || !KINDS.includes(k)) return { orderId, initial: null }
  const terms: Record<string, string> = {}
  for (const [param, key] of [['start', 'start_date'], ['end', 'end_date'], ['price', 'price_final'], ['commission', 'commission_pct']] as const) {
    const v = sp.get(param)
    if (v) terms[key] = v
  }
  return {
    orderId,
    initial: {
      kind: k,
      workIds: (sp.get('works') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n !== 0),
      partyId: Number(sp.get('party')) || undefined,
      processId: sp.get('process') ?? undefined,
      notes: sp.get('notes') ?? undefined,
      terms,
    },
  }
}

const LINE_LABEL: Record<string, DictKey> = {
  returned: 'ord_line_returned', sold: 'ord_line_sold', given: 'ord_line_given', removed: 'ord_line_removed',
}

interface Props {
  /** Opens the work card (the Atelier drawer). */
  openWork: (oeuvreId: number) => void
  /** Contacts for the new-order form (buyer / gallery / borrower / recipient). */
  contacts: OrderContact[]
}

export function Orders({ openWork, contacts }: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null)
  const fmtMoney = (n: number | null, cur: string) =>
    n == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 0 }).format(n)

  const [orders, setOrders] = useState<WorkOrderView[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [kind, setKind] = useState<WorkOrderKind | 'all'>('all')
  const [showClosed, setShowClosed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formInitial, setFormInitial] = useState<NewOrderInitial | undefined>(undefined)
  const [payOpen, setPayOpen] = useState(false)
  const [pay, setPay] = useState({ amount: '', method: PAY_METHODS[0][0], date: '', takeaway: false })
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundDay, setRefundDay] = useState('')
  const [stepBusy, setStepBusy] = useState(false)
  const [stepErr, setStepErr] = useState<string | null>(null)
  const [paperBusy, setPaperBusy] = useState(false)
  /** A line's value being changed: the work and the text typed (Pem 2026-11-18). */
  const [valueEdit, setValueEdit] = useState<{ oeuvreId: number; text: string } | null>(null)
  const [valueBusy, setValueBusy] = useState(false)
  const [valueErr, setValueErr] = useState<string | null>(null)
  /** Orders whose value changed after signing this visit: the paper must be made (and signed) again. */
  const [paperStale, setPaperStale] = useState<Set<string>>(() => new Set())
  const [valueSavedNote, setValueSavedNote] = useState<string | null>(null)
  /** « Partager »: the doc being fetched, and a doc whose file is fetched but needs a second tap. */
  const [shareBusy, setShareBusy] = useState<string | null>(null)
  const [shareReady, setShareReady] = useState<string | null>(null)
  const signedInput = useRef<HTMLInputElement>(null)
  /** An order opened by link (`?order=`): if it is closed, the list shows closed orders too. */
  const linkedOrder = useRef<string | null>(null)
  // A link to another order while this screen is open (work card, Fil, Pipeline): follow it.
  const orderParam = useSearchParams()?.get('order') ?? null
  const seenOrderParam = useRef<string | null>(null)
  useEffect(() => {
    if (!orderParam || orderParam === seenOrderParam.current) return
    seenOrderParam.current = orderParam
    linkedOrder.current = orderParam
    setSelectedId(orderParam); setStepErr(null); setPayOpen(false)
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once per new link
  }, [orderParam])
  useEffect(() => {
    const o = linkedOrder.current && orders?.find((x) => x.id === linkedOrder.current)
    if (!o) return
    linkedOrder.current = null
    if (FINISHED.has(o.status)) setShowClosed(true)
  }, [orders])

  // Another order on screen: drop a half-typed value and the « file ready » state.
  useEffect(() => { setValueEdit(null); setValueErr(null); setValueSavedNote(null); setShareReady(null) }, [selectedId])

  async function redoPaper(o: WorkOrderView) {
    setPaperBusy(true); setStepErr(null)
    try {
      const res = await makeOrderPaper(o.id)
      if ('error' in res) setStepErr(orderErrorText(res.error, t))
      await load()
    } finally {
      setPaperBusy(false)
    }
  }

  function startValueEdit(oeuvreId: number, value: number | null) {
    setValueEdit({ oeuvreId, text: value == null ? '' : String(value) }); setValueErr(null); setValueSavedNote(null)
  }

  async function saveValue(o: WorkOrderView) {
    if (!valueEdit) return
    setValueBusy(true); setValueErr(null)
    try {
      const res = await updateOrderLineValue(o.id, valueEdit.oeuvreId, valueEdit.text)
      if ('error' in res) { setValueErr(orderErrorText(res.error, t)); return }
      setValueEdit(null)
      if (o.status !== 'draft') setPaperStale((s) => new Set(s).add(o.id))
      setValueSavedNote(res.paperRedone ? o.id : null)
      await load()
    } finally {
      setValueBusy(false)
    }
  }

  async function sharePaper(p: { id: string; name: string; storage_path: string | null }) {
    if (!p.storage_path) return
    setShareBusy(p.id); setStepErr(null)
    try {
      const res = await sharePaperFile(p.id, p.storage_path, p.name)
      if (res === 'needs_second_tap') setShareReady(p.id)
      else { setShareReady(null); if (typeof res === 'object') setStepErr(`${t('ord_share_error')} ${res.error}`) }
    } finally {
      setShareBusy(null)
    }
  }

  async function uploadSigned(o: WorkOrderView, picked: File | undefined) {
    if (!picked) return
    setPaperBusy(true); setStepErr(null)
    try {
      // Photos of a signed page: shrunk to a readable 2400 px so they clear the upload cap.
      const file = await downscaleImageFileForMobileIfNeeded(picked, true, 2400)
      const fd = new FormData()
      fd.append('order_id', o.id)
      fd.append('file', file)
      const res = await attachSignedCopy(fd)
      if ('error' in res) setStepErr(orderErrorText(res.error, t))
      // The new signed copy carries the changed value: the « remake the paper » note is done.
      else setPaperStale((s) => { const n = new Set(s); n.delete(o.id); return n })
      await load()
    } finally {
      setPaperBusy(false)
      if (signedInput.current) signedInput.current.value = ''
    }
  }

  async function load(): Promise<void> {
    try {
      const res = await fetchWorkOrders()
      if ('error' in res) setLoadError(res.error)
      else { setLoadError(null); setOrders(res.orders) }
    // eslint-disable-next-line pem-i18n/no-silent-catch -- not silent: the error is shown in the list area
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void load()
    // Opened from elsewhere (work card, Pipeline, Exhibitions, phone): select or prefill, once.
    const intent = readUrlIntent()
    if (intent.orderId) { setSelectedId(intent.orderId); linkedOrder.current = intent.orderId; seenOrderParam.current = intent.orderId }
    if (intent.initial) { setFormInitial(intent.initial); setFormOpen(true) }
    // The Atelier mobile bar's « Vente » (TeamPortalClient `openNewSaleOrder`) asks for a new sale.
    try {
      if (!intent.initial && sessionStorage.getItem('pem_sales_open_new_order') === '1') {
        sessionStorage.removeItem('pem_sales_open_new_order')
        setFormInitial({ kind: 'sale' }); setFormOpen(true)
      }
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage may be blocked; the form just stays closed
    } catch { /* storage unavailable */ }
  }, [])

  function openPay(o: WorkOrderView) {
    const left = Math.max(0, (o.price_final ?? 0) - o.paid_total)
    const deposit = o.status === 'signed' && o.deposit_pct && o.price_final ? Math.round(o.price_final * o.deposit_pct) / 100 : null
    setPay({ amount: String(deposit ?? left), method: PAY_METHODS[0][0], date: new Date().toISOString().slice(0, 10), takeaway: o.shipping_method === 'emportee' })
    setPayOpen(true); setStepErr(null)
  }

  async function savePay(o: WorkOrderView) {
    if (!confirm(t('ord_confirm_step'))) return
    setStepBusy(true); setStepErr(null)
    try {
      const fd = new FormData()
      fd.append('order_id', o.id)
      fd.append('amount', pay.amount)
      fd.append('method', pay.method)
      fd.append('payment_date', pay.date)
      // « Emportée aujourd'hui » only matters when this payment settles the price.
      if (paysInFull(o, pay.amount)) fd.append('takeaway', pay.takeaway ? '1' : '0')
      const res = await recordOrderPayment(fd)
      if ('error' in res) setStepErr(orderErrorText(res.error, t))
      else setPayOpen(false)
      await load()
    } finally {
      setStepBusy(false)
    }
  }

  async function saveRefund(o: WorkOrderView) {
    if (!refundDay) return
    setStepBusy(true); setStepErr(null)
    try {
      const res = await markSaleRefunded(o.id, refundDay)
      if ('error' in res) setStepErr(orderErrorText(res.error, t))
      else setRefundOpen(false)
      await load()
    } finally {
      setStepBusy(false)
    }
  }

  async function runReturn(o: WorkOrderView) {
    if (!confirm(t('ord_confirm_return'))) return
    setStepBusy(true); setStepErr(null)
    try {
      const res = await returnSaleOrder(o.id)
      if ('error' in res) setStepErr(orderErrorText(res.error, t))
      await load()
    } finally {
      setStepBusy(false)
    }
  }

  async function runStep(o: WorkOrderView, to: string | 'cancel') {
    if (!confirm(t(to === 'cancel' ? 'ord_confirm_cancel' : 'ord_confirm_step'))) return
    setStepBusy(true); setStepErr(null)
    try {
      const res = to === 'cancel' ? await cancelWorkOrder(o.id) : await advanceWorkOrder(o.id, to)
      if ('error' in res) setStepErr(orderErrorText(res.error, t))
      await load()
    } finally {
      setStepBusy(false)
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, sale: 0, consignment: 0, loan: 0, gift: 0, entrusted: 0 }
    for (const o of orders ?? []) {
      if (!showClosed && FINISHED.has(o.status)) continue
      c.all++; c[o.kind]++
    }
    return c
  }, [orders, showClosed])

  /** Finished orders for the kind on screen (shown with « + closes »: livrées, rentrées, remis…). */
  const finishedCount = useMemo(() => (orders ?? []).filter((o) => FINISHED.has(o.status) && (kind === 'all' || o.kind === kind)).length, [orders, kind])

  const visible = useMemo(() => (orders ?? []).filter((o) =>
    (kind === 'all' || o.kind === kind) && (showClosed || !FINISHED.has(o.status)),
  ), [orders, kind, showClosed])
  const openRows = visible.filter((o) => !FINISHED.has(o.status))
  const closedRows = visible.filter((o) => FINISHED.has(o.status))
  const selected = (orders ?? []).find((o) => o.id === selectedId) ?? null

  async function openPaper(path: string | null) {
    if (!path) return
    const res = await getSignedUrl(path)
    if ('url' in res) window.open(res.url, '_blank', 'noopener')
    else alert(`${t('error_prefix')} ${res.error}`)
  }

  const kindChip = (k: WorkOrderKind, size = 22) => (
    <span aria-label={t(KIND_LABEL[k])} title={t(KIND_LABEL[k])} style={{
      display: 'inline-grid', placeItems: 'center', width: size, height: size, flex: 'none',
      border: `1px solid ${KIND_COLOR[k]}`, color: KIND_COLOR[k], borderRadius: 3, fontSize: 11, fontWeight: 700,
    }}>{KIND_LETTER[k]}</span>
  )

  const stepDots = (o: WorkOrderView) => {
    const steps = STEPS[o.kind]
    const idx = steps.indexOf(o.status)
    return (
      <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
        {steps.map((s, i) => (
          <span key={s} style={{
            width: 8, height: 8, borderRadius: '50%', display: 'block',
            border: `1px solid ${i <= idx ? 'var(--ac)' : 'var(--bd3)'}`,
            background: i < idx || (i === idx && FINISHED.has(o.status)) ? 'var(--ac)' : 'transparent',
          }} />
        ))}
      </span>
    )
  }

  const statusText = (o: WorkOrderView) => t(o.status === 'cancelled' ? (isReturned(o) ? 'ord_st_returned' : 'ord_st_cancelled') : stepLabelKey(o.kind, o.status))
  /** Phone card / list: « Retour : N j » while a delivered sale can still come back, then « Définitive ». */
  const returnTag = (o: WorkOrderView): string | null => {
    if (o.kind !== 'sale' || o.status !== 'delivered') return null
    const n = returnDaysLeft(o)
    return n != null ? t('ord_card_days_left').replace('{n}', String(n)) : saleMoneyState(o) === 'definitive' ? t('ord_card_definitive') : null
  }

  // R4 preview rule: each thumbnail opens the loupe with its caption; a lone work shows its title too.
  const thumbs = (o: WorkOrderView, size: number, max: number) => (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', minWidth: 0, maxWidth: 'min(100%, 260px)', fontSize: 12 }}>
      {o.works.length === 1
        ? <WorkThumbLabel id={o.works[0].oeuvre_id} title={o.works[0].title} image={o.works[0].image} px={size} idStyle={{ fontSize: 12 }} />
        : o.works.slice(0, max).map((w) => <WorkLoupeThumb key={w.oeuvre_id} id={w.oeuvre_id} image={w.image} title={w.title} px={size} />)}
      {o.works.length > max && <span style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 4 }}>{`+${o.works.length - max}`}</span>}
    </span>
  )

  const chips = (
    <div style={{ display: 'flex', gap: 6, flexWrap: narrow ? 'nowrap' : 'wrap', overflowX: narrow ? 'auto' : undefined, padding: narrow ? '10px 16px 0' : '10px 0', alignItems: 'center' }}>
      {(['all', ...KINDS] as const).map((k) => {
        const on = kind === k
        return (
          <button key={k} type="button" onClick={() => setKind(k)} style={{
            minHeight: narrow ? 44 : 30, padding: '0 10px', borderRadius: 16, display: 'inline-flex', alignItems: 'center', gap: 6,
            border: `1px solid ${on ? 'var(--bd3)' : 'var(--bd2)'}`, background: on ? 'var(--bg3)' : 'none',
            color: on ? 'var(--tx)' : 'var(--tx2)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>
            {k === 'all' ? t('ord_filter_all') : <>{kindChip(k, 18)}{t(KIND_LABEL[k])}</>}
            <span style={{ color: 'var(--tx3)', fontSize: 11 }}>{counts[k]}</span>
          </button>
        )
      })}
      <span style={{ flex: 1 }} />
      <button type="button" onClick={() => setShowClosed((v) => !v)} aria-pressed={showClosed} title={t('ord_filter_closed_tt')} style={{
        minHeight: narrow ? 44 : 30, padding: '0 10px', borderRadius: 16, border: `1px solid ${showClosed ? 'var(--bd3)' : 'var(--bd2)'}`,
        background: showClosed ? 'var(--bg3)' : 'none', color: showClosed ? 'var(--tx)' : 'var(--tx2)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
      }}>{t('ord_filter_closed')}<span style={{ color: 'var(--tx3)', fontSize: 11, marginLeft: 6 }}>{finishedCount}</span></button>
    </div>
  )

  const detail = (o: WorkOrderView) => {
    const steps = STEPS[o.kind]
    const idx = steps.indexOf(o.status)
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: narrow ? '12px 16px' : '14px 18px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {kindChip(o.kind)}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ac)' }}>{o.ref}</span>
            <span className="serif" style={{ fontSize: 22 }}>{t(KIND_LABEL[o.kind])}</span>
            {o.reconstituted && (
              <span title={t('ord_reconstituted_hint')} style={{ fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx3)', border: '1px solid var(--bd2)', borderRadius: 3, padding: '2px 6px' }}>
                {t('ord_reconstituted')}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: 'var(--tx2)', marginTop: 6, overflowWrap: 'anywhere' }}>{o.party_name}</div>
          {o.party_place && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{o.party_place}</div>}
          <OrderAddressLine key={o.id} o={o} narrow={narrow} onSaved={load} />
          {o.reconstituted && <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 6 }}>{t('ord_reconstituted_hint')}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
            {o.works.map((w) => {
              const canEdit = !o.reconstituted && w.line_status === 'active' && VALUE_EDITABLE.includes(o.status)
              const editing = canEdit && valueEdit?.oeuvreId === w.oeuvre_id
              return (
                <div key={w.oeuvre_id} data-testid={`order-line-${w.oeuvre_id}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <button type="button" onClick={() => openWork(w.oeuvre_id)} style={{
                      display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, background: 'none', border: 'none', padding: 0, flex: 1, minWidth: 0,
                      color: 'var(--tx)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 13,
                    }}>
                      <WorkThumbLabel id={w.oeuvre_id} title={w.title} image={w.image} px={36} />
                      {w.line_status !== 'active' && LINE_LABEL[w.line_status] && (
                        <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{t(LINE_LABEL[w.line_status])}</span>
                      )}
                    </button>
                    {w.value != null && VALUE_LABEL[o.kind] && (
                      <span title={t(VALUE_LABEL[o.kind]!)} style={{ fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap', flex: 'none' }}>{fmtMoney(w.value, o.currency)}</span>
                    )}
                    {canEdit && !editing && (
                      <button type="button" className="btn ghost sm" data-testid={`order-line-value-edit-${w.oeuvre_id}`}
                        title={`${t('ord_value_edit_tt')} — ${t(VALUE_LABEL[o.kind]!)}`}
                        onClick={() => startValueEdit(w.oeuvre_id, w.value)} style={{ minHeight: 44, flex: 'none' }}>
                        {t('ord_value_edit')}
                      </button>
                    )}
                  </div>
                  {editing && (
                    <div style={{ margin: '4px 0 8px', padding: 10, border: '1px solid var(--bd2)', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={payLabel}>
                        {t(VALUE_LABEL[o.kind]!)}
                        <input className="input" type="number" inputMode="decimal" min={0} autoFocus value={valueEdit.text}
                          data-testid="order-line-value-input"
                          onChange={(e) => setValueEdit({ oeuvreId: w.oeuvre_id, text: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') void saveValue(o); if (e.key === 'Escape') setValueEdit(null) }}
                          style={payInput} />
                      </label>
                      <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('ord_line_value_hint')}</div>
                      {o.kind === 'sale' && o.price_final != null && (
                        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('ord_value_sale_total').replace('{total}', fmtMoney(o.price_final, o.currency))}</div>
                      )}
                      {o.status !== 'draft' && (
                        <div role="note" style={{ fontSize: 12, color: 'var(--yellow, var(--ac))' }}>{t('ord_value_signed_warn')}</div>
                      )}
                      {valueErr && <div role="alert" style={{ fontSize: 13, color: 'var(--rust)' }}>{valueErr}</div>}
                      <div style={{ display: 'flex', gap: 8, flexDirection: narrow ? 'column' : 'row' }}>
                        <button type="button" className="btn primary" disabled={valueBusy} onClick={() => { void saveValue(o) }} style={{ minHeight: 44 }}>
                          {valueBusy ? t('ord_working') : t('ord_value_save')}
                        </button>
                        <button type="button" className="btn ghost" disabled={valueBusy} onClick={() => setValueEdit(null)} style={{ minHeight: 44 }}>{t('ord_new_cancel')}</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {valueSavedNote === o.id && <div style={{ fontSize: 12, color: 'var(--sage)' }}>{t('ord_value_paper_redone')}</div>}
          </div>
        </div>

        <Section label={t('ord_steps')}>
          {o.status === 'cancelled' && <div style={{ fontSize: 13, color: 'var(--rust)', marginBottom: 6 }}>{`${t(isReturned(o) ? 'ord_st_returned' : 'ord_st_cancelled')} · ${fmtDate(isReturned(o) ? o.returned_at : o.cancelled_at) ?? ''}`}</div>}
          {o.kind === 'sale' && ['signed', 'deposit_paid', 'paid'].includes(o.status) && (
            <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 6 }}>{t('ord_return_from_delivery')}</div>
          )}
          {o.kind === 'sale' && returnDaysLeft(o) != null && (
            <div data-testid="order-return-until" style={{ fontSize: 13, color: 'var(--yellow, var(--ac))', marginBottom: 6 }}>
              {t('ord_return_until').replace('{date}', fmtDate(returnLastDay(o)) ?? '').replace('{n}', String(returnDaysLeft(o)))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: narrow ? 0 : 0 }}>
            {steps.map((s, i) => {
              const done = i < idx || (i === idx && FINISHED.has(o.status))
              const now = i === idx && !FINISHED.has(o.status)
              const color = now ? 'var(--ac)' : done ? 'var(--tx2)' : 'var(--tx3)'
              const date = fmtDate(stepDate(o, s))
              return narrow ? (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32, fontSize: 13, color, fontWeight: now ? 600 : 400 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flex: 'none', border: `1px solid ${done || now ? 'var(--ac)' : 'var(--bd3)'}`, background: done ? 'var(--ac)' : 'transparent' }} />
                  {t(stepLabelKey(o.kind, s))}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tx3)', fontWeight: 400 }}>{date ?? ''}</span>
                </div>
              ) : (
                <div key={s} style={{ flex: 1, fontSize: 11, color, borderTop: `2px solid ${done || now ? 'var(--ac)' : 'var(--bd2)'}`, paddingTop: 5, fontWeight: now ? 600 : 400 }}>
                  {t(stepLabelKey(o.kind, s))}
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--tx3)', fontWeight: 400 }}>{date ?? ' '}</span>
                </div>
              )
            })}
          </div>
          {((NEXT[o.kind][o.status] ?? []).length > 0 || CANCEL_FROM[o.kind].includes(o.status) || canReturn(o)) && (
            <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {canPay(o) && (
                <button type="button" disabled={stepBusy} onClick={() => openPay(o)} className="btn primary" style={{ minHeight: 44 }}>
                  {t('ord_pay')}
                </button>
              )}
              {(NEXT[o.kind][o.status] ?? []).filter((to) => !(o.kind === 'sale' && (to === 'deposit_paid' || to === 'paid'))).map((to, i) => (
                <button key={to} type="button" disabled={stepBusy} onClick={() => { void runStep(o, to) }}
                  className={i === 0 ? 'btn primary' : 'btn ghost'} style={{ minHeight: 44 }}>
                  {stepBusy ? t('ord_working') : t(actionKey(o.kind, to))}
                </button>
              ))}
              {canReturn(o) && (
                <button type="button" disabled={stepBusy} onClick={() => { void runReturn(o) }} className="btn ghost" style={{ minHeight: 44, color: 'var(--rust)' }}>
                  {t('ord_do_return')}
                </button>
              )}
              {CANCEL_FROM[o.kind].includes(o.status) && (
                <button type="button" disabled={stepBusy} onClick={() => { void runStep(o, 'cancel') }} className="btn ghost" style={{ minHeight: 44, color: 'var(--rust)' }}>
                  {t('ord_do_cancel')}
                </button>
              )}
            </div>
          )}
          {payOpen && canPay(o) && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--bd2)', borderRadius: 4, display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 8 }}>
              <label style={payLabel}>
                {t('ord_pay_amount')}
                <input className="input" type="number" inputMode="decimal" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} style={payInput} />
              </label>
              <label style={payLabel}>
                {t('ord_pay_date')}
                <input className="input" type="date" value={pay.date} onChange={(e) => setPay((p) => ({ ...p, date: e.target.value }))} style={payInput} />
              </label>
              <label style={{ ...payLabel, gridColumn: '1 / -1' }}>
                {t('ord_pay_method')}
                <select className="input" value={pay.method} onChange={(e) => setPay((p) => ({ ...p, method: e.target.value }))} style={payInput}>
                  {PAY_METHODS.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
                </select>
              </label>
              {paysInFull(o, pay.amount) && (
                <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, cursor: 'pointer', color: 'var(--tx)' }}>
                  <input type="checkbox" checked={pay.takeaway} onChange={(e) => setPay((p) => ({ ...p, takeaway: e.target.checked }))} data-testid="order-pay-takeaway"
                    style={{ width: 22, height: 22, marginTop: 2, flex: 'none', accentColor: 'var(--ac)' }} />
                  <span style={{ fontSize: 14 }}>
                    {t('ord_takeaway')}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--tx3)' }}>{t(pay.takeaway ? 'ord_takeaway_on' : 'ord_takeaway_off')}</span>
                  </span>
                </label>
              )}
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--tx3)' }}>{t('ord_pay_hint')}</div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexDirection: narrow ? 'column' : 'row' }}>
                <button type="button" className="btn primary" disabled={stepBusy} onClick={() => { void savePay(o) }} style={{ minHeight: 44 }}>
                  {stepBusy ? t('ord_working') : t('ord_pay_save')}
                </button>
                <button type="button" className="btn ghost" disabled={stepBusy} onClick={() => setPayOpen(false)} style={{ minHeight: 44 }}>{t('ord_new_cancel')}</button>
              </div>
            </div>
          )}
          {stepErr && <div role="alert" style={{ fontSize: 13, color: 'var(--rust)', marginTop: 8 }}>{stepErr}</div>}
        </Section>

        {!o.reconstituted && <OrderCascadePanel key={`${o.id}-${o.status}`} orderId={o.id} narrow={narrow} onOrderChanged={() => { void load() }} />}

        <Section label={t('ord_papers')}>
          {o.papers.length === 0 && !o.paper_path && <div style={{ fontSize: 13, color: 'var(--tx3)' }}>{t('ord_no_paper')}</div>}
          {o.papers.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: '1px solid var(--bd)', fontSize: 13 }}>
              <span style={{ width: 24, height: 30, border: '1px solid var(--bd3)', borderRadius: 2, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                {p.name}
                {p.folder && <span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)' }}>{p.folder}</span>}
              </span>
              {p.storage_path && (
                <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => { void openPaper(p.storage_path) }}>
                  {t('ord_open_paper')}
                </button>
              )}
              {p.storage_path && (
                <button type="button" className="btn ghost sm" data-testid={`order-paper-share-${p.id}`} title={t('ord_share_paper_tt')}
                  disabled={shareBusy === p.id} onClick={() => { void sharePaper(p) }}
                  style={{ minHeight: 44, color: shareReady === p.id ? 'var(--ac)' : undefined, borderColor: shareReady === p.id ? 'var(--ac)' : undefined }}>
                  {shareBusy === p.id ? t('ord_working') : t('ord_share_paper')}
                </button>
              )}
            </div>
          ))}
          {shareReady && o.papers.some((p) => p.id === shareReady) && (
            <div role="status" style={{ fontSize: 12, color: 'var(--ac)', marginTop: 6 }}>{t('ord_share_ready')}</div>
          )}
          {paperStale.has(o.id) && (
            <div role="note" data-testid="order-paper-stale" style={{ fontSize: 12, color: 'var(--yellow, var(--ac))', marginTop: 6 }}>{t('ord_value_paper_stale')}</div>
          )}
          <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn ghost" disabled={paperBusy} onClick={() => { void redoPaper(o) }} style={{ minHeight: 44 }}>
              {paperBusy ? t('ord_working') : o.paper_path ? t('ord_paper_redo') : t('ord_paper_make')}
            </button>
            {o.paper_path && o.status !== 'draft' && o.status !== 'cancelled' && (
              <>
                <button type="button" className="btn ghost" disabled={paperBusy} onClick={() => signedInput.current?.click()} style={{ minHeight: 44 }}>
                  {t('ord_signed_add')}
                </button>
                <input ref={signedInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" hidden
                  onChange={(e) => { void uploadSigned(o, e.target.files?.[0]) }} />
              </>
            )}
          </div>
          {o.status === 'draft' && o.paper_path && <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 6 }}>{t('ord_paper_draft_hint')}</div>}
        </Section>

        {(o.price_final != null || o.commission_pct != null || o.payments.length > 0) && (
          <Section label={t('ord_money')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 12px', fontSize: 13 }}>
              {o.price_final != null && <><span style={{ color: 'var(--tx3)' }}>{t('ord_price_final')}</span><span>{fmtMoney(o.price_final, o.currency)}</span></>}
              {o.commission_pct != null && <><span style={{ color: 'var(--tx3)' }}>{t('ord_commission')}</span><span>{`${o.commission_pct} %`}</span></>}
              {o.kind === 'sale' && o.price_final != null && (
                <>
                  <span style={{ gridColumn: '1 / -1' }}><VatLine price={o.price_final} rates={o.works.map((w) => w.tva_rate)} currency={o.currency} /></span>
                  <span style={{ color: 'var(--tx3)' }}>{t('ord_paid_total')}</span><span>{fmtMoney(o.paid_total, o.currency)}</span>
                  <span style={{ color: 'var(--tx3)' }}>{t('ord_remaining')}</span><span>{fmtMoney(Math.max(0, o.price_final - o.paid_total), o.currency)}</span>
                </>
              )}
            </div>
            {o.kind === 'sale' && (o.paid_total > 0 || ['paid', 'delivered'].includes(o.status)) && (() => {
              // House rule (LEGAL_POLICY decision 6): held until delivered + 14 days without return.
              const state = saleMoneyState(o)
              const last = returnLastDay(o)
              const text = state === 'refund'
                ? (o.paid_total > 0
                    ? o.refunded_at ? t('ord_refunded_on').replace('{date}', fmtDate(o.refunded_at) ?? '') : t('ord_money_refund').replace('{amount}', fmtMoney(o.paid_total, o.currency))
                    : null)
                : state === 'definitive' ? t('ord_money_definitive_on').replace('{date}', fmtDate(last ? addCalendarDaysIso(last, 1) : o.delivered_at) ?? '')
                : t('ord_money_held')
              return text ? (
                <div data-testid="order-money-state" style={{ marginTop: 8, fontSize: 12, color: state === 'refund' && !o.refunded_at ? 'var(--rust)' : state === 'definitive' || o.refunded_at ? 'var(--sage)' : 'var(--tx2)' }}>{text}</div>
              ) : null
            })()}
            {REFUNDED_AT_LIVE && o.kind === 'sale' && o.status === 'cancelled' && o.paid_total > 0 && !o.refunded_at && (
              refundOpen ? (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 8, alignItems: narrow ? 'stretch' : 'flex-end', flexWrap: 'wrap' }}>
                  <label style={payLabel}>
                    {t('ord_refund_date')}
                    <input className="input" type="date" value={refundDay} onChange={(e) => setRefundDay(e.target.value)} style={payInput} />
                  </label>
                  <button type="button" className="btn primary" disabled={stepBusy || !refundDay} onClick={() => { void saveRefund(o) }} style={{ minHeight: 44 }}>
                    {stepBusy ? t('ord_working') : t('ord_refund_save')}
                  </button>
                  <button type="button" className="btn ghost" disabled={stepBusy} onClick={() => setRefundOpen(false)} style={{ minHeight: 44 }}>{t('ord_new_cancel')}</button>
                  <div style={{ flexBasis: '100%', fontSize: 12, color: 'var(--tx3)' }}>{t('ord_refund_hint')}</div>
                </div>
              ) : (
                <button type="button" className="btn ghost" data-testid="order-mark-refunded" onClick={() => { setRefundDay(new Date().toISOString().slice(0, 10)); setRefundOpen(true) }} style={{ minHeight: 44, marginTop: 10 }}>
                  {t('ord_do_refunded')}
                </button>
              )
            )}
            {o.payments.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>{t('ord_payments')}</div>
                {o.payments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', gap: 8, fontSize: 12, borderTop: '1px solid var(--bd)', padding: '4px 0' }}>
                    <span style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{fmtDate(p.payment_date)}</span>
                    <span style={{ flex: 1, minWidth: 0, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.method ?? ''}</span>
                    <span>{fmtMoney(p.amount, o.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {o.notes && (
          <Section label={t('ord_notes')}>
            <div style={{ fontSize: 13, color: 'var(--tx2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{o.notes}</div>
          </Section>
        )}
      </div>
    )
  }

  const datesCell = (o: WorkOrderView) => {
    const first = fmtDate(o.signed_at ?? o.delivered_at ?? (o.reconstituted ? null : o.created_at))
    return (
      <>
        {first ?? '—'}
        {o.end_date && (o.kind === 'loan' || o.kind === 'consignment') && (
          <span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)' }}>{`${t('ord_back_by')} ${fmtDate(o.end_date)}`}</span>
        )}
      </>
    )
  }

  const paperCell = (o: WorkOrderView) => {
    const n = o.papers.length
    return <span title={n ? undefined : t('ord_no_paper')} style={{ fontSize: 12, color: n ? 'var(--sage)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>{n ? `● ${n}` : '○'}</span>
  }

  const header = (
    <div style={{ padding: narrow ? '12px 16px 0' : '0 0 4px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 26 }}>{t('ord_title')}</div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{t('ord_intro')}</div>
      </div>
      <button type="button" className="btn primary" onClick={() => setFormOpen(true)} style={{ minHeight: 44, whiteSpace: 'nowrap', flex: 'none' }}>
        {t('ord_new')}
      </button>
    </div>
  )

  const form = formOpen ? (
    <NewOrderForm
      narrow={narrow}
      contacts={contacts}
      initial={formInitial}
      onClose={() => { setFormOpen(false); setFormInitial(undefined); clearUrlIntent() }}
      onCreated={(id) => { setFormOpen(false); setFormInitial(undefined); clearUrlIntent(); setSelectedId(id); void load() }}
    />
  ) : null

  const status = loadError
    ? <div style={{ padding: 16, fontSize: 13, color: 'var(--rust)' }}>{`${t('ord_load_error')} ${loadError}`}</div>
    : orders === null
      ? <div style={{ padding: 16, fontSize: 13, color: 'var(--tx3)' }}>{t('ord_loading')}</div>
      : visible.length === 0
        ? (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--tx3)' }}>
            {orders.length === 0 ? t('ord_empty') : !showClosed && finishedCount > 0 ? t('ord_empty_open_only') : t('ord_empty_filtered')}
            {orders.length > 0 && !showClosed && finishedCount > 0 && (
              <button type="button" className="btn ghost" onClick={() => setShowClosed(true)} style={{ display: 'block', marginTop: 10, minHeight: 44, maxWidth: '100%', whiteSpace: 'normal', textAlign: 'left', height: 'auto', padding: '8px 12px', boxSizing: 'border-box' }}>
                {t('ord_show_closed_n').replace('{n}', String(finishedCount))}
              </button>
            )}
          </div>
        )
        : null

  // ── Phone ────────────────────────────────────────────────────────────────────────
  if (narrow) {
    if (selected) {
      return (
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={() => setSelectedId(null)} style={{
            minHeight: 44, padding: '0 16px', background: 'none', border: 'none', color: 'var(--tx2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
          }}>{`‹ ${t('ord_back_to_list')}`}</button>
          {detail(selected)}
          {form}
        </div>
      )
    }
    return (
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {header}
        {chips}
        {status}
        {[...openRows, ...closedRows].map((o) => (
          <button key={o.id} type="button" onClick={() => { setSelectedId(o.id); setStepErr(null); setPayOpen(false); setRefundOpen(false) }} style={{
            display: 'block', width: 'calc(100% - 32px)', margin: '10px 16px 0', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid var(--bd2)', borderRadius: 4, background: 'var(--bg2)', padding: 10, color: 'var(--tx)',
            opacity: FINISHED.has(o.status) ? 0.75 : 1,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {kindChip(o.kind)}
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.party_name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ac)' }}>{o.ref}</span>
            </span>
            <span style={{ display: 'block', marginTop: 8 }}>{thumbs(o, 36, 5)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: 'var(--tx3)' }}>
              {stepDots(o)}<span>{statusText(o)}</span>
              {returnTag(o) && <span data-testid="order-card-return" style={{ marginLeft: 'auto', color: returnDaysLeft(o) != null ? 'var(--yellow, var(--ac))' : 'var(--sage)' }}>{returnTag(o)}</span>}
            </span>
          </button>
        ))}
        {form}
      </div>
    )
  }

  // ── Desktop ──────────────────────────────────────────────────────────────────────
  const row = (o: WorkOrderView) => {
    const on = o.id === selectedId
    return (
      <tr key={o.id} onClick={() => { setSelectedId(o.id); setStepErr(null); setPayOpen(false); setRefundOpen(false) }} style={{ cursor: 'pointer', background: on ? 'color-mix(in srgb, var(--ac) 7%, transparent)' : undefined, color: FINISHED.has(o.status) ? 'var(--tx3)' : undefined }}>
        <td style={{ ...CELL, width: 34 }}>{kindChip(o.kind)}</td>
        <td style={{ ...CELL, whiteSpace: 'nowrap' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ac)' }}>{o.ref}</span></td>
        <td style={CELL}>{thumbs(o, 28, 4)}</td>
        <td style={{ ...CELL, minWidth: 130, overflowWrap: 'break-word' }}>
          {o.party_name}
          {o.party_place && <span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)' }}>{o.party_place}</span>}
        </td>
        <td style={{ ...CELL, whiteSpace: 'nowrap' }}>{datesCell(o)}</td>
        <td style={CELL}>{stepDots(o)}<span style={{ display: 'block', fontSize: 11, color: 'var(--tx3)' }}>{statusText(o)}</span>
          {returnTag(o) && <span style={{ display: 'block', fontSize: 11, color: returnDaysLeft(o) != null ? 'var(--yellow, var(--ac))' : 'var(--sage)' }}>{returnTag(o)}</span>}</td>
        <td style={CELL}>{paperCell(o)}</td>
      </tr>
    )
  }
  const groupRow = (label: string) => (
    <tr><td colSpan={7} style={{ background: 'var(--bg0)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--tx3)', fontWeight: 600, padding: '5px 10px' }}>{label}</td></tr>
  )

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '16px 20px', overflowY: 'auto' }}>
      {header}
      {chips}
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--bd)', minHeight: 360 }}>
        <div style={{ flex: 1, minWidth: 0, overflowX: 'auto', borderRight: '1px solid var(--bd)' }}>
          {status ?? (
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={CELL} />
                  <th style={CELL}>{t('ord_col_ref')}</th>
                  <th style={CELL}>{t('ord_col_works')}</th>
                  <th style={CELL}>{t('ord_col_party')}</th>
                  <th style={CELL}>{t('ord_col_dates')}</th>
                  <th style={CELL}>{t('ord_col_step')}</th>
                  <th style={CELL}>{t('ord_col_papers')}</th>
                </tr>
              </thead>
              <tbody>
                {openRows.length > 0 && groupRow(t('ord_group_open'))}
                {openRows.map(row)}
                {closedRows.length > 0 && groupRow(t('ord_group_closed'))}
                {closedRows.map(row)}
              </tbody>
            </table>
          )}
        </div>
        <aside style={{ width: 'clamp(280px, 36%, 400px)', flex: 'none', overflowY: 'auto' }}>
          {selected ? detail(selected) : <div style={{ padding: 18, fontSize: 13, color: 'var(--tx3)' }}>{t('ord_pick_one')}</div>}
        </aside>
      </div>
      {form}
    </div>
  )
}

/** Drop `?new=…` once the form is done, so a reload does not open it again. Not at mount: the
 *  router reacts to the URL change and aborts the server actions still in flight. */
/**
 * The address the works go to (TODO 9). Set: its label · city. Not set on a running order whose party
 * has addresses (an exhibition send, a phone sale): pick one here — `setOrderAddress`.
 */
function OrderAddressLine({ o, narrow, onSaved }: { o: WorkOrderView; narrow: boolean; onSaved: () => Promise<void> }) {
  const { t } = useI18n()
  const [list, setList] = useState<PartyAddress[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canPick = !o.address_label && !o.reconstituted && o.address_count > 0 && !FINISHED.has(o.status)
  useEffect(() => {
    if (!canPick) return
    let live = true
    void listPartyAddresses(o.party_id).then((l) => { if (live) setList(l) })
    return () => { live = false }
  }, [canPick, o.party_id])
  if (o.address_label) {
    return <div data-testid="order-address" style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('ord_addr_line').replace('{label}', o.address_label)}</div>
  }
  if (!canPick) return null
  async function pick(raw: string) {
    const id = Number(raw)
    if (!Number.isInteger(id) || id <= 0) return
    setBusy(true); setErr(null)
    try {
      const res = await setOrderAddress(o.id, id)
      if ('error' in res) { setErr(orderErrorText(res.error, t)); return }
      await onSaved()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div data-testid="order-address-pick" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxWidth: 360 }}>
      <select className="input" value="" disabled={busy || !list} onChange={(e) => void pick(e.target.value)}
        aria-label={t('custody_address')} style={{ minHeight: narrow ? 44 : 30, fontSize: 12 }}>
        <option value="">{t('ord_addr_pick')}</option>
        {(list ?? []).map((a) => (
          <option key={a.id} value={a.id}>{[a.label, a.ville].filter(Boolean).join(' · ') || `#${a.id}`}</option>
        ))}
      </select>
      <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{err ?? t('ord_addr_pick_hint')}</span>
    </div>
  )
}

function clearUrlIntent() {
  if (new URLSearchParams(window.location.search).has('new')) window.history.replaceState(null, '', window.location.pathname)
}

const isReturned = (o: WorkOrderView) => o.kind === 'sale' && o.status === 'cancelled' && !!o.returned_at
/** « Retour »: a paid sale before delivery, or a delivered one still inside its 14-day period. */
const canReturn = (o: WorkOrderView) => o.kind === 'sale' && (o.status === 'paid' || (o.status === 'delivered' && returnDaysLeft(o) != null))

/** The amount typed settles the sale (what was paid + this ≥ the price). */
const paysInFull = (o: WorkOrderView, amount: string) =>
  !!o.price_final && o.paid_total + (Number(amount.replace(',', '.')) || 0) >= o.price_final - 0.005
const canPay = (o: WorkOrderView) => o.kind === 'sale' && (o.status === 'signed' || o.status === 'deposit_paid')
const payLabel = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--tx3)', minWidth: 0 } as const
const payInput = { minHeight: 44, fontSize: 15, width: '100%', boxSizing: 'border-box' } as const

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--bd)', padding: '10px 18px' }}>
      <div className="t-label" style={{ marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}
