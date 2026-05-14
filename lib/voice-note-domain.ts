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
