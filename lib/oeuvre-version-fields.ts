/**
 * Fields shown when two `oeuvre_versions` snapshots are compared (session journal compare,
 * drawer version history, journal day "field changes"). Keys = real `Oeuvres` column names —
 * the snapshot is `to_jsonb(OLD)`. One list so the views cannot drift apart again
 * (6 wrong names until 2026-11-12, docs/archive/AUDIT_2026-11.md). Browser-safe.
 */
import type { DictKey } from '@/lib/i18n/dictionary'

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
  'anonymity_level',
] as const

export type OeuvreVersionField = (typeof OEUVRE_VERSION_FIELDS)[number]

/** Readable label of each field (FR / EN in lib/i18n/messages/version-fields.messages.ts), never the column name. */
const LABEL_KEYS = {
  Titre: 'vf_title',
  Année: 'vf_year',
  Technique: 'vf_technique',
  Support: 'vf_support',
  Format: 'vf_format',
  Hauteur: 'vf_height',
  Largeur: 'vf_width',
  Profondeur: 'vf_depth',
  Prix: 'vf_price',
  PrixFinal: 'vf_final_price',
  statusId: 'vf_status',
  ContactID: 'vf_contact',
  Commentaires: 'vf_comments',
  Historique: 'vf_history',
  LocalisationID: 'vf_location',
  LocalisationDetail: 'vf_location_detail',
  tva_rate: 'vf_vat_rate',
  Catalogué: 'vf_catalogued',
  NeedsPhotograph: 'vf_needs_photo',
  IsCommission: 'vf_commission',
  is_paid: 'vf_paid',
  anonymity_level: 'vf_anonymity',
} as const satisfies Record<OeuvreVersionField, DictKey>

/** `t` passed in so this stays usable on both sides; an unknown column falls back to its own name. */
export function versionFieldLabel(field: string, t: (key: DictKey) => string): string {
  const key = (LABEL_KEYS as Record<string, DictKey>)[field]
  return key ? t(key) : field
}

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
