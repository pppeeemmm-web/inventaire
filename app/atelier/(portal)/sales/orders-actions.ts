'use server'

// Orders screen — read + write (TODO R7, docs/design/2026-11-17/R7_Orders.notes.md).
// One list for sale / consignment / loan / gift (`work_order` + `work_order_work`, SQL
// supabase/sql/work_order.sql). Writes: create a draft, move a step, cancel (slice 2).

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logSystemEvent } from '@/lib/utils/logging'
import { logError } from '@/lib/error-reporter/server'
import { circulationError, CONSIGN_FROM, SALE_ORDER_FROM } from '@/lib/work-circulation'
import { appendHistoriqueForOeuvres, historiqueLinesForOeuvreUpdate } from '@/lib/oeuvre-historique'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { recordStorageObject } from '@/lib/storage-object-ledger'
import { ORDER_KEY_PREFIX, VAULT_ORDER_FOLDERS } from '@/lib/vault/folder-routing'
import { buildOrderPaper, PAPER_SLUG, PAPER_TITLE, type PaperParty } from '@/lib/orders/order-paper'
import { addCalendarDaysIso } from '@/lib/sale-return-window'
import { resolveMessage } from '@/lib/i18n/resolve-message'
import { ENTRUSTED_LIVE } from '@/lib/orders/kinds'

/** « entrusted » = « Confié » (framer, restorer…): needs supabase/sql/work_order_r7_decisions.sql first (lib/orders/kinds.ts). */
export type WorkOrderKind = 'sale' | 'consignment' | 'loan' | 'gift' | 'entrusted'

export interface WorkOrderLineView {
  oeuvre_id: number
  title: string | null
  image: string | null
  line_status: string
  /** Agreed price (consignment), insurance value (loan, entrusted) or reference value (gift — never printed). */
  value: number | null
}

export interface WorkOrderPaperView {
  id: string
  name: string
  storage_path: string | null
  folder: string | null
}

export interface WorkOrderPaymentView {
  id: string
  amount: number
  payment_date: string
  method: string | null
}

export interface WorkOrderView {
  id: string
  ref: string | null
  kind: WorkOrderKind
  status: string
  reconstituted: boolean
  party_id: number
  party_name: string
  party_place: string
  created_at: string
  start_date: string | null
  end_date: string | null
  signed_at: string | null
  paid_at: string | null
  delivered_at: string | null
  returned_at: string | null
  cancelled_at: string | null
  currency: string
  price_final: number | null
  deposit_pct: number | null
  commission_pct: number | null
  notes: string | null
  paper_path: string | null
  /** The Pipeline process or exhibition the order came from. */
  process_id: string | null
  works: WorkOrderLineView[]
  papers: WorkOrderPaperView[]
  /** Money received (sale), newest first; counted in Revenue & expenses. */
  payments: WorkOrderPaymentView[]
  paid_total: number
}

export type FetchWorkOrdersResult = { ok: true; orders: WorkOrderView[] } | { error: string }

export async function fetchWorkOrders(): Promise<FetchWorkOrdersResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }

  const { data: orders, error } = await supabase
    .from('work_order')
    .select('id, ref, kind, status, reconstituted, party_id, created_at, start_date, end_date, signed_at, paid_at, delivered_at, returned_at, cancelled_at, currency, price_final, deposit_pct, commission_pct, notes, paper_path, process_id')
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  if (!orders || orders.length === 0) return { ok: true, orders: [] }

  const orderIds = orders.map((o) => o.id)
  const partyIds = [...new Set(orders.map((o) => o.party_id))]

  const [linesRes, partiesRes, papersRes, paymentsRes] = await Promise.all([
    supabase.from('work_order_work').select('order_id, oeuvre_id, line_status, position, price, insurance_value').in('order_id', orderIds),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom", Ville, Pays').in('ContactID', partyIds),
    supabase.from('document').select('id, name, storage_path, folder, work_order_id').in('work_order_id', orderIds),
    supabase.from('payments').select('id, amount, payment_date, method, work_order_id').in('work_order_id', orderIds).order('payment_date', { ascending: false }),
  ])
  if (linesRes.error) return { error: linesRes.error.message }
  if (partiesRes.error) return { error: partiesRes.error.message }
  if (papersRes.error) return { error: papersRes.error.message }
  if (paymentsRes.error) return { error: paymentsRes.error.message }

  const lines = linesRes.data ?? []
  const oeuvreIds = [...new Set(lines.map((l) => l.oeuvre_id))]
  const worksRes = oeuvreIds.length
    ? await supabase.from('Oeuvres').select('OeuvreID, Titre, txtImageNameLink').in('OeuvreID', oeuvreIds)
    : { data: [], error: null }
  if (worksRes.error) return { error: worksRes.error.message }

  const workById = new Map((worksRes.data ?? []).map((w) => [w.OeuvreID, w]))
  const partyById = new Map((partiesRes.data ?? []).map((c) => [c.ContactID, c]))

  const view: WorkOrderView[] = orders.map((o) => {
    const c = partyById.get(o.party_id)
    const name = c
      ? (c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || `#${o.party_id}`)
      : `#${o.party_id}`
    const place = c ? [c.Ville, c.Pays].filter(Boolean).join(', ') : ''
    const works = lines
      .filter((l) => l.order_id === o.id)
      .sort((a, b) => a.position - b.position || a.oeuvre_id - b.oeuvre_id)
      .map((l) => {
        const w = workById.get(l.oeuvre_id)
        const value = o.kind === 'consignment' ? (l.price ?? l.insurance_value) : o.kind === 'sale' ? l.price : l.insurance_value
        return { oeuvre_id: l.oeuvre_id, title: w?.Titre ?? null, image: w?.txtImageNameLink ?? null, line_status: l.line_status, value: value == null ? null : Number(value) }
      })
    const papers = (papersRes.data ?? [])
      .filter((d) => d.work_order_id === o.id)
      .map((d) => ({ id: d.id, name: d.name, storage_path: d.storage_path, folder: d.folder }))
    const payments = (paymentsRes.data ?? [])
      .filter((p) => p.work_order_id === o.id)
      .map((p) => ({ id: p.id, amount: Number(p.amount), payment_date: p.payment_date, method: p.method }))
    return {
      ...o,
      kind: o.kind as WorkOrderKind,
      party_name: name,
      party_place: place,
      works,
      papers,
      payments,
      paid_total: payments.reduce((sum, p) => sum + p.amount, 0),
    }
  })

  return { ok: true, orders: view }
}

// ── Writes (R7 slice 2) ─────────────────────────────────────────────────────────────────────
// Every step follows docs/WORK_CUSTODY_MODEL.md: the order step is written first (the DB custody
// check `oeuvre_holder_check` looks for it), then the works move and get a history line.
// If the works refuse to move, the order goes back to the step it was on.


const PEM = 13
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Supa = Awaited<ReturnType<typeof createClient>>
export type OrderWriteResult = { ok: true; id: string; ref: string | null } | { error: string }
export type SimpleOrderResult = { ok: true } | { error: string }

/** Works a gift may come from (as the former gift dialog): available, reserved, consigned, lent. */
const GIFT_FROM = [2, 4, 7, 8] as const
/** A work may go to a framer / restorer from the studio, available or archived — it keeps its stage. */
const ENTRUST_FROM = [1, 2, 3] as const
const CUSTODY_KINDS: WorkOrderKind[] = ['consignment', 'loan', 'entrusted']

/** Allowed next steps per kind (cancel handled apart). */
const NEXT: Record<WorkOrderKind, Record<string, string[]>> = {
  sale: { draft: ['signed'], signed: ['deposit_paid', 'paid'], deposit_paid: ['paid'], paid: ['delivered'] },
  consignment: { draft: ['signed'], signed: ['out'], out: ['closed'] },
  loan: { draft: ['signed'], signed: ['out'], out: ['closed'] },
  gift: { draft: ['signed'], signed: ['handed_over'] },
  entrusted: { draft: ['out'], out: ['closed'] },
}
const CANCEL_FROM: Record<WorkOrderKind, string[]> = {
  sale: ['draft', 'signed', 'deposit_paid'],
  consignment: ['draft', 'signed'],
  loan: ['draft', 'signed'],
  // Ownership moves at hand-over (don manuel, Pem 2026-11-17): a signed deed can still be cancelled.
  gift: ['draft', 'signed'],
  entrusted: ['draft'],
}

async function guardTeam(): Promise<{ supabase: Supa } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' }
  return { supabase }
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

/** Work ids already on another open order of the same family (sale / gift vs consignment / loan). */
async function busyWorks(supabase: Supa, ids: number[], kind: WorkOrderKind): Promise<number[]> {
  const family = kind === 'sale' || kind === 'gift' ? ['sale', 'gift'] : CUSTODY_KINDS
  const { data } = await supabase
    .from('work_order_work')
    .select('oeuvre_id, line_status, work_order!work_order_work_order_id_fkey(kind, status)')
    .in('oeuvre_id', ids)
    .eq('line_status', 'active')
  const open = (data ?? []).filter((r) => {
    const o = r.work_order as unknown as { kind: string; status: string } | null
    return o && family.includes(o.kind) && !['closed', 'cancelled', 'delivered', 'handed_over'].includes(o.status)
  })
  return [...new Set(open.map((r) => r.oeuvre_id))]
}

// ── Date reminders (Pem 2026-11-17: « a reminder when the dates are getting closer … drafts ready
// to go out ») ── A consignment / loan gets two reminders (Field reminders, Today): a week before it
// goes out (is it signed, is the paper ready?) and a week before it is due back. They start with
// « <REF> — sortie » / « <REF> — retour » so the order's steps can close them: « Sortie » closes the
// first, « Rentré » and a cancel close both.
const REMIND_DAYS_BEFORE = 7

function reminderDay(date: string | null, today: string): string | null {
  if (!date || date < today) return null
  const d = addCalendarDaysIso(date, -REMIND_DAYS_BEFORE)
  return d < today ? today : d
}

async function scheduleDateReminders(supabase: Supa, orderId: string): Promise<void> {
  const { data: o } = await supabase.from('work_order').select('ref, kind, start_date, end_date, process_id, party_id').eq('id', orderId).single()
  if (!o?.ref || !CUSTODY_KINDS.includes(o.kind as WorkOrderKind)) return
  const { data: c } = await supabase.from('Contact').select('*').eq('ContactID', o.party_id).maybeSingle()
  const contact = c as { NomInstitution: string | null; Nom: string | null; Prénom: string | null } | null
  const party = contact ? (contact.NomInstitution || [contact.Prénom, contact.Nom].filter(Boolean).join(' ').trim()) : `#${o.party_id}`
  const kind = resolveMessage('fr', o.kind === 'loan' ? 'ord_kind_loan' : o.kind === 'entrusted' ? 'ord_kind_entrusted' : 'ord_kind_consignment')
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const today = new Date().toISOString().slice(0, 10)
  const rows: { process_id: string | null; message: string; remind_at: string }[] = []
  const outAt = reminderDay(o.start_date, today)
  if (outAt && o.start_date) {
    rows.push({ process_id: o.process_id, remind_at: outAt, message: resolveMessage('fr', 'ord_reminder_out').replace('{ref}', o.ref).replace('{date}', day(o.start_date)).replace('{kind}', kind).replace('{party}', party) })
  }
  const backAt = reminderDay(o.end_date, today)
  if (backAt && o.end_date) {
    rows.push({ process_id: o.process_id, remind_at: backAt, message: resolveMessage('fr', 'ord_reminder_back').replace('{ref}', o.ref).replace('{date}', day(o.end_date)).replace('{party}', party) })
  }
  if (!rows.length) return
  const { error } = await supabase.from('suivi_reminder').insert(rows)
  if (error) await logError('Order date reminders not written', error.message, { source: 'orders.scheduleDateReminders', metadata: { orderId } })
  else revalidateTag('reminders')
}

/** Mark the order's date reminders done: « out » (it went out) or « all » (back / cancelled). */
async function closeDateReminders(supabase: Supa, ref: string | null, which: 'out' | 'all'): Promise<void> {
  if (!ref) return
  const prefix = which === 'out' ? `${ref} — sortie` : `${ref} — `
  const { error } = await supabase.from('suivi_reminder').update({ lu: true }).like('message', `${prefix.replace(/[%_]/g, '')}%`).eq('lu', false)
  if (error) await logError('Order date reminders not closed', error.message, { source: 'orders.closeDateReminders', metadata: { ref, which } })
  else revalidateTag('reminders')
}

export async function createWorkOrder(formData: FormData): Promise<OrderWriteResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g

  const kind = String(formData.get('kind') ?? '') as WorkOrderKind
  if (!['sale', 'consignment', 'loan', 'gift', ...(ENTRUSTED_LIVE ? ['entrusted'] : [])].includes(kind)) return { error: 'ord_err_kind' }
  // Existence is checked by circulationError below (test works may have negative numbers).
  const oeuvreIds = [...new Set(formData.getAll('oeuvre_ids').map(Number).filter((n) => Number.isInteger(n) && n !== 0))]
  if (oeuvreIds.length === 0) return { error: 'ord_err_no_work' }
  const partyId = numOrNull(formData.get('party_id'))
  if (!partyId || partyId === PEM) return { error: 'holder_required' }
  let addressId = numOrNull(formData.get('address_id'))
  // A deposit or a loan always says when the works go out and come back (Pem 2026-11-17).
  const startDate = strOrNull(formData.get('start_date'))
  const endDate = strOrNull(formData.get('end_date'))
  if (CUSTODY_KINDS.includes(kind)) {
    if (!startDate || !endDate) return { error: 'ord_err_dates' }
    if (endDate < startDate) return { error: 'ord_err_dates_order' }
  }

  // A sale states its price: « Encaisser » compares the money received with it.
  const priceFinal = kind === 'sale' ? numOrNull(formData.get('price_final')) : null
  if (kind === 'sale' && !(priceFinal && priceFinal > 0)) return { error: 'ord_err_price' }
  // The Pipeline process or exhibition the order comes from (kept as a link, not a copy).
  const processId = strOrNull(formData.get('process_id'))
  if (processId && !UUID_RE.test(processId)) return { error: 'ord_err_process' }

  const allowed = kind === 'sale' ? SALE_ORDER_FROM : kind === 'gift' ? GIFT_FROM : kind === 'entrusted' ? ENTRUST_FROM : CONSIGN_FROM
  const circ = await circulationError(supabase, oeuvreIds, allowed)
  if (circ) return { error: circ }
  const busy = await busyWorks(supabase, oeuvreIds, kind)
  if (busy.length) return { error: `ord_err_busy:${busy.map((n) => `#${n}`).join(', ')}` }
  const { data: prices } = await supabase.from('Oeuvres').select('OeuvreID, Prix').in('OeuvreID', oeuvreIds)
  const priceOf = new Map((prices ?? []).map((w) => [w.OeuvreID, w.Prix == null ? null : Number(w.Prix)]))

  if (addressId) {
    const { data: addr } = await supabase.from('contact_addresses').select('contact_id').eq('id', addressId).maybeSingle()
    if (!addr || addr.contact_id !== partyId) return { error: 'ord_err_address' }
  } else {
    // No address given (Pipeline, Exhibitions, phone): a party with a single address gets it, as in the form.
    const { data: addrs } = await supabase.from('contact_addresses').select('id').eq('contact_id', partyId).limit(2)
    if (addrs?.length === 1) addressId = addrs[0].id
  }

  const { data: order, error } = await supabase
    .from('work_order')
    .insert({
      kind,
      party_id: partyId,
      address_id: addressId,
      start_date: startDate,
      end_date: endDate,
      price_catalogue: kind === 'sale' ? numOrNull(formData.get('price_catalogue')) : null,
      discount_pct: kind === 'sale' ? numOrNull(formData.get('discount_pct')) : null,
      price_final: priceFinal,
      deposit_pct: kind === 'sale' ? numOrNull(formData.get('deposit_pct')) : null,
      commission_pct: kind === 'consignment' ? numOrNull(formData.get('commission_pct')) : null,
      notes: strOrNull(formData.get('notes')),
      process_id: processId,
    })
    .select('id, ref')
    .single()
  if (error || !order) return { error: error?.message ?? 'Insert failed' }

  const { error: linesErr } = await supabase
    .from('work_order_work')
    .insert(oeuvreIds.map((oeuvre_id, position) => {
      // Per-line value (Pem 2026-11-17): the work's price that day unless typed in the form.
      // Consignment → agreed price (also its insurance value); loan / entrusted → insurance value;
      // gift → reference value, kept for the record and never printed on the deed.
      const v = kind === 'sale' ? null : numOrNull(formData.get(`line_value_${oeuvre_id}`)) ?? priceOf.get(oeuvre_id) ?? null
      return {
        order_id: order.id, oeuvre_id, position,
        price: kind === 'consignment' ? v : null,
        insurance_value: kind === 'sale' ? null : v,
      }
    }))
  if (linesErr) {
    await supabase.from('work_order').update({ status: 'cancelled', notes: `Annulée : œuvres non ajoutées (${linesErr.message})` }).eq('id', order.id)
    return { error: linesErr.message }
  }

  await logSystemEvent({ eventType: 'ORDER_CREATED', tableName: 'work_order', rowId: order.id, metadata: { ref: order.ref, kind, works: oeuvreIds } })
  // The draft comes with its paper (« Brouillon » printed on it); a failure here leaves the
  // order as it is — « Refaire le papier » makes it again.
  const paper = await makeOrderPaper(order.id)
  if ('error' in paper) {
    await logError('Order paper failed at creation', paper.error, { source: 'orders.createWorkOrder', metadata: { orderId: order.id, ref: order.ref } })
  }
  if (CUSTODY_KINDS.includes(kind)) await scheduleDateReminders(supabase, order.id)
  revalidatePath('/atelier/sales')
  if (processId) revalidatePath('/atelier/pipeline')
  return { ok: true, id: order.id, ref: order.ref }
}

type OrderRow = {
  id: string; kind: WorkOrderKind; status: string; party_id: number; address_id: number | null
  end_date: string | null; price_final: number | null; ref: string | null
}
type WorkRow = { OeuvreID: number; statusId: number | null; ContactID: number | null; LocalisationID: number | null }

/** Move the works of an order and write their history lines. */
async function moveWorks(
  supabase: Supa,
  ids: number[],
  patch: Record<string, unknown>,
  after: (w: WorkRow) => { statusId: number | null; contactId: number | null; localisationId: number | null },
): Promise<string | null> {
  if (ids.length === 0) return null
  const { data: before, error: readErr } = await supabase
    .from('Oeuvres').select('OeuvreID, statusId, ContactID, LocalisationID').in('OeuvreID', ids)
  if (readErr) return readErr.message
  const { error } = await supabase.from('Oeuvres').update(patch).in('OeuvreID', ids)
  if (error) return error.message
  const items: { oeuvreId: number; lines: string[] }[] = []
  for (const w of (before ?? []) as WorkRow[]) {
    const lines = await historiqueLinesForOeuvreUpdate(supabase, { statusId: w.statusId, ContactID: w.ContactID, LocalisationID: w.LocalisationID }, after(w))
    if (lines.length) items.push({ oeuvreId: w.OeuvreID, lines })
  }
  await appendHistoriqueForOeuvres(supabase, items)
  return null
}

export async function advanceWorkOrder(orderId: string, to: string): Promise<SimpleOrderResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g

  const { data: o, error: readErr } = await supabase
    .from('work_order').select('id, kind, status, party_id, address_id, end_date, price_final, ref').eq('id', orderId).single()
  if (readErr || !o) return { error: readErr?.message ?? 'Order not found' }
  const order = o as OrderRow
  if (!(NEXT[order.kind][order.status] ?? []).includes(to)) return { error: 'ord_err_step' }

  const { data: lineRows } = await supabase.from('work_order_work').select('oeuvre_id').eq('order_id', order.id).eq('line_status', 'active')
  const ids = (lineRows ?? []).map((l) => l.oeuvre_id)
  const party = order.party_id
  const today = new Date().toISOString().slice(0, 10)

  // Gates before anything is written (a work may have moved since the draft).
  if (order.kind === 'sale' && to === 'signed') {
    const circ = await circulationError(supabase, ids, SALE_ORDER_FROM)
    if (circ) return { error: circ }
  }
  if ((order.kind === 'consignment' || order.kind === 'loan') && to === 'out') {
    const circ = await circulationError(supabase, ids, CONSIGN_FROM)
    if (circ) return { error: circ }
  }
  if (order.kind === 'entrusted' && to === 'out') {
    const circ = await circulationError(supabase, ids, ENTRUST_FROM)
    if (circ) return { error: circ }
  }
  if (order.kind === 'gift' && (to === 'signed' || to === 'handed_over')) {
    const circ = await circulationError(supabase, ids, GIFT_FROM)
    if (circ) return { error: circ }
  }

  // Sale out of a deposit: the gallery's commission, stamped when paid.
  const extra: Record<string, unknown> = {}
  if (order.kind === 'sale' && to === 'paid' && ids.length) {
    const { data: dep } = await supabase
      .from('work_order_work')
      .select('order_id, work_order!work_order_work_order_id_fkey(id, kind, status, commission_pct)')
      .in('oeuvre_id', ids).eq('line_status', 'active')
    const parent = (dep ?? [])
      .map((r) => r.work_order as unknown as { id: string; kind: string; status: string; commission_pct: number | null } | null)
      .find((p) => p && p.kind === 'consignment' && p.status === 'out')
    if (parent) {
      extra.parent_order_id = parent.id
      if (parent.commission_pct && order.price_final) extra.commission_amount = Math.round(order.price_final * parent.commission_pct) / 100
    }
  }
  if (order.kind === 'sale' && to === 'delivered') extra.return_window_starts_at = today

  const { error: stepErr } = await supabase.from('work_order').update({ status: to, ...extra }).eq('id', order.id)
  if (stepErr) return { error: stepErr.message }

  let moveErr: string | null = null
  if (order.kind === 'sale' && to === 'signed') {
    moveErr = await moveWorks(supabase, ids, { statusId: 4, AcheteurID: party },
      // contactId names the line (« Réservé — <buyer> »); owner stays Pem until paid.
      (w) => ({ statusId: 4, contactId: party, localisationId: w.LocalisationID }))
  } else if (order.kind === 'sale' && to === 'paid') {
    moveErr = await moveWorks(supabase, ids, { statusId: 6, ContactID: party, AcheteurID: party },
      (w) => ({ statusId: 6, contactId: party, localisationId: w.LocalisationID }))
  } else if (order.kind === 'sale' && to === 'delivered') {
    moveErr = await moveWorks(supabase, ids, { LocalisationID: party, localisation_address_id: order.address_id },
      (w) => ({ statusId: w.statusId, contactId: party, localisationId: party }))
  } else if (order.kind === 'gift' && to === 'handed_over') {
    // Don manuel (Pem 2026-11-17): ownership and custody move together at hand-over. The price is
    // kept; the gift's reference value lives on its order line.
    moveErr = await moveWorks(supabase, ids,
      { statusId: 11, ContactID: party, AcheteurID: party, is_gift: true, LocalisationID: party, localisation_address_id: order.address_id },
      () => ({ statusId: 11, contactId: party, localisationId: party }))
  } else if (order.kind === 'entrusted' && to === 'out') {
    // « Confié »: the work keeps its stage and owner; only the custodian changes.
    moveErr = await moveWorks(supabase, ids, { LocalisationID: party, localisation_address_id: order.address_id, ReturnDate: order.end_date },
      (w) => ({ statusId: w.statusId, contactId: w.ContactID, localisationId: party }))
  } else if (order.kind === 'entrusted' && to === 'closed') {
    const { data: still } = await supabase.from('Oeuvres').select('OeuvreID').in('OeuvreID', ids).eq('LocalisationID', party)
    const back = (still ?? []).map((w) => w.OeuvreID)
    moveErr = await moveWorks(supabase, back, { LocalisationID: PEM, localisation_address_id: null, ReturnDate: null },
      (w) => ({ statusId: w.statusId, contactId: w.ContactID, localisationId: PEM }))
    if (!moveErr && ids.length) {
      await supabase.from('work_order_work').update({ line_status: 'returned', closed_at: new Date().toISOString() })
        .eq('order_id', order.id).eq('line_status', 'active')
    }
  } else if ((order.kind === 'consignment' || order.kind === 'loan') && to === 'out') {
    const statusId = order.kind === 'loan' ? 8 : 7
    moveErr = await moveWorks(supabase, ids,
      { statusId, ContactID: PEM, LocalisationID: party, localisation_address_id: order.address_id, ReturnDate: order.end_date },
      // contactId names the line (« Consigné / Prêt — <gallery / borrower> »); owner stays Pem.
      () => ({ statusId, contactId: party, localisationId: party }))
  } else if ((order.kind === 'consignment' || order.kind === 'loan') && to === 'closed') {
    // Only works still out with this custodian come back; sold / given ones left the order already.
    const { data: still } = await supabase.from('Oeuvres').select('OeuvreID')
      .in('OeuvreID', ids).in('statusId', [7, 8]).eq('LocalisationID', party)
    const back = (still ?? []).map((w) => w.OeuvreID)
    moveErr = await moveWorks(supabase, back,
      { statusId: 2, ContactID: PEM, LocalisationID: PEM, localisation_address_id: null, ReturnDate: null },
      () => ({ statusId: 2, contactId: PEM, localisationId: PEM }))
    if (!moveErr && ids.length) {
      await supabase.from('work_order_work').update({ line_status: 'returned', closed_at: new Date().toISOString() })
        .eq('order_id', order.id).eq('line_status', 'active')
    }
  }
  // Gift « signed »: the deed is signed, nothing moves until the hand-over.

  if (moveErr) {
    // Put the order back where it was; the step date it stamped is cleared with it.
    const stampCol = to === 'signed' ? 'signed_at' : to === 'paid' ? 'paid_at' : to === 'closed' ? 'returned_at'
      : ['delivered', 'out', 'handed_over'].includes(to) ? 'delivered_at' : null
    await supabase.from('work_order').update({ status: order.status, ...(stampCol ? { [stampCol]: null } : {}) }).eq('id', order.id)
    return { error: moveErr }
  }

  await logSystemEvent({ eventType: 'STATUS_CHANGE', tableName: 'work_order', rowId: order.id, oldValue: order.status, newValue: to, metadata: { ref: order.ref, kind: order.kind, works: ids } })
  // Delivered: a reminder on the day the cooling-off window ends (Field reminders, Today).
  if (order.kind === 'sale' && to === 'delivered') {
    const { data: win } = await supabase.from('work_order').select('return_window_days, return_window_skipped, process_id').eq('id', order.id).single()
    const days = Number(win?.return_window_days ?? 14)
    if (win && !win.return_window_skipped && days > 0) {
      const { error: remErr } = await supabase.from('suivi_reminder').insert({
        process_id: win.process_id,
        message: resolveMessage('fr', 'ord_reminder_cooling_off').replace('{ref}', order.ref ?? '').replace('{works}', ids.map((n) => `#${n}`).join(', ')),
        remind_at: addCalendarDaysIso(today, days),
      })
      if (remErr) await logError('Cooling-off reminder not written', remErr.message, { source: 'orders.advanceWorkOrder', metadata: { orderId: order.id } })
      else revalidateTag('reminders')
    }
  }
  if (CUSTODY_KINDS.includes(order.kind) && to === 'out') await closeDateReminders(supabase, order.ref, 'out')
  if (CUSTODY_KINDS.includes(order.kind) && to === 'closed') await closeDateReminders(supabase, order.ref, 'all')
  // Signed: the paper is made again without the « Brouillon » mark. A gift's deed is made again at
  // hand-over: it becomes the dated record of the hand-over. « Confié » has no signed step.
  if (to === 'signed' || (order.kind === 'gift' && to === 'handed_over') || (order.kind === 'entrusted' && to === 'out')) {
    const paper = await makeOrderPaper(order.id)
    if ('error' in paper) await logError('Order paper failed at signature', paper.error, { source: 'orders.advanceWorkOrder', metadata: { orderId: order.id } })
  }
  revalidatePath('/atelier/sales')
  return { ok: true }
}

export async function cancelWorkOrder(orderId: string): Promise<SimpleOrderResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g
  const { data: o, error: readErr } = await supabase
    .from('work_order').select('id, kind, status, party_id, address_id, end_date, price_final, ref').eq('id', orderId).single()
  if (readErr || !o) return { error: readErr?.message ?? 'Order not found' }
  const order = o as OrderRow
  if (!CANCEL_FROM[order.kind].includes(order.status)) return { error: 'ord_err_step' }

  // A signed sale had reserved its works: those still reserved for this buyer go back.
  if (order.kind === 'sale' && order.status !== 'draft') {
    const { data: lineRows } = await supabase.from('work_order_work').select('oeuvre_id').eq('order_id', order.id)
    const ids = (lineRows ?? []).map((l) => l.oeuvre_id)
    const { data: reserved } = await supabase.from('Oeuvres').select('OeuvreID, LocalisationID')
      .in('OeuvreID', ids).eq('statusId', 4).eq('AcheteurID', order.party_id)
    for (const w of reserved ?? []) {
      // Back to « Disponible » at Pem's, or « Consigné » if it is still at a gallery that holds it.
      const atGallery = w.LocalisationID != null && w.LocalisationID !== PEM
      const err = await moveWorks(supabase, [w.OeuvreID], { statusId: atGallery ? 7 : 2, AcheteurID: null },
        (x) => ({ statusId: atGallery ? 7 : 2, contactId: PEM, localisationId: x.LocalisationID }))
      if (err) return { error: err }
    }
  }

  const { error } = await supabase.from('work_order').update({ status: 'cancelled' }).eq('id', order.id)
  if (error) return { error: error.message }
  await logSystemEvent({ eventType: 'STATUS_CHANGE', tableName: 'work_order', rowId: order.id, oldValue: order.status, newValue: 'cancelled', metadata: { ref: order.ref, kind: order.kind } })
  await closeDateReminders(supabase, order.ref, 'all')
  revalidatePath('/atelier/sales')
  return { ok: true }
}

// ── Money in (R7 step 2) ─────────────────────────────────────────────────────────────────
// « Encaisser » on a sale: one `payments` row linked to the order (Revenue & expenses counts every
// payment on its day). The step follows the money: part of the price → « Acompte », all of it →
// « Soldée » (the buyer becomes the owner). The step is moved first, so a refused move writes no
// payment; a payment that fails after the move is reported (the step stays).

export type PaymentResult = { ok: true; status: string } | { error: string }

export async function recordOrderPayment(formData: FormData): Promise<PaymentResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g
  const orderId = String(formData.get('order_id') ?? '')
  const amount = numOrNull(formData.get('amount'))
  if (!amount || amount <= 0) return { error: 'ord_err_amount' }
  const method = strOrNull(formData.get('method'))
  const date = strOrNull(formData.get('payment_date')) ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'ord_err_amount' }

  const { data: o, error } = await supabase.from('work_order').select('id, kind, status, price_final, ref').eq('id', orderId).single()
  if (error || !o) return { error: error?.message ?? 'Order not found' }
  if (o.kind !== 'sale' || !['signed', 'deposit_paid'].includes(o.status)) return { error: 'ord_err_step' }
  if (!(o.price_final && o.price_final > 0)) return { error: 'ord_err_price' }

  const { data: before, error: sumErr } = await supabase.from('payments').select('amount').eq('work_order_id', o.id)
  if (sumErr) return { error: sumErr.message }
  const paid = (before ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const full = paid + amount >= Number(o.price_final) - 0.005
  const to = full ? 'paid' : o.status === 'signed' ? 'deposit_paid' : null
  if (to) {
    const step = await advanceWorkOrder(o.id, to)
    if ('error' in step) return step
  }

  const { error: payErr } = await supabase.from('payments').insert({
    work_order_id: o.id,
    amount,
    method,
    payment_date: date,
    notes: o.ref,
  })
  if (payErr) {
    await logError('Order payment not written after its step', payErr.message, { source: 'orders.recordOrderPayment', metadata: { orderId: o.id, amount, to } })
    return { error: `ord_err_payment:${payErr.message}` }
  }
  await logSystemEvent({ eventType: 'PAYMENT_GRAIN', tableName: 'work_order', rowId: o.id, metadata: { ref: o.ref, amount, method, date } })
  revalidatePath('/atelier/sales')
  revalidatePath('/atelier/fiscal')
  return { ok: true, status: to ?? o.status }
}

/** Works by number, for a form opened prefilled from elsewhere (work card, Pipeline, phone). */
export async function getWorksForOrder(ids: number[]): Promise<OrderWorkHit[]> {
  const g = await guardTeam()
  if ('error' in g) return []
  const clean = [...new Set(ids.filter((n) => Number.isInteger(n) && n !== 0))].slice(0, 50)
  if (clean.length === 0) return []
  const { data } = await g.supabase.from('Oeuvres').select('OeuvreID, Titre, statusId, txtImageNameLink, Prix').in('OeuvreID', clean).is('deleted_at', null)
  const byId = new Map((data ?? []).map((w) => [w.OeuvreID, w]))
  return clean.flatMap((id) => {
    const w = byId.get(id)
    return w ? [{ id: w.OeuvreID, title: w.Titre, statusId: w.statusId, image: w.txtImageNameLink, price: w.Prix == null ? null : Number(w.Prix) }] : []
  })
}

export type ProcessOrderLink = { id: string; ref: string | null; kind: WorkOrderKind; status: string }

/** Orders made from a Pipeline process or an exhibition (the process keeps a link, not a paper). */
export async function findOrdersForProcess(processId: string): Promise<ProcessOrderLink[]> {
  const g = await guardTeam()
  if ('error' in g || !UUID_RE.test(processId)) return []
  const { data } = await g.supabase.from('work_order').select('id, ref, kind, status').eq('process_id', processId).order('created_at', { ascending: false })
  return (data ?? []).map((o) => ({ id: o.id, ref: o.ref, kind: o.kind as WorkOrderKind, status: o.status }))
}

/** A sale order as Reports « Ventes » reads it (same field names as the former `sale_order` row). */
export type ReportSaleOrder = {
  id: string
  order_ref: string | null
  statut: string
  buyer_id: number
  oeuvre_id: number | null
  oeuvre_ids: number[]
  prix_catalogue: number | null
  prix_final: number | null
  delivery_date: string | null
  deposit_paid: boolean
  balance_paid: boolean
  delivered: boolean
  commission_amount: number | null
  payments: { amount: number }[]
}

/** Sale orders for Reports (newest first; cancelled ones left out). */
export async function fetchSaleOrdersForReport(): Promise<ReportSaleOrder[]> {
  const g = await guardTeam()
  if ('error' in g) return []
  const { supabase } = g
  const { data: orders } = await supabase
    .from('work_order')
    .select('id, ref, status, party_id, price_catalogue, price_final, delivered_at, commission_amount')
    .eq('kind', 'sale').neq('status', 'cancelled')
    .order('created_at', { ascending: false })
  if (!orders?.length) return []
  const ids = orders.map((o) => o.id)
  const [linesRes, payRes] = await Promise.all([
    supabase.from('work_order_work').select('order_id, oeuvre_id, position').in('order_id', ids),
    supabase.from('payments').select('work_order_id, amount').in('work_order_id', ids),
  ])
  return orders.map((o) => {
    const works = (linesRes.data ?? []).filter((l) => l.order_id === o.id).sort((a, b) => a.position - b.position).map((l) => l.oeuvre_id)
    const payments = (payRes.data ?? []).filter((p) => p.work_order_id === o.id).map((p) => ({ amount: Number(p.amount) }))
    return {
      id: o.id,
      order_ref: o.ref,
      statut: o.status,
      buyer_id: o.party_id,
      oeuvre_id: works[0] ?? null,
      oeuvre_ids: works,
      prix_catalogue: o.price_catalogue,
      prix_final: o.price_final,
      delivery_date: o.delivered_at ? o.delivered_at.slice(0, 10) : null,
      deposit_paid: payments.length > 0 || ['deposit_paid', 'paid', 'delivered'].includes(o.status),
      balance_paid: o.status === 'paid' || o.status === 'delivered',
      delivered: o.status === 'delivered',
      commission_amount: o.commission_amount,
      payments,
    }
  })
}

/** The order a work is on (the open one first, else the latest finished one) — the work card's
 *  stage chips link to it. Cancelled orders and lines that left the order are skipped. */
export async function findOrderForWork(oeuvreId: number): Promise<(ProcessOrderLink & { party: string }) | null> {
  const g = await guardTeam()
  if ('error' in g || !Number.isInteger(oeuvreId)) return null
  const { data } = await g.supabase
    .from('work_order_work')
    .select('line_status, work_order!work_order_work_order_id_fkey(id, ref, kind, status, created_at, party_id)')
    .eq('oeuvre_id', oeuvreId)
  const orders = (data ?? [])
    .filter((l) => l.line_status === 'active' || l.line_status === 'sold' || l.line_status === 'given')
    .map((l) => l.work_order as unknown as { id: string; ref: string | null; kind: string; status: string; created_at: string; party_id: number } | null)
    .filter((o): o is { id: string; ref: string | null; kind: string; status: string; created_at: string; party_id: number } => !!o && o.status !== 'cancelled')
    .sort((a, b) => Number(FINISHED_STATUSES.includes(a.status)) - Number(FINISHED_STATUSES.includes(b.status)) || b.created_at.localeCompare(a.created_at))
  const o = orders[0]
  if (!o) return null
  const { data: c } = await g.supabase.from('Contact').select('*').eq('ContactID', o.party_id).maybeSingle()
  const contact = c as { NomInstitution: string | null; Nom: string | null; Prénom: string | null } | null
  const party = contact ? (contact.NomInstitution || [contact.Prénom, contact.Nom].filter(Boolean).join(' ').trim()) : `#${o.party_id}`
  return { id: o.id, ref: o.ref, kind: o.kind as WorkOrderKind, status: o.status, party }
}
const FINISHED_STATUSES = ['closed', 'delivered', 'handed_over']

export type OrderWorkHit = { id: number; title: string | null; statusId: number | null; image: string | null; price: number | null }

/** Work picker for a new order: by number (« 2210 », « #2210 ») or by title. */
export async function searchWorksForOrder(q: string): Promise<OrderWorkHit[]> {
  const g = await guardTeam()
  if ('error' in g) return []
  const { supabase } = g
  const term = q.trim().replace(/^#/, '')
  if (!term) return []
  let query = supabase.from('Oeuvres').select('OeuvreID, Titre, statusId, txtImageNameLink, Prix').is('deleted_at', null).limit(12)
  query = /^\d+$/.test(term) ? query.eq('OeuvreID', Number(term)) : query.ilike('Titre', `%${term.replace(/[%_]/g, '')}%`)
  const { data } = await query.order('OeuvreID', { ascending: false })
  return (data ?? []).map((w) => ({ id: w.OeuvreID, title: w.Titre, statusId: w.statusId, image: w.txtImageNameLink, price: w.Prix == null ? null : Number(w.Prix) }))
}

export type PartyAddress = { id: number; label: string | null; ville: string | null }

export async function listPartyAddresses(partyId: number): Promise<PartyAddress[]> {
  const g = await guardTeam()
  if ('error' in g) return []
  const { data } = await g.supabase.from('contact_addresses').select('id, label, ville, position').eq('contact_id', partyId).order('position')
  return (data ?? []).map((a) => ({ id: a.id, label: a.label, ville: a.ville }))
}


// ── Papers (R7 slice 3) ───────────────────────────────────────────────────────────────────
// Naming policy (Pem 2026-11-17): `<REF>_<paper>.pdf`, signed copy `<REF>_<paper>_signe.<ext>`,
// one Vault folder per kind (`Commandes/Ventes · Dépôts · Prêts · Dons`).

const VAULT_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

async function putVaultObject(key: string, body: Buffer, contentType: string, orderId: string) {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  await s3.send(new PutObjectCommand({ Bucket: VAULT_BUCKET, Key: key, Body: body, ContentType: contentType }))
  await recordStorageObject({
    bucket: VAULT_BUCKET,
    objectKey: key,
    sizeBytes: body.length,
    contentType,
    source: 'work_order_paper',
    classification: 'linked',
    linkedRefs: [{ table: 'work_order', column: 'paper_path', row_id: orderId }, { table: 'document', column: 'storage_path' }],
  })
}

function addressLines(a: { adresse: string | null; code_postal: string | null; ville: string | null; pays: string | null } | null, fallback: string[]): string[] {
  if (!a) return fallback.filter(Boolean)
  return [a.adresse, [a.code_postal, a.ville].filter(Boolean).join(' '), a.pays].filter((x): x is string => Boolean(x && x.trim()))
}

/** Make (or redo) the order's paper: PDF in the Vault, `document` row linked to the order. */
export async function makeOrderPaper(orderId: string): Promise<SimpleOrderResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g

  const { data: o, error } = await supabase.from('work_order').select('*').eq('id', orderId).single()
  if (error || !o) return { error: error?.message ?? 'Order not found' }
  if (!o.ref) return { error: 'ord_err_step' }
  const kind = o.kind as WorkOrderKind

  const { data: lines } = await supabase.from('work_order_work').select('oeuvre_id, price, insurance_value, position, line_status').eq('order_id', o.id).order('position')
  const ids = (lines ?? []).map((l) => l.oeuvre_id)
  const [worksRes, partyRes, addrRes, pemRes, pemAddrRes] = await Promise.all([
    ids.length ? supabase.from('Oeuvres').select('OeuvreID, Titre, "Année", Technique, Support, Hauteur, Largeur, Profondeur, Prix, txtImageNameLink').in('OeuvreID', ids) : Promise.resolve({ data: [] as never[] }),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom", Ville, Pays').eq('ContactID', o.party_id).single(),
    o.address_id ? supabase.from('contact_addresses').select('adresse, code_postal, ville, pays').eq('id', o.address_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('Contact').select('NomInstitution, Nom, "Prénom", Ville, Pays').eq('ContactID', PEM).single(),
    supabase.from('contact_addresses').select('adresse, code_postal, ville, pays, label').eq('contact_id', PEM).ilike('label', 'principal').maybeSingle(),
  ])
  const works = (worksRes.data ?? []) as { OeuvreID: number; Titre: string | null; Année: string | null; Technique: number | null; Support: number | null; Hauteur: number | null; Largeur: number | null; Profondeur: string | null; Prix: number | null; txtImageNameLink: string | null }[]
  const techIds = [...new Set(works.map((w) => w.Technique).filter((x): x is number => x != null))]
  const suppIds = [...new Set(works.map((w) => w.Support).filter((x): x is number => x != null))]
  const [techs, supps] = await Promise.all([
    techIds.length ? supabase.from('Technique').select('TechniqueID, Technique').in('TechniqueID', techIds) : Promise.resolve({ data: [] as { TechniqueID: number; Technique: string | null }[] }),
    suppIds.length ? supabase.from('Support').select('SupportID, Support').in('SupportID', suppIds) : Promise.resolve({ data: [] as { SupportID: number; Support: string | null }[] }),
  ])
  const tM = new Map((techs.data ?? []).map((t) => [t.TechniqueID, t.Technique]))
  const sM = new Map((supps.data ?? []).map((x) => [x.SupportID, x.Support]))
  const byId = new Map(works.map((w) => [w.OeuvreID, w]))

  const nameOf = (c: { NomInstitution: string | null; Nom: string | null; Prénom: string | null } | null) =>
    c ? (c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()) : ''
  const party: PaperParty = {
    name: nameOf(partyRes.data) || `#${o.party_id}`,
    lines: addressLines(addrRes.data, [[partyRes.data?.Ville, partyRes.data?.Pays].filter(Boolean).join(', ')]),
  }
  const artist: PaperParty = {
    name: nameOf(pemRes.data) || 'Pem',
    lines: addressLines(pemAddrRes.data, [[pemRes.data?.Ville, pemRes.data?.Pays].filter(Boolean).join(', ')]),
  }

  const pdf = await buildOrderPaper({
    kind,
    ref: o.ref,
    status: o.status,
    createdAt: o.created_at,
    artist,
    party,
    works: (lines ?? []).map((l) => {
      const w = byId.get(l.oeuvre_id)
      const medium = [w?.Technique != null ? tM.get(w.Technique) : null, w?.Support != null ? sM.get(w.Support) : null].filter(Boolean).join(' sur ')
      const dims = w?.Hauteur && w?.Largeur ? `${w.Hauteur} × ${w.Largeur}${w.Profondeur && w.Profondeur !== '0.1' ? ` × ${w.Profondeur}` : ''} cm` : null
      // A gift never prints a value; loan / entrusted print the line's insurance value; consignment its agreed price.
      const value = kind === 'gift' ? null
        : kind === 'loan' || kind === 'entrusted' ? (l.insurance_value ?? w?.Prix ?? null)
        : kind === 'consignment' ? (l.price ?? l.insurance_value ?? w?.Prix ?? null)
        : (l.price ?? w?.Prix ?? null)
      return { id: l.oeuvre_id, title: w?.Titre ?? null, year: w?.Année ? String(w.Année).slice(0, 4) : null, medium: medium || null, dims, value, image: w?.txtImageNameLink ?? null }
    }),
    currency: o.currency,
    priceCatalogue: o.price_catalogue,
    discountPct: o.discount_pct,
    priceFinal: o.price_final,
    depositPct: o.deposit_pct,
    commissionPct: o.commission_pct,
    startDate: o.start_date,
    endDate: o.end_date,
    returnWindowDays: kind === 'sale' ? o.return_window_days : null,
    handedOverAt: kind === 'gift' && o.status === 'handed_over' ? o.delivered_at : null,
    notes: o.notes,
  })

  const key = `${ORDER_KEY_PREFIX[kind]}${o.ref}_${PAPER_SLUG[kind]}.pdf`
  try {
    await putVaultObject(key, pdf, 'application/pdf', o.id)
  // eslint-disable-next-line pem-i18n/no-silent-catch -- not silent: the error goes back to the screen
  } catch (e) {
    return { error: `R2 : ${String(e)}` }
  }

  const docFields = {
    name: `${o.ref} · ${PAPER_TITLE[kind].fr}`,
    kind: 'contrat',
    folder: VAULT_ORDER_FOLDERS[kind],
    doc_date: new Date().toISOString().slice(0, 10),
    oeuvre_id: ids[0] ?? null,
    oeuvre_ids: ids,
    storage_path: key,
    file_size: pdf.length,
    mime_type: 'application/pdf',
    work_order_id: o.id,
  }
  const { data: existing } = await supabase.from('document').select('id').eq('storage_path', key).maybeSingle()
  const docRes = existing
    ? await supabase.from('document').update(docFields).eq('id', existing.id)
    : await supabase.from('document').insert(docFields)
  if (docRes.error) return { error: docRes.error.message }
  await supabase.from('work_order').update({ paper_path: key }).eq('id', o.id)
  revalidatePath('/atelier/sales')
  return { ok: true }
}

const SIGNED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
}
const SIGNED_MAX_BYTES = 4_000_000

/** The signed copy (scan or photo) of the order's paper, filed next to it. */
export async function attachSignedCopy(formData: FormData): Promise<SimpleOrderResult> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { supabase } = g
  const orderId = String(formData.get('order_id') ?? '')
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'ord_err_file' }
  const ext = SIGNED_TYPES[file.type]
  if (!ext) return { error: 'ord_err_file_type' }
  if (file.size > SIGNED_MAX_BYTES) return { error: 'ord_err_file_size' }

  const { data: o, error } = await supabase.from('work_order').select('id, ref, kind').eq('id', orderId).single()
  if (error || !o || !o.ref) return { error: error?.message ?? 'Order not found' }
  const kind = o.kind as WorkOrderKind
  const { data: lines } = await supabase.from('work_order_work').select('oeuvre_id').eq('order_id', o.id)
  const ids = (lines ?? []).map((l) => l.oeuvre_id)

  // A second signed copy does not overwrite the first: _signe, _signe-2, …
  const base = `${ORDER_KEY_PREFIX[kind]}${o.ref}_${PAPER_SLUG[kind]}_signe`
  const { count } = await supabase.from('document').select('id', { count: 'exact', head: true }).eq('work_order_id', o.id).like('storage_path', `${base}%`)
  const key = `${base}${count ? `-${count + 1}` : ''}.${ext}`
  const body = Buffer.from(await file.arrayBuffer())
  try {
    await putVaultObject(key, body, file.type, o.id)
  // eslint-disable-next-line pem-i18n/no-silent-catch -- not silent: the error goes back to the screen
  } catch (e) {
    return { error: `R2 : ${String(e)}` }
  }
  const { error: docErr } = await supabase.from('document').insert({
    name: `${o.ref} · ${PAPER_TITLE[kind].fr} — copie signée`,
    kind: 'contrat',
    folder: VAULT_ORDER_FOLDERS[kind],
    doc_date: new Date().toISOString().slice(0, 10),
    oeuvre_id: ids[0] ?? null,
    oeuvre_ids: ids,
    storage_path: key,
    file_size: body.length,
    mime_type: file.type,
    work_order_id: o.id,
  })
  if (docErr) return { error: docErr.message }
  await logSystemEvent({ eventType: 'VAULT_UPLOAD', tableName: 'work_order', rowId: o.id, metadata: { ref: o.ref, key } })
  revalidatePath('/atelier/sales')
  return { ok: true }
}
