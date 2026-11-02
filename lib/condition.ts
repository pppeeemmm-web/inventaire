/** Constats (condition reports, owner 2026-11-02). Browser-safe; actions in `app/atelier/works/condition-actions.ts`. */
import type { DictKey } from '@/lib/i18n/dictionary'

export const CONDITION_GRADES = ['excellent', 'good', 'fair', 'poor', 'critical'] as const
export type ConditionGrade = (typeof CONDITION_GRADES)[number]

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
  issues: ConditionIssue[]
}

export function parseGrade(raw: unknown): ConditionGrade | null {
  return typeof raw === 'string' && (CONDITION_GRADES as readonly string[]).includes(raw) ? (raw as ConditionGrade) : null
}

export function parseActionStatus(raw: unknown): ActionStatus | null {
  return typeof raw === 'string' && (ACTION_STATUSES as readonly string[]).includes(raw) ? (raw as ActionStatus) : null
}
