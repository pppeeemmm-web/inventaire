import { defineMessages } from '../message-core'

/** « Corriger » a machine-made or imported Journal entry (components/atelier/journal/EntryCorrection.tsx). */
export const journalCorrectMessages = defineMessages({
  je_fix_open_unverified: { fr: 'Vérifier · corriger', en: 'Check · correct' },
  je_fix_open: { fr: 'Corriger', en: 'Correct' },
  je_fix_save: { fr: 'Enregistrer la correction', en: 'Save the correction' },
  je_fix_ok: { fr: 'Le texte est juste', en: 'The text is right' },
  je_fix_cancel: { fr: 'Annuler', en: 'Cancel' },
  je_fix_unverify: { fr: 'Remettre non vérifiée', en: 'Mark unverified' },
  je_fix_hint: {
    fr: 'Le texte d’origine est gardé ; la correction s’affiche à sa place.',
    en: 'The original text is kept; the correction is shown in its place.',
  },
  je_fix_corrected: { fr: 'Corrigée', en: 'Corrected' },
  je_fix_show_original: { fr: 'voir le texte d’origine', en: 'show the original text' },
  je_fix_hide_original: { fr: 'masquer le texte d’origine', en: 'hide the original text' },
  je_fix_done: { fr: 'Correction enregistrée', en: 'Correction saved' },
})
