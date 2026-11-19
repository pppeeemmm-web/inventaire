import type { DictKey } from '@/lib/i18n/dictionary/keys'
import type { DictKey as AnyDictKey } from '@/lib/i18n/dictionary'
import type { PendingChangeInsertError } from '@/lib/pending-changes-insert'

/** Server action error tokens resolved on the client via `t()`. */
export const WORK_SAVE_SCHEMA_ERROR_KEY = 'wf_save_pending_schema_error' as const satisfies DictKey

/** Form field: the work's `edited_at` as the card opened it; `saveWork` refuses with `WORK_CHANGED_ERROR` if it moved. */
export const WORK_BASE_EDITED_AT_FIELD = '__base_edited_at'
/** `saveWork` refusal: the work was saved elsewhere (another tab, another person) after the card opened. */
export const WORK_CHANGED_ERROR = 'work_changed'
/** `saveWork` refusal: the work was put in the bin after the card opened. */
export const WORK_IN_BIN_ERROR = 'work_in_bin'

export function pendingInsertToSaveError(
  err: PendingChangeInsertError,
): string {
  if (err.kind === 'schema_migration') return WORK_SAVE_SCHEMA_ERROR_KEY
  return err.message
}

export function isWorkSaveI18nError(error: string): error is DictKey {
  return error === WORK_SAVE_SCHEMA_ERROR_KEY
}

/**
 * DB / action gate codes (supabase/sql/work_lifetime_gates.sql, work_custody_model.sql, condition_report_fate.sql, archive_shelf.sql, batchEdit,
 * order actions) → message key. They arrive inside a PostgREST message or as the bare code.
 */
const GATE_ERROR_KEYS: Record<string, AnyDictKey> = {
  holder_required: 'err_holder_required',
  sold_delete_admin_only: 'err_sold_delete_admin_only',
  fate_admin_only: 'cond_err_fate_admin',
  bulk_admin_only: 'err_bulk_admin_only',
  work_out_of_circulation: 'err_work_out_of_circulation',
  custody_order_required: 'err_custody_order_required',
  // Raised by oeuvre_holder_check once work_order_drop_legacy.sql is applied (R7: the old order tables go).
  paid_sale_required: 'err_paid_sale_required',
  gift_order_required: 'err_gift_order_required',
  archive_requires_catalogue: 'err_archive_requires_catalogue',
  archive_exit_requires_photo: 'err_archive_exit_requires_photo',
  [WORK_CHANGED_ERROR]: 'wc_err_work_changed',
  [WORK_IN_BIN_ERROR]: 'wc_err_work_in_bin',
}

/** `purgeWorkPermanently` refusal token `purge_blocked:<table>=<n>,…` → « … figure sur 1 commande, 2 liens du Journal. … » */
const PURGE_HOLDER_KEYS: Record<string, AnyDictKey> = {
  work_order_work: 'wc_purge_held_orders',
  shipment_work: 'wc_purge_held_shipments',
  journal_entry_link: 'wc_purge_held_journal',
  insurance_claim: 'wc_purge_held_claims',
}

export function purgeBlockedMessage(error: string, t: (key: AnyDictKey) => string): string | null {
  if (!error.startsWith('purge_blocked:')) return null
  const parts = error
    .slice('purge_blocked:'.length)
    .split(',')
    .map((p) => p.split('='))
    .filter(([table, n]) => PURGE_HOLDER_KEYS[table] && Number(n) > 0)
    .map(([table, n]) => t(PURGE_HOLDER_KEYS[table]).replace('{n}', n))
  return t('wc_purge_blocked').replace('{what}', parts.join(', '))
}

export function gateErrorKey(error: string): AnyDictKey | null {
  for (const [code, key] of Object.entries(GATE_ERROR_KEYS)) if (error.includes(code)) return key
  return null
}

/** Toast body for saveWork / share-triage failures (i18n keys vs raw PostgREST). */
export function workSaveErrorToastMessage(
  error: string,
  t: (key: AnyDictKey) => string,
): string {
  if (isWorkSaveI18nError(error)) return t(error)
  const purge = purgeBlockedMessage(error, t)
  if (purge) return purge
  const gate = gateErrorKey(error)
  if (gate) return t(gate)
  return `${t('error_prefix')} ${error}`
}
