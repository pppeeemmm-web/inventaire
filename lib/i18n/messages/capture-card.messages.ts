import { defineMessages } from '../message-core'

/**
 * Business-card capture (`components/atelier/capture/CaptureCardClient.tsx`), Pem 2026-11-18:
 * Live Text is read at once by fixed rules (works outdoors, no AI); the AI is a separate, optional
 * step with a time limit; the card photo is shrunk on the phone and kept with the new contact
 * (Vault « Business »). Older labels stay in the legacy dict (`capture_card_*`).
 */
export const captureCardMessages = defineMessages({
  cc_intro: {
    fr: 'Live Text : touchez la case de texte, touchez-la encore, choisissez « Scanner le texte », visez la carte, « Insérer ». Puis « Analyser » : le contact se remplit tout de suite, sans IA.',
    en: 'Live Text: tap the text box, tap it again, choose « Scan Text », aim at the card, « Insert ». Then « Analyse »: the contact fills at once, no AI.',
  },
  cc_photo_kept: {
    fr: 'La photo est gardée avec le contact (Coffre › Business), pour une relecture plus tard.',
    en: 'The photo is kept with the contact (Vault › Business), to reread later.',
  },
  cc_need_text: {
    fr: 'Ajoutez le texte de la carte (Live Text) — ou essayez l’IA sur la photo.',
    en: 'Add the card’s text (Live Text) — or try the AI on the photo.',
  },
  cc_ai: { fr: 'Améliorer avec l’IA', en: 'Improve with AI' },
  cc_ai_busy: { fr: 'IA… (30 s max)', en: 'AI… (30 s max)' },
  cc_ai_note: {
    fr: 'Facultatif. Besoin du réseau et de l’IA de l’atelier ; sinon le contact reste tel quel.',
    en: 'Optional. Needs the network and the studio AI; otherwise the contact stays as it is.',
  },
  cc_ai_failed: {
    fr: 'IA indisponible — le contact reste tel quel.',
    en: 'AI unavailable — the contact stays as it is.',
  },
  cc_ai_done: { fr: 'Contact complété par l’IA.', en: 'Contact completed by the AI.' },
  cc_photo_not_saved: {
    fr: 'Contact créé, mais la photo n’a pas pu être gardée.',
    en: 'Contact created, but the photo could not be kept.',
  },
  cc_shrinking: { fr: 'Préparation de la photo…', en: 'Preparing the photo…' },
  // Pem 2026-11-18: « I captured a photo … nothing happened » — the photo alone is never read here.
  cc_photo_not_read: {
    fr: 'La photo seule n’est pas lue : ajoutez le texte avec Live Text ci-dessous, puis « Analyser ».',
    en: 'The photo alone is not read: add the text with Live Text below, then « Analyse ».',
  },
})
