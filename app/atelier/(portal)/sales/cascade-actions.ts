'use server'

// R7b — the order drives the chain (docs/design/2026-11-18/R7b_OrderCascade.notes.md):
// prep demands on order lines, the shipment checklist (or a pick-up), several orders per shipment
// when they go to the same place, COA made at payment, invoices with a gap-free number, claims.
// Tables: supabase/sql/r7b_order_cascade.sql (applied 2026-11-18). Shipment step dates are stamped
// by the database; moving an order on (custody, 14 days) stays in advanceWorkOrder.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { placeAddressLine } from '@/lib/places/place-address'
import { logSystemEvent } from '@/lib/utils/logging'
import { logError } from '@/lib/error-reporter/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { recordStorageObject } from '@/lib/storage-object-ledger'
import { VAULT_FOLDER_INVOICES } from '@/lib/vault/folder-routing'
import { generateCOA } from '@/app/atelier/(portal)/vault/actions'
import { advanceWorkOrder, type WorkOrderKind } from '@/app/atelier/(portal)/sales/orders-actions'
import { buildInvoicePaper, type InvoiceLine } from '@/lib/orders/invoice-paper'
import { contactListLabel, contactProseLabel } from '@/lib/contacts/contact-display'
import { syncOrderToCalendars, type OrderDateKey, type OrderSyncLabels } from '@/lib/calendar/sync-order'
import { resolveMessage } from '@/lib/i18n/resolve-message'
import type { DictKey } from '@/lib/i18n/dictionary'
import {
  DEMAND_KINDS, INVOICE_FROM_STATUS, INVOICE_VAT_MENTION, SHIP_DONE, SHIP_OPEN, SHIP_STEPS, STUDIO_SIRET, nextShipStep,
  type DemandKind, type ShipmentKind, type ShipmentStatus,
} from '@/lib/orders/cascade'
import { inChunks } from '@/lib/supabase/in-chunks'

type Supa = Awaited<ReturnType<typeof createClient>>
type Err = { error: string }
type Ok = { ok: true }
const PEM = 13
const UUID_RE = /^[0-9a-f-]{36}$/i

async function guard(admin = false): Promise<{ supabase: Supa } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: ok } = await supabase.rpc(admin ? 'is_admin' : 'is_team')
  if (!ok) return { error: admin ? 'cas_admin_only' : 'Accès refusé' }
  return { supabase }
}

const done = () => { revalidatePath('/atelier/sales'); revalidatePath('/atelier/logistics') }

// ── Views ─────────────────────────────────────────────────────────────────────────────────────────

export interface CascadeDemand {
  id: string; line_id: string; oeuvre_id: number; kind: DemandKind; note: string | null
  price: number | null; done_at: string | null; entrusted_order_id: string | null
}
export interface CascadeShipmentWork { oeuvre_id: number; title: string | null; order_id: string | null; order_ref: string | null }
export interface CascadeClaim {
  id: string; oeuvre_id: number; insurer: string; claim_ref: string | null; police_report_ref: string | null
  amount_claimed: number | null; amount_paid: number | null; status: string; filed_on: string | null
}
export interface CascadeShipment {
  id: string; kind: ShipmentKind; status: ShipmentStatus; created_at: string
  to_contact_id: number | null; party_name: string; place_id: number | null; pickup_process_id: string | null
  carrier: string | null; tracking_no: string | null; tracking_url: string | null
  packed_dims: string | null; packed_weight_kg: number | null; packing_note: string | null
  insured_value: number | null; insurer: string | null; policy_ref: string | null; cost: number | null; handed_to: string | null
  photos_at: string | null; picked_at: string | null; packed_at: string | null; insured_at: string | null
  labelled_at: string | null; shipped_at: string | null; delivered_at: string | null; cancelled_at: string | null
  works: CascadeShipmentWork[]
  orders: { id: string; ref: string | null }[]
  open_demands: number
  claims: CascadeClaim[]
}
export interface CascadeInvoice {
  id: string; kind: 'invoice' | 'credit_note'; number: string | null; issued_on: string; total: number
  paper_path: string | null; credits_invoice_id: string | null; credited: boolean
}
export interface CascadeCoa { oeuvre_id: number; document_id: string; storage_path: string | null; cert_id: string | null }
export interface OrderCascadeView {
  orderId: string
  kind: WorkOrderKind
  status: string
  delivery_mode: 'ship' | 'pickup' | null
  shipping_charge: number | null
  lines: { id: string; oeuvre_id: number; title: string | null }[]
  demands: CascadeDemand[]
  shipments: CascadeShipment[]
  invoices: CascadeInvoice[]
  coas: CascadeCoa[]
  /** Paid sales of the same buyer not on a live invoice (one invoice for several orders). */
  uninvoicedSameBuyer: { id: string; ref: string | null }[]
  /** Events a pick-up can happen at (R6: exposition / collaboration / edition, planned or running). */
  events: { id: string; nom: string }[]
  isAdmin: boolean
}

const SHIP_COLS = 'id, kind, status, created_at, to_contact_id, place_id, pickup_process_id, carrier, tracking_no, tracking_url, packed_dims, packed_weight_kg, packing_note, insured_value, insurer, policy_ref, cost, handed_to, photos_at, picked_at, packed_at, insured_at, labelled_at, shipped_at, delivered_at, cancelled_at'

type ShipRow = Omit<CascadeShipment, 'works' | 'orders' | 'open_demands' | 'claims' | 'party_name'>

/** An order in one of these steps has nothing left to send or bring back (cancelled, returned, closed). */
const ORDER_DEAD = ['cancelled', 'closed']
/** Before « Expédié »: the box can still change. */
const notGone = (s: string) => !['shipped', 'delivered', 'cancelled'].includes(s)

/**
 * `liveOnly`: a box not yet gone leaves out the works of cancelled / closed orders (stress test B4 — data
 * left from before the fix); `hideEmptied`: such a box with nothing else in it is not listed at all.
 * Id lists are read in chunks (« URI too long » past ~200 ids, B5).
 */
async function expandShipments(supabase: Supa, rows: ShipRow[], opts: { liveOnly?: boolean; hideEmptied?: boolean } = {}): Promise<CascadeShipment[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const { data: links } = await inChunks(ids, (c) => supabase.from('shipment_work').select('shipment_id, oeuvre_id, order_line_id').in('shipment_id', c))
  const lineIds = [...new Set(links.map((l) => l.order_line_id).filter((x): x is string => !!x))]
  const oeuvreIds = [...new Set(links.map((l) => l.oeuvre_id))]
  const contactIds = [...new Set(rows.map((r) => r.to_contact_id).filter((x): x is number => x != null))]
  const [linesRes, worksRes, contactsRes, claimsRes] = await Promise.all([
    inChunks(lineIds, (c) => supabase.from('work_order_work').select('id, order_id').in('id', c)),
    inChunks(oeuvreIds, (c) => supabase.from('Oeuvres').select('OeuvreID, Titre').in('OeuvreID', c)),
    inChunks(contactIds, (c) => supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom"').in('ContactID', c)),
    inChunks(ids, (c) => supabase.from('insurance_claim').select('id, shipment_id, oeuvre_id, insurer, claim_ref, police_report_ref, amount_claimed, amount_paid, status, filed_on').in('shipment_id', c)),
  ])
  const orderIds = [...new Set((linesRes.data ?? []).map((l) => l.order_id))]
  const [ordersRes, demandsRes] = await Promise.all([
    inChunks(orderIds, (c) => supabase.from('work_order').select('id, ref, status').in('id', c)),
    inChunks(lineIds, (c) => supabase.from('work_order_demand').select('line_id').in('line_id', c).is('done_at', null)),
  ])
  const orderOfLine = new Map((linesRes.data ?? []).map((l) => [l.id, l.order_id]))
  const refOf = new Map((ordersRes.data ?? []).map((o) => [o.id, o.ref]))
  const titleOf = new Map((worksRes.data ?? []).map((w) => [w.OeuvreID, w.Titre]))
  const nameOf = new Map((contactsRes.data ?? []).map((c) => [c.ContactID, contactListLabel(c, { fallback: '' })]))
  const openByLine = new Map<string, number>()
  for (const d of demandsRes.data ?? []) openByLine.set(d.line_id, (openByLine.get(d.line_id) ?? 0) + 1)
  const deadOrder = new Set((ordersRes.data ?? []).filter((o) => ORDER_DEAD.includes(o.status)).map((o) => o.id))
  const isDead = (l: { order_line_id: string | null }) => {
    const oid = l.order_line_id ? orderOfLine.get(l.order_line_id) : undefined
    return oid != null && deadOrder.has(oid)
  }

  return rows.flatMap((r) => {
    const all = links.filter((l) => l.shipment_id === r.id)
    const mine = opts.liveOnly && notGone(r.status) ? all.filter((l) => !isDead(l)) : all
    if (opts.hideEmptied && notGone(r.status) && all.length > 0 && mine.length === 0) return []
    const works = mine.map((l) => {
      const oid = l.order_line_id ? orderOfLine.get(l.order_line_id) ?? null : null
      return { oeuvre_id: l.oeuvre_id, title: titleOf.get(l.oeuvre_id) ?? null, order_id: oid, order_ref: oid ? refOf.get(oid) ?? null : null }
    })
    const orders = [...new Map(works.filter((w) => w.order_id).map((w) => [w.order_id!, { id: w.order_id!, ref: w.order_ref }])).values()]
    return [{
      ...r,
      party_name: r.to_contact_id != null ? nameOf.get(r.to_contact_id) ?? `#${r.to_contact_id}` : '',
      works,
      orders,
      open_demands: mine.reduce((n, l) => n + (l.order_line_id ? openByLine.get(l.order_line_id) ?? 0 : 0), 0),
      claims: ((claimsRes.data ?? []) as (CascadeClaim & { shipment_id: string | null })[]).filter((c) => c.shipment_id === r.id),
    }]
  })
}

export async function fetchOrderCascade(orderId: string): Promise<OrderCascadeView | Err> {
  const g = await guard()
  if ('error' in g) return g
  const { supabase } = g
  if (!UUID_RE.test(orderId)) return { error: 'not_found' }

  const [{ data: o, error }, { data: isAdmin }] = await Promise.all([
    supabase.from('work_order').select('id, kind, status, party_id, delivery_mode, shipping_charge').eq('id', orderId).single(),
    supabase.rpc('is_admin'),
  ])
  if (error || !o) return { error: error?.message ?? 'not_found' }

  const { data: lineRows } = await supabase.from('work_order_work').select('id, oeuvre_id, coa_document_id, line_status').eq('order_id', orderId).order('position')
  const lines = (lineRows ?? []).filter((l) => l.line_status !== 'removed')
  const lineIds = lines.map((l) => l.id)
  const oids = lines.map((l) => l.oeuvre_id)
  const coaIds = lines.map((l) => l.coa_document_id).filter((x): x is string => !!x)

  const [worksRes, demandsRes, swRes, coaRes, invLinks, eventsRes] = await Promise.all([
    oids.length ? supabase.from('Oeuvres').select('OeuvreID, Titre').in('OeuvreID', oids) : Promise.resolve({ data: [] as { OeuvreID: number; Titre: string | null }[] }),
    lineIds.length ? supabase.from('work_order_demand').select('id, line_id, kind, note, price, done_at, entrusted_order_id').in('line_id', lineIds).order('created_at') : Promise.resolve({ data: [] }),
    lineIds.length ? supabase.from('shipment_work').select('shipment_id').in('order_line_id', lineIds) : Promise.resolve({ data: [] as { shipment_id: string }[] }),
    coaIds.length ? supabase.from('document').select('id, oeuvre_id, storage_path, cert_id').in('id', coaIds) : Promise.resolve({ data: [] as { id: string; oeuvre_id: number | null; storage_path: string | null; cert_id: string | null }[] }),
    supabase.from('invoice_order').select('invoice_id').eq('order_id', orderId),
    supabase.from('suivi_process').select('id, nom').in('type', ['exposition', 'collaboration', 'edition']).in('statut', ['prevue', 'en_cours']).order('date_debut'),
  ])
  const titleOf = new Map((worksRes.data ?? []).map((w) => [w.OeuvreID, w.Titre]))
  const oeuvreOfLine = new Map(lines.map((l) => [l.id, l.oeuvre_id]))

  const shipIds = [...new Set((swRes.data ?? []).map((s) => s.shipment_id))]
  const { data: shipRows } = shipIds.length
    ? await supabase.from('shipment').select(SHIP_COLS).in('id', shipIds).order('created_at')
    : { data: [] as ShipRow[] }
  const shipments = await expandShipments(supabase, (shipRows ?? []) as ShipRow[])

  const invIds = [...new Set((invLinks.data ?? []).map((x) => x.invoice_id))]
  const { data: invRows } = invIds.length
    ? await supabase.from('invoice').select('id, kind, number, issued_on, total, paper_path, credits_invoice_id').in('id', invIds)
    : { data: [] as Omit<CascadeInvoice, 'credited'>[] }
  const { data: credits } = invIds.length
    ? await supabase.from('invoice').select('id, kind, number, issued_on, total, paper_path, credits_invoice_id').in('credits_invoice_id', invIds)
    : { data: [] as Omit<CascadeInvoice, 'credited'>[] }
  const creditedIds = new Set((credits ?? []).map((c) => c.credits_invoice_id))
  const invoices = [...(invRows ?? []), ...(credits ?? [])].map((i) => ({
    ...i, kind: i.kind as CascadeInvoice['kind'], total: Number(i.total), credited: creditedIds.has(i.id),
  })).sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''))

  // Other paid sales of the same buyer that no live invoice carries.
  let uninvoicedSameBuyer: { id: string; ref: string | null }[] = []
  if (o.kind === 'sale') {
    const { data: sales } = await supabase.from('work_order').select('id, ref').eq('kind', 'sale').eq('party_id', o.party_id)
      .in('status', [...INVOICE_FROM_STATUS])
    const saleIds = (sales ?? []).map((s) => s.id)
    if (saleIds.length) {
      const { data: io } = await supabase.from('invoice_order').select('order_id, invoice:invoice!invoice_order_invoice_id_fkey(id, kind)').in('order_id', saleIds)
      const { data: allCredits } = await supabase.from('invoice').select('credits_invoice_id').eq('kind', 'credit_note')
      const creditedAll = new Set((allCredits ?? []).map((c) => c.credits_invoice_id))
      const invoiced = new Set((io ?? []).filter((r) => {
        const inv = r.invoice as unknown as { id: string; kind: string } | null
        return inv && inv.kind === 'invoice' && !creditedAll.has(inv.id)
      }).map((r) => r.order_id))
      uninvoicedSameBuyer = (sales ?? []).filter((s) => !invoiced.has(s.id))
    }
  }

  return {
    orderId,
    kind: o.kind as WorkOrderKind,
    status: o.status,
    delivery_mode: (o.delivery_mode as 'ship' | 'pickup' | null) ?? null,
    shipping_charge: o.shipping_charge == null ? null : Number(o.shipping_charge),
    lines: lines.map((l) => ({ id: l.id, oeuvre_id: l.oeuvre_id, title: titleOf.get(l.oeuvre_id) ?? null })),
    demands: ((demandsRes.data ?? []) as Omit<CascadeDemand, 'oeuvre_id'>[]).map((d) => ({
      ...d, kind: d.kind as DemandKind, price: d.price == null ? null : Number(d.price), oeuvre_id: oeuvreOfLine.get(d.line_id) ?? 0,
    })),
    shipments,
    invoices,
    coas: (coaRes.data ?? []).filter((d) => d.oeuvre_id != null).map((d) => ({ oeuvre_id: d.oeuvre_id!, document_id: d.id, storage_path: d.storage_path, cert_id: d.cert_id })),
    uninvoicedSameBuyer,
    events: (eventsRes.data ?? []) as { id: string; nom: string }[],
    isAdmin: isAdmin === true,
  }
}

/** Logistics tab: shipments, open first (finished ones on request). */
export async function fetchShipments(includeDone: boolean): Promise<{ ok: true; shipments: CascadeShipment[] } | Err> {
  const g = await guard()
  if ('error' in g) return g
  let q = g.supabase.from('shipment').select(SHIP_COLS).order('created_at', { ascending: false }).limit(200)
  if (!includeDone) q = q.not('status', 'in', `(${SHIP_DONE.join(',')})`)
  const { data, error } = await q
  if (error) return { error: error.message }
  return { ok: true, shipments: await expandShipments(g.supabase, (data ?? []) as ShipRow[], { liveOnly: true, hideEmptied: true }) }
}

// ── Delivery choice + prep demands ───────────────────────────────────────────────────────────────

export async function setOrderDelivery(orderId: string, mode: 'ship' | 'pickup', shippingCharge: number | null): Promise<Ok | Err> {
  const g = await guard()
  if ('error' in g) return g
  if (mode !== 'ship' && mode !== 'pickup') return { error: 'cas_err_step' }
  const charge = mode === 'pickup' ? null : shippingCharge != null && shippingCharge > 0 ? shippingCharge : null
  const { error } = await g.supabase.from('work_order').update({ delivery_mode: mode, shipping_charge: charge }).eq('id', orderId)
  if (error) return { error: error.message }
  done()
  return { ok: true }
}

export async function addDemand(lineId: string, kind: DemandKind, note: string | null, price: number | null): Promise<Ok | Err> {
  const g = await guard()
  if ('error' in g) return g
  if (!DEMAND_KINDS.includes(kind)) return { error: 'cas_err_step' }
  const { error } = await g.supabase.from('work_order_demand').insert({
    line_id: lineId, kind, note: note?.trim() || null, price: price != null && price > 0 ? price : null,
  })
  if (error) return { error: error.message }
  done()
  return { ok: true }
}

export async function setDemandDone(id: string, isDone: boolean): Promise<Ok | Err> {
  const g = await guard()
  if ('error' in g) return g
  const { error } = await g.supabase.from('work_order_demand').update({ done_at: isDone ? new Date().toISOString() : null }).eq('id', id)
  if (error) return { error: error.message }
  done()
  return { ok: true }
}

/** Admin only (RLS): a demand recorded by mistake. */
export async function removeDemand(id: string): Promise<Ok | Err> {
  const g = await guard(true)
  if ('error' in g) return g
  const { error } = await g.supabase.from('work_order_demand').delete().eq('id', id)
  if (error) return { error: error.message }
  done()
  return { ok: true }
}

// ── Shipments ────────────────────────────────────────────────────────────────────────────────────

/**
 * Open (or join) the shipment for an order's works that are not on one yet. Direction from the order:
 * an order whose works are out (deposit, loan, Confié) gets a return; otherwise its delivery choice
 * (ship / pick-up). A shipment still being prepared (open → picked) for the same party, address and
 * kind takes the works — that is how several orders travel together.
 */
export async function openShipmentForOrder(orderId: string, pickupProcessId?: string | null): Promise<{ ok: true; id: string } | Err> {
  const g = await guard()
  if ('error' in g) return g
  const { supabase } = g

  const { data: o, error } = await supabase.from('work_order').select('id, ref, kind, status, party_id, place_id, delivery_mode, shipping_method').eq('id', orderId).single()
  if (error || !o) return { error: error?.message ?? 'not_found' }
  if (['cancelled', 'closed', 'delivered', 'handed_over'].includes(o.status)) return { error: 'cas_err_step' }

  const isReturn = o.status === 'out'
  const kind: ShipmentKind = isReturn ? 'return' : o.delivery_mode === 'pickup' ? 'pickup' : 'ship'

  const { data: lines } = await supabase.from('work_order_work').select('id, oeuvre_id').eq('order_id', o.id).eq('line_status', 'active')
  const lineIds = (lines ?? []).map((l) => l.id)
  if (lineIds.length === 0) return { error: 'cas_err_nothing_to_ship' }
  // Lines already on a live shipment of the same direction stay there.
  const { data: taken } = await supabase.from('shipment_work').select('order_line_id, shipment:shipment!shipment_work_shipment_id_fkey(kind, status)').in('order_line_id', lineIds)
  const busy = new Set((taken ?? []).filter((t) => {
    const s = t.shipment as unknown as { kind: string; status: string } | null
    return s && s.status !== 'cancelled' && (s.kind === 'return') === isReturn
  }).map((t) => t.order_line_id))
  const todo = (lines ?? []).filter((l) => !busy.has(l.id))
  if (todo.length === 0) return { error: 'cas_err_nothing_to_ship' }

  let q = supabase.from('shipment').select('id').eq('kind', kind).eq('to_contact_id', o.party_id).in('status', [...SHIP_OPEN])
  q = o.place_id ? q.eq('place_id', o.place_id) : q.is('place_id', null)
  if (kind === 'pickup') q = pickupProcessId ? q.eq('pickup_process_id', pickupProcessId) : q.is('pickup_process_id', null)
  // Never a box whose orders were all cancelled / returned / closed (B4): it would carry their works too.
  const { data: candidates } = await q.order('created_at').limit(10)
  let shipmentId: string | null = null
  for (const c of candidates ?? []) {
    if (await boxHasLiveOrder(supabase, c.id)) { shipmentId = c.id; break }
  }

  if (!shipmentId) {
    const { data: s, error: insErr } = await supabase.from('shipment').insert({
      kind, status: 'open', to_contact_id: o.party_id, place_id: o.place_id,
      pickup_process_id: kind === 'pickup' ? pickupProcessId ?? null : null,
      charged_to: o.kind === 'sale' && kind === 'ship' ? 'buyer' : o.kind === 'consignment' || o.kind === 'loan' || o.kind === 'entrusted' ? 'other_party' : 'studio',
    }).select('id').single()
    if (insErr || !s) return { error: insErr?.message ?? 'insert' }
    shipmentId = s.id
  }
  if (!shipmentId) return { error: 'insert' }
  const { error: swErr } = await supabase.from('shipment_work').upsert(
    todo.map((l) => ({ shipment_id: shipmentId!, oeuvre_id: l.oeuvre_id, order_line_id: l.id })),
    { onConflict: 'shipment_id,oeuvre_id' },
  )
  if (swErr) return { error: swErr.message }
  await logSystemEvent({ eventType: 'STATUS_CHANGE', tableName: 'shipment', rowId: shipmentId, newValue: 'open', metadata: { order: o.ref, kind, works: todo.map((l) => l.oeuvre_id) } })
  done()
  return { ok: true, id: shipmentId }
}

/** An empty box, a work with no order, or at least one order still going: the box may take more works. */
async function boxHasLiveOrder(supabase: Supa, shipmentId: string): Promise<boolean> {
  const { data: sw } = await supabase.from('shipment_work').select('order_line_id').eq('shipment_id', shipmentId)
  const rows = sw ?? []
  const lineIds = [...new Set(rows.map((r) => r.order_line_id).filter((x): x is string => !!x))]
  if (rows.length === 0 || rows.some((r) => !r.order_line_id)) return true
  const { data: ls } = await inChunks(lineIds, (c) => supabase.from('work_order_work').select('order_id').in('id', c))
  const { data: os } = await inChunks([...new Set(ls.map((l) => l.order_id))], (c) => supabase.from('work_order').select('status').in('id', c))
  return os.some((o) => !ORDER_DEAD.includes(o.status))
}

const SHIP_FIELDS = ['carrier', 'tracking_no', 'tracking_url', 'packed_dims', 'packed_weight_kg', 'packing_note', 'insured_value', 'insurer', 'policy_ref', 'cost', 'handed_to', 'pickup_process_id'] as const
type ShipField = (typeof SHIP_FIELDS)[number]
const NUMERIC_FIELDS: ShipField[] = ['packed_weight_kg', 'insured_value', 'cost']

export async function patchShipment(id: string, field: ShipField, value: string | null): Promise<Ok | Err> {
  const g = await guard()
  if ('error' in g) return g
  if (!SHIP_FIELDS.includes(field)) return { error: 'cas_err_step' }
  const v = value == null || value.trim() === '' ? null
    : NUMERIC_FIELDS.includes(field) ? Number(value.replace(',', '.')) : value.trim()
  if (typeof v === 'number' && !Number.isFinite(v)) return { error: 'cas_err_step' }
  const { error } = await g.supabase.from('shipment').update({ [field]: v }).eq('id', id)
  if (error) return { error: error.message }
  done()
  return { ok: true }
}

export type AdvanceShipmentResult = { ok: true; moved: string[]; waiting: string[] } | Err

/** The next step of the checklist. « Packed » waits for every prep demand; « Delivered » moves the orders on. */
export async function advanceShipment(id: string, to: ShipmentStatus): Promise<AdvanceShipmentResult> {
  const g = await guard()
  if ('error' in g) return g
  const { supabase } = g
  const { data: s, error } = await supabase.from('shipment').select('id, kind, status').eq('id', id).single()
  if (error || !s) return { error: error?.message ?? 'not_found' }
  const kind = s.kind as ShipmentKind
  if (nextShipStep(kind, s.status as ShipmentStatus) !== to) return { error: 'cas_err_step' }

  const [view] = await expandShipments(supabase, [{ ...(s as unknown as ShipRow) }], { liveOnly: true })
  const stepIdx = SHIP_STEPS[kind].indexOf(to)
  if (kind !== 'return' && stepIdx >= SHIP_STEPS[kind].indexOf('packed') && view.open_demands > 0) {
    return { error: `cas_err_open_demands:${view.open_demands}` }
  }

  const { error: upErr } = await supabase.from('shipment').update({ status: to }).eq('id', id)
  if (upErr) return { error: upErr.message }
  await logSystemEvent({ eventType: 'STATUS_CHANGE', tableName: 'shipment', rowId: id, oldValue: s.status, newValue: to, metadata: { orders: view.orders.map((o) => o.ref) } })

  const moved: string[] = []
  const waiting: string[] = []
  if (to === 'delivered') {
    for (const ord of view.orders) {
      const r = await moveOrderAfterDelivery(supabase, ord.id, kind)
      if (r === 'moved') moved.push(ord.ref ?? ord.id)
      else if (r === 'waiting') waiting.push(ord.ref ?? ord.id)
    }
  }
  done()
  return { ok: true, moved, waiting }
}

/** All active works of the order arrived (on delivered shipments of that direction) → the order's own step. */
async function moveOrderAfterDelivery(supabase: Supa, orderId: string, shipKind: ShipmentKind): Promise<'moved' | 'waiting' | 'none'> {
  const { data: o } = await supabase.from('work_order').select('id, kind, status').eq('id', orderId).single()
  if (!o) return 'none'
  const { data: lines } = await supabase.from('work_order_work').select('id').eq('order_id', orderId).eq('line_status', 'active')
  const lineIds = (lines ?? []).map((l) => l.id)
  if (lineIds.length === 0) return 'none'
  const { data: sw } = await supabase.from('shipment_work').select('order_line_id, shipment:shipment!shipment_work_shipment_id_fkey(kind, status)').in('order_line_id', lineIds)
  const arrived = new Set((sw ?? []).filter((r) => {
    const s = r.shipment as unknown as { kind: string; status: string } | null
    return s && s.status === 'delivered' && (s.kind === 'return') === (shipKind === 'return')
  }).map((r) => r.order_line_id))
  if (!lineIds.every((l) => arrived.has(l))) return 'waiting'

  const kind = o.kind as WorkOrderKind
  const to = shipKind === 'return'
    ? (o.status === 'out' ? 'closed' : null)
    : kind === 'sale' ? (o.status === 'paid' ? 'delivered' : null)
    : kind === 'gift' ? (o.status === 'signed' ? 'handed_over' : null)
    : kind === 'entrusted' ? (o.status === 'draft' ? 'out' : null)
    : (o.status === 'signed' ? 'out' : null)
  if (!to) return 'waiting'
  const r = await advanceWorkOrder(orderId, to)
  if ('error' in r) {
    await logError('Order step after delivery failed', r.error, { source: 'cascade.moveOrderAfterDelivery', metadata: { orderId, to } })
    return 'waiting'
  }
  return 'moved'
}

export async function cancelShipment(id: string): Promise<Ok | Err> {
  const g = await guard()
  if ('error' in g) return g
  const { data: s } = await g.supabase.from('shipment').select('status').eq('id', id).single()
  if (!s || SHIP_DONE.includes(s.status as ShipmentStatus) || s.status === 'shipped') return { error: 'cas_err_step' }
  const { error } = await g.supabase.from('shipment').update({ status: 'cancelled' }).eq('id', id)
  if (error) return { error: error.message }
  done()
  return { ok: true }
}

// ── COA at payment ───────────────────────────────────────────────────────────────────────────────

/**
 * One certificate per work of a sale (Pem 2026-11-18: made at « Paid », put in the crate). Lines that
 * already have one are skipped; failures are logged, the order step is never undone for them.
 */
export async function makeOrderCoas(orderId: string): Promise<{ ok: true; made: number } | Err> {
  const g = await guard()
  if ('error' in g) return g
  const { supabase } = g
  const { data: o } = await supabase.from('work_order').select('kind').eq('id', orderId).single()
  if (!o || o.kind !== 'sale') return { error: 'cas_err_step' }
  const { data: lines } = await supabase.from('work_order_work').select('id, oeuvre_id').eq('order_id', orderId)
    .in('line_status', ['active', 'sold']).is('coa_document_id', null)
  let made = 0
  for (const l of lines ?? []) {
    const res = await generateCOA(l.oeuvre_id)
    if ('error' in res) {
      await logError('COA at payment failed', res.error, { source: 'cascade.makeOrderCoas', metadata: { orderId, oeuvreId: l.oeuvre_id } })
      continue
    }
    await supabase.from('work_order_work').update({ coa_document_id: res.doc.id }).eq('id', l.id)
    await supabase.from('document').update({ work_order_id: orderId }).eq('id', res.doc.id)
    made++
  }
  done()
  return { ok: true, made }
}

// ── Invoices ─────────────────────────────────────────────────────────────────────────────────────

const VAULT_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

async function putInvoicePdf(key: string, body: Buffer, invoiceId: string) {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID ?? ''}.eu.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '', secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '' },
  })
  await s3.send(new PutObjectCommand({ Bucket: VAULT_BUCKET, Key: key, Body: body, ContentType: 'application/pdf' }))
  await recordStorageObject({
    bucket: VAULT_BUCKET, objectKey: key, sizeBytes: body.length, contentType: 'application/pdf',
    source: 'invoice_paper', classification: 'linked',
    linkedRefs: [{ table: 'invoice', column: 'paper_path', row_id: invoiceId }, { table: 'document', column: 'storage_path' }],
  })
}

async function partyBlock(supabase: Supa, contactId: number, addressId: number | null): Promise<{ name: string; lines: string[] }> {
  const [c, a] = await Promise.all([
    supabase.from('Contact').select('NomInstitution, Nom, "Prénom", Ville, Pays').eq('ContactID', contactId).single(),
    addressId
      ? placeAddressLine(supabase, addressId).then((data) => ({ data }))
      : contactId === PEM
        ? supabase.from('contact_place_lines').select('adresse, code_postal, ville, pays, complement').eq('contact_id', PEM).ilike('label', 'principal').order('position').limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
  ])
  // Invoice paper: the institution is the party when there is one (as before); a person reads « Marie DUPONT ».
  const name = c.data ? contactProseLabel(c.data, { institution: 'prefer', fallback: '' }) : `#${contactId}`
  const ad = a.data as { adresse: string | null; code_postal: string | null; ville: string | null; pays: string | null; complement: string | null } | null
  const lines = ad
    ? [ad.adresse, ad.complement, [ad.code_postal, ad.ville].filter(Boolean).join(' '), ad.pays].filter((x): x is string => !!x && !!x.trim())
    : [[c.data?.Ville, c.data?.Pays].filter(Boolean).join(', ')].filter(Boolean)
  return { name: name || `#${contactId}`, lines }
}

async function writeInvoicePaper(
  supabase: Supa,
  inv: { id: string; kind: 'invoice' | 'credit_note'; number: string; issued_on: string; party_id: number; total: number; currency: string; lines: InvoiceLine[]; vat_mention: string | null },
  partyAddressId: number | null, creditsNumber: string | null, paid: number, firstOrderId: string | null,
): Promise<string | null> {
  const [artist, party] = await Promise.all([partyBlock(supabase, PEM, null), partyBlock(supabase, inv.party_id, partyAddressId)])
  const pdf = await buildInvoicePaper({
    kind: inv.kind, number: inv.number, issuedOn: inv.issued_on, creditsNumber,
    artist: { ...artist, siret: STUDIO_SIRET }, party, lines: inv.lines, total: inv.total, currency: inv.currency,
    vatMention: inv.vat_mention, paid,
  })
  const key = `factures/${inv.number}_${inv.kind === 'credit_note' ? 'avoir' : 'facture'}.pdf`
  try {
    await putInvoicePdf(key, pdf, inv.id)
  } catch (e) {
    await logError('Invoice PDF upload failed', e, { source: 'cascade.writeInvoicePaper', metadata: { number: inv.number } })
    return null
  }
  await supabase.from('invoice').update({ paper_path: key }).eq('id', inv.id)
  await supabase.from('document').insert({
    name: `${inv.number} · ${inv.kind === 'credit_note' ? 'Avoir' : 'Facture'}`, kind: 'facture', folder: VAULT_FOLDER_INVOICES,
    doc_date: inv.issued_on, storage_path: key, file_size: pdf.length, mime_type: 'application/pdf',
    contact_id: inv.party_id, work_order_id: firstOrderId,
  })
  return key
}

/** One invoice for one or more paid sales of the same buyer. Admin only; the number is final. */
export async function issueInvoice(orderIds: string[]): Promise<{ ok: true; number: string } | Err> {
  const g = await guard(true)
  if ('error' in g) return g
  const { supabase } = g
  const ids = [...new Set(orderIds)].filter((x) => UUID_RE.test(x))
  if (ids.length === 0) return { error: 'cas_err_step' }

  const { data: orders, error } = await supabase.from('work_order')
    .select('id, ref, kind, status, party_id, place_id, currency, price_final, shipping_charge').in('id', ids)
  if (error || !orders || orders.length !== ids.length) return { error: error?.message ?? 'not_found' }
  const party = orders[0].party_id
  if (orders.some((o) => o.kind !== 'sale' || o.party_id !== party || !(INVOICE_FROM_STATUS as readonly string[]).includes(o.status))) {
    return { error: 'cas_invoice_wait' }
  }
  const currency = orders[0].currency

  const { data: lines } = await supabase.from('work_order_work').select('id, order_id, oeuvre_id, position').in('order_id', ids).in('line_status', ['active', 'sold']).order('position')
  const oids = [...new Set((lines ?? []).map((l) => l.oeuvre_id))]
  const lineIds = (lines ?? []).map((l) => l.id)
  const [worksRes, demandsRes, paysRes] = await Promise.all([
    oids.length ? supabase.from('Oeuvres').select('OeuvreID, Titre, "Année", Hauteur, Largeur').in('OeuvreID', oids) : Promise.resolve({ data: [] as { OeuvreID: number; Titre: string | null; Année: string | null; Hauteur: number | null; Largeur: number | null }[] }),
    lineIds.length ? supabase.from('work_order_demand').select('line_id, kind, note, price').in('line_id', lineIds) : Promise.resolve({ data: [] as { line_id: string; kind: string; note: string | null; price: number | null }[] }),
    supabase.from('payments').select('amount, work_order_id, refunded_at').in('work_order_id', ids),
  ])
  const work = new Map((worksRes.data ?? []).map((w) => [w.OeuvreID, w]))
  const DEMAND_FR: Record<string, string> = { framing: 'Encadrement / Framing', mounting: 'Montage / Mounting', dedication: 'Dédicace / Dedication' }

  const invLines: InvoiceLine[] = []
  for (const o of orders) {
    for (const l of (lines ?? []).filter((x) => x.order_id === o.id)) {
      const w = work.get(l.oeuvre_id)
      const year = w?.Année ? String(w.Année).slice(0, 4) : null
      const dims = w?.Hauteur && w?.Largeur ? `${w.Hauteur} × ${w.Largeur} cm` : null
      invLines.push({ type: 'work', orderRef: o.ref, label: `#${l.oeuvre_id} ${w?.Titre ?? 'Sans titre'}${year ? ` (${year})` : ''}`, detail: dims, amount: null })
      for (const d of (demandsRes.data ?? []).filter((x) => x.line_id === l.id && x.price != null && Number(x.price) > 0)) {
        invLines.push({ type: 'demand', orderRef: o.ref, label: `${DEMAND_FR[d.kind] ?? d.kind} — #${l.oeuvre_id}`, detail: d.note, amount: Number(d.price) })
      }
    }
    invLines.push({ type: 'price', orderRef: o.ref, label: 'Prix convenu des œuvres / Agreed price of the works', amount: Number(o.price_final ?? 0) })
    if (o.shipping_charge != null && Number(o.shipping_charge) > 0) {
      invLines.push({ type: 'shipping', orderRef: o.ref, label: 'Expédition et assurance / Shipping and insurance', amount: Number(o.shipping_charge) })
    }
  }
  const total = Math.round(invLines.reduce((s, l) => s + (l.amount ?? 0), 0) * 100) / 100
  const paid = (paysRes.data ?? []).filter((p) => !p.refunded_at).reduce((s, p) => s + Number(p.amount), 0)

  const { data: inv, error: invErr } = await supabase.from('invoice').insert({
    kind: 'invoice', party_id: party, currency, lines: invLines as unknown as never, total, vat_mention: INVOICE_VAT_MENTION,
  }).select('id, number, issued_on').single()
  if (invErr || !inv) return { error: invErr?.message ?? 'insert' }
  const { error: ioErr } = await supabase.from('invoice_order').insert(ids.map((order_id) => ({ invoice_id: inv.id, order_id })))
  if (ioErr) {
    // The number exists and is never freed: the invoice stays, without orders, and says so in its notes.
    await supabase.from('invoice').update({ notes: `Commandes non rattachées : ${ioErr.message}` }).eq('id', inv.id)
    return { error: ioErr.message }
  }
  await writeInvoicePaper(supabase, { id: inv.id, kind: 'invoice', number: inv.number!, issued_on: inv.issued_on, party_id: party, total, currency, lines: invLines, vat_mention: INVOICE_VAT_MENTION },
    orders[0].place_id, null, paid, ids[0])
  await logSystemEvent({ eventType: 'STATUS_CHANGE', tableName: 'invoice', rowId: inv.id, newValue: 'issued', metadata: { number: inv.number, orders: orders.map((o) => o.ref), total } })
  done()
  return { ok: true, number: inv.number! }
}

/** Cancel an invoice by a credit note (the numbers never change). Admin only. */
export async function creditInvoice(invoiceId: string): Promise<{ ok: true; number: string } | Err> {
  const g = await guard(true)
  if ('error' in g) return g
  const { supabase } = g
  const { data: inv } = await supabase.from('invoice').select('id, kind, number, party_id, currency, lines, total').eq('id', invoiceId).single()
  if (!inv || inv.kind !== 'invoice') return { error: 'cas_err_step' }
  const { data: already } = await supabase.from('invoice').select('id').eq('credits_invoice_id', invoiceId).limit(1)
  if (already?.length) return { error: 'cas_err_step' }
  const lines = ((inv.lines ?? []) as unknown as InvoiceLine[]).map((l) => ({ ...l, amount: l.amount == null ? null : -l.amount }))
  const total = -Number(inv.total)
  const { data: cn, error } = await supabase.from('invoice').insert({
    kind: 'credit_note', party_id: inv.party_id, currency: inv.currency, lines: lines as unknown as never, total,
    credits_invoice_id: inv.id, vat_mention: INVOICE_VAT_MENTION,
  }).select('id, number, issued_on').single()
  if (error || !cn) return { error: error?.message ?? 'insert' }
  const { data: io } = await supabase.from('invoice_order').select('order_id').eq('invoice_id', invoiceId).limit(1)
  await writeInvoicePaper(supabase, { id: cn.id, kind: 'credit_note', number: cn.number!, issued_on: cn.issued_on, party_id: inv.party_id, total, currency: inv.currency, lines, vat_mention: INVOICE_VAT_MENTION },
    null, inv.number, 0, io?.[0]?.order_id ?? null)
  await logSystemEvent({ eventType: 'STATUS_CHANGE', tableName: 'invoice', rowId: cn.id, newValue: 'credit_note', metadata: { number: cn.number, credits: inv.number } })
  done()
  return { ok: true, number: cn.number! }
}

// ── Calendar ─────────────────────────────────────────────────────────────────────────────────────

const CAL_KEY: Record<OrderDateKey, DictKey> = { start: 'cas_cal_start', end: 'cas_cal_end', delivery: 'cas_cal_delivery', return_end: 'cas_cal_return_end' }
const calLabels = (): OrderSyncLabels => {
  const f = (k: OrderDateKey) => (ref: string, party: string) => resolveMessage('fr', CAL_KEY[k]).replace('{ref}', ref).replace('{party}', party)
  return { start: f('start'), end: f('end'), delivery: f('delivery'), return_end: f('return_end') }
}

/** The order's dates in the calendars of the person acting (button in the order). */
export async function pushOrderToCalendars(orderId: string): Promise<{ ok: true; pushed: number } | Err> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }
  const r = await syncOrderToCalendars(supabase, user.id, orderId, calLabels())
  if (!r.ok) return { error: r.message === 'calendar_err_no_accounts' ? 'cas_cal_no_account' : r.message }
  return { ok: true, pushed: r.pushed }
}

/** Best effort after an order changes (created, a step, cancelled): no calendar = nothing, a failure is logged. */
export async function syncOrderCalendarQuietly(orderId: string): Promise<void> {
  const r = await pushOrderToCalendars(orderId)
  if ('error' in r && r.error !== 'cas_cal_no_account') {
    await logError('Order calendar sync failed', r.error, { source: 'cascade.syncOrderCalendarQuietly', metadata: { orderId } })
  }
}

// ── Claims ───────────────────────────────────────────────────────────────────────────────────────

export async function addClaim(input: {
  oeuvreId: number; shipmentId: string | null; orderId: string | null; insurer: string
  claimRef: string | null; policeRef: string | null; amountClaimed: number | null
}): Promise<Ok | Err> {
  const g = await guard()
  if ('error' in g) return g
  if (!input.insurer.trim()) return { error: 'cas_claim_insurer' }
  const { error } = await g.supabase.from('insurance_claim').insert({
    oeuvre_id: input.oeuvreId, shipment_id: input.shipmentId, work_order_id: input.orderId,
    insurer: input.insurer.trim(), claim_ref: input.claimRef?.trim() || null, police_report_ref: input.policeRef?.trim() || null,
    amount_claimed: input.amountClaimed, filed_on: new Date().toISOString().slice(0, 10),
  })
  if (error) return { error: error.message }
  done()
  return { ok: true }
}

export async function setClaimStatus(id: string, status: 'open' | 'paid' | 'refused' | 'withdrawn', amountPaid: number | null): Promise<Ok | Err> {
  const g = await guard()
  if ('error' in g) return g
  const { error } = await g.supabase.from('insurance_claim').update({
    status, amount_paid: status === 'paid' ? amountPaid : null, paid_on: status === 'paid' ? new Date().toISOString().slice(0, 10) : null,
  }).eq('id', id)
  if (error) return { error: error.message }
  done()
  return { ok: true }
}
