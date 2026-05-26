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
})
