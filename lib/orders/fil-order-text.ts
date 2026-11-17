import type { DictKey } from '@/lib/i18n/dictionary'

/** A draft order in the Fil (R7): « Vente avec Galerie X — à vérifier puis signer dans Commandes… ». */
export function orderBody(order: { kind: string; party: string }, t: (k: DictKey) => string): string {
  const kind = ['sale', 'consignment', 'loan', 'gift', 'entrusted'].includes(order.kind) ? t(`ord_kind_${order.kind}` as DictKey) : order.kind
  return t('fil_order_body').replace('{kind}', kind).replace('{party}', order.party)
}
