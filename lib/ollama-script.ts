/**
 * Instructions sent to Ollama as one user message (edit here).
 * Imported by both the server action and the Contacts URL modal for display.
 */
export const OLLAMA_SCRIPT_INSTRUCTIONS = [
  'Tu es un assistant interne pour une base contacts CRM / galerie.',
  '1) Confirme en une phrase que tu réponds bien depuis le script Atelier.',
  '2) En 2–3 phrases en français, explique pourquoi extraire site web et métadonnées (JSON-LD, Open Graph) depuis la page d’un lieu d’art est utile avant saisie manuelle.',
  '3) Termine par une ligne « OK · script » si tout est clair.',
].join('\n')
