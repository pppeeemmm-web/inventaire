import { defineMessages } from '../message-core'

/** Links between people and « interested in » works, on the person page (People.md §4c). */
export const personLinksMessages = defineMessages({
  pl_title: { fr: 'Relations', en: 'Relations' },
  pl_loading: { fr: 'Chargement…', en: 'Loading…' },
  pl_err: { fr: 'Lecture impossible', en: 'Could not load' },
  pl_none: { fr: 'Aucune relation encore', en: 'No relations yet' },
  pl_interested: { fr: 'Intéressé·e par', en: 'Interested in' },
  pl_add: { fr: '+ Lien', en: '+ Link' },
  pl_remove: { fr: 'Retirer', en: 'Remove' },
  pl_save: { fr: 'Enregistrer', en: 'Save' },
  pl_cancel: { fr: 'Annuler', en: 'Cancel' },
  pl_work_open_fmt: { fr: 'Ouvrir l’œuvre {id}', en: 'Open work {id}' },

  pl_s_introduced_out: { fr: 'a présenté {name}', en: 'introduced {name}' },
  pl_s_introduced_in: { fr: 'présenté·e par {name}', en: 'introduced by {name}' },
  pl_s_spouse: { fr: 'conjoint·e de {name}', en: 'spouse of {name}' },
  pl_s_works_at_out: { fr: 'travaille chez {name}', en: 'works at {name}' },
  pl_s_works_at_in: { fr: '{name} y travaille', en: '{name} works here' },
  pl_s_advises_out: { fr: 'conseille {name}', en: 'advises {name}' },
  pl_s_advises_in: { fr: 'conseillé·e par {name}', en: 'advised by {name}' },
  pl_s_works_with: { fr: 'travaille avec {name}', en: 'works with {name}' },

  pl_kind_label: { fr: 'Type de lien', en: 'Kind of link' },
  pl_kind_introduced: { fr: 'a présenté', en: 'introduced' },
  pl_kind_spouse: { fr: 'conjoint·e', en: 'spouse' },
  pl_kind_works_at: { fr: 'travaille chez', en: 'works at' },
  pl_kind_advises: { fr: 'conseille', en: 'advises' },
  pl_kind_works_with: { fr: 'travaille avec', en: 'works with' },
  pl_kind_interested_in: { fr: 'intéressé·e par une œuvre', en: 'interested in a work' },

  pl_search_person: { fr: 'Chercher une personne…', en: 'Search a person…' },
  pl_search_work: { fr: 'Chercher une œuvre…', en: 'Search a work…' },
  pl_picked: { fr: 'Choisi', en: 'Chosen' },
  pl_dir_out: { fr: 'cette personne → autre', en: 'this person → other' },
  pl_dir_in: { fr: 'autre → cette personne', en: 'other → this person' },

  pl_src_label: { fr: 'Source', en: 'Source' },
  pl_src_pick: { fr: 'Choisir…', en: 'Choose…' },
  pl_src_kit: { fr: 'kit', en: 'kit' },
  pl_src_visit: { fr: 'visite', en: 'visit' },
  pl_src_meeting: { fr: 'rencontre', en: 'meeting' },
  pl_src_call: { fr: 'appel', en: 'call' },
  pl_src_event: { fr: 'événement', en: 'event' },
  pl_src_enquiry: { fr: 'demande', en: 'enquiry' },
  pl_src_said: { fr: 'noté', en: 'noted' },
  pl_note: { fr: 'Note courte (facultatif)', en: 'Short note (optional)' },

  pl_refused_forbidden: { fr: 'Refusé : droits insuffisants.', en: 'Refused: not allowed.' },
  pl_refused_not_found: { fr: 'Refusé : fiche ou œuvre introuvable.', en: 'Refused: card or work not found.' },
  pl_refused_bad_field: { fr: 'Refusé : le lien n’est pas valide.', en: 'Refused: the link is not valid.' },
  pl_refused_error: { fr: 'Erreur : rien n’a été enregistré.', en: 'Error: nothing was saved.' },
})
