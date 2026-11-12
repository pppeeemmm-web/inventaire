'use server'

// Journal entries — build step 1 (owner GO 2026-11-12, docs/JOURNAL_PROPOSAL.md).
// Rules live in the DB (supabase/sql/journal_entry.sql): team only, append only, never deleted,
// hide = admin. Works are linked from `#1234` in the text (same as Kaizen).

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import { changedVersionFields } from '@/lib/oeuvre-version-fields'

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
  author: string
  mine: boolean
  hidden: boolean
  works: Array<{ id: number; title: string | null }>
  concepts: Array<{ id: string; title: string | null }>
  /** AI link proposals (✦), not yet validated or rejected (supabase/sql/journal_entry_nodes.sql). */
  proposals: Array<{ linkId: number; workId: number | null; conceptId: string | null; title: string | null }>
}

export type JournalDayChange = { oeuvre_id: number; title: string | null; fields: string[] }
export type JournalDayVoice = { id: string; subject: string | null; created_at: string; oeuvre_id: number | null }
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

export type JournalDayExtras = {
  isAdmin: boolean
  entries: JournalDayEntry[]
  changes: JournalDayChange[]
  voices: JournalDayVoice[]
  creation: JournalDayCreation[]
  /** Concepts (Recherche) the entry form can link to. */
  conceptOptions: Array<{ id: string; title: string }>
}

/** One row per Paris day that has an entry, a Création item or a voice note (index of the journal). */
export type JournalSourceDay = { day: string; entries: number; creation: number; voices: number }

type Err = { error: string }

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** UTC window that surely contains the Paris calendar day (rows are then filtered by Paris day). */
function utcWindow(day: string): { from: string; to: string } {
  const start = new Date(`${day}T00:00:00Z`).getTime()
  return { from: new Date(start - 3 * 3600_000).toISOString(), to: new Date(start + 27 * 3600_000).toISOString() }
}

async function worksMentioned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  text: string,
): Promise<number[]> {
  const ids = [...new Set([...text.matchAll(/#\s?(\d{1,5})/g)].map((m) => Number(m[1])))]
  if (!ids.length) return []
  const { data } = await supabase.from('Oeuvres').select('OeuvreID').in('OeuvreID', ids)
  return (data ?? []).map((r) => r.OeuvreID).sort((a, b) => a - b)
}

export async function getJournalDayExtras(day: string): Promise<JournalDayExtras | Err> {
  if (!DAY_RE.test(day)) return { error: 'day' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' }

  const { data: adminFlag } = await supabase.rpc('is_admin')
  const isAdmin = adminFlag === true
  const win = utcWindow(day)

  const [entriesRes, voicesRes, versionsRes, creationRes, conceptsRes] = await Promise.all([
    supabase.from('journal_entry').select('*').eq('event_on', day).order('created_at', { ascending: true }).limit(500),
    supabase
      .from('voice_note')
      .select('id, subject, created_at, oeuvre_id')
      .gte('created_at', win.from)
      .lt('created_at', win.to)
      .order('created_at', { ascending: true })
      .limit(200),
    // Admin only by RLS (oeuvre_versions_admin_select): team members get no rows.
    isAdmin
      ? supabase
          .from('oeuvre_versions')
          .select('oeuvre_id, changed_at, snapshot')
          .gte('changed_at', win.from)
          .lt('changed_at', win.to)
          .order('changed_at', { ascending: true })
          .limit(1000)
      : Promise.resolve({ data: [] as Array<{ oeuvre_id: number; changed_at: string; snapshot: unknown }>, error: null }),
    supabase
      .from('kaizen_item')
      .select('id, created_at, title, body, author_id, done_at, work_ids')
      .eq('section', 'creation')
      .gte('created_at', win.from)
      .lt('created_at', win.to)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase.from('concept').select('id, titre').order('titre', { ascending: true }).limit(500),
  ])
  if (entriesRes.error) {
    await logError('journal day entries failed', entriesRes.error, { source: 'journal.getJournalDayExtras' })
    return { error: entriesRes.error.message }
  }

  const rows = entriesRes.data ?? []
  const entryIds = rows.map((r) => r.id)
  const { data: links } = entryIds.length
    ? await supabase.from('journal_entry_link').select('*').in('entry_id', entryIds)
    : { data: [] }
  type LinkRow = {
    id: number
    entry_id: number
    oeuvre_id: number | null
    concept_id: string | null
    validated_at: string | null
    proposed_by: string
    rejected_at?: string | null
  }
  const linkRows = (links ?? []) as LinkRow[]
  const conceptTitles = new Map((conceptsRes.data ?? []).map((c) => [c.id, c.titre as string | null]))

  // Field changes: each version row is the work BEFORE a save; the state after is the next
  // version row of that work, or the current row.
  const versions = (versionsRes.data ?? []).filter((v) => calendarDayInParisFromIso(v.changed_at) === day)
  const changedIds = [...new Set(versions.map((v) => v.oeuvre_id))].slice(0, 100)

  const workIds = [...new Set([...linkRows.filter((l) => l.oeuvre_id != null).map((l) => l.oeuvre_id as number), ...changedIds])]
  const titles = new Map<number, string | null>()
  const current = new Map<number, Record<string, unknown>>()
  if (workIds.length) {
    const { data: works } = await supabase.from('Oeuvres').select('*').in('OeuvreID', workIds)
    for (const w of (works ?? []) as Array<Record<string, unknown>>) {
      titles.set(w.OeuvreID as number, (w.Titre as string | null) ?? null)
      current.set(w.OeuvreID as number, w)
    }
  }

  const changes: JournalDayChange[] = []
  if (changedIds.length) {
    const { data: later } = await supabase
      .from('oeuvre_versions')
      .select('oeuvre_id, changed_at, snapshot')
      .in('oeuvre_id', changedIds)
      .gte('changed_at', win.from)
      .order('changed_at', { ascending: true })
      .limit(2000)
    const byWork = new Map<number, Array<{ changed_at: string; snapshot: Record<string, unknown> }>>()
    for (const v of (later ?? []) as Array<{ oeuvre_id: number; changed_at: string; snapshot: Record<string, unknown> }>) {
      const list = byWork.get(v.oeuvre_id) ?? []
      list.push(v)
      byWork.set(v.oeuvre_id, list)
    }
    for (const oid of changedIds) {
      const list = byWork.get(oid) ?? []
      const fields = new Set<string>()
      list.forEach((v, i) => {
        if (calendarDayInParisFromIso(v.changed_at) !== day) return
        const after = list[i + 1]?.snapshot ?? current.get(oid) ?? null
        for (const c of changedVersionFields(v.snapshot, after)) fields.add(c.field)
      })
      if (fields.size) changes.push({ oeuvre_id: oid, title: titles.get(oid) ?? null, fields: [...fields] })
    }
  }

  const creationRows = (creationRes.data ?? []).filter((k) => calendarDayInParisFromIso(k.created_at) === day)
  const authorIds = [
    ...new Set([...rows.map((r) => r.author_id), ...creationRows.map((k) => k.author_id)].filter((x): x is string => !!x)),
  ]
  const names: Record<string, string> = {}
  if (authorIds.length) {
    // `select('*')`: the typed select parser rejects the accented `Prénom` column name.
    const { data } = await supabase.from('Contact').select('*').in('auth_user_id', authorIds)
    for (const c of (data ?? []) as { auth_user_id: string | null; Prénom: string | null; Nom: string | null }[]) {
      if (c.auth_user_id) names[c.auth_user_id] = [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—'
    }
  }

  const entries: JournalDayEntry[] = rows
    .filter((r) => !r.hidden_at || isAdmin)
    .map((r) => ({
      id: r.id,
      created_at: r.created_at,
      event_on: r.event_on,
      event_precision: r.event_precision,
      kind: r.kind,
      body: r.body,
      provenance: r.provenance,
      verification: r.verification,
      visibility: r.visibility,
      author: (r.author_id && names[r.author_id]) || '—',
      mine: r.author_id === user.id,
      hidden: !!r.hidden_at,
      works: linkRows
        .filter((l) => l.entry_id === r.id && l.oeuvre_id != null && l.validated_at)
        .map((l) => ({ id: l.oeuvre_id as number, title: titles.get(l.oeuvre_id as number) ?? null })),
      concepts: linkRows
        .filter((l) => l.entry_id === r.id && l.concept_id != null && l.validated_at)
        .map((l) => ({ id: l.concept_id as string, title: conceptTitles.get(l.concept_id as string) ?? null })),
      proposals: linkRows
        .filter((l) => l.entry_id === r.id && l.proposed_by === 'ai' && !l.validated_at && !l.rejected_at)
        .map((l) => ({
          linkId: l.id,
          workId: l.oeuvre_id,
          conceptId: l.concept_id,
          title: l.oeuvre_id != null ? titles.get(l.oeuvre_id) ?? null : conceptTitles.get(l.concept_id as string) ?? null,
        })),
    }))

  const voices: JournalDayVoice[] = ((voicesRes.data ?? []) as JournalDayVoice[]).filter(
    (v) => calendarDayInParisFromIso(v.created_at) === day,
  )

  const creation: JournalDayCreation[] = creationRows.map((k) => ({
    id: k.id,
    created_at: k.created_at,
    title: k.title,
    body: k.body ?? '',
    author: (k.author_id && names[k.author_id]) || '—',
    done: !!k.done_at,
    works: (k.work_ids ?? []) as number[],
  }))

  const conceptOptions = (conceptsRes.data ?? [])
    .filter((c) => (c.titre ?? '').trim())
    .map((c) => ({ id: c.id, title: (c.titre as string).trim() }))

  return { isAdmin, entries, changes, voices, creation, conceptOptions }
}

/** Days that have journal entries, Création items or voice notes (Paris day), newest first. */
export async function listJournalSourceDays(): Promise<JournalSourceDay[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const [entriesRes, creationRes, voicesRes] = await Promise.all([
    supabase.from('journal_entry').select('event_on, hidden_at').limit(5000),
    supabase.from('kaizen_item').select('created_at').eq('section', 'creation').limit(5000),
    supabase.from('voice_note').select('created_at').limit(5000),
  ])
  const byDay = new Map<string, JournalSourceDay>()
  const bump = (day: string, key: 'entries' | 'creation' | 'voices') => {
    if (!DAY_RE.test(day)) return
    const row = byDay.get(day) ?? { day, entries: 0, creation: 0, voices: 0 }
    row[key] += 1
    byDay.set(day, row)
  }
  for (const e of entriesRes.data ?? []) if (!e.hidden_at) bump(e.event_on, 'entries')
  for (const k of creationRes.data ?? []) bump(calendarDayInParisFromIso(k.created_at), 'creation')
  for (const v of voicesRes.data ?? []) bump(calendarDayInParisFromIso(v.created_at), 'voices')
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
}): Promise<{ ok: true; id: number } | Err> {
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
  revalidatePath('/atelier/journal')
  return { ok: true, id: data.id }
}

/** Admin only (RLS: link update = admin). Validate = the proposal becomes a link; reject = kept, marked rejected. */
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
    .eq('id', id)
  if (error) return { error: error.message.includes('journal_admin_only') ? 'admin_only' : error.message }
  revalidatePath('/atelier/journal')
  return { ok: true }
}
