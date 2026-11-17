/**
 * Old work notes moved into note lines (scripts/old-notes-to-lines.mjs, R1 step 7, 2026-11-17) that had
 * no date anywhere carry this created_at. The app shows « avant mai 2026 » instead of a date (they are
 * older than the version history, which starts 2026-05-12). Same value as in the script.
 */
export const OLD_NOTE_UNDATED_AT = '2026-05-01T00:00:00.000Z'

const UNDATED_MS = Date.parse(OLD_NOTE_UNDATED_AT)

export function isUndatedOldNote(iso: string): boolean {
  return Date.parse(iso) === UNDATED_MS
}
