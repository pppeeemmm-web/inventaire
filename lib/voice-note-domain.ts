/** Voice notes (Verb 2). Kind / project tags are no longer asked (R1 step 7: a voice note is a Journal
 *  entry); stored `voice_note.kind` / `bucket` values stay as they are. */

/** `m:ss` (or `h:mm:ss`). */
export function formatVoiceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
