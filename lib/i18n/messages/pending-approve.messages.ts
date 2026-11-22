import { defineMessages } from '../message-core'

/** Approving a team proposal on a work that changed since (Audit PendingQueue, Fil). */
export const pendingApproveMessages = defineMessages({
  pending_conflict: {
    fr: 'Cette œuvre a changé depuis la proposition : {fields}. Rien n’a été écrit.',
    en: 'This work has changed since the proposal: {fields}. Nothing was written.',
  },
  pending_conflict_no_base: {
    fr: 'Proposition ancienne, sans état de départ : impossible de savoir si ces champs ont changé depuis — {fields}. Rien n’a été écrit.',
    en: 'Older proposal with no starting state: cannot tell whether these fields changed since — {fields}. Nothing was written.',
  },
  pending_conflict_apply_anyway: {
    fr: 'Appliquer quand même',
    en: 'Apply anyway',
  },
  pending_contact_deleted: {
    fr: 'Le contact (ou l’adresse) proposé a été supprimé depuis : rien n’a été écrit. Rejetez la proposition.',
    en: 'The proposed contact (or address) has been deleted since: nothing was written. Reject the proposal.',
  },
  pending_conflict_fil: {
    fr: 'Cette œuvre a changé depuis la proposition ({fields}) : à décider dans Audit — appliquer quand même ou rejeter.',
    en: 'This work has changed since the proposal ({fields}): decide in Audit — apply anyway or reject.',
  },
})
