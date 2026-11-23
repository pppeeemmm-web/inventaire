import { defineMessages } from '../message-core'

/** Reverse pricing block on the work card (docs/design/2026-11-23/ReversePricing.md). */
export const reversePricingMessages = defineMessages({
  rp_title: { fr: 'Prix inverse', en: 'Reverse price' },
  rp_summary: { fr: 'Liste {list} · plancher en gros {wholesale}', en: 'List {list} · wholesale {wholesale}' },
  rp_net: { fr: 'Net voulu €', en: 'Net wanted €' },
  rp_direct: { fr: 'Coûts de l’œuvre €', en: 'Costs of the work €' },
  rp_direct_hint: { fr: 'Dépenses liées {spent} + à venir', en: 'Linked expenses {spent} + planned' },
  rp_planned: { fr: 'À venir €', en: 'Planned €' },
  rp_running: { fr: 'Part des frais généraux €', en: 'Running-cost share €' },
  rp_running_src: { fr: 'Frais {year} {pool} ÷ {n} œuvres', en: '{year} costs {pool} ÷ {n} works' },
  rp_contrib: { fr: 'Cotisations % (à confirmer)', en: 'Contributions % (to confirm)' },
  rp_one: { fr: 'Un seul prix', en: 'One price' },
  rp_per_channel: { fr: 'Par canal', en: 'Per channel' },
  rp_col_channel: { fr: 'Canal', en: 'Channel' },
  rp_col_comm: { fr: 'Comm. %', en: 'Comm. %' },
  rp_col_disc: { fr: 'Remise %', en: 'Disc. %' },
  rp_col_cost: { fr: 'Frais €', en: 'Cost €' },
  rp_col_floor: { fr: 'Plancher', en: 'Floor' },
  rp_col_list: { fr: 'Prix de liste', en: 'List price' },
  rp_col_net: { fr: 'Net gardé', en: 'Net kept' },
  rp_col_maxdisc: { fr: 'Remise max', en: 'Max discount' },
  rp_ch_studio: { fr: 'Atelier', en: 'Studio' },
  rp_ch_gallery: { fr: 'Galerie (dépôt)', en: 'Gallery (consignment)' },
  rp_ch_fair: { fr: 'Foire', en: 'Fair' },
  rp_ch_online: { fr: 'En ligne', en: 'Online' },
  rp_ch_patron: { fr: 'Mécène / institution', en: 'Patron / institution' },
  rp_wholesale: {
    fr: 'Vente en gros à une galerie (sans commission) : {wholesale} = {pct} % du prix de liste',
    en: 'Outright sale to a gallery (no commission): {wholesale} = {pct} % of the list price',
  },
  rp_today: { fr: 'Prix actuel de l’œuvre : {price}', en: 'Current price of the work: {price}' },
  rp_note: {
    fr: 'Calcul seulement : rien n’est enregistré. Les cotisations sont celles de l’artiste-auteur (URSSAF), pas l’impôt.',
    en: 'Calculation only: nothing is saved. Contributions are the artist-author ones (URSSAF), not income tax.',
  },
  rp_na: { fr: '—', en: '—' },
})
