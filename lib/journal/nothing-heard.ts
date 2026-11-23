/**
 * Placeholder texts of voice notes (never Pem's words; readers draw them, never show or copy them as text):
 * - NOTHING_HEARD: the PC heard nothing and there were no phone words (`scripts/transcribe/voice_batch.py`).
 *   Drawn as « Rien entendu » with « Écrire ce qui a été dit » (Pem 2026-11-22).
 * - WAITING_TRANSCRIPT: a voice note saved with no live words; its Journal entry exists at once (Pem
 *   2026-11-23) and waits for the PC's transcript, which arrives as a correction.
 */
export const NOTHING_HEARD = '(rien entendu)'
export const WAITING_TRANSCRIPT = '(transcription à venir)'

/** The text shown (latest correction folded in) is « rien entendu ». */
export function isNothingHeard(e: { body: string }): boolean {
  return e.body.trim() === NOTHING_HEARD
}

/** The text shown is still the waiting placeholder (no live words, no transcript yet). */
export function isWaitingTranscript(e: { body: string }): boolean {
  return e.body.trim() === WAITING_TRANSCRIPT
}

/** Any placeholder: not a transcript, not a memory, not a search hit. */
export function isPlaceholderText(text: string | null | undefined): boolean {
  const t = (text ?? '').trim()
  return t === NOTHING_HEARD || t === WAITING_TRANSCRIPT
}
