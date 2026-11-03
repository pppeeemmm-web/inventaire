import type { DictKey } from '@/lib/i18n/dictionary/keys'
import type { DictKey as AnyDictKey } from '@/lib/i18n/dictionary'
import type { PendingChangeInsertError } from '@/lib/pending-changes-insert'

/** Server action error tokens resolved on the client via `t()`. */
export const WORK_SAVE_SCHEMA_ERROR_KEY = 'wf_save_pending_schema_error' as const satisfies DictKey

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
 * DB / action gate codes (supabase/sql/work_lifetime_gates.sql, work_custody_model.sql, condition_report_fate.sql, batchEdit,
 * order actions) → message key. They arrive inside a PostgREST message or as the bare code.
 */
const GATE_ERROR_KEYS: Record<string, AnyDictKey> = {
  holder_required: 'err_holder_required',
  sold_delete_admin_only: 'err_sold_delete_admin_only',
  fate_admin_only: 'cond_err_fate_admin',
  bulk_admin_only: 'err_bulk_admin_only',
  work_out_of_circulation: 'err_work_out_of_circulation',
  custody_order_required: 'err_custody_order_required',
  sale_order_required: 'err_sale_order_required',
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
  const gate = gateErrorKey(error)
  if (gate) return t(gate)
  return `${t('error_prefix')} ${error}`
}
