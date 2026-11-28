/** The labels an entry can carry (Journal design 2026-11-22 §9; the database check — journal_step_b.sql, then
 * laboratoire_essai_label.sql — holds the same list). « essai » = a Laboratoire trial (Laboratoire.md). */
export const JOURNAL_LABELS = ['process', 'materials', 'spark', 'trigger', 'reflection', 'note', 'idea', 'research', 'essai'] as const
export type JournalLabel = (typeof JOURNAL_LABELS)[number]
