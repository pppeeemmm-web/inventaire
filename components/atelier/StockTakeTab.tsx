'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { labelStockCategory } from '@/lib/i18n/stockCategories'

interface StockItem {
  id:           number
  name:         string
  category:     string | null
  quantity:     number    // recorded
  unit:         string
  min_stock:    number
  supplier_id:  number | null
  cost_unit:    number | null
  notes:        string | null
  updated_at:   string
}

const UNCATEGORIZED_BUCKET = '__stock_uc__'

function bucketFor(it: StockItem): string {
  const c = it.category?.trim()
  return c ? c : UNCATEGORIZED_BUCKET
}

interface Props {
  contacts: { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null }[]
}

export function StockTakeTab({ contacts }: Props) {
  const { t, lang } = useI18n()
  const [items,      setItems]      = useState<StockItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [counts,     setCounts]     = useState<Record<number, number>>({}) // id -> actual count
  const [busy,       setBusy]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('stock_item').select('*').order('category').order('name')
    if (data) {
      setItems(data)
      // Initialize counts with recorded values
      const initial: Record<number, number> = {}
      data.forEach(it => { initial[it.id] = it.quantity })
      setCounts(initial)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const categories = useMemo(() => {
    const cats = new Set(items.map(bucketFor))
    const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'
    return Array.from(cats).sort((a, b) => {
      const la = a === UNCATEGORIZED_BUCKET ? t('stock_uncategorized') : labelStockCategory(a, t)
      const lb = b === UNCATEGORIZED_BUCKET ? t('stock_uncategorized') : labelStockCategory(b, t)
      return la.localeCompare(lb, loc)
    })
  }, [items, t, lang])

  async function handleApply() {
    if (!confirm(t('stock_take_confirm_apply'))) return
    setBusy(true)
    const sb = createClient()

    // For each item where count changed, update DB
    const updates = items.filter(it => counts[it.id] !== it.quantity)

    if (updates.length === 0) {
      setBusy(false)
      return
    }

    const results = await Promise.all(updates.map(it =>
      sb.from('stock_item').update({ quantity: counts[it.id] }).eq('id', it.id)
    ))

    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      alert(t('stock_take_err_fmt').replace(/\{n\}/g, String(errors.length)))
    } else {
      alert(t('stock_take_ok_fmt').replace(/\{n\}/g, String(updates.length)))
      await load()
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 32px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>{t('stock_take_title')}</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>
            {t('stock_take_subtitle')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
           <button type="button" className="btn ghost sm" onClick={() => load()}>{t('stock_take_refresh')}</button>
           <button type="button" className="btn primary sm" onClick={() => void handleApply()} disabled={busy || loading}>
             {busy ? t('stock_take_applying') : t('stock_take_apply')}
           </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        {loading ? (
           <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>{t('loading')}</div>
        ) : items.length === 0 ? (
           <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>{t('stock_take_empty')}</div>
        ) : (
          <table className="tbl" style={{ border: 'none' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg2)' }}>
              <tr>
                <th style={{ paddingLeft: 20 }}>{t('stock_take_th_name')}</th>
                <th>{t('stock_take_th_supplier')}</th>
                <th className="num">{t('stock_take_th_theoretical')}</th>
                <th className="num" style={{ width: 120 }}>{t('stock_take_th_actual')}</th>
                <th className="num" style={{ width: 80 }}>{t('stock_take_th_diff')}</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <Fragment key={cat}>
                  <tr style={{ background: 'var(--bg0)' }}>
                    <td colSpan={6} style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, color: 'var(--tx3)', padding: '8px 20px', textTransform: 'uppercase' }}>
                      {cat === UNCATEGORIZED_BUCKET ? t('stock_uncategorized') : labelStockCategory(cat, t)}
                    </td>
                  </tr>
                  {items.filter(it => bucketFor(it) === cat).map(it => {
                    const diff = counts[it.id] - it.quantity
                    const sup = contacts.find(c => c.ContactID === it.supplier_id)
                    const supName = sup ? (sup.NomInstitution || `${sup.Prénom || ''} ${sup.Nom || ''}`.trim()) : '—'

                    return (
                      <tr key={it.id}>
                        <td style={{ paddingLeft: 20, fontWeight: 500 }}>{it.name} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--tx3)', marginLeft: 4 }}>({it.unit})</span></td>
                        <td style={{ fontSize: 10, color: 'var(--tx3)' }}>{supName}</td>
                        <td className="num t-mono" style={{ opacity: 0.6 }}>{it.quantity}</td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <button type="button" className="btn sm ghost" style={{ padding: '2px 6px', minWidth: 0 }} onClick={() => setCounts(prev => ({...prev, [it.id]: Math.max(0, (prev[it.id] || 0) - 1)}))}>-</button>
                            <input
                              type="number"
                              value={counts[it.id] ?? 0}
                              onChange={e => setCounts(prev => ({...prev, [it.id]: Number(e.target.value)}))}
                              style={{ width: 50, textAlign: 'center', padding: '4px', background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', fontSize: 11, fontWeight: 600 }}
                            />
                            <button type="button" className="btn sm ghost" style={{ padding: '2px 6px', minWidth: 0 }} onClick={() => setCounts(prev => ({...prev, [it.id]: (prev[it.id] || 0) + 1}))}>+</button>
                          </div>
                        </td>
                        <td className="num t-mono" style={{
                          fontWeight: 600,
                          color: diff > 0 ? 'var(--sage)' : diff < 0 ? 'var(--rust)' : 'var(--tx3)'
                        }}>
                          {diff > 0 ? `+${diff}` : diff === 0 ? '—' : diff}
                        </td>
                        <td>
                          {diff !== 0 && (
                            <button type="button" className="btn sm ghost" style={{ padding: '2px 6px' }} title={t('stock_take_reset_title')} onClick={() => setCounts(prev => ({...prev, [it.id]: it.quantity}))}>↺</button>
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
    </div>
  )
}
