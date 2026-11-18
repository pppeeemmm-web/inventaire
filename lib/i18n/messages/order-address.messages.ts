import { defineMessages } from '../message-core'

/** The custodian's address on an order (TODO 9, docs/WORK_CUSTODY_MODEL.md). */
export const orderAddressMessages = defineMessages({
  ord_addr_line: { fr: 'Adresse : {label}', en: 'Address: {label}' },
  ord_addr_pick: { fr: 'Choisir l’adresse…', en: 'Pick the address…' },
  ord_addr_pick_hint: {
    fr: 'Où vont les œuvres. Celles déjà chez ce contact sans adresse la prennent aussi.',
    en: 'Where the works go. Works already with this contact and no address take it too.',
  },
})
