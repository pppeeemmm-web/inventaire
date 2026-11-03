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
  'localisation_address_id',
  'acheteur_id',
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

/** Payload keys for `image_add` rows — a queued addWorkImage() upload, not a scalar-field edit. */
export const PENDING_IMAGE_ADD_KEYS = [
  'filename',
  'capture_meta',
  'sha256',
  'source',
] as const

/** Stored on pending create rows; handled in approvePendingChange, not replayed to saveWork. */
export const PENDING_INTERNAL_KEYS = [
  '__share_inbox_id',
  '__share_file_index',
  /** Set on insert when DB has no change_kind column yet (pre-migration). */
  '__pending_change_kind',
] as const

/** Union of all keys that may appear in pending_changes.payload */
export const ALLOWED_PENDING_SAVE_KEYS = new Set<string>([
  ...PENDING_SCALAR_FORM_KEYS,
  ...PENDING_CHECKBOX_KEYS,
  ...PENDING_MULTI_APPEND_KEYS,
  ...PENDING_INTERNAL_KEYS,
])

/** Union of keys allowed in an `image_add` row's payload. Kept separate from ALLOWED_PENDING_SAVE_KEYS. */
export const ALLOWED_PENDING_IMAGE_ADD_KEYS = new Set<string>([
  ...PENDING_IMAGE_ADD_KEYS,
  ...PENDING_INTERNAL_KEYS,
])

export type PendingChangeKind = 'edit' | 'create' | 'image_add'

/** Resolve queue row kind (column or legacy payload fallback). */
export function resolvePendingChangeKind(row: {
  change_kind?: string | null
  oeuvre_id?: number | null
  payload: Record<string, string>
}): PendingChangeKind {
  if (row.change_kind === 'create' || row.change_kind === 'edit' || row.change_kind === 'image_add') {
    return row.change_kind
  }
  const fromPayload = row.payload.__pending_change_kind
  if (fromPayload === 'create' || fromPayload === 'edit' || fromPayload === 'image_add') return fromPayload
  if (row.oeuvre_id == null && !(row.payload.oeuvre_id ?? '').trim()) return 'create'
  return 'edit'
}

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

/** Strip unknown keys before replay (tampered queue rows). Not for `image_add` rows. */
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

/** Strip unknown keys from an `image_add` row's payload before commitWorkImage(). */
export function filterPendingImageAddPayload(
  payload: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(payload)) {
    if (!ALLOWED_PENDING_IMAGE_ADD_KEYS.has(k)) continue
    if (typeof v === 'string') out[k] = v
  }
  return out
}

/** Rebuild FormData for saveWork() — restores multi-value themes/groups. */
export function formDataFromPendingPayload(payload: Record<string, string>): FormData {
  const fd = new FormData()
  const themesJoined = payload.themes
  const groupsJoined = payload.groups
  const internal = new Set<string>(PENDING_INTERNAL_KEYS)

  for (const [k, v] of Object.entries(payload)) {
    if (k === 'themes' || k === 'groups' || internal.has(k)) continue
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

/**
 * Form key → `Oeuvres` column written by saveWork(). Edit rows store `baseline` as the raw
 * DB row (plus `themes`/`groups`), while `payload` holds form keys — diff through this map.
 * Keep in sync with saveWork()'s update payload in app/atelier/works/actions.ts.
 */
export const PENDING_FORM_KEY_TO_COLUMN: Record<string, string> = {
  titre: 'Titre',
  annee: 'Année',
  technique: 'Technique',
  support: 'Support',
  format: 'Format',
  hauteur: 'Hauteur',
  largeur: 'Largeur',
  profondeur: 'Profondeur',
  prix: 'Prix',
  discount: 'Discount',
  prix_final: 'PrixFinal',
  status_id: 'statusId',
  contact_id: 'ContactID',
  commentaires: 'Commentaires',
  historique: 'Historique',
  localisation_id: 'LocalisationID',
  localisation_detail: 'LocalisationDetail',
  localisation_address_id: 'localisation_address_id',
  acheteur_id: 'AcheteurID',
  tva_rate: 'tva_rate',
  broadcast_caption_seed: 'broadcast_caption_seed',
  date_livraison: 'DateLivraison',
  anonymity_level: 'anonymity_level',
  presentation_id: 'PresentationID',
  exposable: 'Exposable',
  broadcast_ready: 'broadcast_ready',
  montee: 'Montee',
  encadree: 'Encadree',
  catalogued: 'Catalogué',
  is_commission: 'IsCommission',
  needs_photograph: 'NeedsPhotograph',
  admin_override_anonymity: 'admin_override_anonymity',
  is_paid: 'is_paid',
  is_gift: 'is_gift',
  themes: 'themes',
  groups: 'groups',
}

/** Form keys holding a numeric value or id (saveWork parses them with numOrNull). */
export const PENDING_NUMERIC_KEYS = new Set<string>([
  'technique', 'support', 'format', 'prix', 'discount', 'prix_final', 'status_id', 'contact_id',
  'localisation_id', 'localisation_address_id', 'acheteur_id', 'tva_rate', 'anonymity_level', 'presentation_id',
])

/** Form keys that are references, resolved to labels for review. */
export const PENDING_REF_KEYS = [
  'status_id', 'technique', 'support', 'format', 'contact_id', 'localisation_id',
  'localisation_address_id', 'acheteur_id', 'presentation_id',
] as const

/** Never shown in the review diff: routing, image bookkeeping, internal flags. */
const PENDING_DIFF_SKIP_KEYS = new Set<string>(['oeuvre_id', 'image_existing', ...PENDING_INTERNAL_KEYS])

const CHECKBOX_KEY_SET = new Set<string>(PENDING_CHECKBOX_KEYS)

export type PendingDiffEntry = { key: string; before: string | null; after: string | null }

/** Normalise a form value the way saveWork() would store it; `null` = empty. */
function normalisePendingFormValue(key: string, raw: string | undefined): string | null {
  if (CHECKBOX_KEY_SET.has(key)) return raw === '1' ? '1' : '0'
  const v = (raw ?? '').trim()
  if (key === 'anonymity_level') return String(v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v))
  if (!v) return null
  if (PENDING_NUMERIC_KEYS.has(key)) return Number.isFinite(Number(v)) ? String(Number(v)) : null
  if (key === 'annee') {
    if (/^\d{4}$/.test(v)) return `${v}-01-01`
    if (/^\d{4}-\d{2}$/.test(v)) return `${v}-01`
  }
  if (key === 'themes' || key === 'groups') {
    const parts = v.split(',').map((s) => s.trim()).filter(Boolean).sort()
    return parts.length ? parts.join(',') : null
  }
  return v
}

/** Normalise a baseline DB value into the same space as normalisePendingFormValue(). */
function normalisePendingBaselineValue(key: string, raw: unknown): string | null {
  if (CHECKBOX_KEY_SET.has(key)) return raw === true ? '1' : '0'
  if (raw == null) return key === 'anonymity_level' ? '0' : null
  return normalisePendingFormValue(key, String(raw))
}

/**
 * Review diff for a queued work change: only fields whose stored value would change.
 * `baseline` null (create) → every non-empty field, with `before` null.
 */
export function diffPendingPayload(
  baseline: Record<string, unknown> | null,
  payload: Record<string, string>,
): PendingDiffEntry[] {
  const out: PendingDiffEntry[] = []
  for (const [key, raw] of Object.entries(payload)) {
    if (key.startsWith('__') || PENDING_DIFF_SKIP_KEYS.has(key)) continue
    const after = normalisePendingFormValue(key, raw)
    if (!baseline) {
      if (after != null && !(CHECKBOX_KEY_SET.has(key) && after === '0')) out.push({ key, before: null, after })
      continue
    }
    const column = PENDING_FORM_KEY_TO_COLUMN[key]
    // No column (e.g. historique_append, create-only flags): show only when it carries a value.
    if (!column) {
      if (after != null && after !== '0') out.push({ key, before: null, after })
      continue
    }
    const before = normalisePendingBaselineValue(key, baseline[column])
    if (before !== after) out.push({ key, before, after })
  }
  return out
}
