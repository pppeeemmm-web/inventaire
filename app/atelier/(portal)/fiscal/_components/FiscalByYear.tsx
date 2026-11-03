'use client'

// Fiscal → Par année (owner 2026-11-03): income and expenses for every year on record, this
// year to date against the same dates last year, and a pivot over both flows with a year
// dimension. Income follows the same cash rules as the dashboard (`lib/sales/income.ts`).

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import type { Agg, Dim } from '@/lib/pivot'
import { PivotPanel } from '@/components/atelier/PivotPanel'
import { fetchIncomeEntries } from '@/lib/sales/income'

type Flow = {
  date: string
  year: number
  kind: 'income' | 'expense'
  category: string | null
  amount: number
}

type YearRow = { label: string; income: number; expenses: number; count: number; muted?: boolean }

export function FiscalByYear({ fmtEur }: { fmtEur: (n: number) => string }) {
  const { t, lang } = useI18n()
  const [flows, setFlows] = useState<Flow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const sb = createClient()
    void Promise.all([
      sb.from('expense').select('date, category, montant_ttc').order('date', { ascending: true }).limit(20000),
      fetchIncomeEntries(sb),
    ]).then(([exp, inc]) => {
      if (cancelled) return
      const err = exp.error?.message ?? inc.error
      if (err) setError(err)
      const rows: Flow[] = []
      for (const e of (exp.data ?? []) as { date: string | null; category: string | null; montant_ttc: number | null }[]) {
        const day = e.date?.slice(0, 10)
        if (!day) continue
        rows.push({ date: day, year: Number(day.slice(0, 4)), kind: 'expense', category: e.category, amount: Number(e.montant_ttc ?? 0) })
      }
      for (const i of inc.entries) {
        rows.push({ date: i.date, year: Number(i.date.slice(0, 4)), kind: 'income', category: null, amount: i.amount })
      }
      setFlows(rows)
    })
    return () => { cancelled = true }
  }, [])

  const today = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date())
  }, [])

  const rows = useMemo<YearRow[]>(() => {
    if (!flows) return []
    const thisYear = Number(today.slice(0, 4))
    const monthDay = today.slice(5)
    const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
    const dayLabel = new Date(`${today}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    const sum = (pred: (f: Flow) => boolean): YearRow => {
      const r: YearRow = { label: '', income: 0, expenses: 0, count: 0 }
      for (const f of flows) {
        if (!pred(f)) continue
        if (f.kind === 'income') r.income += f.amount
        else { r.expenses += f.amount; r.count += 1 }
      }
      return r
    }
    const years = new Set(flows.map((f) => f.year))
    years.add(thisYear)
    const out: YearRow[] = []
    for (const y of [...years].sort((a, b) => b - a)) {
      if (y === thisYear) {
        out.push({ ...sum((f) => f.year === y), label: t('fiscal_year_to_date_fmt').replace('{year}', String(y)).replace('{date}', dayLabel) })
        out.push({
          ...sum((f) => f.year === y - 1 && f.date.slice(5) <= monthDay),
          label: t('fiscal_same_period_fmt').replace('{year}', String(y - 1)),
          muted: true,
        })
      } else {
        out.push({ ...sum((f) => f.year === y), label: String(y) })
      }
    }
    return out
  }, [flows, today, lang, t])

  const dims: Dim<Flow>[] = useMemo(
    () => [
      { id: 'year', label: t('fiscal_pivot_dim_year'), get: (f) => String(f.year) },
      { id: 'flow', label: t('fiscal_pivot_dim_flow'), get: (f) => (f.kind === 'income' ? t('fiscal_flow_income') : t('fiscal_flow_expense')) },
      { id: 'month', label: t('fiscal_pivot_dim_month'), get: (f) => f.date.slice(0, 7) },
      {
        id: 'category',
        label: t('category'),
        get: (f) => (f.kind === 'income' ? t('fiscal_pivot_sales') : f.category ?? t('pivotOther')),
      },
    ],
    [t],
  )
  const values: Agg<Flow>[] = useMemo(
    () => [
      { id: 'amount', label: t('fiscal_pivot_amount'), kind: 'sum', get: (f) => f.amount },
      { id: 'net', label: t('fiscal_pivot_net'), kind: 'sum', get: (f) => (f.kind === 'income' ? f.amount : -f.amount) },
      { id: 'count', label: t('pivotCount'), kind: 'count' },
    ],
    [t],
  )

  const th: React.CSSProperties = {
    textAlign: 'right', padding: '8px 12px', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    color: 'var(--tx3)', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap', background: 'var(--bg1)',
    position: 'sticky', top: 0,
  }
  const td: React.CSSProperties = {
    textAlign: 'right', padding: '8px 12px', fontSize: 13, borderBottom: '1px solid var(--bd)',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  }

  return (
    <div data-testid="fiscal-by-year" style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
      <div className="t-label" style={{ marginBottom: 4 }}>{t('fiscal_by_year_heading')}</div>
      <p className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', margin: '0 0 16px' }}>{t('fiscal_by_year_hint')}</p>
      {error ? <p style={{ color: 'var(--rust)', fontSize: 12 }}>{`${t('error_prefix')} ${error}`}</p> : null}

      {flows === null ? (
        <div className="pulse t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('ps_loading')}</div>
      ) : rows.every((r) => r.income === 0 && r.expenses === 0) ? (
        <p style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('fiscal_by_year_empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--bd)', marginBottom: 28 }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>{t('fiscal_col_year')}</th>
                <th style={th}>{t('fiscal_col_income')}</th>
                <th style={th}>{t('fiscal_col_expenses')}</th>
                <th style={th}>{t('fiscal_col_net')}</th>
                <th style={th}>{t('fiscal_col_count')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const net = r.income - r.expenses
                return (
                  <tr key={r.label} style={{ color: r.muted ? 'var(--tx3)' : 'var(--tx)' }}>
                    <td style={{ ...td, textAlign: 'left', fontStyle: r.muted ? 'italic' : undefined }}>{r.label}</td>
                    <td style={td}>{fmtEur(r.income)}</td>
                    <td style={td}>{fmtEur(r.expenses)}</td>
                    <td style={{ ...td, color: r.muted ? undefined : net < 0 ? 'var(--rust)' : 'var(--sage)' }}>{fmtEur(net)}</td>
                    <td style={td}>{r.count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {flows && flows.length > 0 ? (
        <PivotPanel<Flow>
          rows={flows}
          availableDims={dims}
          availableValues={values}
          defaultRowDimId="year"
          defaultColDimId="flow"
          defaultValueIds={['amount']}
          exportFileName="fiscal-by-year"
        />
      ) : null}
    </div>
  )
}
