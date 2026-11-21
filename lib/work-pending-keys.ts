/**
 * Allow-listed FormData keys for pending_changes queue + admin replay.
 * Must stay in sync with saveWork() in app/atelier/works/actions.ts.
 */

import { sameHistorique } from './historique-merge'

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
  /** The Historique text the editor loaded — saveWork keeps lines the database wrote since. */
  'historique_base',
  'localisation_id',
  'localisation_detail',
  'localisation_address_id',
  'acheteur_id',
  'tva_rate',
  'broadcast_caption_seed',
  'date_livraison',
  'return_date',
  'anonymity_level',
  'presentation_id',
  'image_existing',
  'historique_append',
  'production_origin',
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
  return_date: 'ReturnDate',
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
const PENDING_DIFF_SKIP_KEYS = new Set<string>(['oeuvre_id', 'image_existing', 'historique_base', ...PENDING_INTERNAL_KEYS])

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

// ── Approve an edit: only what the proposal changed ─────────────────────────────────────────
// Replaying the whole saved form put back the old value of every field the proposer did not touch
// when the work had changed since (TODO §0, 2026-11-18). An approval now writes only the proposed
// fields, on top of the work as it stands, and stops on a field someone else changed meanwhile.

/**
 * Fields that only make sense together: a change to one since the proposal unsettles the others.
 * A key in several sets (status_id: stage + custody) is linked to every member of each.
 */
const PENDING_LINKED_KEY_GROUPS: readonly (readonly string[])[] = [
  ['prix', 'discount', 'prix_final'],
  /** Stage: status and the pipeline flags that follow it. */
  ['status_id', 'catalogued', 'needs_photograph', 'exposable'],
  /** Custody (docs/WORK_CUSTODY_MODEL.md): owner, custodian, address, buyer — set by the stage. */
  ['contact_id', 'localisation_id', 'localisation_address_id', 'acheteur_id', 'status_id'],
]

/** Every key linked to `key` (itself included). */
function pendingLinkedKeys(key: string): string[] {
  const out = new Set<string>([key])
  for (const g of PENDING_LINKED_KEY_GROUPS) if (g.includes(key)) for (const k of g) out.add(k)
  return Array.from(out)
}

/** Hidden form field: the work as the card OPENED it (`Oeuvres` columns + themes / groups), JSON. */
export const PENDING_LOADED_BASE_FIELD = '__base_json'

/** Columns a load-time base may carry: the baseline's own shape (`PENDING_FORM_KEY_TO_COLUMN` values). */
const PENDING_BASE_COLUMNS = new Set<string>(Object.values(PENDING_FORM_KEY_TO_COLUMN))

/**
 * Client side: the load-time base from the row the card opened with. Only known columns the row
 * actually holds; `extra` adds what the card read apart (long text, theme / group ids) when known.
 */
export function pendingLoadedBaseFromRow(
  row: Record<string, unknown>,
  extra: Record<string, string | null | undefined> = {},
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  for (const col of Array.from(PENDING_BASE_COLUMNS)) {
    if (col === 'Historique' || col === 'Commentaires' || col === 'themes' || col === 'groups') continue
    if (!(col in row)) continue
    const v = row[col]
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[col] = v
  }
  for (const [col, v] of Object.entries(extra)) {
    if (PENDING_BASE_COLUMNS.has(col) && typeof v === 'string') out[col] = v
  }
  return out
}

/** Form field: the card's form as it showed with nothing edited (form keys → values), for `planPendingEdit`'s `shown`. */
export const CARD_SHOWN_FORM_FIELD = '__base_form'

/** Server side: validate a `__base_form` field — known form keys with string values only; null when missing / invalid. */
export function parseCardShownForm(raw: unknown): Record<string, string> | null {
  if (typeof raw !== 'string' || !raw || raw.length > 200_000) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null // not a form snapshot: the plan falls back to the stored base
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (k in PENDING_FORM_KEY_TO_COLUMN && typeof v === 'string') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Server side: validate a `__base_json` field. Known columns with plain values only; null when
 * missing or invalid (the caller then keeps reading the base at save time).
 */
export function parsePendingLoadedBase(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || !raw || raw.length > 200_000) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!PENDING_BASE_COLUMNS.has(k)) continue
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

export type PendingEditPlan = {
  /** Proposed form keys whose value differs from the work as it stands now. */
  apply: string[]
  /** Of `apply`: changed by someone else since the proposal (or base unknown) — not written without force. */
  conflicts: string[]
  /** The row has no `baseline`: every proposed difference counts as a conflict. */
  noBaseline: boolean
  /** Not proposed (value as in the base) but changed since by someone else: the stored value stays. */
  kept: string[]
}

/**
 * Which fields of a queued edit to write, and which collide with a later change.
 * `baseline` and `current` share one shape: the `Oeuvres` row plus `themes` / `groups` joined ids
 * (as saveWork() stores the baseline). A key absent from `payload` is never proposed.
 * Historique is applied whenever edited and never a conflict: saveWork() keeps the lines written since.
 */
export function planPendingEdit(
  payload: Record<string, string>,
  baseline: Record<string, unknown> | null,
  current: Record<string, unknown>,
  /** Form keys → the value the card showed when nothing was edited (`__base_form`): a key whose value is still that
   *  one is not proposed, even where the card displays a stored value differently (an empty price shown as 0). */
  shown?: Record<string, string> | null,
): PendingEditPlan {
  const apply: string[] = []
  const conflicts: string[] = []
  const kept: string[] = []
  const now = (key: string) => normalisePendingBaselineValue(key, current[PENDING_FORM_KEY_TO_COLUMN[key]])
  const base = (key: string) => normalisePendingBaselineValue(key, baseline?.[PENDING_FORM_KEY_TO_COLUMN[key]])
  const proposedValue = (key: string) => normalisePendingFormValue(key, payload[key])

  /** Someone else changed `key` (or a field linked to it) since the proposal was made. */
  const changedSince = (key: string): boolean => {
    return pendingLinkedKeys(key).some((j) => {
      if (now(j) === base(j)) return false
      // A linked field already holding the proposal's own value is no collision.
      return !(j !== key && j in payload && now(j) === proposedValue(j))
    })
  }

  for (const [key, raw] of Object.entries(payload)) {
    if (key.startsWith('__') || PENDING_DIFF_SKIP_KEYS.has(key)) continue
    const column = PENDING_FORM_KEY_TO_COLUMN[key]
    if (!column) continue
    if (key === 'historique') {
      if (!(raw ?? '').trim()) continue
      const loaded = 'historique_base' in payload
        ? payload.historique_base
        : ((baseline ?? current).Historique as string | null | undefined)
      if (!sameHistorique(raw, loaded)) apply.push(key)
      continue
    }
    const after = proposedValue(key)
    if (now(key) === after) continue // already in place
    if (baseline) {
      const untouched = shown && key in shown ? normalisePendingFormValue(key, shown[key]) === after : base(key) === after
      if (untouched) { // not part of the proposal; changed since the base: theirs stays
        if (now(key) !== base(key)) kept.push(key)
        continue
      }
      apply.push(key)
      if (changedSince(key)) conflicts.push(key)
    } else {
      apply.push(key)
      conflicts.push(key)
    }
  }
  return { apply, conflicts, noBaseline: baseline == null, kept }
}

/** A stored column value as the form string saveWork() reads back to the same value; null = leave out. */
function pendingFormValueFromColumn(key: string, raw: unknown): string | null {
  if (raw == null) return null
  if (CHECKBOX_KEY_SET.has(key)) return raw === true ? '1' : '0'
  return String(raw)
}

/**
 * FormData for saveWork() approving an edit: the work as it stands, with only `keys` taken from the
 * proposal (saveWork() writes a whole record, so untouched fields go back as they are now). Themes /
 * groups not in `keys` are not sent (`__keep_themes` / `__keep_groups`, honoured for an admin only);
 * Historique not in `keys` is left out, so saveWork() does not write it.
 */
export function formDataForPendingEdit(
  oeuvreId: number,
  payload: Record<string, string>,
  current: Record<string, unknown>,
  keys: readonly string[],
): FormData {
  const take = new Set(keys)
  const fd = new FormData()
  fd.set('oeuvre_id', String(oeuvreId))
  for (const [key, column] of Object.entries(PENDING_FORM_KEY_TO_COLUMN)) {
    if (key === 'historique' || key === 'themes' || key === 'groups') continue
    const v = take.has(key) ? payload[key] : pendingFormValueFromColumn(key, current[column])
    if (v != null) fd.append(key, v)
  }
  if (take.has('historique')) {
    fd.set('historique', payload.historique ?? '')
    if ('historique_base' in payload) fd.set('historique_base', payload.historique_base ?? '')
  }
  for (const list of ['themes', 'groups'] as const) {
    if (!take.has(list)) {
      fd.set(list === 'themes' ? '__keep_themes' : '__keep_groups', '1')
      continue
    }
    for (const s of (payload[list] ?? '').split(',')) {
      const v = s.trim()
      if (v) fd.append(list, v)
    }
  }
  return fd
}
