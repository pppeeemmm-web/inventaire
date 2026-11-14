/** DB + API allow-lists for `public.voice_note` (Verb 2). */
export const VOICE_NOTE_KINDS = ['memo', 'dictation', 'meeting', 'field'] as const
export type VoiceNoteKind = (typeof VOICE_NOTE_KINDS)[number]

export const VOICE_NOTE_BUCKETS = ['terrain', 'studio', 'commercial', 'general'] as const
export type VoiceNoteBucket = (typeof VOICE_NOTE_BUCKETS)[number]

export function parseVoiceNoteKind(raw: string | null | undefined): VoiceNoteKind | null {
  if (!raw) return null
  return (VOICE_NOTE_KINDS as readonly string[]).includes(raw) ? (raw as VoiceNoteKind) : null
}

export function parseVoiceNoteBucket(raw: string | null | undefined): VoiceNoteBucket | null {
  if (!raw) return null
  return (VOICE_NOTE_BUCKETS as readonly string[]).includes(raw) ? (raw as VoiceNoteBucket) : null
}

/** `m:ss` (or `h:mm:ss`). */
export function formatVoiceDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
