import { defineMessages } from '../message-core'

/** Public site (R8 first batch): caption medium, enquiry reasons, Instagram, social preview alt. */
export const publicSiteMessages = defineMessages({
  pub_medium_board: { fr: 'Carton', en: 'Board' },
  pub_medium_canson: { fr: 'Papier Canson', en: 'Canson paper' },
  pub_medium_canvas: { fr: 'Toile', en: 'Canvas' },
  pub_medium_rhodia: { fr: 'Papier Rhodia', en: 'Rhodia paper' },
  pub_medium_yupo: { fr: 'Papier Yupo', en: 'Yupo paper' },
  pub_medium_oil_paper: { fr: 'Papier huile', en: 'Oil paper' },
  pub_medium_paper: { fr: 'Papier', en: 'Paper' },
  pub_medium_aluminium: { fr: 'Aluminium', en: 'Aluminium' },
  pub_medium_gold_paper: { fr: 'Papier doré', en: 'Gold paper' },
  pub_medium_silver_paper: { fr: 'Papier argenté', en: 'Silver paper' },
  pub_medium_photo_paper: { fr: 'Papier photo', en: 'Photo paper' },
  pub_medium_kraft: { fr: 'Papier kraft', en: 'Kraft paper' },
  pub_medium_transparent_paper: { fr: 'Papier transparent', en: 'Transparent paper' },
  pub_medium_wood: { fr: 'Bois', en: 'Wood' },
  pub_medium_round_canvas: { fr: 'Toile ronde', en: 'Round canvas' },
  pub_medium_round_paper: { fr: 'Papier rond', en: 'Round paper' },
  pub_medium_round_board: { fr: 'Carton rond', en: 'Round board' },
  pub_medium_japanese_paper: { fr: 'Papier japonais', en: 'Japanese paper' },
  pub_medium_print_offset: { fr: 'Gravure / offset photo', en: 'Print / photo offset' },

  enquiry_reason_buy: { fr: 'Acquérir une œuvre', en: 'Buy a work' },
  enquiry_reason_commission: { fr: 'Commande', en: 'Commission' },
  enquiry_reason_show: { fr: 'Exposition', en: 'Exhibition' },
  enquiry_reason_press: { fr: 'Presse', en: 'Press' },
  /** First line of the stored message for reasons the `inquiry.category` check does not list yet. */
  enquiry_reason_message_prefix: { fr: 'Motif : {reason}', en: 'Topic: {reason}' },
  enquiry_kicker_instagram: { fr: 'INSTAGRAM', en: 'INSTAGRAM' },

  pub_og_image_alt: { fr: 'Une œuvre de l’atelier', en: 'A work from the studio' },

  // Audience counting opt-out (legal A.2 n° 5): footer link until the cookie page exists.
  pub_count_optout: { fr: 'Ne pas être compté·e', en: 'Don’t count me' },
  pub_count_optout_title: {
    fr: 'Le site compte les visites pour lui seul, sans cookie publicitaire. Ce lien arrête le comptage dans ce navigateur.',
    en: 'The site counts visits for itself only, with no advertising cookie. This link stops the counting in this browser.',
  },
  pub_count_optout_on: { fr: 'Visites non comptées · Annuler', en: 'Visits not counted · Undo' },
  pub_count_optout_on_title: {
    fr: 'Ce navigateur n’est pas compté. Cliquer pour être compté·e à nouveau.',
    en: 'This browser is not counted. Click to be counted again.',
  },
})
