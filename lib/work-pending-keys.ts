/**
 * Allow-listed FormData keys for pending_changes queue + admin replay.
 * Must stay in sync with saveWork() in app/atelier/works/actions.ts.
 */

export const PENDING_SCALAR_FORM_KEYS = [
  'oeuvre_id',
  'titre',
  'annee',
  'technique',
  'support',
  'format',
  'hauteur',
  'largeur',
  'profondeur',
  'prix',
  'discount',
  'prix_final',
  'status_id',
  'contact_id',
  'commentaires',
  'historique',
  'localisation_id',
  'localisation_detail',
  'tva_rate',
  'broadcast_caption_seed',
  'date_livraison',
  'anonymity_level',
  'presentation_id',
  'image_existing',
  'historique_append',
] as const

/** Checkbox-style fields (typically '' or '1'). */
export const PENDING_CHECKBOX_KEYS = [
  'exposable',
  'broadcast_ready',
  'montee',
  'encadree',
  'catalogued',
  'is_commission',
  'needs_photograph',
  'admin_override_anonymity',
  'is_paid',
  'is_gift',
  'payment_received',
  'is_anonymous',
] as const

export const PENDING_MULTI_APPEND_KEYS = ['themes', 'groups'] as const

/** Union of all keys that may appear in pending_changes.payload */
export const ALLOWED_PENDING_SAVE_KEYS = new Set<string>([
  ...PENDING_SCALAR_FORM_KEYS,
  ...PENDING_CHECKBOX_KEYS,
  ...PENDING_MULTI_APPEND_KEYS,
])

/** Build a JSON-safe payload from the editor form (no File blobs, no arbitrary keys). */
export function pendingPayloadFromFormData(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of PENDING_SCALAR_FORM_KEYS) {
    const v = formData.get(key)
    if (typeof v === 'string') out[key] = v
  }
  for (const key of PENDING_CHECKBOX_KEYS) {
    const v = formData.get(key)
    if (typeof v === 'string') out[key] = v
  }
  const themes = formData
    .getAll('themes')
    .filter((x): x is string => typeof x === 'string')
  if (themes.length) out.themes = themes.join(',')

  const groups = formData
    .getAll('groups')
    .filter((x): x is string => typeof x === 'string')
  if (groups.length) out.groups = groups.join(',')

  return out
}

/** Strip unknown keys before replay (tampered queue rows). */
export function filterPendingPayloadForReplay(
  payload: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (!ALLOWED_PENDING_SAVE_KEYS.has(k)) continue
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/** Rebuild FormData for saveWork() — restores multi-value themes/groups. */
export function formDataFromPendingPayload(payload: Record<string, string>): FormData {
  const fd = new FormData()
  const themesJoined = payload.themes
  const groupsJoined = payload.groups

  for (const [k, v] of Object.entries(payload)) {
    if (k === 'themes' || k === 'groups') continue
    fd.append(k, v)
  }

  if ('themes' in payload) {
    for (const t of (themesJoined ?? '').split(',')) {
      const s = t.trim()
      if (s) fd.append('themes', s)
    }
  }
  if ('groups' in payload) {
    for (const g of (groupsJoined ?? '').split(',')) {
      const s = g.trim()
      if (s) fd.append('groups', s)
    }
  }

  return fd
}
