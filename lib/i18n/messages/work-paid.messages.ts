import { defineMessages } from '../message-core'

/** « Paiement reçu » follows the sale order's payments (TODO 10, lib/sales/work-paid.ts). */
export const workPaidMessages = defineMessages({
  paid_src_follows: { fr: 'D’après les paiements de', en: 'From the payments on' },
  paid_src_hand_vs_order: { fr: 'Réglé à la main ; les paiements de', en: 'Set by hand; the payments on' },
  paid_src_amounts: { fr: '{received} € reçus sur {price} €', en: '€{received} received of €{price}' },
  paid_src_hand_no_order: { fr: 'Réglé à la main (aucune vente enregistrée)', en: 'Set by hand (no sale order)' },
  paid_src_order_title: { fr: 'Ouvrir la commande', en: 'Open the order' },
  batch_paid_help: {
    fr: '« Payé » suit les paiements de la vente ; ce réglage le force à la main.',
    en: '« Paid » follows the sale’s payments; this sets it by hand.',
  },
})
