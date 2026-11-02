'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { fetchWorkCost, type WorkCost } from '@/app/atelier/(portal)/fiscal/cost-actions'
import { SectionTitle } from './drawer-widgets'

/**
 * Cost per work (admin only): expenses linked to this work in Income & Expenses
 * (`expense_oeuvre`), by category, and the margin against the sale or the catalogue price.
 */
export function WorkCostBlock({
  oeuvreId,
  isAdmin,
  catalogPrice,
}: {
  oeuvreId: number
  isAdmin: boolean
  catalogPrice: number | null
}) {
  const { t, lang } = useI18n()
  const [cost, setCost] = useState<WorkCost | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    setCost(null)
    void fetchWorkCost(oeuvreId).then((c) => { if (!cancelled) setCost(c) })
    return () => { cancelled = true }
  }, [oeuvreId, isAdmin])

  if (!isAdmin || !cost) return null

  const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
  const eur = (n: number) => n.toLocaleString(loc, { style: 'currency', currency: 'EUR' })
  const priceForMargin = cost.salePrice ?? (catalogPrice && catalogPrice > 0 ? catalogPrice : null)

  return (
    <section data-testid="work-cost-block">
      <SectionTitle title={t('wf_cost_title')} />
      {cost.lines.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('wf_cost_none')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          {cost.byCategory.map((c) => (
            <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: 'var(--tx2)' }}>{c.category || t('wf_cost_uncategorised')}</span>
              <span className="t-mono-sm">{eur(c.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--bd)', paddingTop: 4, fontWeight: 600 }}>
            <span>{t('wf_cost_total')}</span>
            <span className="t-mono-sm">{eur(cost.total)}</span>
          </div>
          {priceForMargin != null ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: priceForMargin - cost.total >= 0 ? 'var(--green)' : 'var(--rust)' }}>
              <span>{cost.salePrice != null ? t('wf_cost_margin_sale') : t('wf_cost_margin_catalogue')}</span>
              <span className="t-mono-sm">{eur(priceForMargin - cost.total)}</span>
            </div>
          ) : null}
          <details style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
            <summary style={{ cursor: 'pointer' }}>{t('wf_cost_detail_fmt').replace('{n}', String(cost.lines.length))}</summary>
            {cost.lines.map((l) => (
              <div key={l.expense_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.date ?? ''} · {l.libelle ?? `#${l.expense_id}`}{l.split ? ` (${t('wf_cost_split')})` : ''}
                </span>
                <span className="t-mono-sm">{eur(l.amount)}</span>
              </div>
            ))}
          </details>
        </div>
      )}
    </section>
  )
}
