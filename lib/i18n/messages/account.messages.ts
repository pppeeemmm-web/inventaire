import { defineMessages } from '../message-core'

/** Small shared copy of the 2026-11-13 batch: sign out / password, contact pop-up, WorkRef, Production drag. */
export const accountMessages = defineMessages({
  account_sign_out: { fr: 'Se déconnecter', en: 'Sign out' },
  account_signing_out: { fr: 'Déconnexion…', en: 'Signing out…' },
  account_change_password: { fr: 'Changer le mot de passe', en: 'Change password' },
  // Contact card over the work drawer (ContactQuickModal).
  cq_title: { fr: 'Fiche contact', en: 'Contact card' },
  cq_loading: { fr: 'Chargement du contact…', en: 'Loading contact…' },
  cq_not_found: { fr: 'Contact introuvable.', en: 'Contact not found.' },
  // Production board drag-back (Production.tsx).
  prod_drag_forward_tick: {
    fr: 'Vers Photographie : utilisez ✓ sur la carte (avancer passe par ✓).',
    en: 'To Photography: use ✓ on the card (moving forward goes through ✓).',
  },
  // `#1234` preview (WorkRef).
  wr_untitled: { fr: 'Sans titre', en: 'Untitled' },
  wr_not_found: { fr: 'Œuvre introuvable', en: 'Work not found' },
})
