/**
 * Theme notes (TODO 23, Pem 2026-11-18): free text about a theme, so its name can stay short.
 * Column `theme.notes` comes from `supabase/sql/theme_notes.sql` (NOT applied yet).
 * Until the lead applies it (flag false): the Thèmes screen shows no notes panel, reads and writes nothing.
 * Flip to true once the SQL is live, then `npm run gen:types` (and drop the cast in theme-notes-actions.ts).
 */
export const THEME_NOTES_SQL_LIVE = false

/** Long enough for a definition or a working paragraph; not a document. */
export const THEME_NOTES_MAX = 4000
