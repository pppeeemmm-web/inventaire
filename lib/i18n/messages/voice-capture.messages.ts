import { defineMessages } from '../message-core'

/**
 * Voice-note capture sheet (`components/shared/VoiceNoteSheet.tsx`): record first, saved at
 * once on stop, details after (Pem 2026-11-14). Older field labels stay in the legacy dict
 * (`voice_*`).
 */
export const voiceCaptureMessages = defineMessages({
  vc_title: { fr: 'Note vocale', en: 'Voice note' },
  vc_close: { fr: 'Fermer', en: 'Close' },

  // Starting / permission
  vc_starting: { fr: 'Ouverture du micro…', en: 'Opening the microphone…' },
  vc_perm_hint: {
    fr: 'Le téléphone va demander l’accès au micro : touchez « Autoriser ». La réponse est gardée pour ce site.',
    en: 'The phone will ask for the microphone: tap « Allow ». The answer is kept for this site.',
  },
  vc_perm_why_title: { fr: 'Le micro « toujours autorisé » ?', en: 'Microphone « always allowed »?' },
  vc_perm_why_body: {
    fr: 'C’est le téléphone qui décide, pas l’app : aucune page web ne peut s’autoriser le micro pour toujours. Sur iPhone, l’accord est gardé pour thepemworkshop.com ; Safari ou l’app de l’écran d’accueil peuvent tout de même redemander après un redémarrage. Pour ne plus voir la question : Réglages › Apps › Safari › Microphone (Réglages › Safari sur iOS plus ancien) → « Autoriser ». L’app demande le micro seulement quand vous ouvrez une note vocale.',
    en: 'The phone decides, not the app: no web page can grant itself the microphone for good. On iPhone the answer is kept for thepemworkshop.com; Safari or the home-screen app may still ask again after a restart. To stop the question: Settings › Apps › Safari › Microphone (Settings › Safari on older iOS) → « Allow ». The app asks for the microphone only when you open a voice note.',
  },

  // Recording
  vc_recording: { fr: 'Enregistrement', en: 'Recording' },
  vc_stop_save: { fr: 'Arrêter et enregistrer', en: 'Stop and save' },
  vc_level_aria: { fr: 'Niveau du micro', en: 'Microphone level' },
  vc_bytes_fmt: { fr: '{kb} Ko reçus du micro', en: '{kb} KB received from the mic' },
  vc_no_data: {
    fr: 'Rien ne vient du micro pour l’instant…',
    en: 'Nothing coming from the microphone yet…',
  },
  vc_lock_hint: {
    fr: 'Gardez l’écran allumé : si le téléphone se verrouille, la note s’arrête et elle est enregistrée telle quelle.',
    en: 'Keep the screen on: if the phone locks, the note stops and is saved as it is.',
  },
  vc_cancel: { fr: 'Annuler', en: 'Cancel' },
  vc_discard_confirm: { fr: 'Jeter cet enregistrement ?', en: 'Throw this recording away?' },
  vc_discard_yes: { fr: 'Jeter', en: 'Throw away' },
  vc_keep_recording: { fr: 'Continuer', en: 'Keep recording' },

  // Saving / saved
  vc_saving: { fr: 'Envoi de la note…', en: 'Saving the note…' },
  vc_saved_fmt: { fr: 'Enregistrée · {d}', en: 'Saved · {d}' },
  vc_saved_text: { fr: 'Note enregistrée', en: 'Note saved' },
  vc_saved_where_fmt: { fr: '{when} · dans Notes', en: '{when} · in Notes' },
  vc_stopped_hidden: {
    fr: 'Arrêtée quand l’écran s’est éteint ou que l’app est passée en arrière-plan.',
    en: 'Stopped when the screen went off or the app went to the background.',
  },
  vc_stopped_size: {
    fr: 'Arrêtée à la taille maximale d’un envoi depuis le téléphone. Lancez une nouvelle note pour continuer.',
    en: 'Stopped at the largest size the phone can send at once. Start a new note to carry on.',
  },
  vc_details_heading: { fr: 'Détails (facultatif)', en: 'Details (optional)' },
  vc_done: { fr: 'Terminé', en: 'Done' },
  vc_new_note: { fr: 'Nouvelle note', en: 'New note' },
  vc_details_saved: { fr: 'Détails enregistrés', en: 'Details saved' },
  vc_details_failed: {
    fr: 'Détails non enregistrés — la note, elle, est bien enregistrée.',
    en: 'Details not saved — the note itself is saved.',
  },

  // Failed
  vc_failed_title: { fr: 'Pas enregistrée', en: 'Not saved' },
  vc_err_offline: { fr: 'Pas de réseau.', en: 'No network.' },
  vc_err_network: {
    fr: 'L’envoi n’a pas abouti (réseau ou serveur).',
    en: 'The upload did not go through (network or server).',
  },
  vc_err_server: { fr: 'Le serveur a refusé la note.', en: 'The server refused the note.' },
  vc_err_empty: {
    fr: 'Rien n’a été enregistré : le micro n’a envoyé aucun son.',
    en: 'Nothing was recorded: the microphone sent no sound.',
  },
  vc_err_recorder: {
    fr: 'L’enregistreur s’est arrêté sur une erreur.',
    en: 'The recorder stopped with an error.',
  },
  vc_failed_keep: {
    fr: 'L’enregistrement reste sur ce téléphone tant que cette fenêtre reste ouverte.',
    en: 'The recording stays on this phone while this window stays open.',
  },
  vc_retry_upload: { fr: 'Réessayer l’envoi', en: 'Retry saving' },
  vc_record_again: { fr: 'Réenregistrer', en: 'Record again' },
  vc_close_lose_confirm: {
    fr: 'Cet enregistrement n’est pas enregistré. Fermer et le perdre ?',
    en: 'This recording is not saved. Close and lose it?',
  },
  vc_close_anyway: { fr: 'Fermer et perdre', en: 'Close and lose it' },

  // Microphone blocked
  vc_blocked_title: { fr: 'Micro non disponible', en: 'Microphone not available' },
  vc_mic_denied_ios: {
    fr: 'Le micro est refusé pour ce site. Sur iPhone : Réglages › Apps › Safari › Microphone (Réglages › Safari sur iOS plus ancien) → « Demander » ou « Autoriser ». Dans Safari, aA › Réglages du site web › Microphone règle ce seul site. Revenez ensuite et touchez Réessayer.',
    en: 'The microphone is refused for this site. On iPhone: Settings › Apps › Safari › Microphone (Settings › Safari on older iOS) → « Ask » or « Allow ». In Safari, aA › Website Settings › Microphone sets this site only. Then come back and tap Retry.',
  },
  vc_mic_denied_other: {
    fr: 'Le micro est refusé pour ce site. Autorisez-le dans les réglages du navigateur (l’icône à gauche de l’adresse), puis touchez Réessayer.',
    en: 'The microphone is refused for this site. Allow it in the browser settings (the icon left of the address), then tap Retry.',
  },
  vc_mic_no_device: { fr: 'Aucun micro trouvé sur cet appareil.', en: 'No microphone found on this device.' },
  vc_mic_busy: {
    fr: 'Le micro est occupé (un appel, une autre app ?). Libérez-le, puis Réessayer.',
    en: 'The microphone is busy (a call, another app?). Free it, then Retry.',
  },
  vc_mic_insecure: {
    fr: 'Le micro ne marche que sur une adresse https (ou localhost).',
    en: 'The microphone only works on an https address (or localhost).',
  },
  vc_mic_unsupported: {
    fr: 'Ce navigateur ne sait pas enregistrer le son.',
    en: 'This browser cannot record sound.',
  },
  vc_mic_other: { fr: 'Le micro n’a pas pu démarrer.', en: 'The microphone could not start.' },
  vc_retry: { fr: 'Réessayer', en: 'Retry' },
  vc_write_instead: { fr: 'Écrire une note', en: 'Write a note' },

  // Text note (no audio)
  vc_record_instead: { fr: 'Enregistrer au micro', en: 'Record with the mic' },
  vc_save_text: { fr: 'Enregistrer la note', en: 'Save the note' },
  vc_text_offline: {
    fr: 'Pas de réseau : le texte reste sur ce téléphone. Réessayez une fois connecté.',
    en: 'No network: the text stays on this phone. Try again once connected.',
  },

  // Notes list
  vc_row_audio_fmt: { fr: 'Audio {d}', en: 'Audio {d}' },
  vc_row_text_only: { fr: 'texte seul', en: 'text only' },
})
