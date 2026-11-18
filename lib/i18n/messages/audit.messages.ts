import { defineMessages } from '../message-core'

export const auditMessages = defineMessages({
  audit_select_all: {
    fr: 'Tout sélectionner',
    en: 'Select all',
  },
  audit_clear_selection: {
    fr: 'Effacer la sélection',
    en: 'Clear selection',
  },
  audit_delete_selected: {
    fr: 'Supprimer ({n})',
    en: 'Delete ({n})',
  },
  audit_delete_selected_confirm: {
    fr: 'Supprimer {n} entrée(s) du journal d’audit ? Les lignes du registre manuel (onglet Système) ne sont pas concernées.',
    en: 'Delete {n} audit log entry/entries? Manual ledger rows (System tab) are not affected.',
  },
  audit_delete_failed: {
    fr: 'Suppression impossible — vérifiez vos droits ou réessayez.',
    en: 'Could not delete — check your permissions or try again.',
  },
  audit_bulk_deleted_toast: {
    fr: '{n} entrée(s) supprimée(s).',
    en: '{n} entry/entries deleted.',
  },
  audit_row_select_aria: {
    fr: 'Sélectionner l’entrée {id}',
    en: 'Select entry {id}',
  },
  // Audit « Corbeille » — the works bin (Oeuvres.deleted_at), admin only.
  bin_tab: { fr: 'Corbeille', en: 'Bin' },
  bin_title: { fr: 'Corbeille des œuvres', en: 'Works bin' },
  bin_intro: {
    fr: 'Les œuvres mises à la corbeille, la plus récente en haut. « Restaurer » les remet dans les listes ; « Supprimer définitivement » efface la fiche.',
    en: 'Works moved to the bin, newest first. « Restore » puts them back in the lists; « Delete permanently » erases the record.',
  },
  bin_empty: { fr: 'La corbeille est vide.', en: 'The bin is empty.' },
  bin_loading: { fr: 'Chargement de la corbeille…', en: 'Loading the bin…' },
  bin_load_error: { fr: 'La corbeille n’a pas pu se charger.', en: 'The bin could not load.' },
  bin_admin_only: { fr: 'Réservé à l’administrateur.', en: 'Admin only.' },
  bin_untitled: { fr: 'Sans titre', en: 'Untitled' },
  bin_deleted_on: { fr: 'Mise à la corbeille le {date}', en: 'Moved to the bin on {date}' },
  bin_restore: { fr: 'Restaurer', en: 'Restore' },
  bin_restored: { fr: 'Œuvre #{id} restaurée : de retour dans les listes.', en: 'Work #{id} restored: back in the lists.' },
  bin_purge: { fr: 'Supprimer définitivement', en: 'Delete permanently' },
  bin_purge_title: { fr: 'Supprimer définitivement ?', en: 'Delete permanently?' },
})
