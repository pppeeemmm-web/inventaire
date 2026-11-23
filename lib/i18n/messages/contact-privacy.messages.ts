import { defineMessages } from '../message-core'

/** « Privé » contacts hidden from the team, and why a contact cannot be deleted (2026-11-18). */
export const contactPrivacyMessages = defineMessages({
  contact_private_label: {
    fr: 'Contact privé',
    en: 'Private contact',
  },
  contact_delete_blocked_title: {
    fr: 'Rien n’a été supprimé :',
    en: 'Nothing was deleted:',
  },
  contact_delete_blocked_line_fmt: {
    fr: '{name} : {reasons}',
    en: '{name}: {reasons}',
  },
  contact_delete_blocked_hint: {
    fr: 'Changez d’abord le propriétaire, le détenteur ou la partie de la commande. Un contact lié à un compte de connexion ne se supprime pas ici.',
    en: 'First change the owner, the holder or the order’s party. A contact linked to a login is not deleted here.',
  },
  contact_delete_login: {
    fr: 'lié à un compte de connexion',
    en: 'linked to a login',
  },
  contact_delete_owner_one: {
    fr: 'propriétaire d’1 œuvre',
    en: 'owner of 1 work',
  },
  contact_delete_owner_fmt: {
    fr: 'propriétaire de {n} œuvres',
    en: 'owner of {n} works',
  },
  contact_delete_holder_one: {
    fr: 'détenteur d’1 œuvre',
    en: 'holder of 1 work',
  },
  contact_delete_holder_fmt: {
    fr: 'détenteur de {n} œuvres',
    en: 'holder of {n} works',
  },
  contact_delete_shipments_one: {
    fr: '1 envoi',
    en: '1 shipment',
  },
  contact_delete_shipments_fmt: {
    fr: '{n} envois',
    en: '{n} shipments',
  },
  contact_delete_orders_one: {
    fr: '1 commande',
    en: '1 order',
  },
  contact_delete_orders_fmt: {
    fr: '{n} commandes',
    en: '{n} orders',
  },
  contact_delete_invoices_one: {
    fr: '1 facture',
    en: '1 invoice',
  },
  contact_delete_invoices_fmt: {
    fr: '{n} factures',
    en: '{n} invoices',
  },
  contact_delete_supply_one: {
    fr: '1 commande fournisseur',
    en: '1 supply order',
  },
  contact_delete_supply_fmt: {
    fr: '{n} commandes fournisseur',
    en: '{n} supply orders',
  },
  contact_delete_journal_one: {
    fr: 'nommé(e) dans le Journal (1) — fusionnez plutôt avec la bonne fiche',
    en: 'named in the Journal (1) — merge it into the right contact instead',
  },
  contact_delete_journal_fmt: {
    fr: 'nommé(e) dans le Journal ({n}) — fusionnez plutôt avec la bonne fiche',
    en: 'named in the Journal ({n}) — merge it into the right contact instead',
  },
})
