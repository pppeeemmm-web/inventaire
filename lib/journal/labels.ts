/** The labels an entry can carry (Journal design 2026-11-22 §9; the database check in journal_step_b.sql holds the same list). */
export const JOURNAL_LABELS = ['process', 'materials', 'spark', 'trigger', 'reflection', 'note', 'idea', 'research'] as const
export type JournalLabel = (typeof JOURNAL_LABELS)[number]
