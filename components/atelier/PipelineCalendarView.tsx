'use client'

import { Fragment, useMemo, useState, useCallback, useEffect } from 'react'
import type { PipelineCalendarEvent } from '@/lib/pipeline-calendar'
import {
  groupPipelineCalendarEventsByDateKey,
  toLocalDateKey,
  type PipelineCalendarRange,
  normalizePipelineCalendarAnchor,
  addCalendarMonthsLocal,
  addCalendarDaysLocal,
  addCalendarYearsLocal,
  isoWeekNumber,
} from '@/lib/pipeline-calendar'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function ymdKey(y: number, m0: number, d: number) {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`
}

function localDateKeyFromDate(d: Date): string {
  return ymdKey(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Monday = 0 … Sunday = 6 */
function mondayIndexFromSundayJs(daySun0: number) {
  return (daySun0 + 6) % 7
}

type MonthMiniGridProps = {
  y: number
  m0: number
  todayKey: string
  selectedKey: string | null
  setSelectedKey: (k: string) => void
  byDay: Map<string, PipelineCalendarEvent[]>
  localeTag: 'fr-FR' | 'en-GB'
  narrow: boolean
  resolveTypeColor: (processType: string) => string
  t: (k: string) => string
  compact?: boolean
  weekdayLabels: string[]
  showWeekNumbers?: boolean
}

function MonthMiniGrid({
  y,
  m0,
  todayKey,
  selectedKey,
  setSelectedKey,
  byDay,
  localeTag,
  narrow,
  resolveTypeColor,
  t,
  compact,
  weekdayLabels,
  showWeekNumbers = true,
}: MonthMiniGridProps) {
  const first = new Date(y, m0, 1)
  const lastDay = new Date(y, m0 + 1, 0).getDate()
  const lead = mondayIndexFromSundayJs(first.getDay())
  const totalCells = Math.ceil((lead + lastDay) / 7) * 7
  const rowCount = totalCells / 7

  const cells = useMemo(() => {
    const out: { key: string | null; dayNum: number | null }[] = []
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - lead + 1
      if (dayNum < 1 || dayNum > lastDay) out.push({ key: null, dayNum: null })
      else out.push({ key: ymdKey(y, m0, dayNum), dayNum })
    }
    return out
  }, [totalCells, lead, lastDay, y, m0])

  const weekNums = useMemo(
    () =>
      Array.from({ length: rowCount }, (_, r) =>
        isoWeekNumber(new Date(y, m0, 1 - lead + r * 7)),
      ),
    [rowCount, lead, y, m0],
  )

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(new Date(y, m0, 1)),
    [localeTag, y, m0],
  )

  const cellPad = compact ? 2 : narrow ? 4 : 6
  const cellMinH = compact ? 28 : narrow ? 40 : 52
  const wkColWidth = compact ? 18 : narrow ? 20 : 24
  const headerFontSize = compact ? 7 : 9
  const wkNumFontSize = compact ? 9 : 10

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      <div
        className="t-mono-sm"
        style={{
          fontSize: compact ? 10 : 11,
          color: 'var(--tx3)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {monthTitle}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: showWeekNumbers
            ? `${wkColWidth}px repeat(7, minmax(0, 1fr))`
            : 'repeat(7, minmax(0, 1fr))',
          gap: compact ? 1 : 2,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {showWeekNumbers && (
          <div
            className="t-mono-sm"
            aria-label={t('pipeline_cal_week_col_aria')}
            style={{
              textAlign: 'center',
              fontSize: headerFontSize,
              color: 'var(--tx3)',
              padding: compact ? '2px 0' : '4px 0',
              textTransform: 'uppercase',
            }}
          >
            {t('pipeline_cal_week_short')}
          </div>
        )}
        {weekdayLabels.map((w, wi) => (
          <div
            key={`wd-${wi}`}
            className="t-mono-sm"
            style={{
              textAlign: 'center',
              fontSize: headerFontSize,
              color: 'var(--tx3)',
              padding: compact ? '2px 0' : '4px 0',
              textTransform: 'uppercase',
            }}
          >
            {w}
          </div>
        ))}
        {Array.from({ length: rowCount }, (_, r) => {
          const rowDays = cells.slice(r * 7, r * 7 + 7)
          return (
            <Fragment key={`row-${r}`}>
              {showWeekNumbers && (
                <div
                  className="t-mono-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: cellMinH,
                    fontSize: wkNumFontSize,
                    color: 'var(--tx3)',
                  }}
                >
                  {weekNums[r]}
                </div>
              )}
              {rowDays.map((c, idx) => {
                if (!c.key) {
                  return <div key={`e-${r}-${idx}`} style={{ minHeight: cellMinH }} />
                }
                const dayKey = c.key
                const list = byDay.get(dayKey) ?? []
                const isToday = dayKey === todayKey
                const isSel = dayKey === selectedKey
                const showDots = list.slice(0, compact ? 2 : 3)
                const more = list.length - showDots.length
                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => setSelectedKey(dayKey)}
                    style={{
                      minHeight: cellMinH,
                      minWidth: 0,
                      padding: cellPad,
                      border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd2)'}`,
                      background: isSel ? 'var(--bg1)' : isToday ? 'var(--bg1)' : 'var(--bg0)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: compact ? 2 : 4,
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        fontSize: compact ? 9 : narrow ? 11 : 12,
                        fontWeight: isToday ? 700 : 500,
                        color: isToday ? 'var(--ac)' : 'var(--tx)',
                      }}
                    >
                      {c.dayNum}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
                      {showDots.map((ev) => (
                        <span
                          key={ev.id}
                          title={ev.label}
                          style={{
                            width: compact ? 4 : 6,
                            height: compact ? 4 : 6,
                            borderRadius: 99,
                            background: ev.kind === 'reminder' ? 'var(--ac)' : resolveTypeColor(ev.processType),
                            flexShrink: 0,
                          }}
                        />
                      ))}
                      {more > 0 && (
                        <span className="t-mono-sm" style={{ fontSize: compact ? 7 : 8, color: 'var(--tx3)', marginLeft: 2 }}>
                          {t('pipeline_cal_more_fmt').replace(/\{n\}/g, String(more))}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

const RANGE_SEQUENCE: PipelineCalendarRange[] = ['week', 'month', 'quarter', 'semester', 'year']

function weekdayHeaders(localeTag: 'fr-FR' | 'en-GB') {
  const base = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(localeTag, { weekday: 'short' }).format(new Date(base.getTime() + i * 86400000)),
  )
}

export function PipelineCalendarView({
  events,
  range,
  anchor,
  onAnchorChange,
  onRangeChange,
  localeTag,
  t,
  narrow,
  resolveTypeColor,
  onOpenProcess,
  onTickEtape,
  onDismissReminder,
}: {
  events: PipelineCalendarEvent[]
  range: PipelineCalendarRange
  anchor: Date
  onAnchorChange: (d: Date) => void
  onRangeChange: (r: PipelineCalendarRange) => void
  localeTag: 'fr-FR' | 'en-GB'
  t: (k: string) => string
  narrow: boolean
  resolveTypeColor: (processType: string) => string
  onOpenProcess: (processId: string) => void
  onTickEtape: (etapeId: string) => Promise<void> | void
  onDismissReminder: (reminderId: string) => Promise<void> | void
}) {
  const todayKey = toLocalDateKey(new Date().toISOString())
  const byDay = useMemo(() => groupPipelineCalendarEventsByDateKey(events), [events])

  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    const tk = toLocalDateKey(new Date().toISOString())
    const a = normalizePipelineCalendarAnchor(range, anchor)
    if (range === 'month') {
      const y = a.getFullYear()
      const m0 = a.getMonth()
      if (tk.startsWith(`${y}-${pad2(m0 + 1)}`)) return tk
    }
    if (range === 'year') {
      const yy = a.getFullYear()
      if (tk.startsWith(`${yy}-`)) return tk
    }
    return null
  })

  const y = anchor.getFullYear()
  const m0 = anchor.getMonth()

  useEffect(() => {
    setSelectedKey((prev) => {
      if (!prev) return null
      if (range === 'week') {
        const start = normalizePipelineCalendarAnchor('week', anchor)
        const end = addCalendarDaysLocal(start, 6)
        const pk = prev
        return pk >= localDateKeyFromDate(start) && pk <= localDateKeyFromDate(end) ? prev : null
      }
      if (range === 'month') {
        const prefix = `${y}-${pad2(m0 + 1)}`
        return prev.startsWith(prefix) ? prev : null
      }
      if (range === 'quarter') {
        const q0 = Math.floor(m0 / 3) * 3
        for (let i = 0; i < 3; i++) {
          const mm = q0 + i
          if (prev.startsWith(`${y}-${pad2(mm + 1)}`)) return prev
        }
        return null
      }
      if (range === 'semester') {
        const s0 = m0 < 6 ? 0 : 6
        for (let i = 0; i < 6; i++) {
          const mm = s0 + i
          if (prev.startsWith(`${y}-${pad2(mm + 1)}`)) return prev
        }
        return null
      }
      if (range === 'year') {
        return prev.startsWith(`${y}-`) ? prev : null
      }
      return null
    })
  }, [range, anchor, y, m0])

  const selectedEvents = selectedKey ? byDay.get(selectedKey) ?? [] : []

  const bump = useCallback(
    (delta: number) => {
      const a = normalizePipelineCalendarAnchor(range, anchor)
      if (range === 'week') onAnchorChange(addCalendarDaysLocal(a, delta * 7))
      else if (range === 'month') onAnchorChange(addCalendarMonthsLocal(a, delta))
      else if (range === 'quarter') onAnchorChange(addCalendarMonthsLocal(a, delta * 3))
      else if (range === 'semester') onAnchorChange(addCalendarMonthsLocal(a, delta * 6))
      else if (range === 'year') onAnchorChange(addCalendarYearsLocal(a, delta))
    },
    [range, anchor, onAnchorChange],
  )

  const goToday = useCallback(() => {
    const n = new Date()
    onAnchorChange(normalizePipelineCalendarAnchor(range, n))
    setSelectedKey(localDateKeyFromDate(n))
  }, [onAnchorChange, range])

  const displayYear = useMemo(() => {
    if (range === 'week') {
      const a = normalizePipelineCalendarAnchor('week', anchor)
      const end = addCalendarDaysLocal(a, 6)
      if (a.getFullYear() !== end.getFullYear()) return `${a.getFullYear()}–${end.getFullYear()}`
      return String(a.getFullYear())
    }
    return String(anchor.getFullYear())
  }, [range, anchor])

  const rangeTitle = useMemo(() => {
    const a = normalizePipelineCalendarAnchor(range, anchor)
    if (range === 'week') {
      const end = addCalendarDaysLocal(a, 6)
      const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
      return `${a.toLocaleDateString(localeTag, o)} – ${end.toLocaleDateString(localeTag, o)}`
    }
    if (range === 'month') {
      return new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(new Date(y, m0, 1))
    }
    if (range === 'quarter') {
      const q0 = Math.floor(m0 / 3) * 3
      const qn = Math.floor(q0 / 3) + 1
      const start = new Date(y, q0, 1)
      const end = new Date(y, q0 + 3, 0)
      return t('pipeline_cal_quarter_title_fmt')
        .replace(/\{n\}/g, String(qn))
        .replace(/\{year\}/g, String(y))
        .replace(/\{start\}/g, start.toLocaleDateString(localeTag, { month: 'short' }))
        .replace(/\{end\}/g, end.toLocaleDateString(localeTag, { month: 'short' }))
    }
    if (range === 'semester') {
      const s0 = m0 < 6 ? 0 : 6
      const label = s0 === 0 ? t('pipeline_cal_semester_h1') : t('pipeline_cal_semester_h2')
      return `${label} ${y}`
    }
    if (range === 'year') {
      return new Intl.DateTimeFormat(localeTag, { year: 'numeric' }).format(new Date(y, 0, 1))
    }
    return new Intl.DateTimeFormat(localeTag, { month: 'long', year: 'numeric' }).format(new Date(y, m0, 1))
  }, [range, anchor, localeTag, y, m0, t])

  const cellPad = narrow ? 4 : 6
  const cellMinH = narrow ? 40 : 52
  const weekdays = useMemo(() => weekdayHeaders(localeTag), [localeTag])

  const weekCells = useMemo(() => {
    const start = normalizePipelineCalendarAnchor('week', anchor)
    return Array.from({ length: 7 }, (_, i) => {
      const d = addCalendarDaysLocal(start, i)
      return { key: localDateKeyFromDate(d), dayNum: d.getDate() }
    })
  }, [anchor])

  const rangeLabel = (r: PipelineCalendarRange, short?: boolean) => {
    const suffix = short ? '_short' : ''
    switch (r) {
      case 'week':
        return t(`pipeline_cal_range_week${suffix}`)
      case 'month':
        return t(`pipeline_cal_range_month${suffix}`)
      case 'quarter':
        return t(`pipeline_cal_range_quarter${suffix}`)
      case 'semester':
        return t(`pipeline_cal_range_semester${suffix}`)
      case 'year':
        return t(`pipeline_cal_range_year${suffix}`)
      default:
        return r
    }
  }

  return (
    <div
      data-testid="pipeline-calendar-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: narrow ? 12 : 16,
        padding: narrow ? '12px 16px' : '20px 28px',
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      {/* Range selector */}
      <div
        role="group"
        aria-label={t('pipeline_cal_range_group_aria')}
        style={narrow ? {
          display: 'flex',
          width: '100%',
          padding: 3,
          gap: 0,
          background: 'var(--bg0)',
          border: '1px solid var(--bd)',
          borderRadius: 10,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        } : {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          padding: '0 0 6px',
          borderBottom: '1px solid var(--bd2)',
        }}
      >
        {RANGE_SEQUENCE.map((r, i) => (
          <button
            key={r}
            type="button"
            className={narrow ? undefined : 'btn ghost sm'}
            aria-pressed={range === r}
            aria-label={narrow ? rangeLabel(r) : undefined}
            onClick={() => { if (r !== range) onRangeChange(r) }}
            style={narrow ? {
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              padding: '10px 4px',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              background: range === r ? 'var(--ac)' : 'transparent',
              color: range === r ? 'var(--bg0)' : 'var(--tx)',
              borderRadius: i === 0 ? '7px 0 0 7px' : i === RANGE_SEQUENCE.length - 1 ? '0 7px 7px 0' : 0,
              boxShadow: range === r ? '0 1px 3px rgba(0,0,0,0.2)' : undefined,
            } : {
              minHeight: 44,
              background: range === r ? 'var(--ac)' : undefined,
              color: range === r ? 'var(--bg0)' : undefined,
              fontWeight: range === r ? 700 : 500,
              fontSize: 11,
              letterSpacing: '0.05em',
            }}
          >
            {rangeLabel(r, narrow)}
          </button>
        ))}
      </div>

      {/* Navigation: narrow splits title and controls to avoid horizontal overflow. */}
      {narrow ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minWidth: 50,
                padding: '6px 8px',
                background: 'var(--bg0)',
                border: '1px solid var(--bd2)',
                borderRadius: 8,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, color: 'var(--tx)' }}>
                {displayYear}
              </span>
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              flex: '1 1 0',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {rangeTitle}
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '44px minmax(0, 1fr) 44px',
            gap: 6,
            minWidth: 0,
          }}>
            <button
              type="button"
              className="btn ghost sm"
              aria-label={t('pipeline_cal_prev')}
              onClick={() => bump(-1)}
              style={{ minWidth: 0, minHeight: 44 }}
            >
              ‹
            </button>
            <button type="button" className="btn ghost sm" onClick={goToday}
              style={{ minWidth: 0, minHeight: 44, whiteSpace: 'nowrap' }}>
              {t('pipeline_cal_today')}
            </button>
            <button
              type="button"
              className="btn ghost sm"
              aria-label={t('pipeline_cal_next')}
              onClick={() => bump(1)}
              style={{ minWidth: 0, minHeight: 44 }}
            >
              ›
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          gap: 10,
        }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 64,
              padding: '8px 10px',
              background: 'var(--bg0)',
              border: '1px solid var(--bd2)',
              borderRadius: 8,
              textAlign: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15, color: 'var(--tx)' }}>
              {displayYear}
            </span>
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 8,
            flex: '1 1 200px',
            minWidth: 0,
          }}>
            <button
              type="button"
              className="btn ghost sm"
              aria-label={t('pipeline_cal_prev')}
              onClick={() => bump(-1)}
              style={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
            >
              ‹
            </button>
            <div style={{
              fontSize: 16,
              fontWeight: 600,
              flex: '1 1 0',
              textAlign: 'center',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {rangeTitle}
            </div>
            <button
              type="button"
              className="btn ghost sm"
              aria-label={t('pipeline_cal_next')}
              onClick={() => bump(1)}
              style={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}
            >
              ›
            </button>
            <button type="button" className="btn ghost sm" onClick={goToday}
              style={{ minHeight: 44, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {t('pipeline_cal_today')}
            </button>
          </div>
        </div>
      )}

      {range === 'week' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${narrow ? 20 : 24}px repeat(7, minmax(0, 1fr))`,
            gap: 2,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <div
            className="t-mono-sm"
            aria-label={t('pipeline_cal_week_col_aria')}
            style={{
              textAlign: 'center',
              fontSize: 9,
              color: 'var(--tx3)',
              padding: '4px 0',
              textTransform: 'uppercase',
            }}
          >
            {t('pipeline_cal_week_short')}
          </div>
          {weekdays.map((w) => (
            <div
              key={w}
              className="t-mono-sm"
              style={{
                textAlign: 'center',
                fontSize: 9,
                color: 'var(--tx3)',
                padding: '4px 0',
                textTransform: 'uppercase',
              }}
            >
              {w}
            </div>
          ))}
          <div
            className="t-mono-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: cellMinH,
              fontSize: 10,
              color: 'var(--tx3)',
            }}
          >
            {isoWeekNumber(new Date(`${weekCells[0].key}T12:00:00`))}
          </div>
          {weekCells.map((c) => {
            const list = byDay.get(c.key) ?? []
            const isToday = c.key === todayKey
            const isSel = c.key === selectedKey
            const showDots = list.slice(0, 4)
            const more = list.length - showDots.length
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedKey(c.key)}
                style={{
                  minHeight: cellMinH,
                  minWidth: 0,
                  padding: cellPad,
                  border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd2)'}`,
                  background: isSel ? 'var(--bg1)' : isToday ? 'var(--bg1)' : 'var(--bg0)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 4,
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontSize: narrow ? 11 : 12,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--ac)' : 'var(--tx)',
                  }}
                >
                  {c.dayNum}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
                  {showDots.map((ev) => (
                    <span
                      key={ev.id}
                      title={ev.label}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 99,
                        background: ev.kind === 'reminder' ? 'var(--ac)' : resolveTypeColor(ev.processType),
                        flexShrink: 0,
                      }}
                    />
                  ))}
                  {more > 0 && (
                    <span className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginLeft: 2 }}>
                      {t('pipeline_cal_more_fmt').replace(/\{n\}/g, String(more))}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {range === 'month' && (
        <div
          data-testid="pipeline-cal-month-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `${narrow ? 20 : 24}px repeat(7, minmax(0, 1fr))`,
            gap: 2,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <div
            className="t-mono-sm"
            aria-label={t('pipeline_cal_week_col_aria')}
            style={{
              textAlign: 'center',
              fontSize: 9,
              color: 'var(--tx3)',
              padding: '4px 0',
              textTransform: 'uppercase',
            }}
          >
            {t('pipeline_cal_week_short')}
          </div>
          {weekdays.map((w) => (
            <div
              key={w}
              className="t-mono-sm"
              style={{
                textAlign: 'center',
                fontSize: 9,
                color: 'var(--tx3)',
                padding: '4px 0',
                textTransform: 'uppercase',
              }}
            >
              {w}
            </div>
          ))}
          {(() => {
            const first = new Date(y, m0, 1)
            const lastDay = new Date(y, m0 + 1, 0).getDate()
            const lead = mondayIndexFromSundayJs(first.getDay())
            const totalCells = Math.ceil((lead + lastDay) / 7) * 7
            const rowCount = totalCells / 7
            const cells: { key: string | null; dayNum: number | null }[] = []
            for (let i = 0; i < totalCells; i++) {
              const dayNum = i - lead + 1
              if (dayNum < 1 || dayNum > lastDay) cells.push({ key: null, dayNum: null })
              else cells.push({ key: ymdKey(y, m0, dayNum), dayNum })
            }
            return Array.from({ length: rowCount }, (_, r) => {
              const rowDays = cells.slice(r * 7, r * 7 + 7)
              const wkNum = isoWeekNumber(new Date(y, m0, 1 - lead + r * 7))
              return (
                <Fragment key={`row-${r}`}>
                  <div
                    className="t-mono-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: cellMinH,
                      fontSize: 10,
                      color: 'var(--tx3)',
                    }}
                  >
                    {wkNum}
                  </div>
                  {rowDays.map((c, idx) => {
                    if (!c.key) {
                      return <div key={`e-${r}-${idx}`} style={{ minHeight: cellMinH }} />
                    }
                    const list = byDay.get(c.key) ?? []
                    const isToday = c.key === todayKey
                    const isSel = c.key === selectedKey
                    const showDots = list.slice(0, 3)
                    const more = list.length - showDots.length
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setSelectedKey(c.key)}
                        style={{
                          minHeight: cellMinH,
                          minWidth: 0,
                          padding: cellPad,
                          border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd2)'}`,
                          background: isSel ? 'var(--bg1)' : isToday ? 'var(--bg1)' : 'var(--bg0)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: 4,
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            fontSize: narrow ? 11 : 12,
                            fontWeight: isToday ? 700 : 500,
                            color: isToday ? 'var(--ac)' : 'var(--tx)',
                          }}
                        >
                          {c.dayNum}
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
                          {showDots.map((ev) => (
                            <span
                              key={ev.id}
                              title={ev.label}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 99,
                                background: ev.kind === 'reminder' ? 'var(--ac)' : resolveTypeColor(ev.processType),
                                flexShrink: 0,
                              }}
                            />
                          ))}
                          {more > 0 && (
                            <span className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginLeft: 2 }}>
                              {t('pipeline_cal_more_fmt').replace(/\{n\}/g, String(more))}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </Fragment>
              )
            })
          })()}
        </div>
      )}

      {(range === 'quarter' || range === 'semester' || range === 'year') && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: narrow
              ? '1fr'
              : range === 'year'
                ? 'repeat(4, minmax(0, 1fr))'
                : 'repeat(3, minmax(0, 1fr))',
            gap: narrow ? 14 : 16,
            width: '100%',
          }}
        >
          {(() => {
            const a = normalizePipelineCalendarAnchor(range, anchor)
            const yy = a.getFullYear()
            if (range === 'year') {
              return Array.from({ length: 12 }, (_, i) => (
                <MonthMiniGrid
                  key={`${yy}-${i}`}
                  y={yy}
                  m0={i}
                  todayKey={todayKey}
                  selectedKey={selectedKey}
                  setSelectedKey={setSelectedKey}
                  byDay={byDay}
                  localeTag={localeTag}
                  narrow={narrow}
                  resolveTypeColor={resolveTypeColor}
                  t={t}
                  compact
                  weekdayLabels={weekdays}
                  showWeekNumbers={false}
                />
              ))
            }
            const startM =
              range === 'quarter' ? Math.floor(a.getMonth() / 3) * 3 : a.getMonth() < 6 ? 0 : 6
            const count = range === 'quarter' ? 3 : 6
            return Array.from({ length: count }, (_, i) => {
              const mm = startM + i
              return (
                <MonthMiniGrid
                  key={`${yy}-${mm}`}
                  y={yy}
                  m0={mm}
                  todayKey={todayKey}
                  selectedKey={selectedKey}
                  setSelectedKey={setSelectedKey}
                  byDay={byDay}
                  localeTag={localeTag}
                  narrow={narrow}
                  resolveTypeColor={resolveTypeColor}
                  t={t}
                  compact={range === 'semester'}
                  weekdayLabels={weekdays}
                />
              )
            })
          })()}
        </div>
      )}

      <div
        style={{
          borderTop: '1px solid var(--bd)',
          paddingTop: 12,
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="t-eyebrow" style={{ marginBottom: 10 }}>
          {selectedKey
            ? new Date(`${selectedKey}T12:00:00`).toLocaleDateString(localeTag, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
            : t('pipeline_cal_pick_day')}
        </div>
        {!selectedKey && <div style={{ height: 4 }} />}
        {selectedKey && selectedEvents.length === 0 && (
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            {t('pipeline_cal_no_events_day')}
          </div>
        )}
        {selectedKey && selectedEvents.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedEvents.map((ev) => (
              <li
                key={ev.id}
                style={{
                  padding: '10px 12px',
                  border: '1px solid var(--bd2)',
                  borderLeft: `3px solid ${ev.kind === 'reminder' ? 'var(--ac)' : resolveTypeColor(ev.processType)}`,
                  background: 'var(--bg0)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--tx)', lineHeight: 1.35 }}>{ev.label}</div>
                {ev.deadlineTime && (
                  <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
                    {ev.deadlineTime}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ev.processId && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ minHeight: 44 }}
                      onClick={() => onOpenProcess(ev.processId!)}
                    >
                      {t('pipeline_cal_open_process')}
                    </button>
                  )}
                  {ev.kind === 'deadline' && ev.etapeId && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ minHeight: 44 }}
                      onClick={() => void onTickEtape(ev.etapeId!)}
                    >
                      {t('pipeline_etape_tick_title')}
                    </button>
                  )}
                  {ev.kind === 'reminder' && ev.reminderId && (
                    <button
                      type="button"
                      className="btn ghost sm"
                      style={{ minHeight: 44 }}
                      onClick={() => void onDismissReminder(ev.reminderId!)}
                    >
                      {t('pipeline_cal_dismiss_reminder')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
