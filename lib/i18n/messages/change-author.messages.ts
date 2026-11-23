import { defineMessages } from '../message-core'

/** Work-change badges (design 2026-11-23 WorkChangeBadges): who changed a work. */
export const changeAuthorMessages = defineMessages({
  ca_machine: {
    fr: 'Automatique (tâche planifiée, script ou import)',
    en: 'Automatic (scheduled task, script or import)',
  },
  ca_unknown: {
    fr: 'Auteur inconnu',
    en: 'Unknown author',
  },
  ca_approved: {
    fr: 'Proposé par {who} · validé par {ok}',
    en: 'Proposed by {who} · approved by {ok}',
  },
  ca_not_recorded: {
    fr: 'non enregistré',
    en: 'not recorded',
  },
  // History drawer: a row shows its own change, so « Restaurer » brings back the « Avant » column.
  ca_before: {
    fr: 'Avant (restaurable)',
    en: 'Before (restorable)',
  },
  ca_after: {
    fr: 'Après',
    en: 'After',
  },
  ca_more: {
    fr: '+{n}',
    en: '+{n}',
  },
})
