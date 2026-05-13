/**
 * Normalized calendar events for Pipeline + Overview (deadlines + reminders).
 * Browser push notifications are out of scope (requires service worker + VAPID + backend).
 */

import {
  computePipelineCalendarDeadlineItems,
  type PipelinePulseItem,
  type PulseProcess,
} from '@/lib/pipeline-deadlines'

export type PipelineCalendarEventKind = 'deadline' | 'reminder'

export type PipelineCalendarEvent = {
  id: string
  kind: PipelineCalendarEventKind
  /** Local calendar day YYYY-MM-DD (browser timezone). */
  dateKey: string
  sortMs: number
  label: string
  processType: string
  processId: string | null
  etapeId?: string
  reminderId?: string
  deadlineTime: string | null
}

/** ISO date or datetime → local calendar YYYY-MM-DD. */
export function toLocalDateKey(isoOrYmd: string): string {
  const d = new Date(isoOrYmd)
  if (Number.isNaN(d.getTime())) return isoOrYmd.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function pulseItemToDeadlineEvent(item: PipelinePulseItem): PipelineCalendarEvent {
  const dateKey = toLocalDateKey(item.date)
  const base = new Date(`${dateKey}T12:00:00`).getTime()
  const id = `d:${item.processId}:${item.etapeId ?? 'fin'}:${dateKey}`
  return {
    id,
    kind: 'deadline',
    dateKey,
    sortMs: base,
    label: item.label,
    processType: item.type,
    processId: item.processId,
    etapeId: item.etapeId,
    deadlineTime: item.deadline_time,
  }
}

export type ReminderInput = {
  id: string
  message: string
  remind_at: string
  process_id: string | null
  lu?: boolean
}

/**
 * Merge open pipeline deadlines (same rules as pulse, no 60-day cap) with reminders.
 * If `allowedProcessIds` is set, drop deadlines for other processes and reminders tied to excluded processes.
 */
export function buildPipelineCalendarEvents(
  processes: PulseProcess[],
  reminders: ReminderInput[],
  opts?: { allowedProcessIds?: Set<string> | null },
): PipelineCalendarEvent[] {
  const allowed = opts?.allowedProcessIds
  const procs =
    allowed !== undefined && allowed !== null
      ? processes.filter((p) => allowed.has(p.id))
      : processes

  const deadlines = computePipelineCalendarDeadlineItems(procs).map(pulseItemToDeadlineEvent)

  const remEvents: PipelineCalendarEvent[] = []
  for (const r of reminders) {
    if (r.lu) continue
    if (allowed !== undefined && allowed !== null && r.process_id && !allowed.has(r.process_id)) continue
    const dateKey = toLocalDateKey(r.remind_at)
    const sortMs = new Date(r.remind_at).getTime()
    remEvents.push({
      id: `r:${r.id}`,
      kind: 'reminder',
      dateKey,
      sortMs,
      label: r.message,
      processType: 'reminder',
      processId: r.process_id,
      reminderId: r.id,
      deadlineTime: null,
    })
  }

  return [...deadlines, ...remEvents].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
    return a.sortMs - b.sortMs || a.label.localeCompare(b.label)
  })
}

export function groupPipelineCalendarEventsByDateKey(
  events: PipelineCalendarEvent[],
): Map<string, PipelineCalendarEvent[]> {
  const m = new Map<string, PipelineCalendarEvent[]>()
  for (const e of events) {
    const arr = m.get(e.dateKey)
    if (arr) arr.push(e)
    else m.set(e.dateKey, [e])
  }
  return m
}

/** Inclusive range [startKey, endKey] on YYYY-MM-DD strings (valid for same timezone month/week UI). */
export function filterEventsInDateKeyRange(
  events: PipelineCalendarEvent[],
  startKey: string,
  endKey: string,
): PipelineCalendarEvent[] {
  return events.filter((e) => e.dateKey >= startKey && e.dateKey <= endKey)
}

export type PipelineCalendarRange = 'week' | 'month' | 'quarter' | 'semester' | 'year'

/** Local calendar midnight, Jan 1 of the same calendar year. */
export function startOfYearLocal(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0)
}

/** Local calendar midnight, Monday = first day of ISO week. */
export function startOfWeekMondayLocal(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const monOffset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - monOffset)
  x.setHours(0, 0, 0, 0)
  return x
}

/** ISO-8601 week number (1-53), Monday-based, Thursday-of-week trick. */
export function isoWeekNumber(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // Shift to Thursday of the same ISO week so the year boundary is unambiguous.
  const dayMon0 = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dayMon0 + 3)
  const yearStart = new Date(x.getFullYear(), 0, 1)
  return Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function startOfMonthLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export function startOfQuarterLocal(d: Date): Date {
  const q0 = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), q0, 1, 0, 0, 0, 0)
}

export function startOfSemesterLocal(d: Date): Date {
  const m0 = d.getMonth() < 6 ? 0 : 6
  return new Date(d.getFullYear(), m0, 1, 0, 0, 0, 0)
}

export function normalizePipelineCalendarAnchor(range: PipelineCalendarRange, d: Date): Date {
  switch (range) {
    case 'week':
      return startOfWeekMondayLocal(d)
    case 'month':
      return startOfMonthLocal(d)
    case 'quarter':
      return startOfQuarterLocal(d)
    case 'semester':
      return startOfSemesterLocal(d)
    case 'year':
      return startOfYearLocal(d)
    default:
      return startOfMonthLocal(d)
  }
}

/** Add calendar years (local midnight on same month/day clamped). */
export function addCalendarYearsLocal(d: Date, delta: number): Date {
  return new Date(d.getFullYear() + delta, d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

/** Add calendar months (local), returns new Date. */
export function addCalendarMonthsLocal(d: Date, delta: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + delta, d.getDate(), 0, 0, 0, 0)
  return x
}

/** Add days (local midnight preserved on start-of-day). */
export function addCalendarDaysLocal(d: Date, delta: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta, 0, 0, 0, 0)
  return x
}
