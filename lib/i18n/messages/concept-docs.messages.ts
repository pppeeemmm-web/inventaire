import { defineMessages } from '../message-core'

/** Concepts — attached documents: files (R2), links (Drive, Proton, web), local mentions. */
export const conceptDocsMessages = defineMessages({
  concept_docs_heading: {
    fr: 'Documents',
    en: 'Documents',
  },
  concept_docs_empty: {
    fr: 'Aucun document. Ajoutez un fichier, un lien ou l’emplacement d’un fichier sur votre ordinateur.',
    en: 'No documents. Add a file, a link, or where a file lives on your computer.',
  },
  concept_docs_add_file: {
    fr: '+ Fichier',
    en: '+ File',
  },
  concept_docs_add_link: {
    fr: '+ Lien',
    en: '+ Link',
  },
  concept_docs_add_local: {
    fr: '+ Emplacement local',
    en: '+ Local location',
  },
  concept_docs_attach: {
    fr: 'Depuis le coffre',
    en: 'From the vault',
  },
  concept_docs_attach_pick: {
    fr: 'Choisir un document du coffre…',
    en: 'Pick a vault document…',
  },
  concept_docs_name_ph: {
    fr: 'Nom (optionnel)',
    en: 'Name (optional)',
  },
  concept_docs_link_ph: {
    fr: 'https://drive.google.com/… ou https://drive.proton.me/…',
    en: 'https://drive.google.com/… or https://drive.proton.me/…',
  },
  concept_docs_local_ph: {
    fr: 'PC atelier — C:\\Recherche\\fichier.pdf',
    en: 'Studio PC — C:\\Research\\file.pdf',
  },
  concept_docs_local_hint: {
    fr: 'Un simple repère : le fichier reste sur cette machine, à ouvrir là-bas.',
    en: 'Just a pointer: the file stays on that machine, open it there.',
  },
  concept_docs_add: {
    fr: 'Ajouter',
    en: 'Add',
  },
  concept_docs_cancel: {
    fr: 'Annuler',
    en: 'Cancel',
  },
  concept_docs_open: {
    fr: 'Ouvrir',
    en: 'Open',
  },
  concept_docs_copy: {
    fr: 'Copier',
    en: 'Copy',
  },
  concept_docs_copied: {
    fr: 'Emplacement copié',
    en: 'Location copied',
  },
  concept_docs_detach: {
    fr: 'Détacher',
    en: 'Detach',
  },
  concept_docs_detach_title: {
    fr: 'Retirer du concept (le document reste dans le coffre)',
    en: 'Remove from this concept (the document stays in the vault)',
  },
  concept_docs_uploading: {
    fr: 'Envoi…',
    en: 'Uploading…',
  },
  concept_docs_added: {
    fr: 'Document ajouté',
    en: 'Document added',
  },
  concept_docs_direct_failed: {
    fr: 'Envoi direct impossible : le stockage n’accepte pas encore les gros fichiers. Ajoutez plutôt un lien.',
    en: 'Direct upload failed: storage does not accept large files yet. Add a link instead.',
  },
  concept_docs_kind_file: {
    fr: 'Fichier',
    en: 'File',
  },
  concept_docs_kind_link: {
    fr: 'Lien',
    en: 'Link',
  },
  concept_docs_kind_local: {
    fr: 'Local',
    en: 'Local',
  },
  vault_doc_concept: {
    fr: 'Concept',
    en: 'Concept',
  },
})
