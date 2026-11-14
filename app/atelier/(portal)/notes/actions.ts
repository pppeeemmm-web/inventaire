'use server'

import crypto from 'crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
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
const MAX_FOLLOW_UP_LABEL = 300

function allowedAudioMime(m: string): boolean {
  const x = m.toLowerCase().split(';')[0]?.trim() ?? ''
  return x === 'audio/webm' || x === 'audio/mp4' || x === 'audio/ogg'
}

async function rpcIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data } = await supabase.rpc('is_admin')
  return !!data
}

export type NotesActionErr = { error: string }
export type CreateVoiceNoteResult = { ok: true; id: string; followUpOk?: boolean }

export async function listVoiceNotes(limit = 200): Promise<{ rows: VoiceNoteRow[] } | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const lim = Math.min(Math.max(limit, 1), 500)
  const { data, error } = await voiceNoteTable(supabase)
    .select(
      'id, created_at, updated_at, user_id, kind, bucket, subject, transcript, audio_r2_key, audio_mime, duration_ms, oeuvre_id, process_id, sketchbook_id, concept_id, condition_report_id, routed_at',
    )
    .order('created_at', { ascending: false })
    .limit(lim)

  if (error) return { error: error.message }
  const rows: VoiceNoteRow[] = data ?? []
  return { rows }
}

export async function createVoiceNote(formData: FormData): Promise<CreateVoiceNoteResult | NotesActionErr> {
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

  // When the recording started (client clock): the note's date/time. Kept only when plausible
  // (last 24 h, not ahead of the server by more than 5 min); otherwise the DB default (now).
  const recordedAtRaw = (formData.get('recorded_at') as string | null)?.trim() || null
  let created_at: string | undefined
  if (recordedAtRaw) {
    const ts = new Date(recordedAtRaw).getTime()
    const now = Date.now()
    if (Number.isFinite(ts) && ts <= now + 5 * 60_000 && ts >= now - 24 * 60 * 60_000) {
      created_at = new Date(ts).toISOString()
    }
  }

  const id = crypto.randomUUID()
  let audio_r2_key: string | null = null

  if (audioBuf && audioMime) {
    const ext = audioMime.includes('mp4') ? 'm4a' : audioMime.includes('ogg') ? 'ogg' : 'webm'
    audio_r2_key = `voice-note/${id}/recording.${ext}`
    try {
      await r2PutObject(audioBuf, audio_r2_key, audioMime, {
        source: 'voice_note',
        classification: 'linked',
        linkedRefs: [{ table: 'voice_note', column: 'audio_r2_key', row_id: id }],
        uploadedBy: user.id,
        metadata: { kind, bucket, duration_ms },
      })
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
    ...(created_at ? { created_at } : {}),
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

  const followUpOk = await insertFollowUp(supabase, formData, subjectRaw)

  revalidatePath('/atelier')
  revalidatePath('/hub')
  revalidatePath('/atelier/field-inbox')
  return { ok: true, id, followUpOk }
}

/**
 * A follow-up is a reminder, not a studio-floor issue: it goes to `suivi_reminder`
 * (no pipeline process), which the Hub inbox and Pipeline's reminders panel list and dismiss.
 * `studio_task kind='field'` is for material issue reports and feeds Production's triage panel.
 * Returns `undefined` when the form asks for no follow-up.
 */
async function insertFollowUp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  subject: string | null,
): Promise<boolean | undefined> {
  // `suivi_reminder.remind_at` is a DATE: prefer the client's local calendar day
  // (`follow_up_date`), since slicing the UTC instant can land on the wrong day near midnight.
  const followUpDueRaw = (formData.get('follow_up_due') as string | null)?.trim() || null
  const followUpDateRaw = (formData.get('follow_up_date') as string | null)?.trim() || null
  const followUpLabelRaw = (formData.get('follow_up_label') as string | null)?.trim() || null
  let followUpDate: string | null = null
  if (followUpDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(followUpDateRaw)) {
    followUpDate = followUpDateRaw
  } else if (followUpDueRaw) {
    const d = new Date(followUpDueRaw)
    if (Number.isFinite(d.getTime())) followUpDate = d.toISOString().slice(0, 10)
  }
  if (!followUpDate) return undefined
  const message = (followUpLabelRaw || subject || 'Voice note follow-up').slice(0, MAX_FOLLOW_UP_LABEL)
  const { error: followUpError } = await supabase.from('suivi_reminder').insert({
    process_id: null,
    message,
    remind_at: followUpDate,
  })
  if (followUpError) {
    console.error('[voice note follow-up]', followUpError.message)
    return false
  }
  revalidateTag('reminders')
  return true
}

/**
 * Details added after the recording was saved (the phone sheet saves the audio first, then
 * asks for a title etc.). Only fields present in the form are written; same owner/admin rule
 * as the transcript edit. Optional follow-up as in `createVoiceNote`.
 */
export async function updateVoiceNoteDetails(
  id: string,
  formData: FormData,
): Promise<{ ok: true; followUpOk?: boolean } | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const { data: row, error: selErr } = await voiceNoteTable(supabase)
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()
  if (selErr || !row) return { error: 'not_found' }
  const r = row as { id: string; user_id: string }
  const admin = await rpcIsAdmin(supabase)
  if (r.user_id !== user.id && !admin) return { error: 'forbidden' }

  const patch: Record<string, unknown> = {}
  if (formData.has('kind')) {
    const kind = parseVoiceNoteKind(String(formData.get('kind') ?? ''))
    if (kind) patch.kind = kind
  }
  if (formData.has('bucket')) {
    const bucket = parseVoiceNoteBucket(String(formData.get('bucket') ?? ''))
    if (bucket) patch.bucket = bucket
  }
  if (formData.has('subject')) patch.subject = (formData.get('subject') as string | null)?.trim() || null
  if (formData.has('transcript')) {
    const tx = (formData.get('transcript') as string | null) ?? ''
    patch.transcript = tx.length > MAX_TRANSCRIPT ? tx.slice(0, MAX_TRANSCRIPT) : tx
  }
  if (formData.has('oeuvre_id')) {
    const raw = (formData.get('oeuvre_id') as string | null)?.trim()
    const n = raw ? parseInt(raw, 10) : NaN
    patch.oeuvre_id = Number.isFinite(n) && n > 0 ? n : null
  }

  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await voiceNoteTable(supabase).update(patch).eq('id', id)
    if (upErr) return { error: upErr.message }
  }

  const subject = typeof patch.subject === 'string' ? patch.subject : null
  const followUpOk = await insertFollowUp(supabase, formData, subject)

  revalidatePath('/atelier')
  revalidatePath('/hub')
  return { ok: true, followUpOk }
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

// ── Triage: route a note to a concept / work / pipeline project, or a dated reminder ──
// Link, never copy: the note stays in Notes; `routed_at` takes it out of "à trier".

export type NoteRouteTargets = {
  concepts: { id: string; titre: string; statut: string }[]
  processes: { id: string; nom: string; type: string | null; statut: string | null }[]
}

export async function listNoteRouteTargets(): Promise<NoteRouteTargets | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const [c, p] = await Promise.all([
    supabase.from('concept').select('id, titre, statut').order('updated_at', { ascending: false }).limit(500),
    supabase
      .from('suivi_process')
      .select('id, nom, type, statut')
      .order('updated_at', { ascending: false })
      .limit(500),
  ])
  if (c.error) return { error: c.error.message }
  if (p.error) return { error: p.error.message }
  return {
    concepts: (c.data ?? []) as NoteRouteTargets['concepts'],
    processes: (p.data ?? []) as NoteRouteTargets['processes'],
  }
}

export type VoiceNoteRoutePatch = {
  concept_id?: string | null
  /** Creates a concept with this title and links the note to it. */
  new_concept_title?: string
  oeuvre_id?: number | null
  process_id?: string | null
  /** Opt-in dated reminder (`suivi_reminder`), never set by default. */
  reminder?: { date: string; label: string }
  /** Creates a constat on the note's work (transcript as its notes) and links the note to it. */
  new_condition_report?: boolean
  /** null = unlink the constat (the constat itself stays). */
  condition_report_id?: null
  /** true = mark sorted, false = put back in "à trier". Any link also marks it sorted. */
  routed?: boolean
}

export type RouteVoiceNoteResult = {
  ok: true
  row: Pick<VoiceNoteRow, 'id' | 'concept_id' | 'oeuvre_id' | 'process_id' | 'condition_report_id' | 'routed_at'>
  createdConcept?: { id: string; titre: string; statut: string }
}

export async function routeVoiceNote(
  id: string,
  patch: VoiceNoteRoutePatch,
): Promise<RouteVoiceNoteResult | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const { data: row, error: selErr } = await voiceNoteTable(supabase)
    .select('id, user_id, subject, transcript, oeuvre_id')
    .eq('id', id)
    .maybeSingle()
  if (selErr || !row) return { error: 'not_found' }
  const r = row as { id: string; user_id: string; subject: string | null; transcript: string | null; oeuvre_id: number | null }
  const admin = await rpcIsAdmin(supabase)
  if (r.user_id !== user.id && !admin) return { error: 'forbidden' }

  const update: Record<string, unknown> = {}
  let createdConcept: RouteVoiceNoteResult['createdConcept']

  const newTitle = patch.new_concept_title?.trim()
  if (newTitle) {
    const { data: c, error: cErr } = await supabase
      .from('concept')
      .insert({ titre: newTitle.slice(0, 200), statut: 'idee', category: 'artistic' })
      .select('id, titre, statut')
      .single()
    if (cErr || !c) return { error: cErr?.message ?? 'concept_insert' }
    createdConcept = c as { id: string; titre: string; statut: string }
    update.concept_id = createdConcept.id
  } else if (patch.concept_id !== undefined) {
    update.concept_id = patch.concept_id
  }
  if (patch.oeuvre_id !== undefined) update.oeuvre_id = patch.oeuvre_id
  if (patch.process_id !== undefined) update.process_id = patch.process_id
  if (patch.condition_report_id === null) update.condition_report_id = null

  if (patch.new_condition_report) {
    const workId = (update.oeuvre_id as number | null | undefined) ?? r.oeuvre_id
    if (workId == null) return { error: 'no_work' }
    const notes = [r.subject?.trim(), r.transcript?.trim()].filter(Boolean).join('\n\n').slice(0, 20_000) || null
    const { data: rep, error: repErr } = await supabase
      .from('condition_report')
      .insert({ oeuvre_id: workId, author_id: user.id, notes })
      .select('id')
      .single()
    if (repErr || !rep) return { error: repErr?.message ?? 'constat_insert' }
    update.condition_report_id = rep.id
  }

  if (patch.reminder) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.reminder.date)) return { error: 'bad_date' }
    const message = (patch.reminder.label.trim() || r.subject?.trim() || 'Note').slice(0, MAX_FOLLOW_UP_LABEL)
    const { error: remErr } = await supabase.from('suivi_reminder').insert({
      process_id: (update.process_id as string | null | undefined) ?? null,
      message,
      remind_at: patch.reminder.date,
    })
    if (remErr) return { error: remErr.message }
    revalidateTag('reminders')
  }

  const linked = Object.values(update).some((v) => v != null) || !!patch.reminder
  if (patch.routed === false) update.routed_at = null
  else if (patch.routed === true || linked) update.routed_at = new Date().toISOString()

  const { data: saved, error: upErr } = await voiceNoteTable(supabase)
    .update(update)
    .eq('id', id)
    .select('id, concept_id, oeuvre_id, process_id, condition_report_id, routed_at')
    .single()
  if (upErr || !saved) return { error: upErr?.message ?? 'update' }

  revalidatePath('/atelier')
  return { ok: true, row: saved as RouteVoiceNoteResult['row'], createdConcept }
}

export type LinkedVoiceNote = Pick<VoiceNoteRow, 'id' | 'created_at' | 'subject' | 'transcript' | 'duration_ms'>

/** Notes routed to a concept, a work or a pipeline project (RLS: own notes, or all for admin). */
export async function listLinkedVoiceNotes(
  field: 'concept_id' | 'oeuvre_id' | 'process_id',
  value: string | number,
): Promise<LinkedVoiceNote[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await voiceNoteTable(supabase)
    .select('id, created_at, subject, transcript, duration_ms')
    .eq(field, value)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.error('[listLinkedVoiceNotes]', error.message)
    return []
  }
  return (data ?? []) as LinkedVoiceNote[]
}
