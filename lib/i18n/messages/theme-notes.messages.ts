import { defineMessages } from '../message-core'

/** Theme notes on Catalogue → Thèmes (TODO 23, Pem 2026-11-18). */
export const themeNotesMessages = defineMessages({
  thn_title: { fr: 'Notes du thème', en: 'Theme notes' },
  thn_pick: { fr: 'Choisissez un thème pour lire ou écrire ses notes.', en: 'Pick a theme to read or write its notes.' },
  thn_empty: { fr: 'Pas encore de notes.', en: 'No notes yet.' },
  thn_add: { fr: 'Écrire des notes', en: 'Write notes' },
  thn_edit: { fr: 'Modifier', en: 'Edit' },
  thn_save: { fr: 'Enregistrer', en: 'Save' },
  thn_cancel: { fr: 'Annuler', en: 'Cancel' },
  thn_placeholder: {
    fr: 'Sens, source, texte de travail… Le nom du thème reste court.',
    en: 'Meaning, source, working text… The theme name stays short.',
  },
  thn_saved: { fr: 'Notes enregistrées.', en: 'Notes saved.' },
  thn_too_long_fmt: { fr: 'Trop long ({count} caractères au plus).', en: 'Too long ({count} characters at most).' },
  thn_error_fmt: { fr: 'Les notes n’ont pas été enregistrées : {error}', en: 'Notes not saved: {error}' },
  thn_has_notes: { fr: 'Ce thème a des notes', en: 'This theme has notes' },
  thn_editing_fmt: { fr: 'Notes de « {name} »', en: 'Notes for “{name}”' },
})
