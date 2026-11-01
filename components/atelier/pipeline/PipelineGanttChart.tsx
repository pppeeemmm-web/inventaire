'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { stringifyError } from '@/lib/error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import {
  ETAPE_STATUT_COLORS,
  TYPE_COLORS,
  type Etape,
  type EtapeStatut,
  type Process,
  type ProcessStatut,
  type ProcessType,
} from '@/components/atelier/pipeline/pipeline-shared'
import { daysUntil } from '@/lib/pipeline-deadlines'
import { PipelineProcessSwipe } from '@/components/atelier/pipeline/PipelineProcessSwipe'
import { fromSuiviEtape } from '@/lib/pipeline/suivi-client'
import {
  fmtDate,
  nextEtapeStatut,
  useSuiviLabels,
} from '@/components/atelier/pipeline/pipeline-suivi-labels'

function upcomingEtapesForPeek(p: Process, max: number): Etape[] {
  return [...p.etapes]
    .filter((e) => e.statut !== 'fait')
    .sort((a, b) => {
      const ta = a.date_echeance ? new Date(a.date_echeance).getTime() : Number.POSITIVE_INFINITY
      const tb = b.date_echeance ? new Date(b.date_echeance).getTime() : Number.POSITIVE_INFINITY
      if (ta !== tb) return ta - tb
      return a.position - b.position
    })
    .slice(0, max)
}

function GanttHoverPopover({
  process,
  clientX,
  clientY,
  onOpen,
  onSurfaceEnter,
  onSurfaceLeave,
}: {
  process: Process
  clientX: number
  clientY: number
  onOpen: () => void
  onSurfaceEnter: () => void
  onSurfaceLeave: () => void
}) {
  const { statutLabels, etapeLabels, typeLabel, t, lang } = useSuiviLabels()
  const dl = lang === 'en' ? 'en' : 'fr'
  const color = TYPE_COLORS[process.type as ProcessType] ?? '#888'
  const steps = upcomingEtapesForPeek(process, 4)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const left = Math.max(8, Math.min(clientX + 8, vw - 292))
  const top = Math.max(8, clientY + 8)

  return (
    <div
      role="dialog"
      aria-label={t('pipeline_gantt_popover_aria')}
      onMouseEnter={onSurfaceEnter}
      onMouseLeave={onSurfaceLeave}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 200,
        width: 280,
        maxWidth: 'calc(100vw - 16px)',
        padding: 12,
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx)', lineHeight: 1.3 }}>{process.nom}</div>
      <div style={{ fontSize: 10, color, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {typeLabel(process.type as ProcessType)} · {statutLabels[process.statut]}
      </div>
      {process.date_fin && (
        <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 8 }}>
          {t('pd_row_deadline')}: {fmtDate(process.date_fin, process.deadline_time, dl)}
        </div>
      )}
      {steps.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>
            {t('pipeline_gantt_peek_heading')}
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 12, color: 'var(--tx)', lineHeight: 1.45 }}>
            {steps.map((e) => (
              <li key={e.id}>
                {e.nom}
                {e.date_echeance ? (
                  <span style={{ color: 'var(--tx3)' }}>
                    {' · '}
                    {fmtDate(e.date_echeance, undefined, dl)}
                    <span style={{ marginLeft: 4 }}>({etapeLabels[e.statut]})</span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--tx3)' }}>
                    {' '}
                    ({etapeLabels[e.statut]})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="btn ghost sm" style={{ marginTop: 12, minHeight: 44, width: '100%' }} onClick={onOpen}>
        {t('pipeline_cal_open_process')}
      </button>
    </div>
  )
}

const DAY_MS = 86400000
/** Visible window width per zoom step — zoom scales time, pan moves the window. */
const GANTT_SPANS = [
  { days: 1095, labelKey: 'pipeline_gantt_span_3y' },
  { days: 365, labelKey: 'pipeline_gantt_span_1y' },
  { days: 182, labelKey: 'pipeline_gantt_span_6m' },
  { days: 91, labelKey: 'pipeline_gantt_span_3m' },
  { days: 42, labelKey: 'pipeline_gantt_span_6w' },
] as const
const GANTT_ZOOM_MAX = GANTT_SPANS.length - 1
const GANTT_DEFAULT_ZOOM = 1
/** Where "today" sits in the window on open / Today: a third in, so recent past stays visible. */
const GANTT_TODAY_AT = 0.3
/** Minimum px between month labels before they are thinned. */
const GANTT_MONTH_LABEL_PX = 56

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function windowStartForToday(zoom: number): number {
  return startOfToday() - GANTT_SPANS[zoom].days * DAY_MS * GANTT_TODAY_AT
}

function GanttView({
  processes,
  dateLocaleTag: ganttDateLoc,
  narrow,
  onSelect,
  onEdit: _onEdit,
  onRefresh,
  onCycleStatut,
}: {
  processes: Process[]
  dateLocaleTag: 'fr-FR' | 'en-GB'
  narrow: boolean
  onSelect: (p: Process) => void
  onEdit: (p: Process) => void
  onRefresh: () => void
  onCycleStatut: (id: string, s: ProcessStatut) => void
}) {
  const { statutLabels, etapeLabels, typeLabel, t, lang } = useSuiviLabels()
  const finePointerHover = useMediaQuery('(hover: hover) and (pointer: fine)')
  const showHoverPopover = finePointerHover && !narrow
  const [expandedPeekId, setExpandedPeekId] = useState<string | null>(null)
  const [hoverPop, setHoverPop] = useState<{ process: Process; x: number; y: number } | null>(null)
  const [zoomIdx, setZoomIdx] = useState(GANTT_DEFAULT_ZOOM)
  const [viewStart, setViewStart] = useState(() => windowStartForToday(GANTT_DEFAULT_ZOOM))
  const spanMs = GANTT_SPANS[zoomIdx].days * DAY_MS
  const headerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<HTMLDivElement | null>(null)
  const [trackPx, setTrackPx] = useState(800)
  const dragRef = useRef<{ x: number; start: number } | null>(null)
  const hidePopTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setZoom = useCallback((next: number) => {
    const z = Math.min(GANTT_ZOOM_MAX, Math.max(0, next))
    if (z === zoomIdx) return
    // Keep the window centred while zooming.
    const nextSpan = GANTT_SPANS[z].days * DAY_MS
    setViewStart((s) => s + spanMs / 2 - nextSpan / 2)
    setZoomIdx(z)
  }, [zoomIdx, spanMs])

  const panBy = useCallback((fraction: number) => {
    setViewStart((s) => s + fraction * spanMs)
  }, [spanMs])

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setTrackPx(Math.max(1, el.clientWidth)))
    ro.observe(el)
    setTrackPx(Math.max(1, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  // Horizontal wheel / trackpad swipe / Shift+wheel pans. Native listener: React's onWheel is passive.
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (!horizontal && !e.shiftKey) return
      e.preventDefault()
      const d = horizontal ? e.deltaX : e.deltaY
      setViewStart((s) => s + (d / trackPx) * spanMs)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [trackPx, spanMs])

  const clearHideTimer = useCallback(() => {
    if (hidePopTimer.current) {
      clearTimeout(hidePopTimer.current)
      hidePopTimer.current = null
    }
  }, [])

  const scheduleHidePopover = useCallback(
    (processId: string) => {
      clearHideTimer()
      hidePopTimer.current = setTimeout(() => {
        setHoverPop((prev) => (prev?.process.id === processId ? null : prev))
        hidePopTimer.current = null
      }, 220)
    },
    [clearHideTimer],
  )

  useEffect(() => () => clearHideTimer(), [clearHideTimer])

  useEffect(() => {
    setHoverPop((h) => (h && processes.some((q) => q.id === h.process.id) ? h : null))
  }, [processes])

  const timeline = useMemo(() => {
    const mn = new Date(viewStart)
    const mx = new Date(viewStart + spanMs)
    const total = spanMs
    /** Window position in %, NOT clamped — callers decide what is off-window. */
    const pctFn = (d: Date | string) => (new Date(d).getTime() - mn.getTime()) / total * 100
    const fmtMonth = (d: Date) => d.toLocaleDateString(ganttDateLoc, { month: 'short', year: '2-digit' })

    // Grid lines: every month start inside the window.
    const months: { left: number; k: string }[] = []
    const cur = new Date(mn.getFullYear(), mn.getMonth(), 1)
    while (cur.getTime() <= mx.getTime()) {
      const left = pctFn(cur)
      if (left >= 0 && left < 100) months.push({ k: `${cur.getFullYear()}-${cur.getMonth()}`, left })
      cur.setMonth(cur.getMonth() + 1)
    }

    // Labels: left-aligned on the month line (never centred across the edge), thinned to fit,
    // dropped when they would run past the right edge.
    const pxPerMonth = trackPx * (30.44 * DAY_MS) / total
    const step = Math.max(1, Math.ceil(GANTT_MONTH_LABEL_PX / pxPerMonth))
    const labelMaxLeft = 100 - (GANTT_MONTH_LABEL_PX * 0.8 / trackPx) * 100
    const monthLabels: { label: string; left: number; k: string }[] = []
    for (const m of months) {
      const [y, mo] = m.k.split('-').map(Number)
      if ((y * 12 + mo) % step !== 0 || m.left > labelMaxLeft) continue
      monthLabels.push({ k: m.k, left: m.left, label: fmtMonth(new Date(y, mo, 1)) })
    }
    // Name the partial month at the left edge when the first label is far enough in.
    const firstLeftPx = monthLabels.length ? (monthLabels[0].left / 100) * trackPx : trackPx
    if (step === 1 && firstLeftPx >= GANTT_MONTH_LABEL_PX) {
      monthLabels.unshift({ k: 'edge', left: 0, label: fmtMonth(mn) })
    }

    const showWeekTicks = total <= 62 * 86400000
    const mondayTicks: { left: number; k: string }[] = []
    if (showWeekTicks) {
      let w = new Date(mn.getFullYear(), mn.getMonth(), mn.getDate())
      w.setHours(0, 0, 0, 0)
      const off = (w.getDay() + 6) % 7
      w.setDate(w.getDate() - off)
      let guard = 0
      while (w.getTime() <= mx.getTime() && guard++ < 240) {
        const left = pctFn(w)
        if (left >= 0) mondayTicks.push({ left, k: `w-${w.getFullYear()}-${w.getMonth()}-${w.getDate()}` })
        w.setDate(w.getDate() + 7)
      }
    }
    return {
      pct: pctFn,
      months,
      monthLabels,
      todayPct: pctFn(new Date(startOfToday())),
      mondayTicks,
      showWeekTicks,
    }
  }, [viewStart, spanMs, trackPx, ganttDateLoc])

  const { pct, months, monthLabels, todayPct, mondayTicks, showWeekTicks } = timeline
  const todayInView = todayPct >= 0 && todayPct <= 100
  const labelColWidth = narrow ? '100%' : 240
  const rowGap = narrow ? 8 : 0

  return (
    <>
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44, minWidth: 44 }}
            aria-label={t('pipeline_gantt_pan_earlier')} title={t('pipeline_gantt_pan_earlier')}
            onClick={() => panBy(-0.5)}>‹</button>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }}
            onClick={() => setViewStart(windowStartForToday(zoomIdx))}>{t('pipeline_gantt_today')}</button>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44, minWidth: 44 }}
            aria-label={t('pipeline_gantt_pan_later')} title={t('pipeline_gantt_pan_later')}
            onClick={() => panBy(0.5)}>›</button>
        </div>
        <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', flexShrink: 0 }}>
          {t('pipeline_gantt_zoom_label')
            .replace(/\{n\}/g, String(zoomIdx + 1))
            .replace(/\{max\}/g, String(GANTT_ZOOM_MAX + 1))}
        </span>
        <input
          type="range"
          min={0}
          max={GANTT_ZOOM_MAX}
          step={1}
          value={zoomIdx}
          aria-label={t('pipeline_gantt_zoom_label')
            .replace(/\{n\}/g, String(zoomIdx + 1))
            .replace(/\{max\}/g, String(GANTT_ZOOM_MAX + 1))}
          aria-valuemin={0}
          aria-valuemax={GANTT_ZOOM_MAX}
          aria-valuenow={zoomIdx}
          aria-valuetext={t(GANTT_SPANS[zoomIdx].labelKey)}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (Number.isFinite(v)) setZoom(v)
          }}
          style={{
            width: narrow ? '100%' : 160,
            flex: narrow ? '1 1 120px' : undefined,
            minWidth: 120,
            maxWidth: narrow ? 280 : 220,
            height: 36,
            accentColor: 'var(--ac)',
            cursor: 'pointer',
          }}
        />
        <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)', flexShrink: 0 }}>
          {t(GANTT_SPANS[zoomIdx].labelKey)}
        </span>
      </div>
      <div
        ref={headerRef}
        title={t('pipeline_gantt_header_drag_hint')}
        onPointerDown={(e) => {
          dragRef.current = { x: e.clientX, start: viewStart }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = dragRef.current
          if (!d) return
          setViewStart(d.start - ((e.clientX - d.x) / trackPx) * spanMs)
        }}
        onPointerUp={() => { dragRef.current = null }}
        onPointerCancel={() => { dragRef.current = null }}
        style={{
          position:'relative',
          height:24,
          marginBottom:8,
          marginLeft: narrow ? 0 : 240,
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
          cursor: 'grab',
          touchAction: 'pan-y',
          userSelect: 'none',
          borderBottom: '1px solid var(--bd)',
        }}
      >
        {monthLabels.map(m=>(
          <div key={m.k} style={{ position:'absolute', left:`${m.left}%`, paddingLeft:4, fontSize:11, color:'var(--tx3)', letterSpacing:'0.05em', whiteSpace:'nowrap', borderLeft: m.k === 'edge' ? undefined : '1px solid var(--bd)' }}>{m.label}</div>
        ))}
      </div>
      <div ref={chartRef} style={{ display:'flex', flexDirection:'column', gap: narrow ? 10 : 5, minWidth: 0, width: '100%' }}>
        {processes.map(p=>{
          const color   = TYPE_COLORS[p.type as ProcessType]??'#888'
          const isDone  = ['perdu','annule','termine'].includes(p.statut)
          // Raw (unclamped) bar ends; the drawn bar is the part inside the window.
          const rawL    = p.date_debut ? pct(p.date_debut) : todayPct-0.5
          const rawR    = p.date_fin   ? pct(p.date_fin)   : todayPct+0.5
          const offLeft = rawR < 0
          const offRight= rawL > 100
          const barL    = Math.max(0, rawL)
          const barR    = Math.min(100, rawR)
          const barW    = Math.max(0.5, barR-barL)
          const done    = p.etapes.filter(e=>e.statut==='fait').length
          const progress= p.etapes.length>0 ? done/p.etapes.length : 0
          const fillR   = rawL + progress * (rawR - rawL)
          const fillPct = Math.max(0, Math.min(100, (Math.min(fillR, barR) - barL) / barW * 100))
          const peekSteps = expandedPeekId === p.id ? upcomingEtapesForPeek(p, 4) : []
          return (
            <PipelineProcessSwipe key={p.id} processId={p.id} enabled={narrow} onRefresh={onRefresh} t={t}>
            <div
              style={{
                display:'flex',
                flexDirection: narrow ? 'column' : 'row',
                alignItems:'flex-start',
                gap: rowGap,
                opacity:isDone?0.5:1,
                minWidth: 0,
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: labelColWidth,
                  flexShrink:0,
                  paddingRight: narrow ? 0 : 16,
                  display:'flex',
                  flexDirection:'column',
                  gap:6,
                  minWidth: 0,
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display:'flex', alignItems:'flex-start', gap:4 }}>
                  <button
                    type="button"
                    aria-expanded={expandedPeekId === p.id}
                    aria-controls={`gantt-peek-${p.id}`}
                    id={`gantt-peek-btn-${p.id}`}
                    data-testid="pipeline-gantt-peek"
                    data-process-id={p.id}
                    aria-label={t('pipeline_gantt_peek_toggle_aria')}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setExpandedPeekId((x) => (x === p.id ? null : p.id))
                    }}
                    className="btn ghost sm"
                    style={{ minWidth:44, minHeight:44, flexShrink:0, padding:0 }}
                  >
                    {expandedPeekId === p.id ? '▼' : '▶'}
                  </button>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:'var(--tx)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }} onClick={()=>onSelect(p)}>{p.nom}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color }}>{typeLabel(p.type as ProcessType)}</span>
                      <button
                        type="button"
                        onClick={() => onCycleStatut(p.id, p.statut)}
                        title={t('pipeline_gantt_process_statut_title').replace(/\{status\}/g, statutLabels[p.statut])}
                        style={{ fontSize:10, padding:'2px 8px', background:'var(--bg0)', border:`1px solid ${color}55`, color, cursor:'pointer', letterSpacing:'0.04em', textTransform:'uppercase', flexShrink:0 }}
                      >{statutLabels[p.statut]}</button>
                    </div>
                  </div>
                </div>
                {expandedPeekId === p.id && (
                  <div
                    id={`gantt-peek-${p.id}`}
                    role="region"
                    data-testid="pipeline-gantt-peek-panel"
                    aria-labelledby={`gantt-peek-btn-${p.id}`}
                    style={{ marginLeft: narrow ? 0 : 48, paddingBottom:2, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }}
                  >
                    <div className="t-mono-sm" style={{ fontSize:10, color:'var(--tx3)', marginBottom:4 }}>
                      {t('pipeline_gantt_peek_heading')}
                    </div>
                    {peekSteps.length === 0 ? (
                      <div className="t-mono-sm" style={{ fontSize:11, color:'var(--tx3)' }}>{t('pipeline_gantt_peek_empty')}</div>
                    ) : (
                      <ul style={{ margin:0, padding:'0 0 0 14px', fontSize:12, color:'var(--tx)', lineHeight:1.45 }}>
                        {peekSteps.map((e) => (
                          <li key={e.id}>
                            {e.nom}
                            {e.date_echeance ? (
                              <span style={{ color:'var(--tx3)' }}>
                                {' · '}
                                {fmtDate(e.date_echeance, undefined, lang === 'en' ? 'en' : 'fr')}
                                <span style={{ marginLeft:4 }}>({etapeLabels[e.statut]})</span>
                              </span>
                            ) : (
                              <span style={{ color:'var(--tx3)' }}> ({etapeLabels[e.statut]})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div
                style={{
                  flex:1,
                  position:'relative',
                  height:28,
                  minWidth:0,
                  width:'100%',
                  maxWidth:'100%',
                  overflow:'hidden',
                }}
                {...(showHoverPopover
                  ? {
                      onMouseEnter: (e: { clientX: number; clientY: number }) => {
                        clearHideTimer()
                        setHoverPop({ process: p, x: e.clientX, y: e.clientY })
                      },
                      onMouseMove: (e: { clientX: number; clientY: number }) => {
                        setHoverPop((prev) =>
                          prev && prev.process.id === p.id ? { process: p, x: e.clientX, y: e.clientY } : prev,
                        )
                      },
                      onMouseLeave: () => scheduleHidePopover(p.id),
                    }
                  : {})}
              >
                {months.map(m=>(
                  <div key={m.k} style={{ position:'absolute', left:`${m.left}%`, top:0, bottom:0, width:1, background:'var(--bd)', opacity:0.4 }} />
                ))}
                {showWeekTicks &&
                  mondayTicks.map((wk) => (
                    <div
                      key={wk.k}
                      style={{
                        position: 'absolute',
                        left: `${wk.left}%`,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: 'var(--bd)',
                        opacity: 0.25,
                      }}
                    />
                  ))}
                {todayInView && (
                  <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:1, background:'var(--ac)', opacity:0.6 }} />
                )}
                {(offLeft || offRight) ? (
                  <button type="button" onClick={()=>onSelect(p)}
                    style={{ position:'absolute', [offLeft ? 'left' : 'right']:0, top:'50%', transform:'translateY(-50%)', fontSize:14, lineHeight:1, padding:'0 6px', color, background:'none', border:'none', cursor:'pointer' }}>
                    {offLeft ? '‹' : '›'}
                  </button>
                ) : (
                  <div style={{ position:'absolute', left:`${barL}%`, width:`${barW}%`, top:'50%', transform:'translateY(-50%)', height:16, background:isDone?'#222':`${color}22`, border:`1px solid ${isDone?'#444':color}`, borderLeftStyle: rawL < 0 ? 'dashed' : 'solid', borderRightStyle: rawR > 100 ? 'dashed' : 'solid', cursor:'pointer', overflow:'hidden' }}
                    onClick={()=>onSelect(p)}>
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${fillPct}%`, background:`${color}55` }} />
                  </div>
                )}
                {/* Step markers sit at their own dates on the row, so dated steps of an undated
                    process stay visible as you pan through the past. */}
                {p.etapes.filter(e=>e.date_echeance).map(e=>{
                    const leftPct    = pct(e.date_echeance!)
                    if (leftPct < 0 || leftPct > 100) return null
                    const isFait     = e.statut === 'fait'
                    const isBloque   = e.statut === 'bloque'
                    const isEnCours  = e.statut === 'en_cours'
                    const days       = daysUntil(e.date_echeance!)
                    const isOverdue  = days < 0 && !isFait && !e.overdue_override
                    const markerColor = isOverdue ? '#c06060' : isFait ? color : isBloque ? '#c06060' : isEnCours ? '#c0a030' : `${color}66`
                    return (
                      <div key={e.id}
                        title={t('pipeline_gantt_etape_marker_title')
                          .replace(/\{step\}/g, e.nom)
                          .replace(/\{stepStatus\}/g, etapeLabels[e.statut])
                          .replace(/\{overdue\}/g, isOverdue ? t('pipeline_gantt_overdue_suffix') : '')}
                        onClick={async(ev)=>{
                          ev.stopPropagation()
                          try {
                            const next = nextEtapeStatut(e.statut)
                            await fromSuiviEtape(createClient()).update({statut:next}).eq('id',e.id)
                            onRefresh()
                          } catch (err) {
                            alert(`${t('error_prefix')} ${stringifyError(err)}`)
                          }
                        }}
                        style={{ position:'absolute', left:`${leftPct}%`, top:6, bottom:6, width:12, transform:'translateX(-50%)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1 }}
                      >
                        <div style={{ width: isFait?4:3, height:'100%', background: markerColor, boxShadow: isOverdue?'0 0 6px #c06060':undefined }} />
                        {(isFait || isBloque || isEnCours) && (
                          <div style={{ position:'absolute', top:2, left:'50%', transform:'translateX(-50%)', fontSize:10, color: isFait?color:isBloque?'#c06060':'#c0a030', fontWeight:700, whiteSpace:'nowrap', pointerEvents:'none' }}>
                            {isFait?'✓':isBloque?'✕':'…'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                {!narrow && p.statut!=='en_cours' && !offLeft && rawR <= 100 && (
                  <div style={{ position:'absolute', left:`${barR+0.5}%`, top:'50%', transform:'translateY(-50%)', fontSize:10, color, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', whiteSpace:'nowrap', paddingLeft:8 }}>
                    {statutLabels[p.statut]}
                  </div>
                )}
              </div>
            </div>
            </PipelineProcessSwipe>
          )
        })}
      </div>
    </div>
    {hoverPop && showHoverPopover && typeof document !== 'undefined' && createPortal(
      <GanttHoverPopover
        process={hoverPop.process}
        clientX={hoverPop.x}
        clientY={hoverPop.y}
        onOpen={() => {
          clearHideTimer()
          onSelect(hoverPop.process)
          setHoverPop(null)
        }}
        onSurfaceEnter={clearHideTimer}
        onSurfaceLeave={() => scheduleHidePopover(hoverPop.process.id)}
      />,
      document.body,
    )}
    </>
  )
}

export { GanttView as PipelineGanttChart }
