'use server'

// Supply orders (TODO 11 + 11d) — Studio → Fournitures → Commandes. Design + Pem's answers:
// docs/design/2026-11-18/Supplies_Orders.notes.md. SQL: supabase/sql/supply_orders.sql (team RLS; receiving
// goes through the security-definer function receive_supply_order, one transaction for every line).
// Behind SUPPLY_ORDERS_SQL_LIVE: until the lead applies the SQL every action returns `so_err_sql_waiting`.
// Errors are returned as `so_err_*` i18n keys when known, else the raw message.

import { saveContact } from '@/app/atelier/(portal)/contacts/save-contact'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  NEW_SUPPLIER_ROLE, SUPPLY_EXPENSE_CATEGORY, SUPPLY_ORDERS_SQL_LIVE,
  orderTotalHt,
  type SupplyOrderDetail, type SupplyOrderExpense, type SupplyOrderFile, type SupplyOrderLine,
  type SupplyOrderStatus, type SupplyOrderSummary,
} from '@/lib/supply-orders'

type Ok = { ok: true }
type Err = { error: string }
// The new tables are not in the generated types until the SQL is applied and `gen:types` runs.
type Loose = SupabaseClient<any, any, any>

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const DB_ERRORS: Record<string, string> = {
  supply_order_nothing_to_receive: 'so_err_nothing_to_receive',
  supply_order_not_open: 'so_err_not_open',
  supply_order_cancel_received: 'so_err_cancel_received',
}

function dbError(e: { message?: string } | null | undefined): Err {
  const msg = e?.message ?? 'error'
  const key = Object.keys(DB_ERRORS).find((k) => msg.includes(k))
  return { error: key ? DB_ERRORS[key] : msg }
}

async function guardTeam(): Promise<{ sb: Loose } | Err> {
  if (!SUPPLY_ORDERS_SQL_LIVE) return { error: 'so_err_sql_waiting' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'so_err_auth' }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'so_err_auth' }
  return { sb: supabase as unknown as Loose }
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ── List ──────────────────────────────────────────────────────────────────────────────────────

export async function listSupplyOrders(): Promise<{ ok: true; orders: SupplyOrderSummary[] } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await g.sb
    .from('supply_order')
    .select('id, ref, supplier_id, status, ordered_at, received_at, expense_id, created_at, supply_order_line(qty_ordered, qty_received, unit_price_ht)')
    .order('created_at', { ascending: false })
  if (error) return dbError(error)
  const rows = (data ?? []) as Array<Record<string, unknown> & { supply_order_line: Array<Record<string, unknown>> }>
  const ids = rows.map((r) => num(r.id))
  const fileCount = new Map<number, number>()
  if (ids.length) {
    const { data: docs, error: dErr } = await g.sb.from('document').select('supply_order_id').in('supply_order_id', ids)
    if (dErr) return dbError(dErr)
    for (const d of (docs ?? []) as { supply_order_id: number }[]) {
      fileCount.set(d.supply_order_id, (fileCount.get(d.supply_order_id) ?? 0) + 1)
    }
  }
  const orders: SupplyOrderSummary[] = rows.map((r) => {
    const lines = (r.supply_order_line ?? []).map((l) => ({
      qty_ordered: num(l.qty_ordered), qty_received: num(l.qty_received), unit_price_ht: numOrNull(l.unit_price_ht),
    }))
    return {
      id: num(r.id),
      ref: String(r.ref ?? ''),
      supplier_id: num(r.supplier_id),
      status: r.status as SupplyOrderStatus,
      ordered_at: (r.ordered_at as string | null) ?? null,
      received_at: (r.received_at as string | null) ?? null,
      expense_id: numOrNull(r.expense_id),
      lines: lines.length,
      short_lines: lines.filter((l) => l.qty_received < l.qty_ordered).length,
      received_any: lines.some((l) => l.qty_received > 0),
      total_ht: orderTotalHt(lines),
      files: fileCount.get(num(r.id)) ?? 0,
    }
  })
  return { ok: true, orders }
}

// ── One order ─────────────────────────────────────────────────────────────────────────────────

export async function getSupplyOrder(id: number): Promise<{ ok: true; order: SupplyOrderDetail } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data: o, error } = await g.sb
    .from('supply_order')
    .select('id, ref, supplier_id, status, ordered_at, received_at, notes, expense_id')
    .eq('id', id)
    .single()
  if (error || !o) return dbError(error)
  const [linesRes, filesRes, expRes] = await Promise.all([
    g.sb.from('supply_order_line')
      .select('id, stock_item_id, qty_ordered, qty_received, unit_price_ht, position, stock_item(name, unit, quantity)')
      .eq('order_id', id)
      .order('position'),
    g.sb.from('document').select('id, name, storage_path').eq('supply_order_id', id).order('created_at'),
    o.expense_id
      ? g.sb.from('expense').select('id, date, receipt_ref, montant_ttc').eq('id', o.expense_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (linesRes.error) return dbError(linesRes.error)
  if (filesRes.error) return dbError(filesRes.error)
  const lines: SupplyOrderLine[] = ((linesRes.data ?? []) as Array<Record<string, unknown>>).map((l) => {
    const it = (l.stock_item ?? {}) as { name?: string; unit?: string; quantity?: number }
    return {
      id: num(l.id),
      stock_item_id: num(l.stock_item_id),
      qty_ordered: num(l.qty_ordered),
      qty_received: num(l.qty_received),
      unit_price_ht: numOrNull(l.unit_price_ht),
      name: it.name ?? `#${String(l.stock_item_id)}`,
      unit: it.unit ?? '',
      stock_qty: num(it.quantity),
    }
  })
  return {
    ok: true,
    order: {
      id: num(o.id),
      ref: String(o.ref ?? ''),
      supplier_id: num(o.supplier_id),
      status: o.status as SupplyOrderStatus,
      ordered_at: o.ordered_at ?? null,
      received_at: o.received_at ?? null,
      notes: o.notes ?? null,
      expense: (expRes.data as SupplyOrderExpense | null) ?? null,
      lines,
      files: (filesRes.data ?? []) as SupplyOrderFile[],
    },
  }
}

// ── Save (create or edit header + lines) ──────────────────────────────────────────────────────

export interface SupplyOrderInput {
  id: number | null
  supplier_id: number
  notes: string | null
  lines: { id: number | null; stock_item_id: number; qty_ordered: number; unit_price_ht: number | null }[]
}

export async function saveSupplyOrder(input: SupplyOrderInput): Promise<{ ok: true; id: number } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  if (!Number.isInteger(input.supplier_id) || input.supplier_id <= 0) return { error: 'so_err_supplier' }
  const lines = input.lines.filter((l) => Number.isInteger(l.stock_item_id) && l.stock_item_id > 0)
  if (!lines.length) return { error: 'so_err_no_lines' }
  if (lines.some((l) => !(l.qty_ordered > 0) || (l.unit_price_ht != null && l.unit_price_ht < 0))) return { error: 'so_err_qty' }
  if (new Set(lines.map((l) => l.stock_item_id)).size !== lines.length) return { error: 'so_err_duplicate_item' }

  let id = input.id
  const notes = input.notes?.trim() || null
  if (id == null) {
    const { data, error } = await g.sb.from('supply_order').insert({ supplier_id: input.supplier_id, notes }).select('id').single()
    if (error || !data) return dbError(error)
    id = num(data.id)
  } else {
    const { error } = await g.sb.from('supply_order').update({ supplier_id: input.supplier_id, notes }).eq('id', id)
    if (error) return dbError(error)
  }

  const { data: existing, error: exErr } = await g.sb.from('supply_order_line').select('id, qty_received').eq('order_id', id)
  if (exErr) return dbError(exErr)
  const keep = new Set(lines.filter((l) => l.id != null).map((l) => l.id as number))
  const gone = ((existing ?? []) as { id: number; qty_received: number }[]).filter((l) => !keep.has(num(l.id)))
  if (gone.some((l) => num(l.qty_received) > 0)) return { error: 'so_err_line_received' }
  if (gone.length) {
    const { error } = await g.sb.from('supply_order_line').delete().in('id', gone.map((l) => l.id))
    if (error) return dbError(error)
  }
  for (const [position, l] of lines.entries()) {
    const row = { stock_item_id: l.stock_item_id, qty_ordered: l.qty_ordered, unit_price_ht: l.unit_price_ht, position }
    const { error } = l.id != null
      ? await g.sb.from('supply_order_line').update(row).eq('id', l.id).eq('order_id', id)
      : await g.sb.from('supply_order_line').insert({ ...row, order_id: id })
    if (error) return dbError(error)
  }
  return { ok: true, id }
}

// ── Steps ─────────────────────────────────────────────────────────────────────────────────────

/** « Marquer commandée » · « Clore » (received with a shortfall) · « Annuler la commande ». */
export async function setSupplyOrderStatus(id: number, status: 'ordered' | 'received' | 'cancelled'): Promise<Ok | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.sb.from('supply_order').update({ status }).eq('id', id)
  return error ? dbError(error) : { ok: true }
}

/** A draft can be thrown away (RLS refuses anything past draft). */
export async function deleteDraftSupplyOrder(id: number): Promise<Ok | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { error, count } = await g.sb.from('supply_order').delete({ count: 'exact' }).eq('id', id).eq('status', 'draft')
  if (error) return dbError(error)
  return count ? { ok: true } : { error: 'so_err_not_open' }
}

export async function receiveSupplyOrder(id: number, lines: { line_id: number; qty: number }[]): Promise<Ok | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const clean = lines.filter((l) => Number.isInteger(l.line_id) && l.qty > 0)
  if (!clean.length) return { error: 'so_err_nothing_to_receive' }
  const { error } = await g.sb.rpc('receive_supply_order', { p_order_id: id, p_lines: clean })
  return error ? dbError(error) : { ok: true }
}

// ── Expense ───────────────────────────────────────────────────────────────────────────────────

export interface OrderExpenseInput {
  date: string
  receipt_ref: string | null
  libelle: string | null
  montant_ht: number | null
  tva_rate: number | null
  montant_ttc: number
}

/** « Créer la dépense »: a Facture expense for the supplier, linked to the order (and its files). */
export async function createExpenseForOrder(orderId: number, input: OrderExpenseInput): Promise<{ ok: true; expense: SupplyOrderExpense } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  if (!ISO_DAY.test(input.date)) return { error: 'so_err_date' }
  if (!(input.montant_ttc > 0)) return { error: 'so_err_amount' }
  const { data: o, error: oErr } = await g.sb.from('supply_order').select('supplier_id, expense_id').eq('id', orderId).single()
  if (oErr || !o) return dbError(oErr)
  if (o.expense_id) return { error: 'so_err_has_expense' }
  const { data: e, error } = await g.sb.from('expense').insert({
    date: input.date,
    fiscal_year: Number(input.date.slice(0, 4)),
    type: 'bill',
    category: SUPPLY_EXPENSE_CATEGORY,
    contact_id: o.supplier_id,
    libelle: input.libelle?.trim() || null,
    receipt_ref: input.receipt_ref?.trim() || null,
    montant_ht: input.montant_ht,
    tva_rate: input.tva_rate,
    montant_ttc: input.montant_ttc,
  }).select('id, date, receipt_ref, montant_ttc').single()
  if (error || !e) return dbError(error)
  const linked = await linkExpenseToOrder(orderId, num(e.id))
  if ('error' in linked) return linked
  return { ok: true, expense: e as SupplyOrderExpense }
}

/** Link (or unlink with null) an existing expense; the order's files follow it. */
export async function linkExpenseToOrder(orderId: number, expenseId: number | null): Promise<Ok | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { error } = await g.sb.from('supply_order').update({ expense_id: expenseId }).eq('id', orderId)
  if (error) return dbError(error)
  if (expenseId != null) {
    const { error: dErr } = await g.sb.from('document').update({ expense_id: expenseId }).eq('supply_order_id', orderId).is('expense_id', null)
    if (dErr) return dbError(dErr)
  }
  return { ok: true }
}

/** The supplier's expenses, newest first, for « Lier une dépense ». */
export async function listSupplierExpenses(supplierId: number): Promise<{ ok: true; expenses: SupplyOrderExpense[] } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await g.sb.from('expense')
    .select('id, date, receipt_ref, montant_ttc').eq('contact_id', supplierId).order('date', { ascending: false }).limit(30)
  if (error) return dbError(error)
  return { ok: true, expenses: (data ?? []) as SupplyOrderExpense[] }
}

/** The orders that point to an expense (shown on the expense form). */
export async function listOrdersForExpense(expenseId: number): Promise<{ ok: true; orders: { id: number; ref: string }[] } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await g.sb.from('supply_order').select('id, ref').eq('expense_id', expenseId).order('id')
  if (error) return dbError(error)
  return { ok: true, orders: ((data ?? []) as { id: number; ref: string }[]).map((r) => ({ id: num(r.id), ref: r.ref })) }
}

// ── Files (Vault « Factures ») ────────────────────────────────────────────────────────────────
// The browser uploads with the Vault's direct upload (createVaultUploadUrl → PUT → finalizeVaultUpload,
// kind « facture »); these only attach the new document.

export async function attachFileToOrder(orderId: number, documentId: string): Promise<Ok | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data: o, error: oErr } = await g.sb.from('supply_order').select('supplier_id, expense_id').eq('id', orderId).single()
  if (oErr || !o) return dbError(oErr)
  const { error } = await g.sb.from('document')
    .update({ supply_order_id: orderId, expense_id: o.expense_id ?? null, contact_id: o.supplier_id, kind: 'facture' })
    .eq('id', documentId)
  return error ? dbError(error) : { ok: true }
}

export async function attachFileToExpense(expenseId: number, documentId: string): Promise<Ok | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data: e, error: eErr } = await g.sb.from('expense').select('contact_id').eq('id', expenseId).single()
  if (eErr || !e) return dbError(eErr)
  const { error } = await g.sb.from('document')
    .update({ expense_id: expenseId, contact_id: e.contact_id ?? null, kind: 'facture' })
    .eq('id', documentId)
  return error ? dbError(error) : { ok: true }
}

export async function listExpenseFiles(expenseId: number): Promise<{ ok: true; files: SupplyOrderFile[] } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const { data, error } = await g.sb.from('document').select('id, name, storage_path').eq('expense_id', expenseId).order('created_at')
  if (error) return dbError(error)
  return { ok: true, files: (data ?? []) as SupplyOrderFile[] }
}

// ── Inline creation: supplier, stock item ─────────────────────────────────────────────────────

export async function createSupplierInline(input: { name: string; email: string | null; phone: string | null }): Promise<{ ok: true; id: number } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const name = input.name.trim()
  if (!name) return { error: 'so_err_supplier' }
  const email = input.email?.trim() || null
  const phone = input.phone?.trim() || null
  // Through the one contact door (BuildingPrinciples 2, ContactDoor.md step 1): the card and its email / phone as list
  // rows in one transaction, so search, duplicate warnings and the person page see them like any other contact.
  const res = await saveContact({
    id: null,
    fields: { NomInstitution: name, Role: NEW_SUPPLIER_ROLE, ...(phone ? { Téléphone1: phone } : {}) },
    lists: {
      ...(email ? { emails: [{ email, label: 'Work', is_primary: true }] } : {}),
      ...(phone ? { phones: [{ phone, country_code: null, label: 'Work', is_primary: true }] } : {}),
    },
  })
  // A refusal is never « ok » (principle 3).
  if (!('ok' in res)) return { error: 'error' in res ? res.error : `refused: ${'refused' in res ? res.refused : 'unchanged'}` }
  return { ok: true, id: res.card.contact.ContactID }
}

export async function createStockItemInline(input: { name: string; unit: string; category: string | null; supplier_id: number | null }): Promise<{ ok: true; id: number } | Err> {
  const g = await guardTeam()
  if ('error' in g) return g
  const name = input.name.trim()
  if (!name || name.length > 120) return { error: 'so_err_item' }
  // The Stock door (`save_stock_item`, equipment.sql): one writer for stock_item; a refusal is never « ok ».
  const { data, error } = await g.sb.rpc('save_stock_item', {
    p: { id: null, fields: { name, unit: input.unit.trim() || 'units', category: input.category?.trim() || null, supplier_id: input.supplier_id, quantity: 0 } },
  })
  if (error) return dbError(error)
  const r = (data ?? {}) as { ok?: boolean; refused?: string; detail?: string; row?: { id: number } }
  if (!r.ok || !r.row) return { error: 'so_err_item' }
  return { ok: true, id: num(r.row.id) }
}
