'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { r2PutObject } from '@/lib/r2-s3-object'
import type { VoiceNoteRow } from '@/lib/types/database'
import {
  parseVoiceNoteBucket,
  parseVoiceNoteKind,
  type VoiceNoteBucket,
  type VoiceNoteKind,
} from '@/lib/voice-note-domain'

function voiceNoteTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  return (supabase as { from: (name: string) => ReturnType<Awaited<ReturnType<typeof createClient>>['from']> }).from(
    'voice_note',
  )
}

const MAX_TRANSCRIPT = 100_000
const MAX_AUDIO_BYTES = 20 * 1024 * 1024

function allowedAudioMime(m: string): boolean {
  const x = m.toLowerCase().split(';')[0]?.trim() ?? ''
  return x === 'audio/webm' || x === 'audio/mp4' || x === 'audio/ogg'
}

async function rpcIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin')
  return !!data
}

export type NotesActionErr = { error: string }

export async function listVoiceNotes(limit = 200): Promise<{ rows: VoiceNoteRow[] } | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const lim = Math.min(Math.max(limit, 1), 500)
  const { data, error } = await voiceNoteTable(supabase)
    .select(
      'id, created_at, updated_at, user_id, kind, bucket, subject, transcript, audio_r2_key, audio_mime, duration_ms, oeuvre_id, process_id, sketchbook_id',
    )
    .order('created_at', { ascending: false })
    .limit(lim)

  if (error) return { error: error.message }
  const rows = (data ?? []) as unknown as VoiceNoteRow[]
  return { rows }
}

export async function createVoiceNote(formData: FormData): Promise<{ ok: true; id: string } | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const kind = parseVoiceNoteKind(String(formData.get('kind') ?? '')) ?? ('memo' as VoiceNoteKind)
  const bucket = parseVoiceNoteBucket(String(formData.get('bucket') ?? '')) ?? ('general' as VoiceNoteBucket)
  const subjectRaw = (formData.get('subject') as string | null)?.trim() || null
  const transcriptRaw = (formData.get('transcript') as string | null) ?? ''
  const transcript = transcriptRaw.length > MAX_TRANSCRIPT ? transcriptRaw.slice(0, MAX_TRANSCRIPT) : transcriptRaw

  const oeuvreRaw = (formData.get('oeuvre_id') as string | null)?.trim()
  let oeuvre_id: number | null = null
  if (oeuvreRaw) {
    const n = parseInt(oeuvreRaw, 10)
    if (Number.isFinite(n) && n > 0) oeuvre_id = n
  }

  const file = formData.get('audio') as File | null
  let audioBuf: Buffer | null = null
  let audioMime: string | null = null
  if (file && file.size > 0) {
    if (file.size > MAX_AUDIO_BYTES) return { error: 'audio_too_large' }
    audioMime = file.type || 'audio/webm'
    if (!allowedAudioMime(audioMime)) return { error: 'audio_mime' }
    audioBuf = Buffer.from(await file.arrayBuffer())
  }

  const durationRaw = (formData.get('duration_ms') as string | null)?.trim()
  let duration_ms: number | null = null
  if (durationRaw) {
    const d = parseInt(durationRaw, 10)
    if (Number.isFinite(d) && d >= 0 && d < 24 * 60 * 60 * 1000) duration_ms = d
  }

  const id = crypto.randomUUID()
  let audio_r2_key: string | null = null

  if (audioBuf && audioMime) {
    const ext = audioMime.includes('mp4') ? 'm4a' : audioMime.includes('ogg') ? 'ogg' : 'webm'
    audio_r2_key = `voice-note/${id}/recording.${ext}`
    try {
      await r2PutObject(audioBuf, audio_r2_key, audioMime)
    } catch (e) {
      return { error: String(e) }
    }
  }

  const { error } = await voiceNoteTable(supabase).insert({
    id,
    user_id: user.id,
    kind,
    bucket,
    subject: subjectRaw,
    transcript,
    audio_r2_key,
    audio_mime: audio_r2_key ? audioMime : null,
    duration_ms,
    oeuvre_id,
  })

  if (error) {
    if (audio_r2_key) {
      try {
        const { r2DeleteObject } = await import('@/lib/r2-s3-object')
        await r2DeleteObject(audio_r2_key)
      } catch {
        /* best-effort */
      }
    }
    return { error: error.message }
  }

  revalidatePath('/atelier')
  return { ok: true, id }
}

export async function updateVoiceNoteTranscript(
  id: string,
  transcript: string,
): Promise<{ ok: true } | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const text = transcript.length > MAX_TRANSCRIPT ? transcript.slice(0, MAX_TRANSCRIPT) : transcript

  const { data: row, error: selErr } = await voiceNoteTable(supabase)
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (selErr || !row) return { error: 'not_found' }

  const r = row as { id: string; user_id: string }
  const admin = await rpcIsAdmin(supabase)
  if (r.user_id !== user.id && !admin) return { error: 'forbidden' }

  const { error: upErr } = await voiceNoteTable(supabase).update({ transcript: text }).eq('id', id)
  if (upErr) return { error: upErr.message }
  revalidatePath('/atelier')
  return { ok: true }
}

export async function deleteVoiceNote(id: string): Promise<{ ok: true } | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const { data: row, error: selErr } = await voiceNoteTable(supabase)
    .select('id, user_id, audio_r2_key')
    .eq('id', id)
    .maybeSingle()
  if (selErr || !row) return { error: 'not_found' }

  const r = row as { id: string; user_id: string; audio_r2_key: string | null }
  const admin = await rpcIsAdmin(supabase)
  if (r.user_id !== user.id && !admin) return { error: 'forbidden' }

  const { error: delErr } = await voiceNoteTable(supabase).delete().eq('id', id)
  if (delErr) return { error: delErr.message }

  if (r.audio_r2_key) {
    try {
      const { r2DeleteObject } = await import('@/lib/r2-s3-object')
      await r2DeleteObject(r.audio_r2_key)
    } catch {
      /* best-effort */
    }
  }

  revalidatePath('/atelier')
  return { ok: true }
}
