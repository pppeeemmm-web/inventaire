'use client'

import {
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { STOCK_CATEGORY_VALUES, labelStockCategory } from '@/lib/i18n/stockCategories'
import { useUnsavedCloseGuard } from '@/hooks/useUnsavedCloseGuard'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import {
  type StockItemRow,
  type StockContactLike,
  supplierDisplayName,
  formatStockCurrency,
  pricedInventoryValueEur,
} from '@/lib/stock-item'
import { useAtelierTabResource } from '@/hooks/useAtelierTabResource'
import { ATELIER_TAB_CACHE_POLICY, atelierTabCacheKey } from '@/lib/atelier/tab-cache-policy'

const UNCATEGORIZED = '__stock_uc__'

type StockEdit = Partial<StockItemRow> & {
  draftCost?: string
  draftNotes?: string
}

interface Props {
  contacts: StockContactLike[]
}

function matchesSearch(it: StockItemRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  return (
    it.name.toLowerCase().includes(s) ||
    (it.notes ?? '').toLowerCase().includes(s)
  )
}

function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SupplierHub({ contacts }: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [editing, setEditing] = useState<StockEdit | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryKey, setCategoryKey] = useState<string>('')
  const [lowOnly, setLowOnly] = useState(false)
  const [sortKey, setSortKey] = useState<'name' | 'qty' | 'updated'>('name')
  const [deleteStep2, setDeleteStep2] = useState(false)

  const suppliers = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.Role?.toLowerCase() === 'supplier' ||
          c.Role?.toLowerCase() === 'fournisseur',
      ),
    [contacts],
  )

  const load = useCallback(async () => {
    const sb = createClient()
    const { data, error } = await sb.from('stock_item').select('*').order('name')
    if (error) {
      toast.error(`${t('error_prefix')} ${stringifyError(error)}`)
      return []
    }
    return (data ?? []) as StockItemRow[]
  }, [t])

  const stockResource = useAtelierTabResource<StockItemRow[]>({
    cacheKey: atelierTabCacheKey('stock'),
    staleMs: ATELIER_TAB_CACHE_POLICY.stock.staleMs,
    load,
    initialData: [],
  })
  const items = useMemo(() => stockResource.data ?? [], [stockResource.data])
  const setItems = stockResource.setCachedData
  const loading = stockResource.loading
  const refreshItems = useCallback(async () => {
    await stockResource.refresh({ force: true })
  }, [stockResource])

  const filteredSorted = useMemo(() => {
    let rows = items.filter((it) => matchesSearch(it, search))
    if (lowOnly) rows = rows.filter((it) => it.quantity <= it.min_stock)
    if (categoryKey === UNCATEGORIZED) {
      rows = rows.filter((it) => !it.category?.trim())
    } else if (categoryKey) {
      rows = rows.filter((it) => (it.category ?? '').trim() === categoryKey)
    }
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    const sorted = [...rows]
    if (sortKey === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, loc))
    } else if (sortKey === 'qty') {
      sorted.sort((a, b) => Number(b.quantity) - Number(a.quantity))
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
    }
    return sorted
  }, [items, search, lowOnly, categoryKey, sortKey, lang])

  const kpiLow = useMemo(
    () => items.filter((it) => it.quantity <= it.min_stock).length,
    [items],
  )
  const kpiValue = useMemo(() => pricedInventoryValueEur(items), [items])

  const openNew = () => {
    setDeleteStep2(false)
    setEditing({
      name: '',
      category: null,
      quantity: 0,
      unit: 'units',
      min_stock: 0,
      supplier_id: null,
      cost_unit: null,
      notes: null,
      draftCost: '',
      draftNotes: '',
    })
  }

  const openEdit = (it: StockItemRow) => {
    setDeleteStep2(false)
    setEditing({
      ...it,
      draftCost: it.cost_unit != null ? String(it.cost_unit) : '',
      draftNotes: it.notes ?? '',
    })
  }

  const parseCost = (): number | null => {
    if (!editing) return null
    const raw = (editing.draftCost ?? '').trim()
    if (!raw) return null
    const n = Number(raw.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  async function handleSave(): Promise<boolean> {
    if (!editing?.name?.trim()) return false
    setBusy(true)
    const sb = createClient()
    const cost = parseCost()
    const payload = {
      name: editing.name.trim(),
      category: editing.category || null,
      quantity: Number(editing.quantity ?? 0),
      unit: (editing.unit || 'units').trim() || 'units',
      min_stock: Number(editing.min_stock ?? 0),
      supplier_id: editing.supplier_id || null,
      cost_unit: cost,
      notes: (editing.draftNotes ?? '').trim() || null,
    }

    try {
      if (editing.id) {
        const { error } = await sb
          .from('stock_item')
          .update(payload)
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('stock_item').insert(payload)
        if (error) throw error
      }
      await refreshItems()
      toast.success(t('stock_toast_saved'))
      setEditing(null)
      return true
    } catch (e) {
      toast.error(`${t('stock_save_failed')} ${stringifyError(e)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: number) {
    setBusy(true)
    const sb = createClient()
    const { error } = await sb.from('stock_item').delete().eq('id', id)
    if (error) {
      toast.error(`${t('error_prefix')} ${stringifyError(error)}`)
    } else {
      toast.success(t('stock_toast_deleted'))
      await refreshItems()
      setEditing(null)
    }
    setBusy(false)
    setDeleteStep2(false)
  }

  const adjustQty = async (id: number, delta: number) => {
    const it = items.find((i) => i.id === id)
    if (!it) return
    const next = Math.max(0, Number(it.quantity) + delta)
    const sb = createClient()
    const { error } = await sb
      .from('stock_item')
      .update({ quantity: next })
      .eq('id', id)
    if (error) {
      toast.error(`${t('stock_adjust_failed')} ${stringifyError(error)}`)
      return
    }
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, quantity: next } : x)),
    )
  }

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const header = [
      'name',
      'category',
      'quantity',
      'unit',
      'supplier',
      'unit_cost_eur',
      'min_stock',
      'notes',
    ]
    const lines = [header.join(',')]
    for (const it of filteredSorted) {
      const sup = contacts.find((c) => c.ContactID === it.supplier_id)
      const supName = sup ? supplierDisplayName(sup) : ''
      lines.push(
        [
          esc(it.name),
          esc(it.category ? labelStockCategory(it.category, t) : ''),
          String(it.quantity),
          esc(it.unit),
          esc(supName),
          it.cost_unit != null ? String(it.cost_unit) : '',
          String(it.min_stock),
          esc(it.notes ?? ''),
        ].join(','),
      )
    }
    downloadCsv(`stock-export-${new Date().toISOString().slice(0, 10)}.csv`, lines)
  }

  const editKey = editing ? String(editing.id ?? 'new') : ''
  const editingSnap = useMemo(
    () => (editing ? JSON.stringify(editing) : ''),
    [editing],
  )
  const [baselineEdit, setBaselineEdit] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (!editing) {
      setBaselineEdit(null)
      return
    }
    setBaselineEdit(JSON.stringify(editing))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey])
  const isDirtyStock =
    editing != null && baselineEdit != null && editingSnap !== baselineEdit

  const { attemptClose: attemptCloseStock, unsavedDialog: unsavedStockDialog } =
    useUnsavedCloseGuard({
      isDirty: isDirtyStock,
      onClose: () => {
        setEditing(null)
        setDeleteStep2(false)
      },
      performSave: () => handleSave(),
    })

  const pad = narrow ? '12px 12px' : '24px 32px'

  return (
    <div
      data-testid="atelier-stock-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        padding: pad,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
            {t('stock_title')}
          </div>
          <div
            className="t-mono-sm"
            style={{ color: 'var(--tx3)', marginTop: 4 }}
          >
            {t('stock_items_count_fmt').replace(/\{n\}/g, String(items.length))}
          </div>
        </div>
        <button
          type="button"
          className="btn primary sm"
          style={{ minHeight: 44 }}
          data-testid="atelier-stock-new-item"
          onClick={() => openNew()}
        >
          {t('stock_new_item')}
        </button>
      </div>

      <div
        data-testid="atelier-stock-kpis"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          className="t-mono-sm"
          style={{
            padding: '10px 14px',
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
            borderRadius: 4,
          }}
        >
          {t('stock_kpi_skus_fmt').replace(/\{n\}/g, String(items.length))}
        </div>
        <div
          className="t-mono-sm"
          style={{
            padding: '10px 14px',
            border: '1px solid var(--bd)',
            background: kpiLow ? 'var(--rust)18' : 'var(--bg1)',
            borderRadius: 4,
            color: kpiLow ? 'var(--rust)' : 'var(--tx2)',
          }}
        >
          {t('stock_kpi_low_fmt').replace(/\{n\}/g, String(kpiLow))}
        </div>
        <div
          className="t-mono-sm"
          style={{
            padding: '10px 14px',
            border: '1px solid var(--bd)',
            background: 'var(--bg1)',
            borderRadius: 4,
          }}
        >
          {t('stock_kpi_value_est')}:{' '}
          {kpiValue != null
            ? formatStockCurrency(lang, kpiValue)
            : '\u2014'}
        </div>
      </div>

      <div
        data-testid="atelier-stock-toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <input
          type="search"
          className="t-mono-sm"
          placeholder={t('stock_toolbar_search_ph')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px',
            minWidth: 120,
            maxWidth: 360,
            padding: '10px 12px',
            background: 'var(--bg0)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            borderRadius: 4,
          }}
        />
        <select
          className="t-mono-sm"
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value)}
          style={{
            padding: '10px 12px',
            background: 'var(--bg0)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            borderRadius: 4,
          }}
        >
          <option value="">{t('stock_category_all')}</option>
          <option value={UNCATEGORIZED}>{t('stock_uncategorized')}</option>
          {STOCK_CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {labelStockCategory(c, t)}
            </option>
          ))}
        </select>
        <label
          className="t-mono-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={lowOnly}
            onChange={(e) => setLowOnly(e.target.checked)}
          />
          {t('stock_low_stock_only')}
        </label>
        <label className="t-mono-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {t('stock_sort_label')}
          <select
            value={sortKey}
            onChange={(e) =>
              setSortKey(e.target.value as 'name' | 'qty' | 'updated')
            }
            style={{
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd)',
              color: 'var(--tx)',
              borderRadius: 4,
            }}
          >
            <option value="name">{t('stock_sort_name')}</option>
            <option value="qty">{t('stock_sort_qty')}</option>
            <option value="updated">{t('stock_sort_updated')}</option>
          </select>
        </label>
        <button
          type="button"
          className="btn ghost sm"
          style={{ minHeight: 44 }}
          onClick={() => exportCsv()}
        >
          {t('stock_export_csv')}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="tbl" data-testid="atelier-stock-table">
          <thead>
            <tr>
              <th>{t('stock_th_name')}</th>
              <th>{t('category')}</th>
              <th className="num">{t('stock_th_qty')}</th>
              <th>{t('stock_th_unit')}</th>
              <th>{t('stock_th_supplier')}</th>
              <th className="num">{t('stock_th_unit_price')}</th>
              <th className="num" style={{ whiteSpace: 'nowrap' }}>
                {t('stock_th_adjust')}
              </th>
              <th style={{ width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', padding: 40, color: 'var(--tx3)' }}
                >
                  {t('loading')}
                </td>
              </tr>
            ) : filteredSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: 'center', padding: 40, color: 'var(--tx3)' }}
                >
                  {items.length === 0 ? t('stock_empty') : t('stock_no_filtered_results')}
                </td>
              </tr>
            ) : (
              filteredSorted.map((it) => {
                const low = it.quantity <= it.min_stock
                const sup = contacts.find((c) => c.ContactID === it.supplier_id)
                const supName = sup ? supplierDisplayName(sup) : '\u2014'
                const stepStyle = narrow
                  ? { minWidth: 44, minHeight: 44, padding: 0 }
                  : { minWidth: 32, minHeight: 32, padding: '2px 6px' }
                return (
                  <tr
                    key={it.id}
                    style={{ opacity: low ? 1 : 0.92 }}
                    data-testid={`atelier-stock-row-${it.id}`}
                  >
                    <td
                      style={{
                        fontWeight: 500,
                        color: low ? 'var(--rust)' : 'var(--tx)',
                      }}
                    >
                      {it.name}{' '}
                      {low && (
                        <span
                          style={{
                            fontSize: 9,
                            marginLeft: 8,
                            color: 'var(--rust)',
                            border: '1px solid var(--rust)',
                            padding: '1px 4px',
                            borderRadius: 2,
                          }}
                        >
                          {t('stock_badge_low')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="t-mono-sm" style={{ opacity: 0.65 }}>
                        {it.category
                          ? labelStockCategory(it.category, t)
                          : '\u2014'}
                      </span>
                    </td>
                    <td
                      className="num"
                      style={{
                        fontWeight: 600,
                        color: low ? 'var(--rust)' : 'var(--tx)',
                      }}
                    >
                      {it.quantity}
                    </td>
                    <td style={{ fontSize: 10, color: 'var(--tx3)' }}>{it.unit}</td>
                    <td style={{ fontSize: 10, color: 'var(--tx2)' }}>
                      {supName}
                    </td>
                    <td className="num">
                      {formatStockCurrency(lang, it.cost_unit)}
                    </td>
                    <td className="num">
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 4,
                        }}
                      >
                        <button
                          type="button"
                          className="btn sm ghost"
                          style={stepStyle}
                          aria-label={t('stock_aria_minus_one')}
                          onClick={() => void adjustQty(it.id, -1)}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          className="btn sm ghost"
                          style={stepStyle}
                          aria-label={t('stock_aria_plus_one')}
                          onClick={() => void adjustQty(it.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="num">
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ minHeight: 44 }}
                        onClick={() => openEdit(it)}
                      >
                        {t('edit')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <>
          {unsavedStockDialog}
          <div
            role="presentation"
            data-testid="atelier-stock-editor-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              zIndex: 100,
              display: 'flex',
              alignItems: narrow ? 'stretch' : 'center',
              justifyContent: 'center',
              padding: narrow ? 0 : 16,
            }}
            onClick={() => void attemptCloseStock()}
          >
            <div
              role="dialog"
              aria-modal
              data-testid="atelier-stock-editor"
              style={{
                background: 'var(--bg1)',
                border: narrow ? 'none' : '1px solid var(--bd2)',
                width: narrow ? '100%' : '100%',
                maxWidth: narrow ? '100%' : 560,
                maxHeight: narrow ? '100%' : '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: narrow ? 'none' : '0 20px 60px rgba(0,0,0,0.5)',
                margin: narrow ? 0 : undefined,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  flexShrink: 0,
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--bd)',
                }}
              >
                <div className="t-eyebrow">
                  {editing.id ? t('stock_modal_edit') : t('stock_modal_new')}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_name')}
                  </div>
                  <input
                    value={editing.name || ''}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('category')}
                    </div>
                    <select
                      value={editing.category || ''}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          category: e.target.value || null,
                        })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    >
                      <option value="">—</option>
                      {STOCK_CATEGORY_VALUES.map((c) => (
                        <option key={c} value={c}>
                          {labelStockCategory(c, t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('stock_field_unit')}
                    </div>
                    <input
                      value={editing.unit || ''}
                      placeholder={t('stock_field_unit_ph')}
                      onChange={(e) =>
                        setEditing({ ...editing, unit: e.target.value })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: narrow ? '1fr' : '1fr 1fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('stock_field_qty_current')}
                    </div>
                    <input
                      type="number"
                      value={editing.quantity ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          quantity: Number(e.target.value),
                        })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <div>
                    <div className="t-label" style={{ marginBottom: 4 }}>
                      {t('stock_field_min_stock')}
                    </div>
                    <input
                      type="number"
                      value={editing.min_stock ?? 0}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          min_stock: Number(e.target.value),
                        })
                      }
                      style={{
                        width: '100%',
                        padding: 10,
                        background: 'var(--bg0)',
                        border: '1px solid var(--bd)',
                        color: 'var(--tx)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_unit_cost')}
                  </div>
                  <input
                    value={editing.draftCost ?? ''}
                    inputMode="decimal"
                    onChange={(e) =>
                      setEditing({ ...editing, draftCost: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_supplier')}
                  </div>
                  <select
                    value={editing.supplier_id || ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        supplier_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                    }}
                  >
                    <option value="">{t('stock_supplier_none_option')}</option>
                    {suppliers.map((s) => (
                      <option key={s.ContactID} value={s.ContactID}>
                        {supplierDisplayName(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4 }}>
                    {t('stock_field_notes')}
                  </div>
                  <textarea
                    value={editing.draftNotes ?? ''}
                    placeholder={t('stock_notes_ph')}
                    rows={3}
                    onChange={(e) =>
                      setEditing({ ...editing, draftNotes: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg0)',
                      border: '1px solid var(--bd)',
                      color: 'var(--tx)',
                      borderRadius: 4,
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  padding: `12px 16px max(12px, env(safe-area-inset-bottom))`,
                  borderTop: '1px solid var(--bd)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  className="btn primary"
                  style={{ flex: '1 1 120px', minHeight: 44 }}
                  onClick={() => void handleSave()}
                  disabled={busy || !editing.name?.trim()}
                >
                  {busy ? '…' : t('save')}
                </button>
                {editing.id && (
                  <>
                    {!deleteStep2 ? (
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ color: 'var(--rust)', minHeight: 44 }}
                        onClick={() => setDeleteStep2(true)}
                      >
                        {t('delete')}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{
                            color: 'var(--rust)',
                            border: '1px solid var(--rust)',
                            minHeight: 44,
                          }}
                          disabled={busy}
                          onClick={() => void handleDelete(editing.id!)}
                        >
                          {t('stock_delete_step2')}
                        </button>
                        <button
                          type="button"
                          className="btn ghost"
                          style={{ minHeight: 44 }}
                          onClick={() => setDeleteStep2(false)}
                        >
                          {t('back')}
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="btn ghost"
                  style={{ marginLeft: narrow ? 0 : 'auto', minHeight: 44 }}
                  onClick={() => void attemptCloseStock()}
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
