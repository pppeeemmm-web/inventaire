// Words the `blocked` result of `deleteContacts` (app/atelier/(portal)/contacts/actions.ts) for the UI.

import type { DictKey } from '@/lib/i18n/dictionary'
import { interpolateMessage } from '@/lib/i18n/message-core'
import type { ContactDeleteBlocker } from '@/app/atelier/(portal)/contacts/actions'

type CountKey = 'owner' | 'holder' | 'shipments' | 'orders' | 'invoices' | 'supplyOrders'

const REASONS: { key: CountKey; one: DictKey; fmt: DictKey }[] = [
  { key: 'owner', one: 'contact_delete_owner_one', fmt: 'contact_delete_owner_fmt' },
  { key: 'holder', one: 'contact_delete_holder_one', fmt: 'contact_delete_holder_fmt' },
  { key: 'orders', one: 'contact_delete_orders_one', fmt: 'contact_delete_orders_fmt' },
  { key: 'shipments', one: 'contact_delete_shipments_one', fmt: 'contact_delete_shipments_fmt' },
  { key: 'invoices', one: 'contact_delete_invoices_one', fmt: 'contact_delete_invoices_fmt' },
  { key: 'supplyOrders', one: 'contact_delete_supply_one', fmt: 'contact_delete_supply_fmt' },
]

/** « Rien n'a été supprimé : / Marie Dupont : propriétaire de 3 œuvres, 1 commande / … / hint ». */
export function formatContactDeleteBlockers(blocked: ContactDeleteBlocker[], t: (key: DictKey) => string): string {
  const lines = blocked.map((b) => {
    const reasons: string[] = []
    if (b.login) reasons.push(t('contact_delete_login'))
    for (const r of REASONS) {
      const n = b[r.key]
      if (n > 0) reasons.push(n === 1 ? t(r.one) : interpolateMessage(t(r.fmt), { n }))
    }
    return interpolateMessage(t('contact_delete_blocked_line_fmt'), { name: b.name, reasons: reasons.join(', ') })
  })
  return [t('contact_delete_blocked_title'), ...lines, '', t('contact_delete_blocked_hint')].join('\n')
}
