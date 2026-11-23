'use client'

// Overview calendar (docs/design/2026-11-23/OverviewGlance.md §3.3b): every dated thing the page already
// loads — open pipeline deadlines (◆), events = deadlines of an exposition / collaboration / edition (●),
// unread reminders (◔) — as a month. Smallest by default (mini month + the agenda that fits); « Agrandir »
// gives the month titles instead of dots. No read of its own: `overviewCalendarEvents` comes from the
// Overview bootstrap (open deadlines with no 60-day cap + unread reminders). Nothing in here scrolls.

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { EVENT_KINDS } from '@/lib/events/event-model'
import type { PipelineCalendarEvent } from '@/lib/pipeline-calendar'
import { FitList } from '@/components/atelier/overview/FitList'

export type CalKind = 'dl' | 'ev' | 'rm'
export type CalItem = {
  id: string
  kind: CalKind
  dateKey: string
  label: string
  processId: string | null
  reminderId?: string
  /** Last day of an event that runs several days (`dateKey` is its first). */
  endKey?: string
}

const EVENT_TYPES = new Set<string>(EVENT_KINDS)

export function buildCalItems(events: PipelineCalendarEvent[]): CalItem[] {
  return events.map((e) => ({
    id: e.id,
    kind: e.kind === 'reminder' ? 'rm' : EVENT_TYPES.has(e.processType) ? 'ev' : 'dl',
    dateKey: e.dateKey,
    label: e.label,
    processId: e.processId,
    reminderId: e.reminderId,
  }))
}

const pad = (n: number) => String(n).padStart(2, '0')
export const localKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dayDiff = (key: string, todayKey: string) =>
  Math.round((new Date(`${key}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime()) / 86_400_000)

/** Where an item sits in the agenda: a running multi-day event counts as today. */
export const effKey = (i: CalItem, todayKey: string) => (i.endKey && i.dateKey < todayKey && i.endKey >= todayKey ? todayKey : i.dateKey)

/** One source for the calendar's status line AND the Overview tally / phone rows (Flow review 2026-11-23). */
export type CalStatus = { late: number; today: number; next7: number; dl: number; ev: number; rm: number }
export function calStatus(items: CalItem[], todayKey: string): CalStatus {
  const c: CalStatus = { late: 0, today: 0, next7: 0, dl: 0, ev: 0, rm: 0 }
  for (const i of items) {
    c[i.kind]++ // every open item of the kind, overdue included — the Rappels card counts the same way
    if (i.kind === 'rm') continue
    const d = dayDiff(effKey(i, todayKey), todayKey)
    if (d < 0) c.late++
    else if (d === 0) c.today++
    else if (d <= 7) c.next7++
  }
  return c
}

const KIND_COLOR: Record<CalKind, string> = { dl: 'var(--ac)', ev: 'var(--sage)', rm: 'var(--yellow)' }
const KIND_GLYPH: Record<CalKind, string> = { dl: '◆', ev: '●', rm: '◔' }

function Mark({ kind, size = 8 }: { kind: CalKind; size?: number }) {
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', flex: 'none', width: size, height: size, background: KIND_COLOR[kind], borderRadius: kind === 'dl' ? 0 : '50%' }} />
  )
}

const ELLIPSIS: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

export function OverviewCalendar({
  items, big, onToggleBig, fit, onOpenItem, onReminderDone, onGoPipeline,
}: {
  items: CalItem[]
  big: boolean
  onToggleBig: () => void
  /** One-screen mode: the agenda is cut to the height left. Off when the page itself scrolls. */
  fit: boolean
  onOpenItem: (item: CalItem) => void
  onReminderDone: (reminderId: string) => void
  onGoPipeline: () => void
}) {
  const { t, lang } = useI18n()
  const fmt = (k: DictKey, vars: Record<string, string | number>) => interpolateMessage(t(k), vars)
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const todayKey = localKey(new Date())
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [filter, setFilter] = useState<Set<CalKind>>(() => new Set())
  const [sel, setSel] = useState<string | null>(null)

  const shown = useMemo(() => items.filter((i) => filter.size === 0 || filter.has(i.kind)), [items, filter])
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>()
    for (const i of shown) {
      // A multi-day event is marked on every day it covers (capped: a bad range never fills the map).
      const last = new Date(`${i.endKey ?? i.dateKey}T12:00:00`)
      const d = new Date(`${i.dateKey}T12:00:00`)
      for (let n = 0; n < 62 && d <= last; n++, d.setDate(d.getDate() + 1)) {
        const k = localKey(d)
        ;(m.get(k) ?? m.set(k, []).get(k)!).push(i)
      }
    }
    return m
  }, [shown])
  const counts = useMemo(() => calStatus(items, todayKey), [items, todayKey])
  const { late, today } = counts

  // The agenda leaves reminders out unless their chip is on: the Rappels card owns that list.
  const agendaItems = shown.filter((i) => (filter.has('rm') || i.kind !== 'rm') && (!sel || byDay.get(sel)?.includes(i)))
  const groups: { id: string; label: string; rows: CalItem[] }[] = [
    { id: 'late', label: t('cal_g_late'), rows: agendaItems.filter((i) => effKey(i, todayKey) < todayKey) },
    { id: 'today', label: t('cal_g_today'), rows: agendaItems.filter((i) => effKey(i, todayKey) === todayKey) },
    { id: 'tom', label: t('cal_g_tomorrow'), rows: agendaItems.filter((i) => dayDiff(effKey(i, todayKey), todayKey) === 1) },
    { id: 'week', label: t('cal_g_week'), rows: agendaItems.filter((i) => { const d = dayDiff(effKey(i, todayKey), todayKey); return d >= 2 && d <= 6 }) },
    { id: 'later', label: t('cal_g_later'), rows: agendaItems.filter((i) => dayDiff(effKey(i, todayKey), todayKey) >= 7) },
  ]
  const rel = (key: string) => {
    const d = dayDiff(key, todayKey)
    return d < 0 ? fmt('od_days_late', { n: -d }) : d === 0 ? t('od_today') : d === 1 ? t('od_tomorrow') : fmt('od_in_days', { n: d })
  }

  // « 27 → 30 nov. » for an event that lasts several days.
  const span = (i: CalItem) => {
    const f = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    return `${f(i.dateKey)} → ${f(i.endKey!)}`
  }
  const agendaNodes: ReactNode[] = []
  for (const g of groups) {
    if (!g.rows.length) continue
    agendaNodes.push(
      <div key={`h-${g.id}`} style={{ padding: '4px 12px', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)', background: 'var(--bg1)', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>
        {g.label}
      </div>,
    )
    for (const i of g.rows) {
      agendaNodes.push(
        <div key={i.id} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto', gap: 8, alignItems: 'center', minHeight: 28, padding: '0 12px', borderBottom: '1px solid var(--bg2)' }}>
          <Mark kind={i.kind} />
          <button type="button" onClick={() => onOpenItem(i)} style={{ ...ELLIPSIS, background: 'none', border: 0, padding: 0, font: 'inherit', color: 'var(--tx)', textAlign: 'left', cursor: 'pointer' }}>
            {i.label}
          </button>
          {i.kind === 'rm' && i.reminderId ? (
            <button type="button" onClick={() => onReminderDone(i.reminderId!)} title={t('ov_reminder_done')} aria-label={t('ov_reminder_done')} style={{ background: 'none', border: 0, borderLeft: '1px solid var(--bd)', paddingLeft: 8, color: 'var(--tx3)', cursor: 'pointer', font: 'inherit' }}>✓</button>
          ) : (
            <span style={{ fontSize: 11, color: effKey(i, todayKey) < todayKey ? 'var(--rust)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>{i.endKey ? span(i) : rel(i.dateKey)}</span>
          )}
        </div>,
      )
    }
  }

  // Month grid: Monday first, six rows.
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const dow = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i) // a Monday
    return d.toLocaleDateString(locale, { weekday: 'narrow' })
  })
  const toggleKind = (k: CalKind | null) =>
    setFilter((f) => {
      if (k == null) return new Set()
      const n = new Set(f)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const chip = (k: CalKind | null, label: string) => {
    const on = k == null ? filter.size === 0 : filter.has(k)
    return (
      <button key={k ?? 'all'} type="button" aria-pressed={on} onClick={() => toggleKind(k)}
        style={{ border: '1px solid var(--bd2)', borderRadius: 10, padding: '1px 8px', fontSize: 11, font: 'inherit', cursor: 'pointer', color: on ? 'var(--bg0)' : 'var(--tx2)', background: on ? 'var(--tx)' : 'transparent' }}>
        {label}
      </button>
    )
  }

  return (
    <section data-testid="overview-calendar" style={{ display: 'flex', flexDirection: 'column', flex: fit ? '1 1 0' : 'none', minHeight: 0, minWidth: 0 }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 8px 0 12px', background: 'var(--bg1)', borderBottom: '1px solid var(--bd)', borderTop: '1px solid var(--bd)' }}>
        <h2 style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)' }}>{t('cal_title')}</h2>
        <button type="button" aria-label={t('cal_prev')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={NAV}>‹</button>
        <span style={{ fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{month.toLocaleDateString(locale, big ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' })}</span>
        <button type="button" aria-label={t('cal_next')} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={NAV}>›</button>
        <span style={{ flex: 1 }} />
        <button type="button" data-testid="overview-calendar-expand" aria-pressed={big} onClick={onToggleBig} style={{ ...NAV, border: '1px solid var(--bd2)', borderRadius: 9, padding: '0 7px', fontSize: 11 }}>
          {big ? `⤡ ${t('cal_reduce')}` : `⤢ ${t('cal_expand')}`}
        </button>
      </div>
      <div style={{ flex: 'none', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, padding: '5px 12px', borderBottom: '1px solid var(--bd)' }}>
        {chip(null, t('cal_all'))}
        {chip('dl', `◆ ${t('cal_chip_dl')} ${counts.dl}`)}
        {chip('ev', `● ${t('cal_chip_ev')} ${counts.ev}`)}
        {chip('rm', `◔ ${t('cal_chip_rm')} ${counts.rm}`)}
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '2px 12px', borderBottom: '1px solid var(--bd)', fontSize: 11 }}>
        <span data-testid="overview-calendar-status" style={{ color: late ? 'var(--rust)' : today ? 'var(--yellow)' : 'var(--tx3)' }}>{fmt('cal_status', { late, today })}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onGoPipeline} style={{ ...NAV, fontSize: 11 }}>{t('cal_pipeline')}</button>
      </div>
      <div style={{ flex: big && fit ? '1 1 0' : 'none', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: big ? (fit ? 'minmax(0, 1fr)' : 'minmax(78px, auto)') : '28px', gridTemplateRows: big && fit ? 'auto repeat(6, minmax(0, 1fr))' : 'auto', borderBottom: '1px solid var(--bd)' }}>
        {dow.map((d, i) => (
          <div key={i} style={{ fontSize: 10, color: 'var(--tx3)', textAlign: 'center', padding: '3px 0' }}>{d}</div>
        ))}
        {cells.map((d) => {
          const key = localKey(d)
          const its = byDay.get(key) ?? []
          const inMonth = d.getMonth() === month.getMonth()
          const isToday = key === todayKey
          const isSel = sel === key
          return (
            <button key={key} type="button" aria-pressed={isSel} aria-label={`${d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}${its.length ? ` · ${its.length}` : ''}`}
              onClick={() => setSel(isSel ? null : key)}
              style={{ position: 'relative', minHeight: 0, minWidth: 0, overflow: 'hidden', textAlign: 'left', padding: big ? '3px 5px' : '2px 4px', border: 0, borderTop: '1px solid var(--bg2)', background: 'none', font: 'inherit', fontSize: 11, color: inMonth ? 'var(--tx2)' : 'var(--tx3)', opacity: inMonth ? 1 : 0.55, cursor: 'pointer', boxShadow: isSel ? 'inset 0 0 0 1px var(--ac)' : undefined }}>
              <span style={isToday ? { background: 'var(--ac)', color: 'var(--bg0)', borderRadius: 9, padding: '0 4px' } : undefined}>{d.getDate()}</span>
              {big ? (
                <span style={{ display: 'block', marginTop: 1 }}>
                  {its.slice(0, 3).map((i) => (
                    <span key={i.id} style={{ ...ELLIPSIS, display: 'block', fontSize: 10, lineHeight: 1.25, color: KIND_COLOR[i.kind] }} title={i.label}>{i.dateKey !== key ? '▸' : KIND_GLYPH[i.kind]} {i.label}</span>
                  ))}
                  {its.length > 3 ? <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{fmt('od_more', { n: its.length - 3 })}</span> : null}
                </span>
              ) : its.length ? (
                <span style={{ position: 'absolute', left: 4, right: 4, bottom: 3, display: 'flex', gap: 2 }}>
                  {its.slice(0, 4).map((i) => <Mark key={i.id} kind={i.kind} size={5} />)}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {big ? null : (
        <FitList
          testId="overview-agenda"
          enabled={fit}
          style={{ flex: fit ? '1 1 0' : 'none' }}
          items={agendaNodes.length ? agendaNodes : [<div key="none" style={{ padding: '10px 12px', color: 'var(--tx3)', fontSize: 12 }}>{sel ? t('cal_nothing_day') : t('od_no_deadline')}</div>]}
        />
      )}
    </section>
  )
}

const NAV: CSSProperties = { background: 'none', border: 0, padding: '0 4px', color: 'var(--tx2)', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }
