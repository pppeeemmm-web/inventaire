'use server'

import { WAITING_TRANSCRIPT, isPlaceholderText } from '@/lib/journal/nothing-heard'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import crypto from 'crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { r2PutObject } from '@/lib/r2-s3-object'
import type { VoiceNoteRow } from '@/lib/types/database'

// Voice notes are Journal entries (R1 step 7): nobody picks a kind / project any more. New notes get the
// old defaults; stored values on older notes are kept, never rewritten.
const DEFAULT_KIND = 'memo'
const DEFAULT_BUCKET = 'general'

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

/** PC transcript of an audio note: `scripts/transcribe/voice_batch.py` writes it as a Journal entry
 *  (`journal_entry.voice_note_id`) and leaves `voice_note.transcript` empty (TODO B1). */
export type MachineTranscript = { body: string; engine: string | null; verification: string }

async function machineTranscripts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Map<string, MachineTranscript>> {
  const out = new Map<string, MachineTranscript>()
  if (ids.length === 0) return out
  const { data, error } = await supabase
    .from('journal_entry')
    .select('voice_note_id, body, engine, verification, created_at')
    .in('voice_note_id', ids)
    .is('hidden_at', null)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[machineTranscripts]', error.message)
    return out
  }
  for (const r of data ?? []) {
    // « (rien entendu) » / « (transcription à venir) » are placeholders, not transcripts: never shown or copied.
    if (!r.voice_note_id || out.has(r.voice_note_id) || !r.body?.trim() || isPlaceholderText(r.body)) continue
    out.set(r.voice_note_id, { body: r.body, engine: r.engine, verification: r.verification })
  }
  return out
}

export async function createVoiceNote(formData: FormData): Promise<CreateVoiceNoteResult | NotesActionErr> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const kind = DEFAULT_KIND
  const bucket = DEFAULT_BUCKET
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

  // One-time id from the phone (lib/mobile/capture-queue.ts): it becomes the note's id, so a resend after
  // a lost answer finds the note already saved and writes nothing twice.
  const clientIdRaw = String(formData.get('client_id') ?? '').trim()
  const clientId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientIdRaw) ? clientIdRaw.toLowerCase() : null
  if (clientId) {
    const { data: already } = await voiceNoteTable(supabase).select('id').eq('id', clientId).maybeSingle()
    if (already) return { ok: true, id: clientId, followUpOk: true }
  }

  // When the recording started (client clock): the note's date/time. Kept only when plausible (last 24 h;
  // 14 days for a note that waited on the phone with no network; not ahead of the server by more than
  // 5 min); otherwise the DB default (now).
  const recordedAtRaw = (formData.get('recorded_at') as string | null)?.trim() || null
  let created_at: string | undefined
  if (recordedAtRaw) {
    const ts = new Date(recordedAtRaw).getTime()
    const now = Date.now()
    const back = (clientId ? 14 * 24 : 24) * 60 * 60_000
    if (Number.isFinite(ts) && ts <= now + 5 * 60_000 && ts >= now - back) {
      created_at = new Date(ts).toISOString()
    }
  }

  const id = clientId ?? crypto.randomUUID()
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

  // Two sends of the same one-time id at once: the other one saved it (same audio key) — not an error.
  if (error && clientId && error.code === '23505') return { ok: true, id, followUpOk: true }
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

  // The Journal entry, at once (Pem 2026-11-23): a recording becomes a Journal note the moment it is saved,
  // with the words the phone heard (or a placeholder until the PC transcribes; its transcript then arrives
  // as a correction of this entry). A typed note (no audio) is a typed entry. A failure here keeps the
  // voice note: the PC transcript then creates the entry as before.
  await addVoiceNoteEntry(supabase, {
    noteId: id,
    userId: user.id,
    text: transcript,
    hasAudio: !!audio_r2_key,
    createdAt: created_at ?? new Date().toISOString(),
  })

  const followUpOk = await insertFollowUp(supabase, formData, subjectRaw)

  revalidatePath('/atelier')
  revalidatePath('/hub')
  revalidatePath('/atelier/field-inbox')
  return { ok: true, id, followUpOk }
}

async function correctVoiceNoteEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  noteId: string,
  userId: string,
  text: string,
): Promise<{ ok: true } | { error: string }> {
  const { data: rows, error } = await supabase
    .from('journal_entry')
    .select('id, kind, event_on, event_precision, body, corrects_id, created_at, hidden_at')
    .eq('voice_note_id', noteId)
    .order('created_at', { ascending: true })
  if (error) return { error: error.message }
  const root = (rows ?? []).find((r) => r.corrects_id == null)
  if (!root) return { ok: true }
  const latest = [...(rows ?? [])].filter((r) => r.corrects_id === root.id && !r.hidden_at).pop()
  if ((latest?.body ?? root.body).trim() === text) return { ok: true }
  const { error: insErr } = await supabase.from('journal_entry').insert({
    kind: root.kind,
    body: text.slice(0, 20_000),
    event_on: root.event_on,
    event_precision: root.event_precision,
    author_id: userId,
    provenance: 'typed',
    verification: 'verified',
    corrects_id: root.id,
    voice_note_id: noteId,
    ai_links_at: new Date().toISOString(),
  })
  return insErr ? { error: insErr.message } : { ok: true }
}

/** Engine name of an entry written from the phone's live words (the PC script skips none: it corrects it). */
const PHONE_ENGINE = 'téléphone (mots en direct)'

async function addVoiceNoteEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  v: { noteId: string; userId: string; text: string; hasAudio: boolean; createdAt: string },
): Promise<void> {
  const words = v.text.trim().slice(0, 20_000)
  if (!words && !v.hasAudio) return
  const { error } = await supabase.from('journal_entry').insert({
    kind: v.hasAudio ? 'voice' : 'note',
    body: words || WAITING_TRANSCRIPT,
    event_on: calendarDayInParisFromIso(v.createdAt),
    event_precision: 'day',
    author_id: v.userId,
    provenance: v.hasAudio ? 'voice' : 'typed',
    verification: v.hasAudio ? 'unverified' : 'verified',
    voice_note_id: v.noteId,
    engine: v.hasAudio ? PHONE_ENGINE : null,
    // No AI link proposals on the waiting placeholder (the embed worker would propose from it once, then never).
    ...(words ? {} : { ai_links_at: new Date().toISOString() }),
  })
  if (error) await logError('voice note journal entry failed', error, { source: 'notes.createVoiceNote', metadata: { noteId: v.noteId } })
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
  // Words changed in the sheet after saving: they become the author's correction of the note's Journal entry
  // (append-only; the words first saved stay as its original).
  if (typeof patch.transcript === 'string' && patch.transcript.trim()) {
    const fixed = await correctVoiceNoteEntry(supabase, id, user.id, patch.transcript.trim())
    if ('error' in fixed) await logError('voice note entry correction failed', fixed.error, { source: 'notes.updateVoiceNoteDetails', metadata: { id } })
  }

  const subject = typeof patch.subject === 'string' ? patch.subject : null
  const followUpOk = await insertFollowUp(supabase, formData, subject)

  revalidatePath('/atelier')
  revalidatePath('/hub')
  return { ok: true, followUpOk }
}

/**
 * Delete a voice note (Pem 2026-11-18: « cannot delete the test one »). Author or admin.
 * The audio goes to `recycle/` (r2SoftDeleteObject), never a hard delete.
 * - No Journal entry carries it yet: the `voice_note` row is deleted.
 * - A PC transcript entry carries it: the Journal is append-only and `journal_entry.voice_note_id`
 *   restricts the delete (supabase/sql/journal_entry.sql), so an admin hides the entry (as « Masquer »)
 *   and the note row is emptied in place: no audio, no text, no links. The entry's own links stay on
 *   the hidden entry. Since every note has its Journal entry at once (2026-11-23), the author may also
 *   delete their own note while only their own words are on it (no PC transcript, nobody else's
 *   correction); the hide is then done by the server for them. Otherwise a non-admin gets `admin_only`.
 * What the note created earlier (an idea, a constat, a reminder) are records of their own and stay.
 */
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

  const { data: carried, error: entErr } = await supabase
    .from('journal_entry')
    .select('id, hidden_at, author_id, engine')
    .eq('voice_note_id', id)
  if (entErr) return { error: entErr.message }

  if ((carried ?? []).length > 0) {
    const ownWordsOnly = (carried ?? []).every((e) => e.author_id === user.id && !(e.engine ?? '').startsWith('faster-whisper'))
    if (!admin && !ownWordsOnly) return { error: 'admin_only' }
    const open = (carried ?? []).filter((e) => !e.hidden_at).map((e) => e.id)
    if (open.length) {
      // An author is not an admin: the hide (admin-only in the database) is done by the server, after the
      // checks above (own note, own words only).
      const writer = admin ? supabase : createServiceClient()
      const { error: hideErr } = await writer
        .from('journal_entry')
        .update({ hidden_at: new Date().toISOString(), hidden_by: user.id })
        .in('id', open)
      if (hideErr) return { error: hideErr.message }
    }
    const { error: upErr } = await voiceNoteTable(supabase)
      .update({
        audio_r2_key: null,
        audio_mime: null,
        transcript: '',
        subject: null,
        oeuvre_id: null,
        concept_id: null,
        process_id: null,
        condition_report_id: null,
      })
      .eq('id', id)
    if (upErr) return { error: upErr.message }
  } else {
    const { error: delErr } = await voiceNoteTable(supabase).delete().eq('id', id)
    if (delErr) return { error: delErr.message }
  }

  if (r.audio_r2_key) {
    try {
      const { r2SoftDeleteObject } = await import('@/lib/r2-s3-object')
      await r2SoftDeleteObject(r.audio_r2_key)
    } catch (e) {
      // The note is already gone from the screens; the audio stays reachable by key only.
      await logError('Voice note audio recycle failed', e, { source: 'notes.deleteVoiceNote', metadata: { key: r.audio_r2_key } })
    }
  }

  revalidatePath('/atelier')
  revalidatePath('/atelier/journal')
  revalidatePath('/hub')
  return { ok: true }
}

// ── Link a note to a concept / work / pipeline project, or a dated reminder ──
// Journal entry « Relier » (VoiceNoteLinkPanel; ex Notes triage). Link, never copy: the note stays a
// Journal entry. `routed_at` is still set on any link (no list reads it since Notes moved).

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
    // The new idea carries the note's text: Pem's edited transcript, else the machine transcript (Pem 2026-11-20).
    const tx = r.transcript?.trim() || (await machineTranscripts(supabase, [r.id])).get(r.id)?.body.trim() || null
    const { data: c, error: cErr } = await supabase
      .from('concept')
      .insert({ titre: newTitle.slice(0, 200), statut: 'idee', category: 'artistic', description: tx ? tx.slice(0, 20_000) : null })
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
    const tx = r.transcript?.trim() || (await machineTranscripts(supabase, [r.id])).get(r.id)?.body.trim()
    const notes = [r.subject?.trim(), tx].filter(Boolean).join('\n\n').slice(0, 20_000) || null
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
  const rows = (data ?? []) as LinkedVoiceNote[]
  const machine = await machineTranscripts(
    supabase,
    rows.filter((r) => !r.transcript?.trim()).map((r) => r.id),
  )
  return rows.map((r) => (r.transcript?.trim() ? r : { ...r, transcript: machine.get(r.id)?.body ?? r.transcript }))
}
