'use client'

import { useEffect, useMemo, useState } from 'react'
import { openReadOr } from '@/lib/atelier/open-reads'
import { drawerOpenKey } from '@/lib/atelier/open-read-keys'
import { useI18n } from '@/lib/i18n/context'
import { fetchWorkCost, fetchRunningCostRate, type RunningCostRate } from '@/app/atelier/(portal)/fiscal/cost-actions'
import { CONTRIBUTIONS_RATE, DEFAULT_CHANNELS, type ChannelKnobs } from '@/lib/pricing/params'
import { reversePrice } from '@/lib/pricing/reverse'
import { FIS } from './drawer-widgets'

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Reverse price (admin only, read only): from the net wanted back to the list price per channel.
 * Reads the work's linked expenses (same open read as WorkCostBlock); writes nothing.
 * Design: docs/design/2026-11-23/ReversePricing.md.
 */
export function WorkReversePriceBlock({
  oeuvreId,
  isAdmin,
  catalogPrice,
  narrow,
}: {
  oeuvreId: number
  isAdmin: boolean
  catalogPrice: number | null
  narrow: boolean
}) {
  const { t, lang } = useI18n()
  const [spent, setSpent] = useState(0)
  const [netS, setNetS] = useState('1000')
  const [plannedS, setPlannedS] = useState('0')
  const [runningS, setRunningS] = useState('0')
  const [rateS, setRateS] = useState(String(+(CONTRIBUTIONS_RATE * 100).toFixed(2)))
  const [rate, setRate] = useState<RunningCostRate | null>(null)
  // Reads start the first time the fold is opened, once per card (a screen asks for what it shows).
  const [opened, setOpened] = useState(false)
  const [one, setOne] = useState(true)
  const [chs, setChs] = useState<ChannelKnobs[]>(() => DEFAULT_CHANNELS.map((c) => ({ ...c })))

  useEffect(() => {
    if (!isAdmin || !opened) return
    let cancelled = false
    void openReadOr(drawerOpenKey.cost(oeuvreId), () => fetchWorkCost(oeuvreId)).then((c) => { if (!cancelled) setSpent(c?.total ?? 0) })
    return () => { cancelled = true }
  }, [oeuvreId, isAdmin, opened])

  // Running-cost share: last year's real expenses ÷ works made that year, filled once; Pem can overwrite it.
  useEffect(() => {
    if (!isAdmin || !opened) return
    let cancelled = false
    void fetchRunningCostRate().then((r) => {
      if (cancelled || !r) return
      setRate(r)
      setRunningS((cur) => (cur === '0' ? String(r.perWork) : cur))
    })
    return () => { cancelled = true }
  }, [isAdmin, opened])

  const res = useMemo(
    () => reversePrice({ net: num(netS), contributions: num(rateS) / 100, direct: spent + num(plannedS), running: num(runningS), channels: chs, onePrice: one }),
    [netS, rateS, spent, plannedS, runningS, chs, one],
  )

  if (!isAdmin) return null

  const loc = lang === 'en' ? 'en-GB' : 'fr-FR'
  const eur = (n: number) => (Number.isFinite(n) ? n.toLocaleString(loc, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : t('rp_na'))
  const h = narrow ? 44 : 26
  const inp = { ...FIS, height: h, padding: '0 6px', fontSize: 12, width: 72, textAlign: 'right' as const }
  const field = (label: string, v: string, set: (s: string) => void, hint?: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 110px', minWidth: 0 }}>
      <span style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      <input className="input" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} style={{ ...inp, width: '100%', maxWidth: 140 }} />
      {hint ? <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{hint}</span> : null}
    </label>
  )
  const setKnob = (id: ChannelKnobs['id'], k: 'c' | 'd' | 'x', v: string) =>
    setChs((p) => p.map((c) => (c.id === id ? { ...c, [k]: num(v) } : c)))
  const knob = (c: ChannelKnobs, k: 'c' | 'd' | 'x', label: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 1, fontSize: 10, color: 'var(--tx3)' }}>
      {label}
      <input className="input" inputMode="decimal" value={String(c[k])} onChange={(e) => setKnob(c.id, k, e.target.value)} style={{ ...inp, width: 58 }} />
    </label>
  )
  const wholesalePct = res.wholesale != null && res.listOne > 0 ? Math.round((res.wholesale / res.listOne) * 100) : 0
  const sum = t('rp_summary').replace('{list}', eur(res.listOne)).replace('{wholesale}', res.wholesale != null ? eur(res.wholesale) : t('rp_na'))

  return (
    <details data-testid="work-reverse-price" style={{ marginTop: 2 }} onToggle={(e) => { if (e.currentTarget.open) setOpened(true) }}>
      <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--tx3)', minHeight: narrow ? 44 : undefined, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>{t('rp_title')}</span>
        <span className="t-mono-sm">{sum}</span>
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, fontSize: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'flex-start' }}>
          {field(t('rp_net'), netS, setNetS)}
          {field(t('rp_planned'), plannedS, setPlannedS, t('rp_direct_hint').replace('{spent}', eur(spent)))}
          {field(t('rp_running'), runningS, setRunningS, rate ? t('rp_running_src').replace('{year}', String(rate.year)).replace('{pool}', eur(rate.pool)).replace('{n}', String(rate.works)) : undefined)}
          {field(t('rp_contrib'), rateS, setRateS)}
          <button type="button" className="btn" onClick={() => setOne((v) => !v)} aria-pressed={one} style={{ minHeight: h, alignSelf: 'flex-end' }}>
            {one ? t('rp_one') : t('rp_per_channel')}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {res.rows.map((r) => {
            const c = chs.find((x) => x.id === r.id)!
            const low = Number.isFinite(r.netKept) && r.netKept < num(netS) - 1
            return (
              <div key={r.id} data-testid={`rp-row-${r.id}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'flex-end', padding: '6px 0', borderTop: '1px solid var(--bd)' }}>
                <div style={{ flex: '1 1 120px', minWidth: 0, fontWeight: 600 }}>{t(`rp_ch_${r.id}` as 'rp_ch_studio')}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {knob(c, 'c', t('rp_col_comm'))}
                  {knob(c, 'd', t('rp_col_disc'))}
                  {knob(c, 'x', t('rp_col_cost'))}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span><span style={{ display: 'block', fontSize: 10, color: 'var(--tx3)' }}>{t('rp_col_floor')}</span><span className="t-mono-sm">{eur(r.floor)}</span></span>
                  <span><span style={{ display: 'block', fontSize: 10, color: 'var(--tx3)' }}>{t('rp_col_list')}</span><span className="t-mono-sm" style={{ fontWeight: 700 }}>{eur(r.list)}</span></span>
                  <span><span style={{ display: 'block', fontSize: 10, color: 'var(--tx3)' }}>{t('rp_col_net')}</span><span className="t-mono-sm" style={{ color: low ? 'var(--rust)' : undefined }}>{eur(r.netKept)}</span></span>
                  <span><span style={{ display: 'block', fontSize: 10, color: 'var(--tx3)' }}>{t('rp_col_maxdisc')}</span><span className="t-mono-sm">{Number.isFinite(r.maxDiscount) ? `${r.maxDiscount.toLocaleString(loc, { maximumFractionDigits: 1 })} %` : t('rp_na')}</span></span>
                </div>
              </div>
            )
          })}
        </div>
        {res.wholesale != null ? (
          <div style={{ fontSize: 11, color: 'var(--tx2)' }}>{t('rp_wholesale').replace('{wholesale}', eur(res.wholesale)).replace('{pct}', String(wholesalePct))}</div>
        ) : null}
        {catalogPrice != null ? <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('rp_today').replace('{price}', eur(catalogPrice))}</div> : null}
        <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('rp_note')}</div>
      </div>
    </details>
  )
}
