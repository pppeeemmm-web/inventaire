import type { SaveContactResult } from '@/app/atelier/(portal)/contacts/save-contact'
import type { DictKey } from '@/lib/i18n/dictionary'

/**
 * The sentence a screen shows for a saveContact answer that wrote nothing (refused / error), or null when it saved.
 * `t` is the screen's i18n function; the keys live in contacts-ui.messages.ts.
 */
export function saveContactRefusalText(res: SaveContactResult, t: (key: DictKey) => string): string | null {
  if ('ok' in res || 'unchanged' in res) return null
  if ('error' in res) return t('contact_save_error_fmt').replace('{msg}', res.error)
  const detail = res.detail
  switch (res.refused) {
    case 'forbidden':
      return t('contact_save_forbidden')
    case 'admin_only':
      return t('contact_save_admin_only_fmt').replace('{field}', String(detail ?? ''))
    case 'stale':
      return t('contact_save_stale')
    case 'not_found':
      return t('contact_save_not_found')
    case 'bad_field':
      return t('contact_save_bad_field_fmt').replace('{field}', String(detail ?? ''))
    case 'address_in_use': {
      const d = (detail ?? {}) as { label?: string; works?: number; orders?: number; shipments?: number }
      return t('contact_editor_addr_in_use_fmt')
        .replace('{label}', d.label ?? '')
        .replace('{works}', String(d.works ?? 0))
        .replace('{orders}', String(d.orders ?? 0))
        .replace('{shipments}', String(d.shipments ?? 0))
    }
  }
}
