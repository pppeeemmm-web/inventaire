'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { labelStockCategory } from '@/lib/i18n/stockCategories'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import {
  type StockItemRow,
  type StockContactLike,
  supplierDisplayName,
} from '@/lib/stock-item'

const UNCATEGORIZED_BUCKET = '__stock_uc__'

function bucketFor(it: StockItemRow): string {
  const c = it.category?.trim()
  return c ? c : UNCATEGORIZED_BUCKET
}

interface Props {
  contacts: StockContactLike[]
}

export function StockTake({ contacts }: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [items, setItems] = useState<StockItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [diffOnly, setDiffOnly] = useState(false)
  const [applyModal, setApplyModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data, error } = await sb
      .from('stock_item')
      .select('*')
      .order('category')
      .order('name')
    if (error) {
      toast.error(`${t('error_prefix')} ${stringifyError(error)}`)
      setItems([])
    } else if (data) {
      const rows = data as StockItemRow[]
      setItems(rows)
      const initial: Record<number, number> = {}
      rows.forEach((it) => {
        initial[it.id] = it.quantity
      })
      setCounts(initial)
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const searchNorm = search.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    let r = items
    if (searchNorm) {
      r = r.filter((it) => it.name.toLowerCase().includes(searchNorm))
    }
    if (diffOnly) {
      r = r.filter((it) => counts[it.id] !== it.quantity)
    }
    return r
  }, [items, searchNorm, diffOnly, counts])

  const categories = useMemo(() => {
    const cats = new Set(filteredItems.map(bucketFor))
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    return Array.from(cats).sort((a, b) => {
      const la =
        a === UNCATEGORIZED_BUCKET
          ? t('stock_uncategorized')
          : labelStockCategory(a, t)
      const lb =
        b === UNCATEGORIZED_BUCKET
          ? t('stock_uncategorized')
          : labelStockCategory(b, t)
      return la.localeCompare(lb, loc)
    })
  }, [filteredItems, t, lang])

  async function runApply() {
    setBusy(true)
    const sb = createClient()
    const updates = items.filter((it) => counts[it.id] !== it.quantity)

    if (updates.length === 0) {
      setBusy(false)
      setApplyModal(false)
      return
    }

    const results = await Promise.all(
      updates.map((it) =>
        sb.from('stock_item').update({ quantity: counts[it.id] }).eq('id', it.id),
      ),
    )

    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      toast.error(
        t('stock_take_err_fmt').replace(/\{n\}/g, String(errors.length)),
      )
    } else {
      toast.success(
        t('stock_take_ok_fmt').replace(/\{n\}/g, String(updates.length)),
      )
      await load()
    }
    setBusy(false)
    setApplyModal(false)
  }

  const stepStyle = narrow
    ? { minWidth: 44, minHeight: 44, padding: 0 }
    : { minWidth: 32, minHeight: 32, padding: '2px 6px' }

  return (
    <div
      data-testid="atelier-stock-take-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        padding: narrow
          ? `12px 12px max(12px, env(safe-area-inset-bottom))`
          : '24px 32px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
            {t('stock_take_title')}
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
            {t('stock_take_subtitle')}
          </div>
        </div>
        {!narrow && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn ghost sm"
              style={{ minHeight: 44 }}
              onClick={() => void load()}
            >
              {t('stock_take_refresh')}
            </button>
            <button
              type="button"
              className="btn primary sm"
              style={{ minHeight: 44 }}
              data-testid="atelier-stock-take-apply-top"
              onClick={() => setApplyModal(true)}
              disabled={busy || loading}
            >
              {busy ? t('stock_take_applying') : t('stock_take_apply')}
            </button>
          </div>
        )}
      </div>

      <div
        data-testid="atelier-stock-take-toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <input
          type="search"
          className="t-mono-sm"
          placeholder={t('stock_take_search_ph')}
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
            checked={diffOnly}
            onChange={(e) => setDiffOnly(e.target.checked)}
          />
          {t('stock_take_diff_only')}
        </label>
      </div>

      <div
        data-testid="atelier-stock-take-scroll"
        style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid var(--bd)',
          background: 'var(--bg1)',
        }}
      >
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>
            {t('loading')}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>
            {t('stock_take_empty')}
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>
            {t('stock_take_no_rows_filtered')}
          </div>
        ) : (
          <table className="tbl" data-testid="atelier-stock-take-table" style={{ border: 'none' }}>
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--bg2)',
              }}
            >
              <tr>
                <th style={{ paddingLeft: 20 }}>{t('stock_take_th_name')}</th>
                <th>{t('stock_take_th_supplier')}</th>
                <th className="num">{t('stock_take_th_theoretical')}</th>
                <th className="num" style={{ width: narrow ? 140 : 120 }}>
                  {t('stock_take_th_actual')}
                </th>
                <th className="num" style={{ width: narrow ? 96 : 80 }}>
                  {t('stock_take_th_diff')}
                </th>
                <th style={{ width: narrow ? 52 : 40 }} />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <Fragment key={cat}>
                  <tr style={{ background: 'var(--bg0)' }}>
                    <td
                      colSpan={6}
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: 1,
                        color: 'var(--tx3)',
                        padding: '8px 20px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {cat === UNCATEGORIZED_BUCKET
                        ? t('stock_uncategorized')
                        : labelStockCategory(cat, t)}
                    </td>
                  </tr>
                  {filteredItems
                    .filter((it) => bucketFor(it) === cat)
                    .map((it) => {
                      const diff = counts[it.id] - it.quantity
                      const sup = contacts.find((c) => c.ContactID === it.supplier_id)
                      const supName = sup ? supplierDisplayName(sup) : '\u2014'

                      return (
                        <tr key={it.id}>
                          <td style={{ paddingLeft: 20, fontWeight: 500 }}>
                            {it.name}{' '}
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 400,
                                color: 'var(--tx3)',
                                marginLeft: 4,
                              }}
                            >
                              ({it.unit})
                            </span>
                          </td>
                          <td style={{ fontSize: 10, color: 'var(--tx3)' }}>{supName}</td>
                          <td className="num t-mono" style={{ opacity: 0.6 }}>
                            {it.quantity}
                          </td>
                          <td className="num">
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 4,
                              }}
                            >
                              <button
                                type="button"
                                className="btn sm ghost"
                                style={stepStyle}
                                onClick={() =>
                                  setCounts((prev) => ({
                                    ...prev,
                                    [it.id]: Math.max(0, (prev[it.id] ?? 0) - 1),
                                  }))
                                }
                              >
                                −
                              </button>
                              <input
                                type="number"
                                value={counts[it.id] ?? 0}
                                onChange={(e) =>
                                  setCounts((prev) => ({
                                    ...prev,
                                    [it.id]: Number(e.target.value),
                                  }))
                                }
                                style={{
                                  width: narrow ? 56 : 50,
                                  textAlign: 'center',
                                  padding: '4px',
                                  background: 'var(--bg0)',
                                  border: '1px solid var(--bd)',
                                  color: 'var(--tx)',
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              />
                              <button
                                type="button"
                                className="btn sm ghost"
                                style={stepStyle}
                                onClick={() =>
                                  setCounts((prev) => ({
                                    ...prev,
                                    [it.id]: (prev[it.id] ?? 0) + 1,
                                  }))
                                }
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td
                            className="num t-mono"
                            style={{
                              fontWeight: 600,
                              color:
                                diff > 0
                                  ? 'var(--sage)'
                                  : diff < 0
                                    ? 'var(--rust)'
                                    : 'var(--tx3)',
                            }}
                          >
                            {diff > 0 ? `+${diff}` : diff === 0 ? '\u2014' : diff}
                          </td>
                          <td>
                            {diff !== 0 && (
                              <button
                                type="button"
                                className="btn sm ghost"
                                style={{
                                  ...stepStyle,
                                  minWidth: narrow ? 44 : undefined,
                                }}
                                title={t('stock_take_reset_title')}
                                onClick={() =>
                                  setCounts((prev) => ({
                                    ...prev,
                                    [it.id]: it.quantity,
                                  }))
                                }
                              >
                                ↺
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {narrow && (
        <div
          data-testid="atelier-stock-take-sticky-actions"
          style={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            right: 0,
            marginTop: 'auto',
            marginLeft: narrow ? -12 : 0,
            marginRight: narrow ? -12 : 0,
            padding: `10px 12px max(10px, env(safe-area-inset-bottom))`,
            background: 'var(--bg2)',
            borderTop: '1px solid var(--bd)',
            display: 'flex',
            gap: 10,
            zIndex: 20,
          }}
        >
          <button
            type="button"
            className="btn ghost sm"
            style={{ flex: 1, minHeight: 44 }}
            onClick={() => void load()}
          >
            {t('stock_take_refresh')}
          </button>
          <button
            type="button"
            className="btn primary sm"
            style={{ flex: 1, minHeight: 44 }}
            data-testid="atelier-stock-take-apply-sticky"
            onClick={() => setApplyModal(true)}
            disabled={busy || loading}
          >
            {busy ? t('stock_take_applying') : t('stock_take_apply')}
          </button>
        </div>
      )}

      {applyModal && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !busy && setApplyModal(false)}
        >
          <div
            role="dialog"
            aria-modal
            data-testid="atelier-stock-take-apply-modal"
            style={{
              background: 'var(--bg1)',
              border: '1px solid var(--bd2)',
              maxWidth: 420,
              width: '100%',
              padding: 20,
              borderRadius: 4,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="t-eyebrow" style={{ marginBottom: 12 }}>
              {t('stock_take_apply_modal_title')}
            </div>
            <div className="t-mono-sm" style={{ color: 'var(--tx2)', marginBottom: 20 }}>
              {t('stock_take_confirm_apply')}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn primary"
                style={{ flex: '1 1 120px', minHeight: 44 }}
                disabled={busy}
                onClick={() => void runApply()}
              >
                {busy ? t('stock_take_applying') : t('btn_confirm')}
              </button>
              <button
                type="button"
                className="btn ghost"
                style={{ minHeight: 44 }}
                disabled={busy}
                onClick={() => setApplyModal(false)}
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
