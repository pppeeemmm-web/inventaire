import { defineMessages } from '../message-core'

/** Voice-note triage (Notes → Trier) and the linked-notes blocks on concepts, works and projects. */
export const notesTriageMessages = defineMessages({
  notes_triage_heading: { fr: 'Trier', en: 'Sort' },
  notes_triage_intro: {
    fr: 'Relier la note là où elle sert. Elle reste dans Notes ; rien n’est copié.',
    en: 'Link the note where it belongs. It stays in Notes; nothing is copied.',
  },
  notes_triage_to_sort_fmt: { fr: 'À trier ({n})', en: 'To sort ({n})' },
  notes_triage_all: { fr: 'Toutes', en: 'All' },
  notes_triage_unsorted_badge: { fr: 'à trier', en: 'to sort' },
  notes_triage_concept: { fr: 'Recherche', en: 'Research' },
  notes_triage_concept_ph: { fr: 'Choisir un concept…', en: 'Choose a concept…' },
  notes_triage_concept_new: { fr: '+ Nouveau concept', en: '+ New concept' },
  notes_triage_concept_new_ph: { fr: 'Titre du nouveau concept', en: 'New concept title' },
  notes_triage_work: { fr: 'Œuvre', en: 'Work' },
  notes_triage_work_ph: { fr: 'N° ou titre…', en: 'No. or title…' },
  notes_triage_process: { fr: 'Projet (Pipeline)', en: 'Project (Pipeline)' },
  notes_triage_process_ph: { fr: 'Choisir un projet…', en: 'Choose a project…' },
  notes_triage_reminder: { fr: 'Rappel daté (facultatif)', en: 'Dated reminder (optional)' },
  notes_triage_reminder_label_ph: { fr: 'Libellé du rappel', en: 'Reminder label' },
  notes_triage_reminder_add: { fr: 'Ajouter le rappel', en: 'Add reminder' },
  notes_triage_reminder_added: { fr: 'Rappel ajouté', en: 'Reminder added' },
  notes_triage_link: { fr: 'Relier', en: 'Link' },
  notes_triage_unlink: { fr: 'Délier', en: 'Unlink' },
  notes_triage_open: { fr: 'Ouvrir', en: 'Open' },
  notes_triage_keep: { fr: 'Garder comme note', en: 'Keep as a note' },
  notes_triage_back_to_sort: { fr: 'Remettre à trier', en: 'Back to sort' },
  notes_triage_sorted_fmt: { fr: 'Triée le {date}', en: 'Sorted on {date}' },
  notes_triage_saved: { fr: 'Note reliée', en: 'Note linked' },
  notes_triage_coming: {
    fr: 'Constats et R&D viendront ensuite.',
    en: 'Condition reports and R&D come next.',
  },
  linked_notes_title_fmt: { fr: 'Notes vocales ({n})', en: 'Voice notes ({n})' },
  linked_notes_untitled: { fr: 'Note sans titre', en: 'Untitled note' },
})
