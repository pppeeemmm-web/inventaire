'use client'

// One supply order (TODO 11 + 11d): supplier, lines, steps, receiving into stock, expense, invoice files.
// Desktop = right drawer, phone = full-screen sheet with a sticky footer. `mode: 'purchase'` = « + Achat »:
// a walk-in purchase, received today in one go (with the ticket and the expense). Design:
// docs/design/2026-11-18/Supplies_Orders.notes.md.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import { getSignedUrl } from '@/app/atelier/(portal)/vault/actions'
import {
  attachFileToOrder, createExpenseForOrder, createStockItemInline, createSupplierInline, deleteDraftSupplyOrder,
  getSupplyOrder, linkExpenseToOrder, listSupplierExpenses, receiveSupplyOrder, saveSupplyOrder,
  setSupplyOrderStatus,
} from '@/app/atelier/(portal)/stock/supply-order-actions'
import {
  isOpenSupplyOrder, lineDue, orderTotalHt,
  type SupplyOrderDetail, type SupplyOrderExpense,
} from '@/lib/supply-orders'
import {
  type StockContactLike, formatStockCurrency, isStockSupplierRole, supplierDisplayName,
} from '@/lib/stock-item'
import { uploadInvoiceFile } from '@/lib/supplies/upload-invoice'

type ItemLite = { id: number; name: string; unit: string; quantity: number; supplier_id: number | null; category: string | null }

type FormLine = {
  key: string
  id: number | null
  stock_item_id: number
  name: string
  unit: string
  stock_qty: number
  qty_ordered: string
  qty_received: number
  unit_price_ht: string
}

type Form = { supplierId: number | null; notes: string; lines: FormLine[] }

let keySeq = 0
const nextKey = () => `l${++keySeq}`

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

function parseNum(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function serialize(f: Form): string {
  return JSON.stringify({ s: f.supplierId, n: f.notes.trim(), l: f.lines.map((l) => [l.id, l.stock_item_id, l.qty_ordered.trim(), l.unit_price_ht.trim()]) })
}

export function SupplyOrderSheet({
  orderId, mode, contacts, onClose, onChanged, onSupplierAdded,
}: {
  orderId: number | null
  mode: 'order' | 'purchase'
  contacts: StockContactLike[]
  onClose: () => void
  /** After any write; the list reloads. */
  onChanged: (id: number | null) => void
  onSupplierAdded: (c: StockContactLike) => void
}) {
  const { t, lang } = useI18n()
  const isPhone = useMediaQuery('(max-width: 767px)')
  const errText = useCallback((e: string) => (e.startsWith('so_err_') ? t(e as DictKey) : e), [t])

  const [id, setId] = useState<number | null>(orderId)
  const [detail, setDetail] = useState<SupplyOrderDetail | null>(null)
  const [items, setItems] = useState<ItemLite[]>([])
  const [form, setForm] = useState<Form>({ supplierId: null, notes: '', lines: [] })
  const [baseline, setBaseline] = useState(serialize({ supplierId: null, notes: '', lines: [] }))
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(orderId != null)

  // Sub-panels
  const [supQuery, setSupQuery] = useState('')
  const [supPicking, setSupPicking] = useState(orderId == null)
  const [newSup, setNewSup] = useState<{ name: string; email: string; phone: string } | null>(null)
  const [itemQuery, setItemQuery] = useState('')
  const [newItem, setNewItem] = useState<{ name: string; unit: string; category: string } | null>(null)
  const [receiving, setReceiving] = useState<Record<number, string> | null>(null)
  const [expenseForm, setExpenseForm] = useState<{ date: string; ref: string; ht: string; tva: string; ttc: string } | null>(null)
  const [linkable, setLinkable] = useState<SupplyOrderExpense[] | null>(null)
  // « + Achat »
  const [purchaseExpense, setPurchaseExpense] = useState(true)
  const [purchaseTtc, setPurchaseTtc] = useState('')
  const [purchaseRef, setPurchaseRef] = useState('')
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const status = detail?.status ?? 'draft'
  const editable = isOpenSupplyOrder(status)
  const dirty = serialize(form) !== baseline

  const loadItems = useCallback(async () => {
    const { data, error } = await createClient().from('stock_item').select('id, name, unit, quantity, supplier_id, category').order('name')
    if (error) { toast.error(`${t('error_prefix')} ${stringifyError(error)}`); return }
    setItems((data ?? []) as ItemLite[])
  }, [t])

  const loadOrder = useCallback(async (oid: number) => {
    setLoading(true)
    const res = await getSupplyOrder(oid)
    setLoading(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    const o = res.order
    setDetail(o)
    const f: Form = {
      supplierId: o.supplier_id,
      notes: o.notes ?? '',
      lines: o.lines.map((l) => ({
        key: nextKey(), id: l.id, stock_item_id: l.stock_item_id, name: l.name, unit: l.unit, stock_qty: l.stock_qty,
        qty_ordered: String(l.qty_ordered), qty_received: l.qty_received,
        unit_price_ht: l.unit_price_ht == null ? '' : String(l.unit_price_ht),
      })),
    }
    setForm(f)
    setBaseline(serialize(f))
    setSupPicking(false)
  }, [errText])

  useEffect(() => { void loadItems() }, [loadItems])
  useEffect(() => { if (orderId != null) void loadOrder(orderId) }, [orderId, loadOrder])

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.ContactID, c])), [contacts])
  const supplierName = form.supplierId != null
    ? (contactById.get(form.supplierId) ? supplierDisplayName(contactById.get(form.supplierId)!) : `#${form.supplierId}`)
    : ''

  const supplierHits = useMemo(() => {
    const q = supQuery.trim().toLowerCase()
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    const list = contacts
      .filter((c) => !q || supplierDisplayName(c).toLowerCase().includes(q))
      .sort((a, b) => Number(isStockSupplierRole(b.Role)) - Number(isStockSupplierRole(a.Role)) || supplierDisplayName(a).localeCompare(supplierDisplayName(b), loc))
    return (q ? list : list.filter((c) => isStockSupplierRole(c.Role))).slice(0, 8)
  }, [contacts, supQuery, lang])

  const itemHits = useMemo(() => {
    const q = itemQuery.trim().toLowerCase()
    if (!q) return []
    const taken = new Set(form.lines.map((l) => l.stock_item_id))
    return items
      .filter((it) => !taken.has(it.id) && it.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.supplier_id === form.supplierId) - Number(a.supplier_id === form.supplierId))
      .slice(0, 8)
  }, [items, itemQuery, form.lines, form.supplierId])

  const totalHt = orderTotalHt(form.lines.map((l) => ({ qty_ordered: parseNum(l.qty_ordered) ?? 0, unit_price_ht: parseNum(l.unit_price_ht) })))

  // ── Writes ─────────────────────────────────────────────────────────────────

  /** Saves header + lines; returns the order id or null. */
  const save = useCallback(async (): Promise<number | null> => {
    if (form.supplierId == null) { toast.error(t('so_err_supplier')); return null }
    const lines = form.lines.map((l) => ({
      id: l.id, stock_item_id: l.stock_item_id, qty_ordered: parseNum(l.qty_ordered) ?? 0, unit_price_ht: parseNum(l.unit_price_ht),
    }))
    setBusy(true)
    const res = await saveSupplyOrder({ id, supplier_id: form.supplierId, notes: form.notes, lines })
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return null }
    setId(res.id)
    onChanged(res.id)
    await loadOrder(res.id)
    return res.id
  }, [form, id, t, errText, onChanged, loadOrder])

  const { attemptClose, unsavedDialog } = useUnsavedCloseGuard({
    isDirty: dirty && editable,
    onClose,
    performSave: async () => (await save()) != null,
  })

  async function step(next: 'ordered' | 'received' | 'cancelled') {
    if (next === 'cancelled' && !window.confirm(t('so_confirm_cancel'))) return
    if (next === 'received' && !window.confirm(t('so_confirm_close'))) return
    let oid = id
    if (dirty || oid == null) oid = await save()
    if (oid == null) return
    setBusy(true)
    const res = await setSupplyOrderStatus(oid, next)
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    onChanged(oid)
    await loadOrder(oid)
  }

  async function removeDraft() {
    if (id == null || !window.confirm(t('so_confirm_delete'))) return
    setBusy(true)
    const res = await deleteDraftSupplyOrder(id)
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    onChanged(null)
    onClose()
  }

  async function openReceive() {
    let oid = id
    if (dirty || oid == null) oid = await save()
    if (oid == null) return
    const due: Record<number, string> = {}
    for (const l of form.lines) if (l.id != null) due[l.id] = String(lineDue({ qty_ordered: parseNum(l.qty_ordered) ?? 0, qty_received: l.qty_received }))
    setReceiving(due)
  }

  async function confirmReceive() {
    if (id == null || !receiving) return
    const lines = Object.entries(receiving).map(([lid, q]) => ({ line_id: Number(lid), qty: parseNum(q) ?? 0 })).filter((l) => l.qty > 0)
    setBusy(true)
    const res = await receiveSupplyOrder(id, lines)
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    toast.success(t('so_received_toast'))
    setReceiving(null)
    onChanged(id)
    await Promise.all([loadOrder(id), loadItems()])
  }

  async function addSupplier() {
    if (!newSup?.name.trim()) return
    setBusy(true)
    const res = await createSupplierInline({ name: newSup.name, email: newSup.email || null, phone: newSup.phone || null })
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    onSupplierAdded({ ContactID: res.id, NomInstitution: newSup.name.trim(), Nom: null, Prénom: null, Role: 'Fournisseur' })
    setForm((f) => ({ ...f, supplierId: res.id }))
    setNewSup(null)
    setSupPicking(false)
    setSupQuery('')
  }

  function addLine(it: ItemLite) {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, {
        key: nextKey(), id: null, stock_item_id: it.id, name: it.name, unit: it.unit, stock_qty: it.quantity,
        qty_ordered: '1', qty_received: 0, unit_price_ht: '',
      }],
    }))
    setItemQuery('')
  }

  async function addItem() {
    if (!newItem?.name.trim()) return
    setBusy(true)
    const res = await createStockItemInline({ name: newItem.name, unit: newItem.unit, category: newItem.category || null, supplier_id: form.supplierId })
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    const it: ItemLite = { id: res.id, name: newItem.name.trim(), unit: newItem.unit.trim() || 'units', quantity: 0, supplier_id: form.supplierId, category: newItem.category || null }
    setItems((p) => [...p, it])
    addLine(it)
    setNewItem(null)
  }

  function patchLine(key: string, patch: Partial<FormLine>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }))
  }

  async function copyText() {
    const date = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')
    const head = t('restock_order_header_fmt').replace('{supplier}', supplierName).replace('{date}', date)
    const lines = form.lines.map((l) => `- ${l.qty_ordered} ${l.unit} × ${l.name}`)
    const text = [detail?.ref ? `${head} — ${detail.ref}` : head, '', ...lines].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('restock_copied'))
    // eslint-disable-next-line pem-i18n/no-silent-catch -- surfaced with a toast
    } catch (e) {
      toast.error(`${t('error_prefix')} ${stringifyError(e)}`)
    }
  }

  function openExpenseForm() {
    const ht = totalHt ?? 0
    setExpenseForm({ date: todayIso(), ref: '', ht: ht ? String(ht) : '', tva: '20', ttc: ht ? String(Math.round(ht * 120) / 100) : '' })
  }

  async function saveExpense() {
    if (id == null || !expenseForm) return
    const ttc = parseNum(expenseForm.ttc)
    if (ttc == null || ttc <= 0) { toast.error(t('so_err_amount')); return }
    setBusy(true)
    const res = await createExpenseForOrder(id, {
      date: expenseForm.date, receipt_ref: expenseForm.ref || null,
      libelle: `${detail?.ref ?? ''} — ${supplierName}`.trim(),
      montant_ht: parseNum(expenseForm.ht), tva_rate: parseNum(expenseForm.tva), montant_ttc: ttc,
    })
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    toast.success(t('so_expense_created'))
    setExpenseForm(null)
    onChanged(id)
    await loadOrder(id)
  }

  async function openLink() {
    if (form.supplierId == null) return
    const res = await listSupplierExpenses(form.supplierId)
    if ('error' in res) { toast.error(errText(res.error)); return }
    setLinkable(res.expenses)
  }

  async function link(expenseId: number | null) {
    if (id == null) return
    setBusy(true)
    const res = await linkExpenseToOrder(id, expenseId)
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    setLinkable(null)
    onChanged(id)
    await loadOrder(id)
  }

  async function attachFile(file: File, oid: number): Promise<boolean> {
    try {
      const up = await uploadInvoiceFile(file, `${detail?.ref ?? t('so_file_default_name')} — ${supplierName}`, todayIso())
      if ('error' in up) { toast.error(errText(up.error)); return false }
      const res = await attachFileToOrder(oid, up.id)
      if ('error' in res) { toast.error(errText(res.error)); return false }
      return true
    // eslint-disable-next-line pem-i18n/no-silent-catch -- surfaced with a toast (a TypeError = the bucket refused the PUT)
    } catch (e) {
      toast.error(e instanceof TypeError ? t('so_err_upload') : stringifyError(e))
      return false
    }
  }

  async function onPickFile(file: File | null) {
    if (!file || id == null) return
    setBusy(true)
    const ok = await attachFile(file, id)
    setBusy(false)
    if (!ok) return
    toast.success(t('so_file_added'))
    onChanged(id)
    await loadOrder(id)
  }

  async function openFile(path: string | null) {
    if (!path) return
    const res = await getSignedUrl(path)
    if ('error' in res) { toast.error(res.error); return }
    window.open(res.url, '_blank', 'noopener')
  }

  /** « + Achat » → « Reçu aujourd'hui »: save, receive every line in full, ticket, expense. */
  async function receivePurchase() {
    const oid = await save()
    if (oid == null) return
    setBusy(true)
    const fresh = await getSupplyOrder(oid)
    if ('error' in fresh) { setBusy(false); toast.error(errText(fresh.error)); return }
    const rec = await receiveSupplyOrder(oid, fresh.order.lines.map((l) => ({ line_id: l.id as number, qty: lineDue(l) })))
    if ('error' in rec) { setBusy(false); toast.error(errText(rec.error)); return }
    if (purchaseFile) await attachFile(purchaseFile, oid)
    const ttc = parseNum(purchaseTtc)
    if (purchaseExpense && ttc != null && ttc > 0) {
      const ht = orderTotalHt(fresh.order.lines)
      const exp = await createExpenseForOrder(oid, {
        date: todayIso(), receipt_ref: purchaseRef || null, libelle: `${fresh.order.ref} — ${supplierName}`,
        montant_ht: ht, tva_rate: ht ? Math.round(((ttc - ht) / ht) * 1000) / 10 : null, montant_ttc: ttc,
      })
      if ('error' in exp) toast.error(errText(exp.error))
    }
    setBusy(false)
    toast.success(t('so_received_toast'))
    onChanged(oid)
    onClose()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const money = (v: number | null | undefined) => formatStockCurrency(lang, v)
  const dateFmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB') : '')
  const inp: React.CSSProperties = { width: '100%', minHeight: 40, padding: '6px 10px', fontSize: 14, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', borderRadius: 3 }
  const numInp: React.CSSProperties = { ...inp, width: 76, textAlign: 'right', padding: '6px 8px' }
  const row: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }
  const tap: React.CSSProperties = { minHeight: 44 }
  const isPurchase = mode === 'purchase' && id == null

  const title = isPurchase ? t('so_purchase_title') : detail?.ref ? t('so_order_title_fmt').replace('{ref}', detail.ref) : t('so_new_title')

  const stepsLine = detail ? (
    <div style={{ fontSize: 12, color: 'var(--tx3)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: status === 'draft' ? 'var(--ac)' : 'var(--tx2)' }}>{t('so_status_draft')}</span>
      <span>›</span>
      <span style={{ color: status === 'ordered' ? 'var(--ac)' : 'var(--tx2)' }}>{t('so_status_ordered')}{detail.ordered_at ? ` ${dateFmt(detail.ordered_at)}` : ''}</span>
      <span>›</span>
      <span style={{ color: status === 'received' ? 'var(--ac)' : 'var(--tx2)' }}>{t('so_status_received')}{detail.received_at ? ` ${dateFmt(detail.received_at)}` : ''}</span>
      {status === 'cancelled' ? <span style={{ color: 'var(--rust)' }}>· {t('so_status_cancelled')}</span> : null}
    </div>
  ) : null

  const supplierBlock = (
    <div>
      <div className="t-label" style={{ marginBottom: 4 }}>{t('so_supplier')}</div>
      {!supPicking && form.supplierId != null ? (
        <div style={row}>
          <span style={{ fontSize: 15 }}>{supplierName}</span>
          {editable ? <button type="button" className="btn ghost sm" style={tap} onClick={() => setSupPicking(true)}>{t('so_change')}</button> : null}
        </div>
      ) : newSup ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <input style={inp} value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} placeholder={t('so_new_supplier_name')} aria-label={t('so_new_supplier_name')} />
          <input style={inp} value={newSup.email} onChange={(e) => setNewSup({ ...newSup, email: e.target.value })} placeholder={t('so_new_supplier_email')} aria-label={t('so_new_supplier_email')} type="email" />
          <input style={inp} value={newSup.phone} onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} placeholder={t('so_new_supplier_phone')} aria-label={t('so_new_supplier_phone')} type="tel" />
          <div style={row}>
            <button type="button" className="btn primary sm" style={tap} disabled={busy || !newSup.name.trim()} onClick={() => void addSupplier()}>{t('so_add_supplier')}</button>
            <button type="button" className="btn ghost sm" style={tap} onClick={() => setNewSup(null)}>{t('cancel')}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 4 }}>
          <input style={inp} value={supQuery} onChange={(e) => setSupQuery(e.target.value)} placeholder={t('so_supplier_search')} aria-label={t('so_supplier_search')} />
          <div style={{ border: '1px solid var(--bd)', borderRadius: 3 }}>
            {supplierHits.map((c) => (
              <button key={c.ContactID} type="button" onClick={() => { setForm((f) => ({ ...f, supplierId: c.ContactID })); setSupPicking(false); setSupQuery('') }}
                style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '8px 10px', background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', color: 'var(--tx)', cursor: 'pointer', fontSize: 14 }}>
                {supplierDisplayName(c)}{c.Role ? <span style={{ color: 'var(--tx3)', fontSize: 12 }}> · {c.Role}</span> : null}
              </button>
            ))}
            <button type="button" onClick={() => setNewSup({ name: supQuery, email: '', phone: '' })}
              style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '8px 10px', background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 14 }}>
              {t('so_new_supplier')}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const linesBlock = (
    <div>
      <div className="t-label" style={{ marginBottom: 4 }}>{t('so_lines')}</div>
      {form.lines.length === 0 ? <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 6 }}>{t('so_lines_empty')}</div> : null}
      <div style={{ display: 'grid', gap: 6 }}>
        {form.lines.map((l) => {
          const q = parseNum(l.qty_ordered) ?? 0
          const p = parseNum(l.unit_price_ht)
          const short = l.qty_received > 0 && l.qty_received < q
          return (
            <div key={l.key} style={{ border: '1px solid var(--bd)', borderRadius: 4, padding: '8px 10px', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
                <span className="t-mono-sm" style={{ fontSize: 11, color: short ? 'var(--yellow)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>
                  {l.qty_received > 0 ? t('so_received_fmt').replace('{n}', String(l.qty_received)).replace('{of}', String(q)) : t('so_in_stock_fmt').replace('{n}', String(l.stock_qty)).replace('{unit}', l.unit)}
                </span>
              </div>
              <div style={row}>
                <label style={{ ...row, gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
                  {t('so_qty')}
                  <input style={numInp} inputMode="decimal" value={l.qty_ordered} disabled={!editable} aria-label={t('so_qty')} onChange={(e) => patchLine(l.key, { qty_ordered: e.target.value })} />
                  <span>{l.unit}</span>
                </label>
                <label style={{ ...row, gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
                  {t('so_price_ht')}
                  <input style={numInp} inputMode="decimal" value={l.unit_price_ht} disabled={!editable} aria-label={t('so_price_ht')} onChange={(e) => patchLine(l.key, { unit_price_ht: e.target.value })} />
                </label>
                <span style={{ marginLeft: 'auto', fontSize: 13 }}>{p != null ? money(q * p) : '—'}</span>
                {editable && l.qty_received === 0 ? (
                  <button type="button" className="btn ghost sm" style={{ ...tap, minWidth: 44 }} aria-label={t('so_remove_line')} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.key !== l.key) }))}>✕</button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      {editable ? (
        newItem ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            <input style={inp} value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder={t('so_new_item_name')} aria-label={t('so_new_item_name')} />
            <div style={row}>
              <input style={{ ...inp, flex: 1, width: 'auto' }} value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder={t('so_new_item_unit')} aria-label={t('so_new_item_unit')} />
              <input style={{ ...inp, flex: 2, width: 'auto' }} value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} placeholder={t('so_new_item_category')} aria-label={t('so_new_item_category')} />
            </div>
            <div style={row}>
              <button type="button" className="btn primary sm" style={tap} disabled={busy || !newItem.name.trim()} onClick={() => void addItem()}>{t('so_add_item')}</button>
              <button type="button" className="btn ghost sm" style={tap} onClick={() => setNewItem(null)}>{t('cancel')}</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
            <input style={inp} value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder={t('so_item_search')} aria-label={t('so_item_search')} />
            {itemQuery.trim() ? (
              <div style={{ border: '1px solid var(--bd)', borderRadius: 3 }}>
                {itemHits.map((it) => (
                  <button key={it.id} type="button" onClick={() => addLine(it)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '8px 10px', background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', color: 'var(--tx)', cursor: 'pointer', fontSize: 14 }}>
                    {it.name}<span style={{ color: 'var(--tx3)', fontSize: 12 }}> · {it.quantity} {it.unit}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setNewItem({ name: itemQuery, unit: 'units', category: '' })}
                  style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '8px 10px', background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 14 }}>
                  {t('so_new_item_fmt').replace('{name}', itemQuery.trim())}
                </button>
              </div>
            ) : null}
          </div>
        )
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, fontSize: 13 }}>
        <span className="t-label">{t('so_total_ht')}</span><b>{money(totalHt)}</b>
      </div>
    </div>
  )

  const notesBlock = (
    <div>
      <div className="t-label" style={{ marginBottom: 4 }}>{t('so_notes')}</div>
      <textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={form.notes} disabled={!editable} aria-label={t('so_notes')} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
    </div>
  )

  const expenseBlock = detail && status !== 'cancelled' ? (
    <div>
      <div className="t-label" style={{ marginBottom: 4 }}>{t('so_expense')}</div>
      {detail.expense ? (
        <div style={{ ...row, justifyContent: 'space-between', border: '1px solid var(--bd)', borderRadius: 3, padding: '8px 10px' }}>
          <span style={{ fontSize: 13 }}>
            {t('so_expense_line_fmt').replace('{date}', dateFmt(detail.expense.date)).replace('{ref}', detail.expense.receipt_ref ?? '—').replace('{ttc}', money(detail.expense.montant_ttc))}
          </span>
          <button type="button" className="btn ghost sm" style={tap} disabled={busy} onClick={() => void link(null)}>{t('so_unlink')}</button>
        </div>
      ) : expenseForm ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={row}>
            <label style={{ display: 'grid', gap: 2, flex: 1, minWidth: 140, fontSize: 12, color: 'var(--tx3)' }}>{t('so_exp_date')}
              <input type="date" style={inp} value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 2, flex: 1, minWidth: 140, fontSize: 12, color: 'var(--tx3)' }}>{t('so_exp_ref')}
              <input style={inp} value={expenseForm.ref} onChange={(e) => setExpenseForm({ ...expenseForm, ref: e.target.value })} />
            </label>
          </div>
          <div style={row}>
            <label style={{ display: 'grid', gap: 2, fontSize: 12, color: 'var(--tx3)' }}>{t('so_exp_ht')}
              <input style={numInp} inputMode="decimal" value={expenseForm.ht} onChange={(e) => setExpenseForm({ ...expenseForm, ht: e.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 2, fontSize: 12, color: 'var(--tx3)' }}>{t('so_exp_tva')}
              <input style={numInp} inputMode="decimal" value={expenseForm.tva} onChange={(e) => {
                const tva = e.target.value
                const ht = parseNum(expenseForm.ht); const r = parseNum(tva)
                setExpenseForm({ ...expenseForm, tva, ttc: ht != null && r != null ? String(Math.round(ht * (100 + r)) / 100) : expenseForm.ttc })
              }} />
            </label>
            <label style={{ display: 'grid', gap: 2, fontSize: 12, color: 'var(--tx3)' }}>{t('so_exp_ttc')}
              <input style={numInp} inputMode="decimal" value={expenseForm.ttc} onChange={(e) => setExpenseForm({ ...expenseForm, ttc: e.target.value })} />
            </label>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('so_exp_hint')}</div>
          <div style={row}>
            <button type="button" className="btn primary sm" style={tap} disabled={busy} onClick={() => void saveExpense()}>{t('so_exp_save')}</button>
            <button type="button" className="btn ghost sm" style={tap} onClick={() => setExpenseForm(null)}>{t('cancel')}</button>
          </div>
        </div>
      ) : linkable ? (
        <div style={{ border: '1px solid var(--bd)', borderRadius: 3 }}>
          {linkable.length === 0 ? <div style={{ padding: 10, fontSize: 12, color: 'var(--tx3)' }}>{t('so_link_empty')}</div> : null}
          {linkable.map((e) => (
            <button key={e.id} type="button" onClick={() => void link(e.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 44, padding: '8px 10px', background: 'none', border: 'none', borderBottom: '1px solid var(--bd)', color: 'var(--tx)', cursor: 'pointer', fontSize: 13 }}>
              {t('so_expense_line_fmt').replace('{date}', dateFmt(e.date)).replace('{ref}', e.receipt_ref ?? '—').replace('{ttc}', money(e.montant_ttc))}
            </button>
          ))}
          <button type="button" className="btn ghost sm" style={{ ...tap, margin: 6 }} onClick={() => setLinkable(null)}>{t('cancel')}</button>
        </div>
      ) : (
        <div style={row}>
          <button type="button" className="btn ghost sm" style={tap} disabled={busy} onClick={openExpenseForm}>{t('so_create_expense')}</button>
          <button type="button" className="btn ghost sm" style={tap} disabled={busy} onClick={() => void openLink()}>{t('so_link_expense')}</button>
        </div>
      )}
    </div>
  ) : null

  const filesBlock = detail ? (
    <div>
      <div className="t-label" style={{ marginBottom: 4 }}>{t('so_files')}</div>
      <div style={{ display: 'grid', gap: 4 }}>
        {detail.files.map((f) => (
          <button key={f.id} type="button" onClick={() => void openFile(f.storage_path)}
            style={{ textAlign: 'left', minHeight: 44, padding: '8px 10px', border: '1px solid var(--bd)', borderRadius: 3, background: 'none', color: 'var(--tx)', cursor: 'pointer', fontSize: 13 }}>
            {f.name}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { void onPickFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
      <button type="button" className="btn ghost sm" style={{ ...tap, marginTop: 6 }} disabled={busy} onClick={() => fileRef.current?.click()}>{t('so_add_file')}</button>
    </div>
  ) : null

  const purchaseBlock = isPurchase ? (
    <div style={{ display: 'grid', gap: 8 }}>
      <div>
        <div className="t-label" style={{ marginBottom: 4 }}>{t('so_ticket')}</div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { setPurchaseFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
        <button type="button" className="btn ghost sm" style={tap} onClick={() => fileRef.current?.click()}>{purchaseFile ? purchaseFile.name : t('so_ticket_pick')}</button>
      </div>
      <label style={{ ...row, fontSize: 13, minHeight: 44, cursor: 'pointer' }}>
        <input type="checkbox" checked={purchaseExpense} onChange={(e) => setPurchaseExpense(e.target.checked)} style={{ width: 20, height: 20 }} />
        {t('so_purchase_expense')}
      </label>
      {purchaseExpense ? (
        <div style={row}>
          <label style={{ display: 'grid', gap: 2, fontSize: 12, color: 'var(--tx3)' }}>{t('so_exp_ttc')}
            <input style={numInp} inputMode="decimal" value={purchaseTtc} onChange={(e) => setPurchaseTtc(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 2, flex: 1, minWidth: 140, fontSize: 12, color: 'var(--tx3)' }}>{t('so_exp_ref')}
            <input style={inp} value={purchaseRef} onChange={(e) => setPurchaseRef(e.target.value)} />
          </label>
        </div>
      ) : null}
    </div>
  ) : null

  const receivePanel = receiving ? (
    <div style={{ display: 'grid', gap: 2 }}>
      <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('so_receive_title')}</div>
      {form.lines.filter((l) => l.id != null).map((l) => {
        const raw = receiving[l.id as number] ?? '0'
        const q = parseNum(raw) ?? 0
        const set = (v: number) => setReceiving((r) => ({ ...(r ?? {}), [l.id as number]: String(Math.max(0, v)) }))
        return (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{l.name}</div>
              <div style={{ fontSize: 12, color: q > 0 ? 'var(--sage)' : 'var(--tx3)' }}>
                {t('so_move_fmt').replace('{from}', String(l.stock_qty)).replace('{to}', String(l.stock_qty + q)).replace('{unit}', l.unit)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--bd)', borderRadius: 4 }}>
              <button type="button" aria-label={t('so_less')} onClick={() => set(q - 1)} style={{ width: 44, height: 44, background: 'none', border: 'none', color: 'var(--tx2)', fontSize: 18, cursor: 'pointer' }}>−</button>
              <input inputMode="decimal" value={raw} aria-label={t('so_qty')} onChange={(e) => setReceiving((r) => ({ ...(r ?? {}), [l.id as number]: e.target.value }))}
                style={{ width: 44, height: 44, textAlign: 'center', background: 'none', border: 'none', color: 'var(--tx)', fontSize: 15 }} />
              <button type="button" aria-label={t('so_more')} onClick={() => set(q + 1)} style={{ width: 44, height: 44, background: 'none', border: 'none', color: 'var(--tx2)', fontSize: 18, cursor: 'pointer' }}>+</button>
            </div>
          </div>
        )
      })}
      <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>{t('so_receive_hint')}</div>
    </div>
  ) : null

  // Footer actions by state
  const footer = receiving ? (
    <>
      <button type="button" className="btn ghost sm" style={tap} disabled={busy} onClick={() => setReceiving(null)}>{t('cancel')}</button>
      <button type="button" className="btn primary sm" style={{ ...tap, marginLeft: 'auto' }} disabled={busy} onClick={() => void confirmReceive()}>{t('so_receive_confirm')}</button>
    </>
  ) : isPurchase ? (
    <>
      <button type="button" className="btn ghost sm" style={tap} disabled={busy || !dirty} onClick={() => void save()}>{t('so_save_draft')}</button>
      <button type="button" className="btn primary sm" style={{ ...tap, marginLeft: 'auto' }} disabled={busy || form.lines.length === 0 || form.supplierId == null} onClick={() => void receivePurchase()}>{t('so_received_today')}</button>
    </>
  ) : (
    <>
      {editable ? <button type="button" className="btn primary sm" style={tap} disabled={busy || !dirty} onClick={() => void save()}>{t('save')}</button> : null}
      {status === 'draft' ? <button type="button" className="btn ghost sm" style={tap} disabled={busy || form.lines.length === 0} onClick={() => void step('ordered')}>{t('so_mark_ordered')}</button> : null}
      {editable && form.lines.length > 0 ? <button type="button" className="btn ghost sm" style={tap} disabled={busy} onClick={() => void openReceive()}>{detail?.lines.some((l) => l.qty_received > 0) ? t('so_receive_rest') : t('so_receive')}</button> : null}
      {status === 'ordered' && detail?.lines.some((l) => l.qty_received > 0) ? <button type="button" className="btn ghost sm" style={tap} disabled={busy} onClick={() => void step('received')}>{t('so_close_short')}</button> : null}
      {form.lines.length > 0 ? <button type="button" className="btn ghost sm" style={tap} onClick={() => void copyText()}>{t('so_copy_text')}</button> : null}
      <span style={{ flex: 1 }} />
      {status === 'draft' && id != null ? <button type="button" className="btn ghost sm" style={{ ...tap, color: 'var(--rust)' }} disabled={busy} onClick={() => void removeDraft()}>{t('so_delete_draft')}</button> : null}
      {status === 'ordered' && !detail?.lines.some((l) => l.qty_received > 0) ? <button type="button" className="btn ghost sm" style={{ ...tap, color: 'var(--rust)' }} disabled={busy} onClick={() => void step('cancelled')}>{t('so_cancel_order')}</button> : null}
    </>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label={title} data-testid="supply-order-sheet"
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: isPhone ? 'var(--bg1)' : 'rgba(0,0,0,0.45)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={() => { if (!isPhone && !busy) attemptClose() }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: isPhone ? '100%' : 560, maxWidth: '100%', height: '100%', background: 'var(--bg1)', borderLeft: isPhone ? 'none' : '1px solid var(--bd)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isPhone ? 'max(12px, env(safe-area-inset-top)) 12px 10px 16px' : '14px 16px 10px 20px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22 }}>{title}</div>
            {stepsLine}
          </div>
          <button type="button" className="btn ghost sm" style={{ minWidth: 44, minHeight: 44 }} aria-label={t('close')} onClick={attemptClose} disabled={busy}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: isPhone ? '12px 16px' : '14px 20px', display: 'grid', gap: 16, alignContent: 'start' }}>
          {loading ? <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('so_loading')}</div> : receiving ? receivePanel : (
            <>
              {supplierBlock}
              {linesBlock}
              {purchaseBlock}
              {expenseBlock}
              {filesBlock}
              {notesBlock}
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: `10px 16px max(10px, env(safe-area-inset-bottom))`, borderTop: '1px solid var(--bd)', background: 'var(--bg1)' }}>
          {footer}
        </div>
        {unsavedDialog}
      </div>
    </div>
  )
}
