'use server'

// Journal entries — build step 1 (owner GO 2026-11-12, docs/archive/JOURNAL_PROPOSAL.md).
// Rules live in the DB (supabase/sql/journal_entry.sql): team only, append only, never deleted,
// hide = admin. Works are linked from `#1234` in the text (same as Kaizen).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import { INSPIRATION_SQL_LIVE, type InspirationPhoto } from '@/lib/inspiration-photo'
import { latestCorrections } from '@/lib/journal-corrections'
import { readJournalDays } from '@/lib/journal/day-read'
import { isPlaceholderText } from '@/lib/journal/nothing-heard'
import type { ChangeAuthor } from '@/lib/journal/authors'

export type JournalEntryKind = 'spark' | 'trigger' | 'reflection' | 'note'
const KINDS: readonly JournalEntryKind[] = ['spark', 'trigger', 'reflection', 'note']
const PRECISIONS = ['day', 'month', 'year'] as const
const MAX_BODY = 20_000

export type JournalDayEntry = {
  id: number
  created_at: string
  event_on: string
  event_precision: string
  kind: string
  body: string
  provenance: string
  verification: string
  visibility: string
  /** Corrected (« Corriger »): `body` is the latest correction, this is the text as first written. */
  original: string | null
  /** The row whose text is shown (the latest correction, else the entry): « Le texte est juste » checks it. */
  textId?: number
  /** The PC's transcript kept beside a person's words (hidden correction, engine « … → proposition »), not yet decided. */
  pcProposal?: { id: number; body: string } | null
  /** The PC wrote on this entry (a transcript, nothing heard, or a hidden proposal): its author can no longer delete the note alone. */
  pcTouched?: boolean
  author: string
  mine: boolean
  hidden: boolean
  /** Transcript of a voice note (scripts/transcribe/voice_batch.py): its audio + the engine that wrote it. */
  voiceNoteId: string | null
  audioKey: string | null
  engine: string | null
  /** A voice note's words as the phone heard them live (shown beside the PC transcript when correcting). */
  liveWords?: string | null
  /** The voice note's own links (work / idea / project / constat), when RLS lets this user read the note. */
  voiceLinks: VoiceNoteLinks | null
  works: Array<{ id: number; title: string | null; thumb?: string | null }>
  concepts: Array<{ id: string; title: string | null }>
  /** People named with `@` (journal_step_b2.sql); a « Privé » contact is left out for the team (RLS). */
  people?: Array<{ id: number; name: string }>
  /** Labels beside the entry (journal_step_b.sql); empty until that SQL is live. */
  labels?: Array<{ id: number; label: string }>
  /** This entry is a suite of an earlier one (« suite de … »). */
  suiteOf?: { id: number; day: string; snippet: string } | null
  /** Later entries written as suites of this one, each with its own day. */
  suites?: Array<{ id: number; day: string; created_at: string; body: string }>
  /** AI link proposals (✦), not yet validated or rejected (supabase/sql/journal_entry_nodes.sql). */
  proposals: Array<{ linkId: number; workId: number | null; conceptId: string | null; title: string | null; thumb: string | null }>
}

/** Where a voice note is linked (`voice_note` columns; set by « Relier » on the Journal entry). */
export type VoiceNoteLinks = {
  subject: string | null
  oeuvre_id: number | null
  concept_id: string | null
  process_id: string | null
  condition_report_id: number | null
}

/** `by`: who changed the work that day, first change first (empty = not recorded, before oeuvre_version_author.sql). */
export type JournalDayChange = { oeuvre_id: number; title: string | null; fields: string[]; by?: ChangeAuthor[] }
/**
 * An idea's own change that day (Idées 2026-11-23, `concept_change`): planted, stage moved, text reworked, renamed,
 * grafted. One line per idea and kind of change per day (`count` saves of the text that day, the last stage).
 */
export type JournalDayIdeaChange = {
  key: string
  at: string
  conceptId: string
  title: string | null
  what: 'planted' | 'stage' | 'title' | 'text' | 'parent'
  to: string | null
  count: number
  by: string | null
}
/**
 * A voice note recorded that day (RLS: own notes, or all for admin). A voice note is a Journal entry
 * spoken instead of written (R1): once the PC transcript exists it shows as that entry (`hasEntry`);
 * until then it shows on its own in the day's entries. The links are what Notes triage used to set.
 */
export type JournalDayVoice = {
  id: string
  subject: string | null
  created_at: string
  oeuvre_id: number | null
  concept_id: string | null
  process_id: string | null
  condition_report_id: number | null
  /** Live words / typed text saved with the audio (not the PC transcript). */
  transcript: string | null
  audioKey: string | null
  duration_ms: number | null
  author: string
  mine: boolean
  /** A Journal entry (the PC transcript) already carries this note. */
  hasEntry: boolean
}
/** Kaizen → Création item created that day — read from `kaizen_item`, never copied (owner 2026-11-12). */
export type JournalDayCreation = {
  id: number
  created_at: string
  title: string | null
  body: string
  author: string
  done: boolean
  works: number[]
}

/** A remark on a work or an idea (`note_line`) written that day — read from its home, never copied (Journal design 2026-11-22 §1). */
export type JournalDayRemark = {
  id: number
  created_at: string
  body: string
  imageKey: string | null
  oeuvreId: number | null
  workTitle: string | null
  workThumb: string | null
  conceptId: string | null
  conceptTitle: string | null
  author: string
}

export type JournalDayExtras = {
  isAdmin: boolean
  /** Remarks on works / ideas written that day (empty when entries are not read). */
  remarks: JournalDayRemark[]
  entries: JournalDayEntry[]
  changes: JournalDayChange[]
  /** Ideas planted / moved / reworked that day (empty until read; absent on older callers). */
  ideaChanges?: JournalDayIdeaChange[]
  /** Works changed that day, all of them (`changes` details at most 100 of them; admin only by RLS). */
  changedWorks?: number
  voices: JournalDayVoice[]
  creation: JournalDayCreation[]
  /** Concepts (Recherche) the entry form can link to. */
  conceptOptions: Array<{ id: string; title: string }>
  /** Inspiration photos of the day (R1 / R2); empty until supabase/sql/inspiration_photo.sql is live. */
  inspirations: InspirationPhoto[]
}

/** One row per Paris day that has an entry, a Création item, a voice note or an inspiration photo (index of the journal). */
export type JournalSourceDay = {
  day: string
  entries: number
  creation: number
  voices: number
  /** Inspiration photos placed on that day (a day holding only a photo is listed too, Pem 2026-11-21). */
  photos: number
  /** Open ✦ AI link suggestions on that day's entries (shown to admins, who decide them). */
  proposals: number
}

type Err = { error: string }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/


async function worksMentioned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  text: string,
): Promise<number[]> {
  const ids = [...new Set([...text.matchAll(/#\s?(\d{1,5})/g)].map((m) => Number(m[1])))]
  if (!ids.length) return []
  const { data } = await supabase.from('Oeuvres').select('OeuvreID').in('OeuvreID', ids)
  return (data ?? []).map((r) => r.OeuvreID).sort((a, b) => a - b)
}

/**
 * `opts.folds: false` skips the two fold reads (work versions, Création) — « Aujourd'hui » on the phone
 * loads them only when a fold opens (`getJournalDayFolds`). `opts.entries: false` skips the entries and
 * what only they use (voice notes, concept options: returned empty).
 * Reads run in three waves of parallel calls (user + admin flag; the day's rows; what those rows point to)
 * instead of up to eight calls one after another: each call is a round trip from the server to Supabase
 * (about 0.2 s in production, R2 speed notes), so the count of waves sets the time.
 */
export async function getJournalDayExtras(
  day: string,
  opts: { folds?: boolean; entries?: boolean } = {},
): Promise<JournalDayExtras | Err> {
  if (!DAY_RE.test(day)) return { error: 'day' }
  const supabase = await createClient()
  // The admin flag is read with the same session as the user (false when signed out); a missing user
  // still stops here before any data is read.
  const [
    {
      data: { user },
    },
    { data: adminFlag },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc('is_admin')])
  if (!user) return { error: 'auth' }
  // One day = a run of one day: the same read as the stream (lib/journal/day-read.ts).
  const res = await readJournalDays(supabase, { userId: user.id, isAdmin: adminFlag === true }, day, day, opts)
  if ('error' in res) return res
  return res.get(day) as JournalDayExtras
}

/** The two folds of a day (« Attributs d'œuvres modifiés », « Création (Kaizen) »), read when one opens on « Aujourd'hui ». */
export async function getJournalDayFolds(
  day: string,
): Promise<{ isAdmin: boolean; changes: JournalDayChange[]; creation: JournalDayCreation[] } | Err> {
  const res = await getJournalDayExtras(day, { entries: false })
  if ('error' in res) return res
  return { isAdmin: res.isAdmin, changes: res.changes, creation: res.creation }
}

/** Days that have journal entries, Création items, voice notes or inspiration photos (Paris day), newest first. */
export async function listJournalSourceDays(): Promise<JournalSourceDay[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const [entriesRes, creationRes, voicesRes, proposalsRes, photosRes] = await Promise.all([
    supabase.from('journal_entry').select('id, event_on, hidden_at, corrects_id, photo_id' as never).limit(5000),
    supabase.from('kaizen_item').select('created_at').eq('section', 'creation').limit(5000),
    supabase.from('voice_note').select('created_at').limit(5000),
    supabase
      .from('journal_entry_link')
      .select('entry_id')
      .eq('proposed_by', 'ai')
      .is('validated_at', null)
      .is('rejected_at', null)
      .limit(5000),
    INSPIRATION_SQL_LIVE
      ? supabase.from('inspiration_photo').select('day').is('hidden_at' as never, null).limit(5000)
      : Promise.resolve({ data: [] as Array<{ day: string }> }),
  ])
  const byDay = new Map<string, JournalSourceDay>()
  const bump = (day: string, key: 'entries' | 'creation' | 'voices' | 'proposals' | 'photos') => {
    if (!DAY_RE.test(day)) return
    const row = byDay.get(day) ?? { day, entries: 0, creation: 0, voices: 0, proposals: 0, photos: 0 }
    row[key] += 1
    byDay.set(day, row)
  }
  const dayByEntry = new Map<number, string>()
  for (const e of (entriesRes.data ?? []) as unknown as Array<{ id: number; event_on: string; hidden_at: string | null; corrects_id: number | null; photo_id?: string | null }>) {
    // A photo's text is counted as the photo, not as an entry.
    if (e.hidden_at || e.corrects_id != null || e.photo_id != null) continue
    dayByEntry.set(Number(e.id), e.event_on)
    bump(e.event_on, 'entries')
  }
  for (const l of proposalsRes.data ?? []) {
    const day = dayByEntry.get(Number(l.entry_id))
    if (day) bump(day, 'proposals')
  }
  for (const k of creationRes.data ?? []) bump(calendarDayInParisFromIso(k.created_at), 'creation')
  for (const v of voicesRes.data ?? []) bump(calendarDayInParisFromIso(v.created_at), 'voices')
  for (const p of photosRes.data ?? []) bump(String(p.day), 'photos')
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day))
}

export async function createJournalEntry(input: {
  day: string
  kind: string
  body: string
  precision?: string
  /** Dictated in the browser (Web Speech): provenance voice, unverified until checked. */
  dictated?: boolean
  /** Concepts (Recherche) picked in the form. */
  conceptIds?: string[]
  /** Targets picked with `#` / `@` (one shared picker, principle 13): each becomes a link row on the entry. */
  links?: Array<{ kind: 'oeuvre' | 'concept' | 'contact'; id: number | string }>
}): Promise<{ ok: true; id: number; linkError?: string } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  if (!DAY_RE.test(input.day)) return { error: 'day' }
  const kind = KINDS.find((k) => k === input.kind)
  if (!kind) return { error: 'kind' }
  const body = input.body.trim().slice(0, MAX_BODY)
  if (!body) return { error: 'empty' }
  const precision = PRECISIONS.find((p) => p === input.precision) ?? 'day'
  // A partial date is stored as the first day of its period.
  const eventOn =
    precision === 'year' ? `${input.day.slice(0, 4)}-01-01` : precision === 'month' ? `${input.day.slice(0, 7)}-01` : input.day

  const { data, error } = await supabase
    .from('journal_entry')
    .insert({
      kind,
      body,
      event_on: eventOn,
      event_precision: precision,
      author_id: user.id,
      provenance: input.dictated ? 'voice' : 'typed',
      verification: input.dictated ? 'unverified' : 'verified',
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'insert' }

  const works = await worksMentioned(supabase, body)
  const conceptIds = [...new Set((input.conceptIds ?? []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))].slice(0, 20)
  const now = new Date().toISOString()
  const linkRows = [
    ...works.map((oeuvre_id) => ({ entry_id: data.id, oeuvre_id, created_by: user.id, proposed_by: 'pem', validated_at: now })),
    ...conceptIds.map((concept_id) => ({ entry_id: data.id, concept_id, created_by: user.id, proposed_by: 'pem', validated_at: now })),
  ]
  if (linkRows.length) {
    const { error: linkErr } = await supabase.from('journal_entry_link').insert(linkRows)
    if (linkErr) await logError('journal entry links failed', linkErr, { source: 'journal.createJournalEntry', metadata: { id: data.id } })
  }
  // Picked targets, one row each so a duplicate (23505: already linked by `#1234` or the concept list) skips only itself.
  // `contact_id` is not in the generated types until journal_step_b2.sql is live.
  let linkError: string | undefined
  const picked = new Map<string, Record<string, unknown>>()
  for (const l of input.links ?? []) {
    const id = String(l?.id ?? '')
    if (l?.kind === 'oeuvre' && /^\d{1,9}$/.test(id)) picked.set(`o${id}`, { oeuvre_id: Number(id) })
    else if (l?.kind === 'contact' && /^\d{1,9}$/.test(id)) picked.set(`c${id}`, { contact_id: Number(id) })
    else if (l?.kind === 'concept' && /^[0-9a-f-]{36}$/i.test(id)) picked.set(`i${id}`, { concept_id: id })
    else linkError = 'bad_link'
  }
  const loose = supabase as unknown as { from: (t: string) => { insert: (r: unknown) => PromiseLike<{ error: { code?: string; message: string } | null }> } }
  for (const target of picked.values()) {
    const { error: pErr } = await loose
      .from('journal_entry_link')
      .insert({ entry_id: data.id, ...target, created_by: user.id, proposed_by: 'pem', validated_at: now })
    if (pErr && pErr.code !== '23505') {
      linkError = pErr.message
      await logError('journal entry picked link failed', pErr, { source: 'journal.createJournalEntry', metadata: { id: data.id } })
    }
  }
  revalidatePath('/atelier/journal')
  return linkError ? { ok: true, id: data.id, linkError } : { ok: true, id: data.id }
}

/** Admin only (RLS: link update = admin). Validate = the proposal becomes a link; reject = kept, marked rejected. */
/** A concept shown in place in the Journal (✦ suggestion preview, Pem 2026-11-18: « preview rather than leave the journal »). */
export type ConceptPreview = { id: string; titre: string; description: string | null; notes: string | null; medium: string | null; statut: string; maturity: string }

export async function fetchConceptPreview(id: string): Promise<ConceptPreview | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data, error } = await supabase
    .from('concept')
    .select('id, titre, description, notes, medium, statut, maturity')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    await logError('journal: concept preview', error)
    return { error: error.message }
  }
  if (!data) return { error: 'not_found' }
  return data as ConceptPreview
}

export async function decideJournalLink(linkId: number, accept: boolean): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const now = new Date().toISOString()
  // `rejected_at` / `rejected_by` come from journal_entry_nodes.sql (cast: generated types may predate it).
  const patch = (accept ? { validated_at: now } : { rejected_at: now, rejected_by: user.id }) as { validated_at?: string }
  const { data, error } = await supabase
    .from('journal_entry_link')
    .update(patch)
    .eq('id', linkId)
    .eq('proposed_by', 'ai')
    .is('validated_at', null)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'admin_only' }
  revalidatePath('/atelier/journal')
  return { ok: true }
}

/** Admin only (DB guard `journal_admin_only`). Never deletes: the entry is hidden from the team. */
export async function setJournalEntryHidden(id: number, hidden: boolean): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { error } = await supabase
    .from('journal_entry')
    .update(hidden ? { hidden_at: new Date().toISOString(), hidden_by: user.id } : { hidden_at: null, hidden_by: null })
    // Its corrections follow (search, Notes and the archive read them on their own).
    .or(`id.eq.${id},corrects_id.eq.${id}`)
  if (error) return { error: error.message.includes('journal_admin_only') ? 'admin_only' : error.message }
  revalidatePath('/atelier/journal')
  return { ok: true }
}

/** Admin marks a machine transcript as checked (or back to unchecked). `verification` is outside the append-only guard. */
export async function setJournalEntryVerified(id: number, verified: boolean): Promise<{ ok: true } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'admin_only' }
  // A voice-note placeholder is no text to confirm (it would stop the PC from transcribing the note).
  const { data: row } = await supabase.from('journal_entry').select('body').eq('id', id).maybeSingle()
  if (!row) return { error: 'not_found' }
  if (verified && isPlaceholderText(row.body)) return { error: 'placeholder' }
  const { data: changed, error } = await supabase
    .from('journal_entry')
    .update({ verification: verified ? 'verified' : 'unverified' })
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  if (!changed?.length) return { error: 'not_found' }
  revalidatePath('/atelier/journal')
  return { ok: true }
}

/**
 * « Corriger » (admin, like « vérifier »): the Journal is append-only (journal_entry_guard), so a
 * correction is a new entry pointing at the original (`corrects_id`) — same day, kind and voice note,
 * typed and verified. Readers show it in place of the original (`latestCorrections`). The AI link
 * proposer skips it (`ai_links_at` set at insert); works named `#1234` in the new text are linked to
 * the original, so the links stay on one record.
 */
export async function correctJournalEntry(id: number, text: string): Promise<{ ok: true; id: number } | Err> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return { error: 'admin_only' }
  const body = text.trim().slice(0, MAX_BODY)
  if (!body) return { error: 'empty' }

  const { data: target, error: tErr } = await supabase
    .from('journal_entry')
    .select('id, kind, body, event_on, event_precision, visibility, voice_note_id, corrects_id, provenance')
    .eq('id', id)
    .maybeSingle()
  if (tErr) return { error: tErr.message }
  if (!target) return { error: 'not_found' }
  // A correction of a correction points at the original: one chain, the latest wins.
  let root = target
  if (target.corrects_id != null) {
    const r = await supabase
      .from('journal_entry')
      .select('id, kind, body, event_on, event_precision, visibility, voice_note_id, corrects_id, provenance')
      .eq('id', target.corrects_id)
      .maybeSingle()
    if (r.error) return { error: r.error.message }
    if (!r.data) return { error: 'not_found' }
    root = r.data
  }
  if (root.corrects_id != null) return { error: 'not_found' }
  // A photo's text is corrected only through setInspirationCaption (photo_id is not in generated types).
  const photoRows = await supabase
    .from('journal_entry')
    .select('id, photo_id' as never)
    .in('id', [target.id, root.id])
  if (photoRows.error) return { error: photoRows.error.message }
  if (((photoRows.data ?? []) as unknown as Array<{ photo_id?: string | null }>).some((r) => r.photo_id != null)) {
    return { error: 'photo_text' }
  }
  if (root.provenance === 'typed') return { error: 'typed' }

  const { data: fixes } = await supabase
    .from('journal_entry').select('corrects_id, body, created_at, hidden_at').eq('corrects_id', root.id)
  const current = latestCorrections(fixes ?? []).get(root.id) ?? root.body
  if (body === current.trim()) return { error: 'unchanged' }

  const { data, error } = await supabase
    .from('journal_entry')
    .insert({
      kind: root.kind,
      body,
      event_on: root.event_on,
      event_precision: root.event_precision,
      visibility: root.visibility,
      voice_note_id: root.voice_note_id,
      corrects_id: root.id,
      author_id: user.id,
      provenance: 'typed',
      verification: 'verified',
      ai_links_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) return { error: error?.message ?? 'insert' }

  // A work named in the new text: already linked → nothing; an open ✦ proposal → validated (Pem named it);
  // otherwise a new link. A proposal Pem rejected stays rejected.
  const { data: linked } = await supabase
    .from('journal_entry_link').select('id, oeuvre_id, validated_at, rejected_at').eq('entry_id', root.id).not('oeuvre_id', 'is', null)
  const byWork = new Map((linked ?? []).map((l) => [Number(l.oeuvre_id), l]))
  const now = new Date().toISOString()
  const named = await worksMentioned(supabase, body)
  const toValidate = named.map((w) => byWork.get(w)).filter((l) => l && !l.validated_at && !l.rejected_at).map((l) => l!.id)
  if (toValidate.length) {
    const { error: vErr } = await supabase.from('journal_entry_link').update({ validated_at: now }).in('id', toValidate)
    if (vErr) await logError('journal correction: validate proposals failed', vErr, { source: 'journal.correctJournalEntry', metadata: { id: root.id } })
  }
  const newWorks = named.filter((w) => !byWork.has(w))
  if (newWorks.length) {
    const { error: linkErr } = await supabase.from('journal_entry_link').insert(
      newWorks.map((oeuvre_id) => ({ entry_id: root.id, oeuvre_id, created_by: user.id, proposed_by: 'pem', validated_at: now })),
    )
    if (linkErr) await logError('journal correction links failed', linkErr, { source: 'journal.correctJournalEntry', metadata: { id: root.id } })
  }
  revalidatePath('/atelier/journal')
  return { ok: true, id: data.id }
}

export type WorkJournalEntry = { id: number; day: string; kind: string; snippet: string }

/** Constellation side panel: the journal entries linked to a work (validated links only). */
export async function listJournalEntriesForWork(oeuvreId: number): Promise<WorkJournalEntry[]> {
  if (!Number.isInteger(oeuvreId) || oeuvreId <= 0) return []
  const supabase = await createClient()
  const { data: links, error } = await supabase
    .from('journal_entry_link')
    .select('entry_id')
    .eq('oeuvre_id', oeuvreId)
    .not('validated_at', 'is', null)
  if (error || !links?.length) return []
  const ids = [...new Set(links.map((l) => Number(l.entry_id)))]
  const [{ data: rows }, { data: fixes }] = await Promise.all([
    supabase
      .from('journal_entry')
      .select('id, event_on, kind, body, hidden_at')
      .in('id', ids)
      .is('hidden_at', null)
      .order('event_on', { ascending: false }),
    supabase.from('journal_entry').select('corrects_id, body, created_at, hidden_at').in('corrects_id', ids),
  ])
  const latestFix = latestCorrections(fixes ?? [])
  return (rows ?? []).map((r) => ({
    id: Number(r.id),
    day: String(r.event_on),
    kind: String(r.kind),
    snippet: String(latestFix.get(Number(r.id)) ?? r.body ?? '')
      .replace(/[#*`|_>]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120),
  }))
}

