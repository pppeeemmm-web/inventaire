import type { DictKey } from '@/lib/i18n/dictionary/keys'
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

/** Toast body for saveWork / share-triage failures (i18n keys vs raw PostgREST). */
export function workSaveErrorToastMessage(
  error: string,
  t: (key: DictKey) => string,
): string {
  if (isWorkSaveI18nError(error)) return t(error)
  return `${t('error_prefix')} ${error}`
}
