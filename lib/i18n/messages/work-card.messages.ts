import { defineMessages } from '../message-core'

/** Work card R3 (docs/design/2026-11-16/WorkCard.notes.md): header, top block, Création / Objet drawers, save bar. */
export const workCardMessages = defineMessages({
  wc_view_aria: { fr: 'Affichage de la fiche', en: 'Card view' },
  wc_view_folded: { fr: 'Replié', en: 'Folded' },
  wc_view_folded_tt: {
    fr: 'Le haut de la fiche en entier, Création et Objet fermés, les champs vides réunis en une ligne.',
    en: 'The top of the card in full, Création and Objet closed, empty fields gathered in one line.',
  },
  wc_view_open: { fr: 'Développé', en: 'Expanded' },
  wc_view_open_tt: {
    fr: 'Création et Objet ouverts, les champs vides grisés à leur place.',
    en: 'Création and Objet open, empty fields greyed in place.',
  },
  wc_sel_add: { fr: 'Ajouter à la sélection', en: 'Add to selection' },
  wc_sel_remove: { fr: 'Dans la sélection — retirer', en: 'In the selection — remove' },
  wc_widen: { fr: 'Élargir : photo à gauche, fiche à droite', en: 'Widen: picture left, card right' },
  wc_narrow: { fr: 'Réduire à une colonne', en: 'Back to one column' },
  wc_modified_fmt: { fr: 'modifié {date}', en: 'changed {date}' },

  wc_pic_download: { fr: 'Télécharger l’original', en: 'Download the original' },
  wc_pic_retouch: { fr: 'Remplacer par la retouche', en: 'Replace with the retouched file' },
  wc_pic_delete: { fr: 'Supprimer cette photo (admin)', en: 'Delete this picture (admin)' },
  wc_pic_zoom_hint: { fr: 'Molette = loupe', en: 'Wheel = loupe' },
  wc_strip_hint: { fr: '⠿ glisser pour changer l’ordre · la 1re = couverture', en: '⠿ drag to reorder · the first = cover' },
  wc_strip_grip_aria: { fr: 'Glisser pour changer l’ordre', en: 'Drag to reorder' },
  wc_strip_cover: { fr: 'couverture', en: 'cover' },
  wc_swatch_fmt: { fr: '{hex} · {share}', en: '{hex} · {share}' },

  wc_prod_label: { fr: 'Production', en: 'Production' },
  wc_stage_started_fmt: { fr: 'commencée {date}', en: 'started {date}' },
  wc_stage_photo_needed: { fr: 'photo requise', en: 'photo needed' },
  wc_stage_photo_needed_tt: {
    fr: 'Photographier l’œuvre — la photo validée la fait passer en Disponible. Toucher = photo faite.',
    en: 'Photograph the work — the validated picture moves it to Available. Tap = picture done.',
  },
  wc_stage_photo_ok: { fr: 'photo ✓', en: 'photo ✓' },
  wc_stage_next_tt: { fr: 'Toucher pour passer à cette étape', en: 'Tap to move to this stage' },
  wc_stage_locked_tt: {
    fr: 'Fermé : l’œuvre est vendue, donnée ou dans l’archive de l’artiste. Changer d’abord la propriété.',
    en: 'Closed: the work is sold, given or in the artist’s archive. Change the ownership first.',
  },
  wc_own_label: { fr: 'Propriété', en: 'Ownership' },
  wc_gift_chip: { fr: 'Don…', en: 'Gift…' },
  wc_gift_chip_tt: {
    fr: 'Préparer un don : la propriété passe au donataire à la signature de l’acte.',
    en: 'Prepare a gift: ownership moves to the recipient when the deed is signed.',
  },
  wc_custodian_auto: { fr: 'automatique', en: 'automatic' },

  wc_dims: { fr: 'Dimensions', en: 'Dimensions' },
  wc_format: { fr: 'Format', en: 'Format' },
  wc_period: { fr: 'Période', en: 'Period' },
  wc_year: { fr: 'Année', en: 'Year' },
  wc_completed_fmt: { fr: 'terminée {date}', en: 'finished {date}' },
  wc_tap_edit: { fr: 'Toucher pour modifier', en: 'Tap to edit' },

  wc_public_on: { fr: 'Publique', en: 'Public' },
  wc_public_off: { fr: 'Non publique', en: 'Not public' },
  wc_public_tt: {
    fr: 'État public de l’œuvre, calculé par la base (étape + propriété). Lecture seule.',
    en: 'The work’s public state, set by the database (stage + ownership). Read only.',
  },
  wc_session_photos_fmt: { fr: '{n} photo(s) de session à valider', en: '{n} session photo(s) to review' },
  wc_pending_photo_one: { fr: '1 photo en attente de validation', en: '1 photo waiting for approval' },
  wc_pending_photos_fmt: { fr: '{n} photos en attente de validation', en: '{n} photos waiting for approval' },
  wc_pending_photos_tt: {
    fr: 'Ajoutée par l’équipe : elle rejoint les images de l’œuvre quand l’administrateur la valide dans Audit › Validation.',
    en: 'Added by the team: it joins the work’s images once the administrator approves it in Audit › Review.',
  },
  wc_session_photos_tt: {
    fr: 'Des photos prises en session de terrain attendent votre tri : les ajouter à l’œuvre ou les écarter. Voir Création › Sessions de terrain.',
    en: 'Field-session photos wait for your sorting: add them to the work or set them aside. See Création › Field sessions.',
  },

  wc_voice_note_fmt: { fr: 'note vocale {date}', en: 'voice note {date}' },
  wc_sessions_fmt: { fr: '{n} session(s)', en: '{n} session(s)' },
  wc_sum_voice_fmt: { fr: '{n} note(s) vocale(s)', en: '{n} voice note(s)' },
  wc_sum_ai_to_judge: { fr: 'IA à juger', en: 'AI to judge' },
  wc_creation: { fr: 'Création', en: 'Création' },
  wc_object: { fr: 'Objet', en: 'Object' },
  wc_p_period: { fr: 'Période & sources', en: 'Period & sources' },
  wc_p_history: { fr: 'Historique de création', en: 'Making history' },
  wc_p_comments: { fr: 'Commentaires & notes', en: 'Comments & notes' },
  wc_p_themes: { fr: 'Thèmes', en: 'Themes' },
  wc_p_links: { fr: 'Liens vers d’autres œuvres', en: 'Links to other works' },
  wc_p_sessions: { fr: 'Sessions de terrain', en: 'Field sessions' },
  wc_p_ai: { fr: 'Vu par l’IA', en: 'Seen by the AI' },
  wc_p_provenance: { fr: 'Historique / provenance', en: 'History / provenance' },
  wc_p_confidentiality: { fr: 'Confidentialité du contact', en: 'Contact confidentiality' },
  wc_p_confidentiality_tt: {
    fr: 'Comment le nom du propriétaire s’affiche (public, masqué, confidentiel).',
    en: 'How the owner’s name is shown (public, masked, confidential).',
  },
  wc_p_presentation: { fr: 'Présentation', en: 'Presentation' },
  wc_p_value: { fr: 'Valeur', en: 'Value' },
  wc_p_costs: { fr: 'Coûts (admin)', en: 'Costs (admin)' },
  wc_p_groups: { fr: 'Groupes', en: 'Groups' },
  wc_p_condition: { fr: 'État · constats', en: 'Condition · reports' },
  wc_p_fate: { fr: 'Destin', en: 'Fate' },
  wc_p_fate_none: { fr: 'ni détruite ni perdue — se règle par un constat', en: 'neither destroyed nor lost — set through a condition report' },
  wc_p_label: { fr: 'Étiquette physique', en: 'Physical label' },
  wc_p_admin: { fr: 'Zone admin', en: 'Admin zone' },
  wc_p_trash: { fr: 'Corbeille', en: 'Trash' },
  wc_trash_work: { fr: 'Mettre à la corbeille…', en: 'Move to trash…' },
  wc_trash_work_tt: {
    fr: 'Met l’œuvre à la corbeille ; « Annuler » reste possible quelques secondes.',
    en: 'Moves the work to the trash; « Undo » stays available for a few seconds.',
  },
  wc_purge_work: { fr: 'Supprimer définitivement…', en: 'Delete permanently…' },
  wc_purge_work_tt: {
    fr: 'Efface la fiche, ses thèmes et liens ; les photos vont à la corbeille R2 (90 j). Impossible d’annuler.',
    en: 'Erases the record, its themes and links; pictures go to the R2 recycle bin (90 days). Cannot be undone.',
  },
  wc_purge_confirm_fmt: {
    fr: 'Supprimer définitivement l’œuvre #{id} ? La fiche, ses thèmes et ses liens seront effacés, les photos iront à la corbeille R2 (90 j). Impossible d’annuler.',
    en: 'Permanently delete work #{id}? The record, its themes and links will be erased, the pictures go to the R2 recycle bin (90 days). This cannot be undone.',
  },
  wc_purge_done: { fr: 'Œuvre supprimée définitivement.', en: 'Work permanently deleted.' },
  // purgeWorkPermanently refuses, erasing nothing, while a row still points at the work (lib/work-save-error.ts).
  wc_purge_blocked: {
    fr: 'Suppression définitive refusée : l’œuvre figure sur {what}. Rien n’a été effacé.',
    en: 'Permanent deletion refused: the work is on {what}. Nothing was erased.',
  },
  wc_purge_held_orders: { fr: '{n} commande(s)', en: '{n} order(s)' },
  wc_purge_held_shipments: { fr: '{n} envoi(s)', en: '{n} shipment(s)' },
  wc_purge_held_journal: { fr: '{n} lien(s) du Journal', en: '{n} Journal link(s)' },
  wc_purge_held_claims: { fr: '{n} déclaration(s) de sinistre', en: '{n} insurance claim(s)' },
  wc_data_history: { fr: 'Historique des données', en: 'Data history' },
  wc_add_theme: { fr: 'thème', en: 'theme' },
  wc_add_group: { fr: 'groupe', en: 'group' },
  wc_done: { fr: 'OK', en: 'Done' },

  wc_sum_none: { fr: 'rien de saisi', en: 'nothing entered' },
  wc_sum_comments: { fr: 'commentaires', en: 'comments' },
  wc_sum_themes_fmt: { fr: '{n} thème(s)', en: '{n} theme(s)' },
  wc_sum_period_fmt: { fr: 'période {p}', en: 'period {p}' },
  wc_sum_provenance: { fr: 'provenance', en: 'provenance' },
  wc_sum_price_fmt: { fr: 'prix {p}', en: 'price {p}' },
  wc_sum_paid: { fr: 'payé', en: 'paid' },
  wc_sum_groups_fmt: { fr: '{n} groupe(s)', en: '{n} group(s)' },
  wc_sum_framed: { fr: 'encadrée', en: 'framed' },
  wc_sum_broadcast: { fr: 'prêt à diffuser', en: 'ready to share' },
  wc_sum_fate: { fr: 'détruite / perdue', en: 'destroyed / lost' },
  wc_sum_label: { fr: 'étiquette', en: 'label' },

  // ── Step 2 — Objet › Logistique / Valeur « Commande » / Présentation gates ──
  wc_p_logistics: { fr: 'Logistique', en: 'Logistics' },
  wc_p_logistics_tt: {
    fr: 'Les envois liés à l’œuvre (aussi dans l’onglet Logistique) et ses dates de livraison / retour.',
    en: 'Shipments linked to the work (also in the Logistics tab) and its delivery / return dates.',
  },
  wc_ship_none: { fr: 'aucun envoi', en: 'no shipment' },
  wc_ship_delivery: { fr: 'Livraison', en: 'Delivery' },
  wc_ship_delivery_empty: { fr: 'date de livraison', en: 'delivery date' },
  wc_ship_return: { fr: 'Retour', en: 'Return' },
  wc_ship_return_empty: { fr: 'date de retour', en: 'return date' },
  wc_ship_open_tab: { fr: 'Logistique ↗', en: 'Logistics ↗' },
  wc_ship_chip_tt: {
    fr: 'Un envoi de cette œuvre est en cours (statut → destinataire · date). Toucher : voir la partie Logistique.',
    en: 'A shipment of this work is under way (status → recipient · date). Tap: see the Logistics part.',
  },
  wc_ship_status_tt: {
    fr: 'Statut de l’envoi : conditionné → prêt → planifié → en transit → livré. Se change dans l’onglet Logistique.',
    en: 'Shipment status: packed → ready → scheduled → in transit → delivered. Changed in the Logistics tab.',
  },
  wc_sum_shipping: { fr: 'envoi en cours', en: 'shipment under way' },

  wc_commission: { fr: 'Commande', en: 'Commission' },
  wc_commission_tt: {
    fr: 'Œuvre faite sur commande pour un client. Le lien avec le pipeline commercial viendra avec la refonte des dossiers.',
    en: 'Work made to order for a client. The link to the sales pipeline comes with the dossier overhaul.',
  },
  wc_commission_client: { fr: 'client', en: 'client' },
  wc_commission_client_tt: {
    fr: 'Le client de la commande — enregistré comme acheteur de l’œuvre (le même qu’à la réservation / vente).',
    en: 'The commission’s client — saved as the work’s buyer (the same as at reservation / sale).',
  },
  wc_commission_later: { fr: '· pipeline : avec la refonte des dossiers', en: '· pipeline: with the dossier overhaul' },
  wc_sum_commission: { fr: 'commande', en: 'commission' },

  wc_p_presentation_tt: {
    fr: 'Les portes du pipeline : l’œuvre est-elle montée, encadrée, exposable, prête à diffuser ? « Cataloguée » = l’étape Catalogué.',
    en: 'The pipeline gates: is the work mounted, framed, showable, ready to share? « Catalogued » = the Catalogué stage.',
  },
  wc_gate_mounted: { fr: 'Montée', en: 'Mounted' },
  wc_gate_mounted_tt: {
    fr: 'Montée sur châssis / support. Aussi cochée par les tâches de l’onglet Production.',
    en: 'Mounted on a stretcher / backing. Also ticked by the Production tab tasks.',
  },
  wc_gate_framed: { fr: 'Encadrée', en: 'Framed' },
  wc_gate_framed_tt: {
    fr: 'Encadrée. Aussi cochée par les tâches de l’onglet Production.',
    en: 'Framed. Also ticked by the Production tab tasks.',
  },
  wc_gate_exposable: { fr: 'Exposable', en: 'Showable' },
  wc_gate_exposable_tt: {
    fr: 'Physiquement prête à montrer : montée, encadrée, vernie. ≠ Disponible, qui veut dire la fiche prête (cataloguée + photo).',
    en: 'Physically ready to show: mounted, framed, varnished. ≠ Available, which means the record is ready (catalogued + photo).',
  },
  wc_gate_exposable_fate_tt: {
    fr: 'Fermé : une œuvre détruite ou perdue n’est jamais exposable (règle de la base).',
    en: 'Closed: a destroyed or lost work is never showable (database rule).',
  },
  wc_gate_exposable_archive_tt: {
    fr: 'Fermé : une œuvre de l’archive de l’artiste n’est pas exposable. Changer d’abord la propriété.',
    en: 'Closed: a work in the artist’s archive is not showable. Change the ownership first.',
  },
  wc_gate_broadcast_tt: {
    fr: 'Prête pour une publication (Diffusion) : photo validée, texte de légende relu.',
    en: 'Ready for a post (Broadcast): picture validated, caption text checked.',
  },
  wc_sum_gates_fmt: { fr: '{n}/4 portes', en: '{n}/4 gates' },

  // ── Captions on the top block ──
  wc_own_closed_order_tt: {
    fr: 'Fermé : dépôt, prêt et vente passent par leur commande (Business → Commandes), pas par la fiche.',
    en: 'Closed: consignment, loan and sale go through their order (Business → Orders), not the card.',
  },
  wc_own_closed_gift_tt: {
    fr: 'Fermé : un don se prépare avec « Don… » — la propriété passe au donataire à la signature de l’acte.',
    en: 'Closed: a gift is prepared with « Gift… » — ownership moves to the recipient when the deed is signed.',
  },
  wc_own_closed_archive_tt: {
    fr: 'Fermé : cataloguer d’abord — une œuvre ne part en archive qu’avec sa fiche (même partielle).',
    en: 'Closed: catalogue it first — a work goes to the archive only with its record (even partial).',
  },
  wc_own_closed_locked_tt: {
    fr: 'Fermé : l’œuvre est détruite / perdue — rouvrir le constat d’abord.',
    en: 'Closed: the work is destroyed / lost — reopen the condition report first.',
  },
  wc_own_label_tt: {
    fr: 'Qui possède l’œuvre. Elle quitte Pem par un dossier (dépôt, prêt, vente) ou par un don signé.',
    en: 'Who owns the work. It leaves Pem through an order (consignment, loan, sale) or a signed gift.',
  },
  wc_prod_label_tt: {
    fr: 'Où en est la fiche : Atelier (en cours) → Catalogué (photo à faire) → Disponible (fiche prête). Toucher l’étape suivante pour avancer.',
    en: 'Where the record stands: Atelier (in progress) → Catalogué (picture to take) → Available (record ready). Tap the next stage to move on.',
  },
  wc_return_window_tt: {
    fr: 'Délai de retour de 14 jours (règle de l’atelier, toute vente) : l’acheteur peut encore rendre l’œuvre ; l’argent reste en attente jusqu’à la fin.',
    en: '14-day return period (studio rule, every sale): the buyer can still return the work; the money stays held until it ends.',
  },

  // ── Owner / custodian hover card ──
  wc_hc_card: { fr: 'Fiche ↗', en: 'Card ↗' },
  wc_hc_change: { fr: 'Changer…', en: 'Change…' },
  wc_hc_address: { fr: 'Adresse ▾', en: 'Address ▾' },
  wc_hc_change_locked_tt: {
    fr: 'Se change par le dossier (vente, dépôt, prêt) ou par « Don… ».',
    en: 'Changed through the order (sale, consignment, loan) or « Gift… ».',
  },
  wc_hc_no_address: { fr: 'pas d’adresse', en: 'no address' },

  wc_modified_by_fmt: { fr: 'modifié par {who} · {date}', en: 'changed by {who} · {date}' },

  wc_empty_fmt: { fr: '{n} champ(s) vide(s) — {list}', en: '{n} empty field(s) — {list}' },
  wc_empty_see: { fr: 'voir', en: 'show' },

  wc_save_clean: { fr: 'aucune modification', en: 'no changes' },
  wc_save_dirty: { fr: '● modifications non enregistrées', en: '● unsaved changes' },
  wc_discard_tt: { fr: 'Annuler les modifications non enregistrées', en: 'Discard the unsaved changes' },
})
