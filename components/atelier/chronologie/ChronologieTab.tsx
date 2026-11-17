'use client'

// R4 « Chronologie » (Pem 2026-11-17: two tabs — the Carte keeps its place, the timeline is its own tab;
// computer only). One horizontal axis: period bands behind, five rows — Œuvres, Séances, Journal & notes,
// Création, Sorties (Œuvres + Séances open, the rest folded). Click a month or drag a span → the panel
// below lists what happened then, with « Voir sur la carte » (Carte « Création », same span) and the
// Journal of each day. `?place=` (from a Carte pin) keeps only the works made there; `?from=&to=` picks
// a span. Brief: docs/design/2026-11-17/R4_TimelineMap.notes.md.

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { loadTimePlaceData, type TimePlaceData, type TPWork } from '@/app/atelier/time-place-actions'
import { WorkChip } from '@/components/atelier/WorkChip'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { inSpan, monthKey, monthOf, parseMonthKey, placeColor, studioOrder } from '@/lib/time-place'

type Lane = 'works' | 'sessions' | 'journal' | 'creation' | 'out'
const LANES: Lane[] = ['works', 'sessions', 'journal', 'creation', 'out']
const LANE_KEY = {
  works: 'chrono_lane_works',
  sessions: 'chrono_lane_sessions',
  journal: 'chrono_lane_journal',
  creation: 'chrono_lane_creation',
  out: 'chrono_lane_out',
} as const
const LABEL = 140
const AXIS_H = 44
const OPEN_H = 64
const FOLD_H = 26
const MAX_LIST = 48
/** A gap of more years than this before the work starts in earnest is folded into one stub (Youth 1997–2000). */
const GAP_YEARS = 5

type Sel = { kind: 'span'; from: number; to: number } | { kind: 'undated'; periodId: number }

function countBy<T>(items: T[], key: (x: T) => number | null): Map<number, number> {
  const m = new Map<number, number>()
  for (const it of items) {
    const k = key(it)
    if (k != null) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export function ChronologieTab() {
  const { t, lang } = useI18n()
  const params = useSearchParams()
  const router = useRouter()
  const [data, setData] = useState<TimePlaceData | null>(null)
  const [failed, setFailed] = useState(false)
  const [folded, setFolded] = useState<Set<Lane>>(() => new Set<Lane>(['journal', 'creation', 'out']))
  const [width, setWidth] = useState(900)
  const box = useRef<HTMLDivElement | null>(null)

  const placeFilter = Number(params?.get('place')) || null
  const urlFrom = parseMonthKey(params?.get('from'))
  const urlTo = parseMonthKey(params?.get('to'))
  const [sel, setSel] = useState<Sel | null>(() => (urlFrom != null && urlTo != null && urlFrom <= urlTo ? { kind: 'span', from: urlFrom, to: urlTo } : null))
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null)
  // The live drag also in a ref: a quick click's pointerup can arrive before React re-renders.
  const dragRef = useRef<{ a: number; b: number } | null>(null)

  useEffect(() => {
    let alive = true
    void loadTimePlaceData().then(
      (res) => {
        if (!alive) return
        if ('error' in res) setFailed(true)
        else setData(res)
      },
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [data])

  const now = new Date()
  const nowMi = now.getFullYear() * 12 + now.getMonth()

  const d = useMemo(() => {
    if (!data) return null
    const works = placeFilter ? data.works.filter((w) => w.placeId === placeFilter) : data.works
    const ids = new Set(works.map((w) => w.id))
    const sessions = placeFilter ? data.sessions.filter((s) => s.oeuvreIds.some((id) => ids.has(id))) : data.sessions
    const marks = placeFilter ? data.marks.filter((m) => m.oeuvreId != null && ids.has(m.oeuvreId)) : data.marks
    const steps = data.steps.filter((s) => s.on_date && (!placeFilter || ids.has(s.oeuvre_id)))
    const orders = placeFilter ? data.orders.filter((o) => o.oeuvreIds.some((id) => ids.has(id))) : data.orders

    const years = new Set<number>()
    for (const w of works) {
      const y = w.day ? Number(w.day.slice(0, 4)) : w.year
      if (y != null) years.add(y)
    }
    for (const s of sessions) years.add(Number(s.day.slice(0, 4)))
    for (const m of marks) years.add(Number(m.day.slice(0, 4)))
    const sorted = [...years].filter((y) => y * 12 <= nowMi).sort((a, b) => a - b)
    let startYear = sorted[0] ?? now.getFullYear()
    for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] > GAP_YEARS) startYear = sorted[i]
    const before = works.filter((w) => {
      const y = w.day ? Number(w.day.slice(0, 4)) : w.year
      return y != null && y < startYear
    })
    const beforeYears = sorted.filter((y) => y < startYear)
    return {
      works,
      sessions,
      marks,
      steps,
      orders,
      fullFrom: startYear * 12,
      fullTo: nowMi,
      before: before.length,
      beforeLabel: beforeYears.length ? `${beforeYears[0]}–${beforeYears[beforeYears.length - 1]}` : null,
      studios: studioOrder(data.periods),
      yearOnly: countBy(works.filter((w) => !w.day && w.year != null), (w) => w.year),
      byMonth: countBy(works, (w) => (w.day ? monthOf(w.day) : null)),
      // -1 = no year and no period (e.g. Rutali's drawings: a place of their own, no date).
      undatedByPeriod: countBy(works.filter((w) => !w.day && w.year == null), (w) => w.periodId ?? -1),
      sessionsByMonth: countBy(sessions, (s) => monthOf(s.day)),
      marksByMonth: countBy(marks, (m) => monthOf(m.day)),
      stepsByMonth: countBy(steps, (s) => monthOf(s.on_date as string)),
    }
  }, [data, placeFilter, nowMi]) // eslint-disable-line react-hooks/exhaustive-deps -- `now` is read once per render

  const [view, setView] = useState<{ from: number; to: number } | null>(null)
  const v = view ?? (d ? { from: d.fullFrom, to: d.fullTo } : { from: nowMi - 11, to: nowMi })
  const span = Math.max(1, v.to - v.from + 1)
  const W = Math.max(200, width - LABEL - 16)
  const monthW = W / span
  const x = (mi: number) => LABEL + ((mi - v.from) / span) * W
  const miAt = (px: number) => Math.min(v.to, Math.max(v.from, v.from + Math.floor(((px - LABEL) / W) * span)))
  const visible = (mi: number) => mi >= v.from && mi <= v.to

  const monthLabel = (mi: number, long = false) =>
    new Date(Math.floor(mi / 12), mi % 12, 15).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { month: long ? 'long' : 'short', year: 'numeric' })

  if (failed) return <div style={{ padding: 28, color: 'var(--tx3)' }}>{t('chrono_error')}</div>
  if (!data || !d) return <div style={{ padding: 28, color: 'var(--tx3)' }}>{t('chrono_loading')}</div>

  const laneTop: Record<Lane, number> = { works: 0, sessions: 0, journal: 0, creation: 0, out: 0 }
  let yy = AXIS_H
  for (const l of LANES) {
    laneTop[l] = yy
    yy += folded.has(l) ? FOLD_H : OPEN_H
  }
  const H = yy + 6
  const placeName = placeFilter ? data.places.find((p) => p.id === placeFilter)?.name ?? `#${placeFilter}` : null

  const setZoom = (months: number | null) => {
    if (months == null) setView(null)
    else setView({ from: d.fullTo - months + 1, to: d.fullTo })
  }
  const shift = (dir: -1 | 1) => {
    const step = Math.max(1, Math.floor(span / 2))
    setView({ from: v.from + dir * step, to: v.to + dir * step })
  }

  const svgX = (e: ReactPointerEvent<SVGSVGElement>) => e.clientX - e.currentTarget.getBoundingClientRect().left
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const px = svgX(e)
    if (px < LABEL || (e.target as Element).closest('[data-undated]') || (e.target as Element).closest('[data-fold]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const mi = miAt(px)
    dragRef.current = { a: mi, b: mi }
    setDrag(dragRef.current)
  }
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const cur = dragRef.current
    if (!cur) return
    dragRef.current = { a: cur.a, b: miAt(svgX(e)) }
    setDrag(dragRef.current)
  }
  const onUp = () => {
    const cur = dragRef.current
    if (!cur) return
    dragRef.current = null
    setSel({ kind: 'span', from: Math.min(cur.a, cur.b), to: Math.max(cur.a, cur.b) })
    setDrag(null)
  }
  const shown = drag ? { from: Math.min(drag.a, drag.b), to: Math.max(drag.a, drag.b) } : sel?.kind === 'span' ? sel : null

  const lanesSvg: ReactNode[] = []
  // Period bands.
  for (const p of data.periods) {
    const a = Math.max(v.from, monthOf(p.start_on))
    const b = Math.min(v.to, p.end_on ? monthOf(p.end_on) : v.to)
    if (b < a) continue
    const col = placeColor(p.default_place_id, d.studios)
    const x0 = x(a)
    const w = x(b + 1) - x0
    lanesSvg.push(
      <g key={`p${p.id}`}>
        <rect x={x0} y={22} width={w} height={H - 22} fill={col} opacity={0.07} />
        <rect x={x0} y={22} width={w} height={16} fill={col} opacity={0.3} />
        {w > 50 ? (
          <text x={x0 + 5} y={34} fontSize={11} fontWeight={600} fill="var(--tx)">
            {p.name}
          </text>
        ) : null}
      </g>,
    )
  }
  // Year ticks (and months when the span is short).
  for (let mi = v.from; mi <= v.to; mi++) {
    const isYear = mi % 12 === 0
    if (!isYear && span > 30) continue
    lanesSvg.push(
      <g key={`t${mi}`}>
        <line x1={x(mi)} x2={x(mi)} y1={isYear ? 6 : 14} y2={H} stroke="var(--bd)" strokeWidth={isYear ? 1 : 0.5} />
        {isYear || monthW > 26 ? (
          <text x={x(mi) + 3} y={isYear ? 15 : 18} fontSize={isYear ? 11 : 9} fill="var(--tx2)">
            {isYear ? Math.floor(mi / 12) : String((mi % 12) + 1).padStart(2, '0')}
          </text>
        ) : null}
      </g>,
    )
  }
  // Lane separators + labels (click to fold).
  for (const l of LANES) {
    const y0 = laneTop[l]
    lanesSvg.push(
      <g key={`l${l}`} data-fold style={{ cursor: 'pointer' }} onClick={() => setFolded((f) => { const n = new Set(f); if (n.has(l)) n.delete(l); else n.add(l); return n })}>
        <line x1={0} x2={LABEL + W} y1={y0} y2={y0} stroke="var(--bd)" />
        <rect x={0} y={y0} width={LABEL - 4} height={folded.has(l) ? FOLD_H : OPEN_H} fill="transparent" />
        <text x={8} y={y0 + 17} fontSize={12} fontWeight={600} fill="var(--tx2)">
          {folded.has(l) ? '▸' : '▾'} {t(LANE_KEY[l])}
        </text>
      </g>,
    )
  }
  const base = (l: Lane) => laneTop[l] + (folded.has(l) ? FOLD_H : OPEN_H) - 5
  const scaleH = (n: number, open: boolean) => (open ? Math.min(OPEN_H - 14, 4 + Math.sqrt(n) * 4) : Math.min(FOLD_H - 8, 3 + Math.sqrt(n) * 2))

  // Œuvres: year veil, month bars, undated blocks.
  {
    const open = !folded.has('works')
    for (const [y, n] of d.yearOnly) {
      const a = y * 12
      if (a + 11 < v.from || a > v.to) continue
      const x0 = x(Math.max(a, v.from))
      const x1 = x(Math.min(a + 11, v.to) + 1)
      const h = scaleH(n, open) * 0.8
      lanesSvg.push(
        <g key={`yo${y}`}>
          <rect x={x0 + 1} y={base('works') - h} width={Math.max(1, x1 - x0 - 2)} height={h} fill="var(--tx)" opacity={0.1} stroke="var(--tx3)" strokeOpacity={0.3} />
          {open && x1 - x0 > 24 ? (
            <text x={x1 - 4} y={base('works') - h + 10} textAnchor="end" fontSize={9} fill="var(--tx2)">
              {n}
            </text>
          ) : null}
        </g>,
      )
    }
    for (const [mi, n] of d.byMonth) {
      if (!visible(mi)) continue
      const h = scaleH(n, open)
      lanesSvg.push(<rect key={`wm${mi}`} x={x(mi) + 0.5} y={base('works') - h} width={Math.max(1, monthW - 1.5)} height={h} fill="var(--ac)" />)
    }
    let edge = 0
    for (const [pid, n] of d.undatedByPeriod) {
      const p = data.periods.find((q) => q.id === pid)
      if (!p && pid !== -1) continue
      const end = p ? Math.min(p.end_on ? monthOf(p.end_on) : d.fullTo, v.to) : v.from
      // No period, or a period that ended before the view: at the left edge, label to the right.
      const atEdge = !p || end < v.from
      const bw = Math.max(10, Math.min(18, monthW))
      const bx = atEdge ? LABEL + 2 + 170 * edge++ : x(end + 1) - bw
      lanesSvg.push(
        <g key={`un${pid}`} data-undated style={{ cursor: 'pointer' }} onClick={() => setSel({ kind: 'undated', periodId: pid })}>
          <rect x={bx} y={laneTop.works + 6} width={bw} height={(open ? OPEN_H : FOLD_H) - 12} fill="url(#chrono-hatch)" stroke="var(--rust, #d9734c)" />
          {open ? (
            <text x={atEdge ? bx + bw + 4 : bx - 4} y={laneTop.works + 16} textAnchor={atEdge ? 'start' : 'end'} fontSize={9} fill="var(--rust, #d9734c)">
              {interpolateMessage(t(p ? 'chrono_undated_fmt' : 'chrono_undated_none_fmt'), { count: String(n) })}
              {p && atEdge ? ` · ${p.name}` : ''}
            </text>
          ) : null}
        </g>,
      )
    }
  }
  // Séances.
  for (const [mi, n] of d.sessionsByMonth) {
    if (!visible(mi)) continue
    const open = !folded.has('sessions')
    const cy = laneTop.sessions + (open ? OPEN_H : FOLD_H) / 2 + (open ? 4 : 2)
    lanesSvg.push(<circle key={`s${mi}`} cx={x(mi) + monthW / 2} cy={cy} r={Math.min(open ? 14 : 8, 2.5 + Math.sqrt(n) * (open ? 1.6 : 0.9))} fill="var(--sage, #8bc48a)" opacity={0.85} />)
  }
  // Journal & notes.
  for (const [mi, n] of d.marksByMonth) {
    if (!visible(mi)) continue
    const h = scaleH(n, !folded.has('journal'))
    lanesSvg.push(<rect key={`j${mi}`} x={x(mi) + monthW * 0.3} y={base('journal') - h} width={Math.max(1.5, monthW * 0.4)} height={h} fill="var(--cyan, #6fb6e0)" />)
  }
  // Création lines.
  for (const [mi, n] of d.stepsByMonth) {
    if (!visible(mi)) continue
    const h = scaleH(n, !folded.has('creation'))
    lanesSvg.push(<rect key={`c${mi}`} x={x(mi) + 0.5} y={base('creation') - h} width={Math.max(1, monthW - 1.5)} height={h} fill="#b9b27a" />)
  }
  // Sorties: ▲ out, ▼ back.
  const outUndated = d.orders.filter((o) => !o.out).length
  for (const o of d.orders) {
    for (const [day, up] of [[o.out, true], [o.back, false]] as const) {
      if (!day) continue
      const mi = monthOf(day)
      if (!visible(mi)) continue
      const cx = x(mi) + monthW / 2
      const cy = laneTop.out + (folded.has('out') ? FOLD_H : OPEN_H) / 2 + 2
      lanesSvg.push(<path key={`o${o.id}${up ? 'u' : 'd'}`} d={up ? `M${cx} ${cy - 6} l6 10 h-12 z` : `M${cx} ${cy + 6} l6 -10 h-12 z`} fill="none" stroke="var(--rust, #d9734c)" strokeWidth={1.4} />)
    }
  }
  if (outUndated && !folded.has('out')) {
    lanesSvg.push(
      <text key="outund" x={LABEL + 6} y={laneTop.out + 40} fontSize={10} fill="var(--tx3)">
        {interpolateMessage(t('chrono_out_undated_fmt'), { count: String(outUndated) })}
      </text>,
    )
  }
  // Today.
  if (visible(nowMi)) {
    const tx = x(nowMi) + (now.getDate() / 31) * monthW
    lanesSvg.push(<line key="today" x1={tx} x2={tx} y1={22} y2={H} stroke="var(--ac)" strokeWidth={1.5} />)
  }
  // Selection.
  if (shown) {
    const a = Math.max(shown.from, v.from)
    const b = Math.min(shown.to, v.to)
    if (b >= a) lanesSvg.push(<rect key="sel" x={x(a)} y={AXIS_H - 4} width={x(b + 1) - x(a)} height={H - AXIS_H + 4} fill="var(--ac)" opacity={0.12} stroke="var(--ac)" pointerEvents="none" />)
  }

  const strip = interpolateMessage(t('chrono_strip_fmt'), {
    works: String(d.works.length),
    dayDated: String(d.works.filter((w) => w.day).length),
    yearOnly: String(d.works.filter((w) => !w.day && w.year != null).length),
    undated: String(d.works.filter((w) => !w.day && w.year == null).length),
    sessions: String(d.sessions.length),
    marks: String(d.marks.length),
  })

  return (
    <div data-testid="chronologie-tab" style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 28px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        {[
          [null, 'chrono_zoom_all'],
          [24, 'chrono_zoom_24'],
          [6, 'chrono_zoom_6'],
        ].map(([m, k]) => (
          <button
            key={String(k)}
            type="button"
            className="btn ghost sm"
            style={{ fontSize: 11, opacity: (view == null && m == null) || (view && m != null && view.to - view.from + 1 === m) ? 1 : 0.5 }}
            onClick={() => setZoom(m as number | null)}
          >
            {t(k as 'chrono_zoom_all')}
          </button>
        ))}
        <button type="button" className="btn ghost sm" aria-label={t('chrono_prev')} title={t('chrono_prev')} onClick={() => shift(-1)}>
          ‹
        </button>
        <button type="button" className="btn ghost sm" aria-label={t('chrono_next')} title={t('chrono_next')} onClick={() => shift(1)}>
          ›
        </button>
        {placeName ? (
          <button type="button" className="btn ghost sm" data-testid="chrono-place" style={{ fontSize: 11, borderColor: 'var(--ac)' }} onClick={() => router.replace('/atelier/chronologie')}>
            {interpolateMessage(t('chrono_place_fmt'), { place: placeName })} ✕
          </button>
        ) : null}
        <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, marginLeft: 'auto' }}>
          {strip}
        </span>
      </div>
      <div ref={box} style={{ padding: '8px 8px 0', position: 'relative' }}>
        {d.before && d.beforeLabel ? (
          <div className="t-mono-sm" style={{ position: 'absolute', left: 16, top: 12, fontSize: 10, color: 'var(--tx3)' }}>
            {interpolateMessage(t('chrono_before_fmt'), { years: d.beforeLabel, count: String(d.before) })}
          </div>
        ) : null}
        <svg
          width={LABEL + W}
          height={H}
          style={{ display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'crosshair' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onLostPointerCapture={onUp}
          onClick={onUp}
          onPointerCancel={() => {
            dragRef.current = null
            setDrag(null)
          }}
        >
          <defs>
            <pattern id="chrono-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={5} stroke="#d9734c" strokeWidth={1.2} />
            </pattern>
          </defs>
          {lanesSvg}
        </svg>
        <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', padding: '4px 0 0', marginLeft: LABEL }}>
          {t('chrono_hint')}
        </div>
      </div>
      <SelectionPanel data={data} works={d.works} sessions={d.sessions} marks={d.marks} steps={d.steps} orders={d.orders} sel={sel} monthLabel={monthLabel} />
    </div>
  )
}

function SelectionPanel({
  data,
  works,
  sessions,
  marks,
  steps,
  orders,
  sel,
  monthLabel,
}: {
  data: TimePlaceData
  works: TPWork[]
  sessions: TimePlaceData['sessions']
  marks: TimePlaceData['marks']
  steps: TimePlaceData['steps']
  orders: TimePlaceData['orders']
  sel: Sel | null
  monthLabel: (mi: number, long?: boolean) => string
}) {
  const { t } = useI18n()
  const section = { padding: '12px 28px', borderTop: '1px solid var(--bd)' } as const
  const h = { fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '0 0 8px', fontWeight: 600 } as const
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2px 16px' } as const
  const list = (ws: TPWork[]) => (
    <>
      <div style={grid}>
        {ws.slice(0, MAX_LIST).map((w) => (
          <WorkChip key={w.id} id={w.id} title={w.title} image={w.image} />
        ))}
      </div>
      {ws.length > MAX_LIST ? <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '6px 0 0' }}>{interpolateMessage(t('chrono_more_fmt'), { count: String(ws.length - MAX_LIST) })}</p> : null}
    </>
  )

  if (!sel) return <p style={{ ...section, color: 'var(--tx3)', margin: 0, fontSize: 13 }}>{t('chrono_pick')}</p>

  if (sel.kind === 'undated') {
    const p = data.periods.find((q) => q.id === sel.periodId)
    const ws = works.filter((w) => !w.day && w.year == null && (w.periodId ?? -1) === sel.periodId).sort((a, b) => b.id - a.id)
    return (
      <div style={section} data-testid="chrono-panel">
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 22, margin: '0 0 10px' }}>
          {p ? interpolateMessage(t('chrono_undated_title_fmt'), { period: p.name }) : t('chrono_undated_none')} · {ws.length}
        </h3>
        {list(ws)}
      </div>
    )
  }

  const { from, to } = sel
  const inM = (day: string | null | undefined) => !!day && monthOf(day) >= from && monthOf(day) <= to
  const dated = works.filter((w) => inM(w.day)).sort((a, b) => (b.day as string).localeCompare(a.day as string) || b.id - a.id)
  const byYear = works.filter((w) => !w.day && inSpan(null, w.year, from, to)).sort((a, b) => b.id - a.id)
  const ses = sessions.filter((s) => inM(s.day)).sort((a, b) => b.day.localeCompare(a.day))
  const mk = marks.filter((m) => inM(m.day))
  const markDays = [...countBy(mk, (m) => Number(m.day.replace(/-/g, '')))].sort((a, b) => b[0] - a[0])
  const st = steps.filter((s) => inM(s.on_date))
  const ord = orders.filter((o) => inM(o.out) || inM(o.back))
  const dayStr = (n: number) => `${String(n).slice(0, 4)}-${String(n).slice(4, 6)}-${String(n).slice(6, 8)}`
  const empty = !dated.length && !byYear.length && !ses.length && !mk.length && !st.length && !ord.length
  const kindKey = (k: string) => (['sale', 'consignment', 'loan', 'gift'].includes(k) ? (`chrono_order_kind_${k}` as 'chrono_order_kind_sale') : null)

  return (
    <div data-testid="chrono-panel">
      <div style={{ ...section, display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 22, margin: 0 }}>
          {from === to ? monthLabel(from, true) : interpolateMessage(t('chrono_span_fmt'), { from: monthLabel(from), to: monthLabel(to) })}
        </h3>
        <Link className="btn ghost sm" data-testid="chrono-see-map" href={`/atelier/map?mode=creation&from=${monthKey(from)}&to=${monthKey(to)}`}>
          {t('chrono_see_on_map')} →
        </Link>
        {st.length ? <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{interpolateMessage(t('chrono_steps_fmt'), { count: String(st.length) })}</span> : null}
      </div>
      {empty ? <p style={{ ...section, color: 'var(--tx3)', margin: 0, fontSize: 13 }}>{t('chrono_none')}</p> : null}
      {dated.length ? (
        <div style={section}>
          <h4 style={h}>
            {t('chrono_works_dated')} · {dated.length}
          </h4>
          {list(dated)}
        </div>
      ) : null}
      {byYear.length ? (
        <div style={section}>
          <h4 style={h}>
            {t('chrono_works_year')} · {byYear.length}
          </h4>
          {list(byYear)}
        </div>
      ) : null}
      {ses.length ? (
        <div style={section}>
          <h4 style={h}>
            {t('chrono_lane_sessions')} · {ses.length}
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {ses.slice(0, 40).map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <Link href={`/atelier/journal?day=${s.day}`} style={{ fontSize: 12, color: 'var(--ac)', minWidth: 92 }}>
                  {s.day}
                </Link>
                {s.oeuvreIds.map((id) => (
                  <WorkChip key={id} id={id} size="chip" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {markDays.length ? (
        <div style={section}>
          <h4 style={h}>
            {interpolateMessage(t('chrono_marks_fmt'), { count: String(mk.length) })}
          </h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {markDays.slice(0, 60).map(([n, c]) => (
              <Link key={n} href={`/atelier/journal?day=${dayStr(n)}`} style={{ fontSize: 12, color: 'var(--ac)' }}>
                {dayStr(n)} · {c}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      {ord.length ? (
        <div style={section}>
          <h4 style={h}>
            {t('chrono_lane_out')} · {ord.length}
          </h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {ord.map((o) => {
              const k = kindKey(o.kind)
              return (
                <div key={o.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
                  <Link href={`/atelier/sales?order=${o.id}`} style={{ color: 'var(--ac)' }}>
                    {k ? t(k) : o.kind} {o.ref ?? ''}
                  </Link>
                  <span style={{ color: 'var(--tx3)' }}>
                    {o.out ?? ''}
                    {o.back ? ` · ${t('chrono_order_back')} ${o.back}` : ''}
                  </span>
                  {o.oeuvreIds.map((id) => (
                    <WorkChip key={id} id={id} size="chip" />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
