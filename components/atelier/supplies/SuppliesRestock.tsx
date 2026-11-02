'use client'

// Réassort / Commande — supplies out of stock or below their minimum, grouped by supplier,
// with an order quantity per line and a "copy order" per supplier. Order quantities are a
// per-device draft (no orders table yet); minimums are written to `stock_item.min_stock`.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import {
  type StockItemRow,
  type StockContactLike,
  supplierDisplayName,
  formatStockCurrency,
} from '@/lib/stock-item'

const DRAFT_KEY = 'pem_restock_order_draft'

function readDraft(): Record<number, number> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Record<number, number>) : {}
  // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked or bad JSON: start with an empty draft
  } catch {
    return {}
  }
}

function needsRestock(it: StockItemRow): boolean {
  return it.quantity <= 0 || (it.min_stock > 0 && it.quantity <= it.min_stock)
}

export function SuppliesRestock({ contacts }: { contacts: StockContactLike[] }) {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<StockItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [order, setOrder] = useState<Record<number, number>>({})

  useEffect(() => { setOrder(readDraft()) }, [])
  useEffect(() => {
    // eslint-disable-next-line pem-i18n/no-silent-catch -- private mode: the draft is simply not kept
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(order)) } catch { /* private mode: draft not kept */ }
  }, [order])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await createClient().from('stock_item').select('*').order('name')
    if (error) toast.error(`${t('error_prefix')} ${stringifyError(error)}`)
    setItems((data ?? []) as StockItemRow[])
    setLoading(false)
  }, [t])
  useEffect(() => { void load() }, [load])

  const nameById = useMemo(() => new Map(contacts.map((c) => [c.ContactID, supplierDisplayName(c)])), [contacts])

  const groups = useMemo(() => {
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    const shown = items.filter((it) => showAll || needsRestock(it) || (order[it.id] ?? 0) > 0)
    const by = new Map<string, { label: string; rows: StockItemRow[] }>()
    for (const it of shown) {
      const key = it.supplier_id != null ? String(it.supplier_id) : '_none'
      const label = it.supplier_id != null ? (nameById.get(it.supplier_id) ?? `#${it.supplier_id}`) : t('restock_no_supplier')
      if (!by.has(key)) by.set(key, { label, rows: [] })
      by.get(key)!.rows.push(it)
    }
    return [...by.entries()]
      .sort(([ka, a], [kb, b]) => (ka === '_none' ? 1 : kb === '_none' ? -1 : a.label.localeCompare(b.label, loc)))
      .map(([key, g]) => ({ key, ...g }))
  }, [items, showAll, order, nameById, lang, t])

  async function saveMin(it: StockItemRow, raw: string) {
    const v = raw === '' ? 0 : Math.max(0, Number(raw))
    if (Number.isNaN(v) || v === it.min_stock) return
    const { error } = await createClient().from('stock_item').update({ min_stock: v }).eq('id', it.id)
    if (error) { toast.error(`${t('error_prefix')} ${stringifyError(error)}`); return }
    setItems((p) => p.map((x) => (x.id === it.id ? { ...x, min_stock: v } : x)))
    toast.success(t('restock_min_saved'))
  }

  async function copyOrder(label: string, rows: StockItemRow[]) {
    const date = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')
    const lines = rows
      .filter((r) => (order[r.id] ?? 0) > 0)
      .map((r) => `- ${order[r.id]} ${r.unit || ''} × ${r.name}`.replace(/\s+×/, ' ×'))
    if (!lines.length) return
    const text = [t('restock_order_header_fmt').replace('{supplier}', label).replace('{date}', date), '', ...lines].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('restock_copied'))
    // eslint-disable-next-line pem-i18n/no-silent-catch -- surfaced with a toast
    } catch (e) {
      toast.error(`${t('error_prefix')} ${stringifyError(e)}`)
    }
  }

  const cell: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--bd)', fontSize: 12, verticalAlign: 'middle' }
  const num: React.CSSProperties = { ...cell, textAlign: 'right', whiteSpace: 'nowrap' }
  const input: React.CSSProperties = {
    width: 70, padding: '4px 6px', fontSize: 12, textAlign: 'right',
    background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)',
  }

  return (
    <div data-testid="supplies-restock" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 28px' }}>
      <p style={{ fontSize: 12, color: 'var(--tx2)', margin: '0 0 10px', maxWidth: 760 }}>{t('restock_intro')}</p>
      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--tx2)', marginBottom: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        {t('restock_show_all')}
      </label>

      {!loading && groups.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('restock_empty')}</div>
      ) : null}

      {groups.map((g) => {
        const total = g.rows.reduce((s, r) => s + (order[r.id] ?? 0) * (r.cost_unit ?? 0), 0)
        const hasOrder = g.rows.some((r) => (order[r.id] ?? 0) > 0)
        return (
          <section key={g.key} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
              <div className="t-eyebrow">{g.label}</div>
              {total > 0 ? (
                <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>
                  {t('restock_total_fmt').replace('{total}', formatStockCurrency(lang, total))}
                </span>
              ) : null}
              <button type="button" className="btn ghost sm" disabled={!hasOrder} onClick={() => void copyOrder(g.label, g.rows)} style={{ marginLeft: 'auto' }}>
                {t('restock_copy')}
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <th style={{ ...cell, textAlign: 'left' }}>{t('restock_col_item')}</th>
                  <th style={num}>{t('restock_col_qty')}</th>
                  <th style={num}>{t('restock_col_min')}</th>
                  <th style={num}>{t('restock_col_order')}</th>
                  <th style={num}>{t('restock_col_estimate')}</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const q = order[r.id] ?? 0
                  return (
                    <tr key={r.id} style={{ background: needsRestock(r) ? 'color-mix(in srgb, var(--rust) 8%, transparent)' : undefined }}>
                      <td style={cell}>
                        {r.name}
                        {r.category ? <span style={{ color: 'var(--tx3)', fontSize: 10 }}> · {r.category}</span> : null}
                      </td>
                      <td style={num}>{r.quantity} {r.unit}</td>
                      <td style={num}>
                        <input
                          type="number" min={0} step="any" defaultValue={r.min_stock || ''}
                          aria-label={t('restock_col_min')}
                          onBlur={(e) => void saveMin(r, e.target.value)}
                          style={input}
                        />
                      </td>
                      <td style={num}>
                        <input
                          type="number" min={0} step="any" value={q || ''}
                          aria-label={t('restock_col_order')}
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value) || 0)
                            setOrder((p) => {
                              const n = { ...p }
                              if (v > 0) n[r.id] = v; else delete n[r.id]
                              return n
                            })
                          }}
                          style={input}
                        />
                      </td>
                      <td style={num}>{q > 0 && r.cost_unit != null ? formatStockCurrency(lang, q * r.cost_unit) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      })}
    </div>
  )
}
