/** Constats (condition reports, owner 2026-11-02). Browser-safe; actions in `app/atelier/works/condition-actions.ts`. */
import type { DictKey } from '@/lib/i18n/dictionary'
import type { DatePrecision } from '@/lib/partial-date'

export const CONDITION_GRADES = ['excellent', 'good', 'fair', 'poor', 'critical'] as const
export type ConditionGrade = (typeof CONDITION_GRADES)[number]

/** 'destroyed' / 'lost' constats take the work out of circulation (owner 2026-11-03, admin only;
 * DB triggers in supabase/sql/condition_report_fate.sql set the work's status and `fate`). */
export const REPORT_KINDS = ['examination', 'destroyed', 'lost'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export const REPORT_KIND_KEY: Record<ReportKind, DictKey> = {
  examination: 'cond_kind_examination',
  destroyed: 'cond_kind_destroyed',
  lost: 'cond_kind_lost',
}

export function parseReportKind(raw: unknown): ReportKind | null {
  return typeof raw === 'string' && (REPORT_KINDS as readonly string[]).includes(raw) ? (raw as ReportKind) : null
}

export const ACTION_STATUSES = ['none', 'todo', 'done'] as const
export type ActionStatus = (typeof ACTION_STATUSES)[number]

export const GRADE_KEY: Record<ConditionGrade, DictKey> = {
  excellent: 'cond_grade_excellent',
  good: 'cond_grade_good',
  fair: 'cond_grade_fair',
  poor: 'cond_grade_poor',
  critical: 'cond_grade_critical',
}

/** Grade colour: green → rust as the state worsens. */
export const GRADE_COLOR: Record<ConditionGrade, string> = {
  excellent: 'var(--sage)',
  good: 'var(--sage)',
  fair: 'var(--ac)',
  poor: 'var(--rust)',
  critical: 'var(--rust)',
}

export const ACTION_STATUS_KEY: Record<ActionStatus, DictKey> = {
  none: 'cond_action_none',
  todo: 'cond_action_todo',
  done: 'cond_action_done',
}

export type ConditionIssue = {
  id: number
  report_id: number
  created_at: string
  author_id: string | null
  description: string
  location: string | null
  photo_key: string | null
}

export type ConditionReport = {
  id: number
  oeuvre_id: number
  created_at: string
  updated_at: string
  author_id: string | null
  examined_on: string
  examiner: string | null
  grade: ConditionGrade | null
  notes: string | null
  action: string | null
  action_status: ActionStatus
  kind: ReportKind
  /** Date of the destruction / loss (≠ report date); null = the report date. */
  event_on: string | null
  event_precision: DatePrecision | null
  /** Lost work found again. */
  resolved_on: string | null
  issues: ConditionIssue[]
}

/** What a constat write changed on the work (triggers) — patched into the Atelier list row. */
export type ConditionWorkPatch = {
  statusId: number | null
  fate: 'destroyed' | 'lost' | null
  fate_on: string | null
  fate_precision: DatePrecision | null
  is_public: boolean | null
}

export function parseGrade(raw: unknown): ConditionGrade | null {
  return typeof raw === 'string' && (CONDITION_GRADES as readonly string[]).includes(raw) ? (raw as ConditionGrade) : null
}

export function parseActionStatus(raw: unknown): ActionStatus | null {
  return typeof raw === 'string' && (ACTION_STATUSES as readonly string[]).includes(raw) ? (raw as ActionStatus) : null
}
