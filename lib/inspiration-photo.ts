/**
 * Inspiration photo (R1 / R2): a photo taken on the phone that joins the day's Journal entries and can be
 * linked to a work and / or an idée. Table `inspiration_photo` comes from `supabase/sql/inspiration_photo.sql`.
 * Until the lead applies it (flag false): the Photo · doc sheet hides « Inspiration », the capture screen
 * says it is waiting and saves nothing, and the Journal reads no photos. Flip to true once the SQL is live,
 * then `npm run gen:types`. SQL applied live 2026-11-18 (flag on).
 */
export const INSPIRATION_SQL_LIVE = true

/** One inspiration photo as the Journal day shows it. */
export type InspirationPhoto = {
  id: string
  created_at: string
  day: string
  image_key: string
  caption: string | null
  oeuvre_id: number | null
  concept_id: string | null
  conceptTitle: string | null
  author: string
  /** Journal Step B part 2 (journal_step_b2.sql): the photo's text is a Journal entry — its id and links. */
  entryId?: number | null
  hidden?: boolean
  /** The photo's own data (taken_at, model, lens…); the place is never here (admin-only table). */
  meta?: Record<string, unknown> | null
  works?: Array<{ id: number; title: string | null; thumb?: string | null }>
  concepts?: Array<{ id: string; title: string | null }>
  people?: Array<{ id: number; name: string }>
}

/** Long side of the stored AVIF (like a session shot / constat photo). */
export const INSPIRATION_MAX_EDGE = 2100
