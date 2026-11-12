/**
 * Fields shown when two `oeuvre_versions` snapshots are compared (session journal compare,
 * drawer version history, journal day "field changes"). Keys = real `Oeuvres` column names —
 * the snapshot is `to_jsonb(OLD)`. One list so the three views cannot drift apart again
 * (6 wrong names until 2026-11-12, docs/AUDIT_2026-11.md). Browser-safe.
 */
export const OEUVRE_VERSION_FIELDS = [
  'Titre',
  'Année',
  'Technique',
  'Support',
  'Format',
  'Hauteur',
  'Largeur',
  'Profondeur',
  'Prix',
  'PrixFinal',
  'statusId',
  'ContactID',
  'Commentaires',
  'Historique',
  'LocalisationID',
  'LocalisationDetail',
  'tva_rate',
  'Catalogué',
  'NeedsPhotograph',
  'IsCommission',
  'is_paid',
  'is_gift',
  'anonymity_level',
] as const

/** Fields that differ between two snapshots (string compare, null = empty). */
export function changedVersionFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ field: string; before: unknown; after: unknown }> {
  if (!before && !after) return []
  return OEUVRE_VERSION_FIELDS.flatMap((field) => {
    const a = before?.[field] ?? null
    const b = after?.[field] ?? null
    return String(a ?? '') === String(b ?? '') ? [] : [{ field, before: a, after: b }]
  })
}
