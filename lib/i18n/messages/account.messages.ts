import { defineMessages } from '../message-core'

/** Sign out + change password (Atelier header, Hub). */
export const accountMessages = defineMessages({
  account_sign_out: { fr: 'Se déconnecter', en: 'Sign out' },
  account_signing_out: { fr: 'Déconnexion…', en: 'Signing out…' },
  account_change_password: { fr: 'Changer le mot de passe', en: 'Change password' },
  // Contact card over the work drawer (ContactQuickModal).
  cq_title: { fr: 'Fiche contact', en: 'Contact card' },
  cq_loading: { fr: 'Chargement du contact…', en: 'Loading contact…' },
  cq_not_found: { fr: 'Contact introuvable.', en: 'Contact not found.' },
  // `#1234` preview (WorkRef).
  wr_untitled: { fr: 'Sans titre', en: 'Untitled' },
  wr_not_found: { fr: 'Œuvre introuvable', en: 'Work not found' },
})
