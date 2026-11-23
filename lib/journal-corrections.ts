/**
 * Journal corrections (« Corriger »): the Journal is append-only, so a correction is a new entry with
 * `corrects_id` = the original. Every reader shows the latest correction in place of the original and
 * never lists the correction on its own (writer: `correctJournalEntry`).
 */

/** Original entry id → body of its latest visible correction. */
export function latestCorrections(
  rows: ReadonlyArray<{ corrects_id: number | null; body: string; created_at: string; hidden_at: string | null }>,
): Map<number, string> {
  const out = new Map<number, string>()
  const sorted = rows
    .filter((r) => r.corrects_id != null && !r.hidden_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const r of sorted) out.set(Number(r.corrects_id), r.body)
  return out
}

/**
 * Original entry id → its latest visible correction row (same rule as `latestCorrections`). A correction may
 * be a person's (typed, verified) or a machine's (the PC transcript of a voice note: unverified, engine named);
 * readers that show « vérifié » or offer « Le texte est juste » use this row, not the original's.
 */
export function latestCorrectionRows<R extends { id: number; corrects_id: number | null; body: string; created_at: string; hidden_at: string | null; verification?: string | null; engine?: string | null }>(
  rows: ReadonlyArray<R>,
): Map<number, R> {
  const out = new Map<number, R>()
  const sorted = rows.filter((r) => r.corrects_id != null && !r.hidden_at).sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const r of sorted) out.set(Number(r.corrects_id), r)
  return out
}
