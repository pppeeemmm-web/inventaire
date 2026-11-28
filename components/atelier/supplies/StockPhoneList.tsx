'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { STOCK_CATEGORY_VALUES, labelStockCategory } from '@/lib/i18n/stockCategories'

/** SupplierHub's key for « no category » (desk select value). */
const UNCATEGORIZED = '__stock_uc__'
import { supplierDisplayName, type StockContactLike, type StockItemRow } from '@/lib/stock-item'
import { PhoneListToolbar, PhoneChip } from '@/components/shared/phone/PhoneListToolbar'
import { PhoneListRow } from '@/components/shared/phone/PhoneListRow'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'

/** One-tap categories shown while no filter is active (fixed per tab — PhonePattern.md, Pem 2026-11-28 « GO build »). */
const QUICK_CATEGORIES = ['Pigment', 'Liant', 'Équipement'] as const

/**
 * Stock on the phone (PhonePattern.md step 1): count line + « … » + « + », the shared search / chips toolbar, the
 * filter sheet, one row per item (tap → the same editor as the desk). Filter state stays in SupplierHub.
 */
export function StockPhoneList({
  rows, loading, total, low, valueLabel, search, onSearch, categoryKey, onCategory, supplierId, onSupplier, suppliers, lowOnly,
  onLowOnly, onClear, onOpen, onNew, onExport, supplierNameFor,
}: {
  rows: StockItemRow[]
  loading: boolean
  total: number
  low: number
  valueLabel: string
  search: string
  onSearch: (q: string) => void
  categoryKey: string
  onCategory: (c: string) => void
  supplierId: number | null
  onSupplier: (id: number | null) => void
  suppliers: StockContactLike[]
  lowOnly: boolean
  onLowOnly: (v: boolean) => void
  onClear: () => void
  onOpen: (it: StockItemRow) => void
  onNew: () => void
  onExport: () => void
  supplierNameFor: (id: number | null) => string
}) {
  const { t } = useI18n()
  const [sheet, setSheet] = useState<'filters' | 'more' | null>(null)
  const active = (categoryKey ? 1 : 0) + (supplierId != null ? 1 : 0) + (lowOnly ? 1 : 0)
  const supplierName = supplierId != null ? supplierNameFor(supplierId) : ''
  const categoryLabel = (c: string) => (c === UNCATEGORIZED ? t('stock_uncategorized') : labelStockCategory(c, t))

  const chips = active ? (
    <>
      {categoryKey ? <PhoneChip label={categoryLabel(categoryKey)} active onClick={() => onCategory('')} /> : null}
      {supplierId != null ? <PhoneChip label={supplierName} active onClick={() => onSupplier(null)} /> : null}
      {lowOnly ? <PhoneChip label={t('stock_low_stock_only')} active onClick={() => onLowOnly(false)} /> : null}
    </>
  ) : QUICK_CATEGORIES.map((c) => <PhoneChip key={c} label={labelStockCategory(c, t)} onClick={() => onCategory(c)} />)

  return (
    <div data-testid="atelier-stock-phone">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="t-mono-sm" style={{ flex: 1, minWidth: 0, color: 'var(--tx3)' }}>
          {t('stock_filtered_count_fmt').replace(/\{shown\}/g, String(rows.length)).replace(/\{total\}/g, String(total))}
          {low ? <span style={{ color: 'var(--rust)' }}> · {t('stock_kpi_low_fmt').replace(/\{n\}/g, String(low))}</span> : null}
        </div>
        <button type="button" className="btn ghost sm" aria-label={t('phone_more_actions')} onClick={() => setSheet('more')} style={{ minWidth: 44, minHeight: 44 }}>…</button>
        <button type="button" className="btn primary sm" aria-label={t('stock_new_item')} data-testid="atelier-stock-new-item" onClick={onNew} style={{ minWidth: 44, minHeight: 44, borderRadius: 22, fontSize: 20 }}>+</button>
      </div>

      <PhoneListToolbar
        query={search}
        onQuery={onSearch}
        placeholder={t('stock_toolbar_search_ph')}
        activeCount={active}
        onOpenFilters={() => setSheet('filters')}
        chips={chips}
        testId="atelier-stock-phone-toolbar"
      />

      {loading ? <p className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '24px 0', textAlign: 'center' }}>{t('loading')}</p> : null}
      {!loading && rows.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--tx3)' }}>
          <p className="t-mono-sm" style={{ margin: '0 0 8px' }}>{total === 0 ? t('stock_empty') : t('stock_no_filtered_results')}</p>
          {total > 0 ? <button type="button" className="btn ghost sm" onClick={onClear} style={{ minHeight: 44 }}>{t('phone_filters_clear')}</button> : null}
        </div>
      ) : null}
      <ul style={{ margin: 0, padding: 0 }}>
        {rows.map((it) => (
          <PhoneListRow
            key={it.id}
            title={it.name}
            sub={[it.category ? labelStockCategory(it.category, t) : '', it.supplier_id ? supplierNameFor(it.supplier_id) : ''].filter(Boolean).join(' · ')}
            value={`${it.quantity} ${it.unit}`.trim()}
            alert={it.quantity <= it.min_stock}
            onClick={() => onOpen(it)}
            testId={`atelier-stock-row-${it.id}`}
          />
        ))}
      </ul>

      {sheet === 'filters' ? (
        <PhoneSheet
          title={t('phone_filters')}
          onClose={() => setSheet(null)}
          testId="atelier-stock-phone-filters"
          footer={<button type="button" className="btn primary" onClick={() => setSheet(null)} style={{ width: '100%', minHeight: 48 }}>{t('phone_filters_show_fmt').replace('{n}', t('stock_items_count_fmt').replace(/\{n\}/g, String(rows.length)))}</button>}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost sm" onClick={onClear} disabled={!active && !search} style={{ minHeight: 44 }}>{t('phone_filters_clear')}</button>
          </div>
          <h3 className="t-eyebrow" style={{ color: 'var(--tx3)', margin: '8px 0 6px' }}>{t('category')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[...STOCK_CATEGORY_VALUES, UNCATEGORIZED].map((c) => (
              <PhoneChip key={c} label={categoryLabel(c)} active={categoryKey === c} onClick={() => onCategory(categoryKey === c ? '' : c)} />
            ))}
          </div>
          <h3 className="t-eyebrow" style={{ color: 'var(--tx3)', margin: '14px 0 6px' }}>{t('stock_th_supplier')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suppliers.map((s) => (
              <PhoneChip key={s.ContactID} label={supplierDisplayName(s)} active={supplierId === s.ContactID} onClick={() => onSupplier(supplierId === s.ContactID ? null : s.ContactID)} />
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginTop: 10, borderTop: '1px solid var(--bd)' }}>
            <span>{t('stock_low_stock_only')}</span>
            <input type="checkbox" checked={lowOnly} onChange={(e) => onLowOnly(e.target.checked)} style={{ width: 22, height: 22 }} />
          </label>
        </PhoneSheet>
      ) : null}

      {sheet === 'more' ? (
        <PhoneSheet title={t('phone_more_actions')} onClose={() => setSheet(null)} testId="atelier-stock-phone-more">
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '4px 0 8px' }}>{t('stock_kpi_value_est')}: {valueLabel}</div>
          <button type="button" className="btn ghost" data-testid="atelier-stock-export-all-csv" onClick={() => { setSheet(null); onExport() }} style={{ width: '100%', minHeight: 48, justifyContent: 'flex-start' }}>{t('stock_export_all_csv')}</button>
        </PhoneSheet>
      ) : null}
    </div>
  )
}
