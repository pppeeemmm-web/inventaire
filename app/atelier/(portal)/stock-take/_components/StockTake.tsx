'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { labelStockCategory } from '@/lib/i18n/stockCategories'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { PhoneListToolbar, PhoneChip } from '@/components/shared/phone/PhoneListToolbar'
import { PhoneListRow } from '@/components/shared/phone/PhoneListRow'
import { toast } from '@/lib/ui/toast'
import { stringifyError } from '@/lib/error'
import { saveStockQuantities } from '@/app/atelier/(portal)/stock/equipment-actions'
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
    const updates = items.filter((it) => counts[it.id] !== it.quantity)

    if (updates.length === 0) {
      setBusy(false)
      setApplyModal(false)
      return
    }

    // Through the Stock door, one request; the count is the truth, so no stale check (the door stamps updated_at).
    // Not all or nothing: what saved is reloaded, the failed lines keep their typed count and are named.
    const r = await saveStockQuantities(updates.map((it) => ({ id: it.id, quantity: counts[it.id] })))
    const failedIds = 'error' in r ? updates.map((it) => it.id) : r.failed
    if (failedIds.length > 0) {
      const names = updates.filter((it) => failedIds.includes(it.id)).map((it) => it.name).slice(0, 5).join(', ')
      toast.error(`${t('stock_take_err_fmt').replace(/\{n\}/g, String(failedIds.length))} ${names}`)
    } else {
      toast.success(
        t('stock_take_ok_fmt').replace(/\{n\}/g, String(updates.length)),
      )
    }
    const keep = Object.fromEntries(failedIds.map((id) => [id, counts[id]]))
    await load()
    if (failedIds.length > 0) setCounts((prev) => ({ ...prev, ...keep }))
    setBusy(false)
    setApplyModal(false)
  }

  // One way to change a count, for the desk table and the phone rows alike.
  const setCount = (id: number, v: number) => setCounts((prev) => ({ ...prev, [id]: v }))
  const bump = (id: number, d: number) => setCounts((prev) => ({ ...prev, [id]: d < 0 ? Math.max(0, (prev[id] ?? 0) + d) : (prev[id] ?? 0) + d }))

  const stepStyle = { minWidth: 32, minHeight: 32, padding: '2px 6px' }
  const phoneStep = { minWidth: 44, minHeight: 44, padding: 0 }

  return (
    <div
      data-testid="atelier-stock-take-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        overflowY: narrow ? 'auto' : undefined,
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

      {narrow ? (
        <PhoneListToolbar
          query={search}
          onQuery={setSearch}
          placeholder={t('stock_take_search_ph')}
          chips={<PhoneChip label={t('stock_take_diff_only')} active={diffOnly} onClick={() => setDiffOnly((v) => !v)} />}
          testId="atelier-stock-take-phone-toolbar"
        />
      ) : (
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
      )}

      <div
        data-testid="atelier-stock-take-scroll"
        style={
          narrow
            ? { flex: '1 0 auto' }
            : {
                flex: 1,
                overflow: 'auto',
                border: '1px solid var(--bd)',
                background: 'var(--bg1)',
              }
        }
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
        ) : narrow ? (
          <div data-testid="atelier-stock-take-phone-list">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="t-eyebrow" style={{ color: 'var(--tx3)', margin: '14px 0 4px' }}>
                  {cat === UNCATEGORIZED_BUCKET
                    ? t('stock_uncategorized')
                    : labelStockCategory(cat, t)}
                </h3>
                <ul style={{ margin: 0, padding: 0 }}>
                  {filteredItems
                    .filter((it) => bucketFor(it) === cat)
                    .map((it) => {
                      const diff = counts[it.id] - it.quantity
                      const sup = contacts.find((c) => c.ContactID === it.supplier_id)
                      const supName = sup ? supplierDisplayName(sup) : '\u2014'
                      return (
                        <PhoneListRow
                          key={it.id}
                          title={it.name}
                          sub={`${supName} · ${it.quantity} ${it.unit}`.trim()}
                          value={diff > 0 ? `+${diff}` : diff === 0 ? '\u2014' : String(diff)}
                          alert={diff !== 0}
                          testId={`atelier-stock-take-row-${it.id}`}
                          trailing={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <button
                                type="button"
                                className="btn sm ghost"
                                style={phoneStep}
                                onClick={() => bump(it.id, -1)
                                }
                              >
                                −
                              </button>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={counts[it.id] ?? 0}
                                onChange={(e) => setCount(it.id, Number(e.target.value))
                                }
                                style={{
                                  width: 64,
                                  minHeight: 44,
                                  textAlign: 'center',
                                  padding: '4px',
                                  background: 'var(--bg0)',
                                  border: '1px solid var(--bd)',
                                  color: 'var(--tx)',
                                  fontSize: 16,
                                  fontWeight: 600,
                                }}
                              />
                              <button
                                type="button"
                                className="btn sm ghost"
                                style={phoneStep}
                                onClick={() => bump(it.id, 1)
                                }
                              >
                                +
                              </button>
                            </div>
                          }
                        />
                      )
                    })}
                </ul>
              </div>
            ))}
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
                <th className="num" style={{ width: 120 }}>
                  {t('stock_take_th_actual')}
                </th>
                <th className="num" style={{ width: 80 }}>
                  {t('stock_take_th_diff')}
                </th>
                <th style={{ width: 40 }} />
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
                                onClick={() => bump(it.id, -1)
                                }
                              >
                                −
                              </button>
                              <input
                                type="number"
                                value={counts[it.id] ?? 0}
                                onChange={(e) => setCount(it.id, Number(e.target.value))
                                }
                                style={{
                                  width: 50,
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
                                onClick={() => bump(it.id, 1)
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
                                style={{ ...stepStyle, minWidth: undefined }}
                                title={t('stock_take_reset_title')}
                                onClick={() => setCount(it.id, it.quantity)
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
            marginLeft: -12,
            marginRight: -12,
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
