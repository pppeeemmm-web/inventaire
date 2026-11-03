import { defineMessages } from '../message-core'

/** Owner / custodian / address — docs/WORK_CUSTODY_MODEL.md (owner 2026-11-03). */
export const custodyMessages = defineMessages({
  custody_owner: { fr: 'Propriétaire', en: 'Owner' },
  custody_custodian: { fr: 'Dépositaire', en: 'Custodian' },
  custody_address: { fr: 'Adresse', en: 'Address' },
  custody_buyer: { fr: 'Acheteur', en: 'Buyer' },
  custody_address_none: { fr: 'Adresse non précisée', en: 'Address not specified' },
  custody_by_order_hint: {
    fr: 'Géré par sa commande (vente, dépôt, prêt) : propriétaire et dépositaire changent avec elle.',
    en: 'Managed by its order (sale, consignment, loan): owner and custodian change with it.',
  },
  custody_gift_override_hint: {
    fr: 'Don : vous choisissez le bénéficiaire, et qui garde l’œuvre jusqu’à la remise.',
    en: 'Gift: you choose the recipient, and who keeps the work until it is handed over.',
  },
  err_custody_order_required: {
    fr: 'Une œuvre ne quitte l’atelier que par une commande (dépôt, prêt, vente) ; en production, disponible ou archivée, Pem en est propriétaire et dépositaire.',
    en: 'A work leaves Pem only through an order (consignment, loan, sale); in production, available or archived, Pem owns and holds it.',
  },
  err_sale_order_required: {
    fr: 'Vendu : la propriété passe à l’acheteur quand la commande est réglée, la garde à la livraison.',
    en: 'Sold: ownership moves to the buyer when the order is paid, custody on delivery.',
  },
  gift_handed_over: { fr: 'Remise au bénéficiaire maintenant', en: 'Handed over to the recipient now' },
  gift_handed_over_help: {
    fr: 'Décoché : vous gardez l’œuvre (dépositaire Pem) jusqu’à la remise.',
    en: 'Unticked: you keep the work (custodian Pem) until it is handed over.',
  },
  exh_works_count_fmt: { fr: '{n} œuvre(s) chez ce lieu', en: '{n} work(s) at this venue' },
  exh_works_none: { fr: 'Aucune œuvre chez ce lieu pour le moment.', en: 'No work at this venue yet.' },
  exh_send_kind: { fr: 'Envoi', en: 'Send as' },
  exh_send_loan: { fr: 'Prêt', en: 'Loan' },
  exh_send_consignment: { fr: 'Dépôt-vente', en: 'Consignment' },
  exh_send_selection_fmt: { fr: 'Envoyer la sélection ({n})', en: 'Send the selection ({n})' },
  ov_health_missing_address: { fr: 'Adresse absente', en: 'No address set' },
  batch_pem_address: { fr: 'Adresse chez Pem', en: 'Address at Pem' },
  batch_pem_address_help: {
    fr: 'S’applique aux œuvres que Pem détient ; changera à la prochaine étape.',
    en: 'Applies to works Pem holds; it changes again at the next stage.',
  },
  batch_status_studio_help: {
    fr: 'En lot : En production, Disponible ou Archive. Ventes, dépôts et prêts passent par leur commande.',
    en: 'In bulk: In production, Available or Archive. Sales, consignments and loans go through their order.',
  },
})
