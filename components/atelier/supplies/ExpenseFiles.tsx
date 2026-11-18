'use client'

// Invoice / ticket files of one expense (Vault « Factures », `document.expense_id`) and the supply orders that
// point to it. Pem 2026-11-18: « we track everything » — every expense can carry its file, order or not.
// Shown in the expense form of Revenus & dépenses once supply_orders.sql is live (SUPPLY_ORDERS_SQL_LIVE).

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import { getSignedUrl } from '@/app/atelier/(portal)/vault/actions'
import { attachFileToExpense, listExpenseFiles, listOrdersForExpense } from '@/app/atelier/(portal)/stock/supply-order-actions'
import type { SupplyOrderFile } from '@/lib/supply-orders'
import { uploadInvoiceFile } from '@/lib/supplies/upload-invoice'

export function ExpenseFiles({ expenseId, label, date }: { expenseId: number; label: string; date: string | null }) {
  const { t } = useI18n()
  const [files, setFiles] = useState<SupplyOrderFile[]>([])
  const [orders, setOrders] = useState<{ id: number; ref: string }[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const errText = useCallback((e: string) => (e.startsWith('so_err_') ? t(e as DictKey) : e), [t])

  const load = useCallback(async () => {
    const [f, o] = await Promise.all([listExpenseFiles(expenseId), listOrdersForExpense(expenseId)])
    if ('error' in f) { toast.error(errText(f.error)); return }
    if ('error' in o) { toast.error(errText(o.error)); return }
    setFiles(f.files)
    setOrders(o.orders)
  }, [expenseId, errText])
  useEffect(() => { void load() }, [load])

  async function onPick(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const up = await uploadInvoiceFile(file, label || file.name, date)
      if ('error' in up) { toast.error(errText(up.error)); return }
      const res = await attachFileToExpense(expenseId, up.id)
      if ('error' in res) { toast.error(errText(res.error)); return }
      toast.success(t('so_file_added'))
      await load()
    // eslint-disable-next-line pem-i18n/no-silent-catch -- surfaced with a toast (a TypeError = the bucket refused the PUT)
    } catch (e) {
      toast.error(e instanceof TypeError ? t('so_err_upload') : stringifyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function open(path: string | null) {
    if (!path) return
    const res = await getSignedUrl(path)
    if ('error' in res) { toast.error(res.error); return }
    window.open(res.url, '_blank', 'noopener')
  }

  return (
    <div data-testid="expense-files" style={{ borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
      <div className="t-label" style={{ marginBottom: 3 }}>{t('so_expense_files')}</div>
      {orders.length ? (
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 6 }}>
          {t('so_expense_orders_fmt').replace('{refs}', orders.map((o) => o.ref).join(', '))}{' '}
          <a href={`/atelier/stock?view=orders&order=${orders[0].id}`} style={{ color: 'var(--ac)' }}>{t('so_open_order')}</a>
        </div>
      ) : null}
      {files.map((f) => (
        <button key={f.id} type="button" onClick={() => void open(f.storage_path)}
          style={{ display: 'block', width: '100%', textAlign: 'left', minHeight: 36, padding: '6px 8px', marginBottom: 4, border: '1px solid var(--bd)', borderRadius: 3, background: 'none', color: 'var(--tx)', cursor: 'pointer', fontSize: 12 }}>
          {f.name}
        </button>
      ))}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { void onPick(e.target.files?.[0] ?? null); e.target.value = '' }} />
      <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? '…' : t('so_add_file')}
      </button>
    </div>
  )
}
