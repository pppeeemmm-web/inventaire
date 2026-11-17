export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL?.trim() || 'nomic-embed-text'
export const EMBEDDING_VECTOR_SIZE = 768
export const BATCH_SIZE = 32
export const STUCK_EMBEDDING_MINUTES = 10
export const MAX_EMBEDDING_ATTEMPTS = 5

/**
 * Journal ✦ link suggestions (`journal_propose_links`, supabase/sql/journal_link_threshold.sql).
 * Quieter rule (R1 step 7, 2026-11-17): only the closest work and the closest concept per entry,
 * at least 0.60 cosine and 0.05 above that target's average closeness to all entries.
 * Measured on Pem's 35 decisions (17 yes, 18 no): keeps 8 of 16 scorable yes, 4 of 16 scorable no
 * (the 3 / 0.03 rule kept 15 and 16). Override per PC with JOURNAL_LINK_K / _MIN / _MARGIN.
 */
function numEnv(name, fallback) {
  const n = Number(process.env[name])
  return process.env[name]?.trim() && Number.isFinite(n) ? n : fallback
}
export const JOURNAL_LINK_K = numEnv('JOURNAL_LINK_K', 1)
export const JOURNAL_LINK_MIN = numEnv('JOURNAL_LINK_MIN', 0.6)
export const JOURNAL_LINK_MARGIN = numEnv('JOURNAL_LINK_MARGIN', 0.05)
