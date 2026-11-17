'use client'

// Revenue & expenses → « Ventes » (TODO R7 v2: « the revenue-by-year chart and the sales pivot
// move out of Orders into Revenue & expenses »). Moved from the former Sales tab: sold works,
// revenue, average price, consigned count, revenue by year (last 8), pivot of sold works.
// Read from the works (status « Vendu » / « Consigné »), not from the orders.

import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { statusOf, yearOf, type StatusKey } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'
import type { Agg, Dim } from '@/lib/pivot'
import { PivotPanel } from '@/components/atelier/PivotPanel'
import { ReportLinkButton } from '@/components/atelier/ReportLinkButton'
import { useMediaQuery } from '@/lib/useMediaQuery'

interface Props {
  oeuvres: Oeuvre[]
  statusLabelMap: Record<number, string>
  cM: Record<number, string>
  tM: Record<number, string>
}

export function FiscalSales({ oeuvres, statusLabelMap, cM, tM }: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')

  const { soldWorks, consignedCount, totalRevenue, avgPrice, byYear } = useMemo(() => {
    const sold: Oeuvre[] = []
    let consigned = 0
    for (const o of oeuvres) {
      const key: StatusKey = statusOf(o, statusLabelMap)
      if (key === 'sold') sold.push(o)
      if (key === 'consigned') consigned++
    }
    const rev = sold.reduce((acc, o) => acc + (o.PrixFinal ?? o.Prix ?? 0), 0)
    const avg = sold.length > 0 ? Math.round(rev / sold.length) : 0
    const yearMap: Record<string, { count: number; revenue: number }> = {}
    for (const o of sold) {
      const yr = String(o.DateLivraison ? o.DateLivraison.slice(0, 4) : yearOf(o.Année) ?? '?')
      if (!yearMap[yr]) yearMap[yr] = { count: 0, revenue: 0 }
      yearMap[yr].count++
      yearMap[yr].revenue += (o.PrixFinal ?? o.Prix ?? 0)
    }
    return {
      soldWorks: sold,
      consignedCount: consigned,
      totalRevenue: rev,
      avgPrice: avg,
      byYear: Object.entries(yearMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8),
    }
  }, [oeuvres, statusLabelMap])

  const maxRevYear = byYear.length > 0 ? Math.max(...byYear.map(([, v]) => v.revenue)) : 0
  const fmt = (n: number) => (n === 0 ? '—' : `€ ${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}`)

  const dims: Dim<Oeuvre>[] = useMemo(() => [
    { id: 'year', label: t('year'), get: (o) => String(o.DateLivraison ? o.DateLivraison.slice(0, 4) : yearOf(o.Année) ?? '—') },
    { id: 'buyer', label: t('buyer'), get: (o) => (o.AcheteurID != null ? (cM[o.AcheteurID] ?? `#${o.AcheteurID}`) : '—') },
    { id: 'technique', label: t('technique'), get: (o) => (o.Technique != null ? (tM[o.Technique] ?? String(o.Technique)) : '—') },
  ], [t, cM, tM])

  const values: Agg<Oeuvre>[] = useMemo(() => [
    { id: 'count', label: t('pivotCount'), kind: 'count' },
    { id: 'sumRev', label: `${t('pivotSum')} (${t('revenue')})`, kind: 'sum', get: (o) => Number(o.PrixFinal ?? o.Prix ?? 0) },
  ], [t])

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: narrow ? '16px' : '28px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <ReportLinkButton source="sales" />
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
        borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
      }}>
        <KpiCard label={t('sold')} value={String(soldWorks.length)} detail={t('salesSoldWorksDetail')} />
        <KpiCard label={t('revenue')} value={fmt(totalRevenue)} detail={t('salesRevenueDetail')} border />
        <KpiCard label={t('salesAvgPriceLabel')} value={fmt(avgPrice)} detail={t('salesAvgPriceDetail')} border />
        <KpiCard label={t('consigned')} value={String(consignedCount)} detail={t('salesConsignedDetail')} border />
      </div>

      {byYear.length > 0 && (
        <div className="panel pad-sm">
          <div className="t-label" style={{ marginBottom: 12 }}>{t('salesRevenueByYear')}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 120 }}>
            {byYear.map(([yr, { count, revenue }]) => {
              const pct = maxRevYear > 0 ? (revenue / maxRevYear) * 100 : 0
              return (
                <div key={yr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', textAlign: 'center' }}>{revenue > 0 ? fmt(revenue) : '—'}</div>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${pct}%`, background: revenue > 0 ? 'var(--ac)' : 'var(--bd)', minHeight: revenue > 0 ? 2 : 0 }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{yr}</div>
                  {count > 0 && <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: -2 }}>{`${count}×`}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <PivotPanel<Oeuvre>
        rows={soldWorks}
        availableDims={dims}
        availableValues={values}
        defaultRowDimId="year"
        defaultColDimId="buyer"
        defaultValueIds={['count', 'sumRev']}
        title={t('pivot')}
        exportFileName="sales-sold-pivot"
      />
    </div>
  )
}

function KpiCard({ label, value, detail, border = false }: { label: string; value: string; detail?: string; border?: boolean }) {
  return (
    <div style={{ padding: '18px 20px', borderLeft: border ? '1px solid var(--bd)' : undefined }}>
      <div className="stat">
        <span className="l">{label}</span>
        <span className="v">{value}</span>
        {detail && <span className="d" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>{detail}</span>}
      </div>
    </div>
  )
}
