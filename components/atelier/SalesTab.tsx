'use client'

// SalesTab — revenue stats + bar chart + recent sales, derived from oeuvres data.
// No extra DB fetch needed — sold works live in the oeuvres prop.

import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { statusOf, yearOf, type StatusKey } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'

// ── Types ────────────────────────────────────────────────────

interface Props {
  oeuvres:        Oeuvre[]
  statusLabelMap: Record<number, string>
  cM:             Record<number, string>
  tM:             Record<number, string>
}

// ── Component ────────────────────────────────────────────────

export function SalesTab({ oeuvres, statusLabelMap, cM, tM }: Props) {
  const { lang } = useI18n()

  // ── Derive data ───────────────────────────────────────────

  const { soldWorks, consignedCount, totalRevenue, avgPrice, byYear, recentSales } = useMemo(() => {
    const sold: Oeuvre[] = []
    let consigned = 0

    for (const o of oeuvres) {
      const key: StatusKey = statusOf(o, statusLabelMap)
      if (key === 'sold')      sold.push(o)
      if (key === 'consigned') consigned++
    }

    // Sort sold by delivery date or year descending
    const sorted = [...sold].sort((a, b) => {
      const da = a.DateLivraison ?? a.Année ?? ''
      const db = b.DateLivraison ?? b.Année ?? ''
      return db.localeCompare(da)
    })

    // Revenue: prefer PrixFinal, fall back to Prix
    const rev = sold.reduce((acc, o) => acc + (o.PrixFinal ?? o.Prix ?? 0), 0)
    const avg = sold.length > 0 ? Math.round(rev / sold.length) : 0

    // Group by year using DateLivraison or Année
    const yearMap: Record<string, { count: number; revenue: number }> = {}
    for (const o of sold) {
      const yr = String(
        o.DateLivraison ? o.DateLivraison.slice(0, 4)
          : yearOf(o.Année) ?? '?'
      )
      if (!yearMap[yr]) yearMap[yr] = { count: 0, revenue: 0 }
      yearMap[yr].count++
      yearMap[yr].revenue += (o.PrixFinal ?? o.Prix ?? 0)
    }
    const byYr = Object.entries(yearMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8) // show last 8 years max

    return {
      soldWorks:      sorted,
      consignedCount: consigned,
      totalRevenue:   rev,
      avgPrice:       avg,
      byYear:         byYr,
      recentSales:    sorted.slice(0, 10),
    }
  }, [oeuvres, statusLabelMap])

  const maxRevYear = byYear.length > 0 ? Math.max(...byYear.map(([, v]) => v.revenue)) : 0

  const fmt = (n: number) =>
    n === 0 ? '—' : `€\u202f${n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB')}`

  return (
    <div style={{ padding: '20px 28px', overflowY: 'auto' }}>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 0,
        marginBottom: 28,
        borderTop: '1px solid var(--bd)',
        borderBottom: '1px solid var(--bd)',
      }}>
        <KpiCard
          label={lang === 'fr' ? 'Ventes totales' : 'Total sales'}
          value={String(soldWorks.length)}
          detail={lang === 'fr' ? 'œuvres vendues' : 'works sold'}
        />
        <KpiCard
          label={lang === 'fr' ? 'Revenu total' : 'Total revenue'}
          value={fmt(totalRevenue)}
          detail={lang === 'fr' ? 'prix final ou catalogue' : 'final or catalogue price'}
          border
        />
        <KpiCard
          label={lang === 'fr' ? 'Prix moyen' : 'Average price'}
          value={fmt(avgPrice)}
          detail={lang === 'fr' ? 'par œuvre vendue' : 'per sold work'}
          border
        />
        <KpiCard
          label={lang === 'fr' ? 'En consignation' : 'Consigned'}
          value={String(consignedCount)}
          detail={lang === 'fr' ? 'en galerie' : 'in gallery'}
          border
        />
      </div>

      {/* Revenue by year chart */}
      {byYear.length > 0 && (
        <div className="panel pad-md" style={{ marginBottom: 24 }}>
          <div className="t-label" style={{ marginBottom: 16 }}>
            {lang === 'fr' ? 'Revenu par année' : 'Revenue by year'}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 16,
            height: 140,
            paddingBottom: 4,
          }}>
            {byYear.map(([yr, { count, revenue }]) => {
              const pct = maxRevYear > 0 ? (revenue / maxRevYear) * 100 : 0
              return (
                <div key={yr} style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                }}>
                  <div className="t-mono-sm" style={{
                    color: revenue > 0 ? 'var(--tx2)' : 'var(--tx3)',
                    fontSize: 9,
                    fontVariantNumeric: 'tabular-nums',
                    textAlign: 'center',
                  }}>
                    {revenue > 0 ? fmt(revenue) : '—'}
                  </div>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%',
                      height: `${pct}%`,
                      background: revenue > 0 ? 'var(--ac)' : 'var(--bd)',
                      minHeight: revenue > 0 ? 2 : 0,
                      transition: 'height 0.3s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--tx3)' }}>{yr}</div>
                  {count > 0 && (
                    <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: -4 }}>{count}×</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent sales table */}
      {recentSales.length > 0 && (
        <div className="panel pad-md">
          <div className="t-label" style={{ marginBottom: 12 }}>
            {lang === 'fr' ? 'Ventes récentes' : 'Recent sales'}
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>{lang === 'fr' ? 'Titre' : 'Title'}</th>
                <th>{lang === 'fr' ? 'Technique' : 'Technique'}</th>
                <th>{lang === 'fr' ? 'Acheteur' : 'Buyer'}</th>
                <th className="num">{lang === 'fr' ? 'Date' : 'Date'}</th>
                <th className="num">{lang === 'fr' ? 'Prix' : 'Price'}</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((o) => {
                const price = o.PrixFinal ?? o.Prix
                const dateStr = o.DateLivraison ?? o.Année ?? '—'
                const buyer = o.AcheteurID ? (cM[o.AcheteurID] ?? `#${o.AcheteurID}`) : '—'
                return (
                  <tr key={o.OeuvreID}>
                    <td style={{ color: 'var(--tx)' }}>{o.Titre ?? '—'}</td>
                    <td>{o.Technique ? (tM[o.Technique] ?? '—') : '—'}</td>
                    <td style={{ color: 'var(--tx2)' }}>{buyer}</td>
                    <td className="num" style={{ color: 'var(--tx2)' }}>{String(dateStr).slice(0, 10)}</td>
                    <td className="num" style={{ color: 'var(--ac)' }}>
                      {price ? fmt(price) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {soldWorks.length > 10 && (
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 10 }}>
              +{soldWorks.length - 10} {lang === 'fr' ? 'autres' : 'more'}
            </div>
          )}
        </div>
      )}

      {soldWorks.length === 0 && (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
          {lang === 'fr' ? 'Aucune vente enregistrée.' : 'No sales recorded yet.'}
        </div>
      )}
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────

function KpiCard({
  label, value, detail, border = false,
}: {
  label:   string
  value:   string
  detail?: string
  border?: boolean
}) {
  return (
    <div style={{
      padding: '22px 22px',
      borderLeft: border ? '1px solid var(--bd)' : undefined,
    }}>
      <div className="stat">
        <span className="l">{label}</span>
        <span className="v">{value}</span>
        {detail && <span className="d" style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 4 }}>{detail}</span>}
      </div>
    </div>
  )
}
