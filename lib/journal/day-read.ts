import 'server-only'

// The Journal's read of one day or a run of days (design 2026-11-22, Step A). One set of parallel reads
// for the whole run, then rows are split by Paris day — the stream loads a page of days at once instead
// of one day at a time. Not a Server Action (principle 6: reads do not queue behind saves): called from
// server pages, the stream route and the `getJournalDayExtras` action, which wraps it for one day.

import type { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import { changedVersionFields } from '@/lib/oeuvre-version-fields'
import type { Tables } from '@/lib/types/supabase.generated'
import { INSPIRATION_SQL_LIVE, type InspirationPhoto } from '@/lib/inspiration-photo'
import { contactListLabel } from '@/lib/contacts/contact-display'
import { latestCorrectionRows, latestCorrections } from '@/lib/journal-corrections'
import { isPlaceholderText } from '@/lib/journal/nothing-heard'
import { addAuthor, authorIdsOf, authorOfRow, type AuthorContactRow, type AuthorRow, type ChangeAuthor } from '@/lib/journal/authors'
import type {
  JournalDayChange,
  JournalDayCreation,
  JournalDayEntry,
  JournalDayExtras,
  JournalDayIdeaChange,
  JournalDayRemark,
  JournalDayVoice,
  VoiceNoteLinks,
} from '@/app/atelier/(portal)/journal/entry-actions'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const JOURNAL_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** UTC window that surely contains the Paris calendar days `from`..`to` (rows are then filtered by Paris day). */
function utcWindow(from: string, to: string): { from: string; to: string } {
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  return { from: new Date(start - 3 * 3600_000).toISOString(), to: new Date(end + 27 * 3600_000).toISOString() }
}

function emptyDay(isAdmin: boolean, conceptOptions: JournalDayExtras['conceptOptions']): JournalDayExtras {
  return { isAdmin, entries: [], changes: [], changedWorks: 0, voices: [], creation: [], conceptOptions, inspirations: [], remarks: [] }
}

/**
 * Every day from `from` to `to` (Paris days, inclusive, `from` <= `to`) → its extras. Days with nothing
 * are present and empty. `folds: false` skips work versions and Création; `entries: false` skips the
 * entries and what only they use (voice notes, photos, remarks, concept options).
 */
export async function readJournalDays(
  supabase: Supabase,
  ctx: { userId: string; isAdmin: boolean },
  from: string,
  to: string,
  opts: { folds?: boolean; entries?: boolean; ideas?: boolean } = {},
): Promise<Map<string, JournalDayExtras> | { error: string }> {
  if (!JOURNAL_DAY_RE.test(from) || !JOURNAL_DAY_RE.test(to) || from > to) return { error: 'day' }
  const withFolds = opts.folds !== false
  const withEntries = opts.entries !== false
  const { isAdmin, userId } = ctx
  const win = utcWindow(from, to)
  const inRange = (day: string) => day >= from && day <= to

  type VoiceRow = Omit<JournalDayVoice, 'audioKey' | 'author' | 'mine' | 'hasEntry'> & { audio_r2_key: string | null; user_id: string }
  // `hidden_at` / `meta`: journal_step_b2.sql (absent before it: read with `*`).
  type InspirationRow = Omit<InspirationPhoto, 'conceptTitle' | 'author' | 'entryId' | 'hidden' | 'works' | 'concepts' | 'people'> & { author_id: string; hidden_at?: string | null }
  type IdeaChangeRow = { id: number; concept_id: string; what: string; to_value: string | null; changed_at: string; changed_by: string | null }
  type RemarkRow = { id: number; created_at: string; body: string; image_key: string | null; oeuvre_id: number | null; concept_id: string | null; author_id: string | null }

  // Wave 1: the run's own rows.
  const [entriesRes, voicesRes, versionsRes, creationRes, conceptsRes, inspirationsRes, remarksRes, ideaChangesRes] = await Promise.all([
    withEntries
      ? supabase.from('journal_entry').select('*').gte('event_on', from).lte('event_on', to).order('created_at', { ascending: true }).limit(1000)
      : Promise.resolve({ data: [] as Array<Tables<'journal_entry'>>, error: null }),
    withEntries
      ? supabase
          .from('voice_note')
          .select('id, subject, created_at, oeuvre_id, concept_id, process_id, condition_report_id, transcript, audio_r2_key, duration_ms, user_id')
          .gte('created_at', win.from)
          .lt('created_at', win.to)
          .order('created_at', { ascending: true })
          .limit(400)
      : Promise.resolve({ data: [] as VoiceRow[], error: null }),
    // Admin only by RLS (oeuvre_versions_admin_select): team members get no rows.
    isAdmin && withFolds
      ? supabase
          .from('oeuvre_versions')
          .select('oeuvre_id, changed_at, changed_by')
          .gte('changed_at', win.from)
          .lt('changed_at', win.to)
          .order('changed_at', { ascending: true })
          .limit(2000)
      : Promise.resolve({ data: [] as Array<{ oeuvre_id: number; changed_at: string; changed_by: string | null }>, error: null }),
    withFolds
      ? supabase
          .from('kaizen_item')
          .select('id, created_at, title, body, author_id, done_at, work_ids')
          .eq('section', 'creation')
          .gte('created_at', win.from)
          .lt('created_at', win.to)
          .order('created_at', { ascending: true })
          .limit(400)
      : Promise.resolve({
          data: [] as Array<Pick<Tables<'kaizen_item'>, 'id' | 'created_at' | 'title' | 'body' | 'author_id' | 'done_at' | 'work_ids'>>,
          error: null,
        }),
    withEntries
      ? supabase.from('concept').select('id, titre').order('titre', { ascending: true }).limit(500)
      : Promise.resolve({ data: [] as Array<{ id: string; titre: string | null }>, error: null }),
    withEntries && INSPIRATION_SQL_LIVE
      ? supabase
          .from('inspiration_photo')
          .select('*')
          .gte('day', from)
          .lte('day', to)
          .order('created_at', { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [] as InspirationRow[], error: null }),
    // Remarks on works (and ideas) written in the run — read from their home, never copied (design §1).
    withEntries
      ? supabase
          .from('note_line')
          .select('id, created_at, body, image_key, oeuvre_id, concept_id, author_id')
          .is('discarded_at', null)
          .gte('created_at', win.from)
          .lt('created_at', win.to)
          .order('created_at', { ascending: true })
          .limit(400)
      : Promise.resolve({ data: [] as RemarkRow[], error: null }),
    // Ideas planted, moved, reworked or grafted in the run (Idées 2026-11-23): the day shows them as lines.
    // `ideas: false` skips it (an idea's own desk reads its moments through this function).
    withEntries && opts.ideas !== false
      ? supabase
          .from('concept_change')
          .select('id, concept_id, what, to_value, changed_at, changed_by')
          .gte('changed_at', win.from)
          .lt('changed_at', win.to)
          .order('changed_at', { ascending: true })
          .limit(400)
      : Promise.resolve({ data: [] as IdeaChangeRow[], error: null }),
  ])
  if (entriesRes.error) {
    await logError('journal day entries failed', entriesRes.error, { source: 'journal.readJournalDays' })
    return { error: entriesRes.error.message }
  }

  // A read that hit its row cap would silently drop the newest rows of the run (corrections included):
  // say so in the log instead of showing a quietly incomplete day (flow review 2026-11-23).
  const caps: Array<[string, number, number]> = [
    ['journal_entry', (entriesRes.data ?? []).length, 1000],
    ['voice_note', (voicesRes.data ?? []).length, 400],
    ['oeuvre_versions', (versionsRes.data ?? []).length, 2000],
    ['kaizen_item', (creationRes.data ?? []).length, 400],
    ['inspiration_photo', (inspirationsRes.data ?? []).length, 300],
    ['note_line', (remarksRes.data ?? []).length, 400],
    ['concept_change', (ideaChangesRes.data ?? []).length, 400],
  ]
  for (const [table, n, cap] of caps) {
    if (n >= cap) await logError('journal read hit its row cap', new Error(table), { source: 'journal.readJournalDays', metadata: { table, from, to, cap } })
  }
  for (const [table, res] of [['voice_note', voicesRes], ['oeuvre_versions', versionsRes], ['kaizen_item', creationRes], ['inspiration_photo', inspirationsRes], ['note_line', remarksRes], ['concept_change', ideaChangesRes]] as const) {
    if (res.error) await logError('journal read failed', res.error, { source: 'journal.readJournalDays', metadata: { table, from, to } })
  }

  const rows = entriesRes.data ?? []
  const entryIds = rows.map((r) => r.id)
  type LinkRow = {
    id: number
    entry_id: number
    oeuvre_id: number | null
    concept_id: string | null
    contact_id?: number | null
    validated_at: string | null
    proposed_by: string
    rejected_at?: string | null
  }
  const conceptTitles = new Map((conceptsRes.data ?? []).map((c) => [c.id, c.titre as string | null]))

  const versions = (versionsRes.data ?? []).filter((v) => inRange(calendarDayInParisFromIso(v.changed_at)))
  // Per day: every work changed (the true count) and, for the details, the first 100 of that day — a bulk
  // edit on one day (1,177 works on 2026-11-15) must not push the other days' works out of the read.
  const worksByDay = new Map<string, number[]>()
  for (const v of versions) {
    const day = calendarDayInParisFromIso(v.changed_at)
    const list = worksByDay.get(day) ?? []
    if (!list.includes(v.oeuvre_id)) list.push(v.oeuvre_id)
    worksByDay.set(day, list)
  }
  const detailIds = new Map([...worksByDay].map(([day, ids]) => [day, new Set(ids.slice(0, 100))]))
  const changedIds = [...new Set([...detailIds.values()].flatMap((set) => [...set]))]
  const creationRows = (creationRes.data ?? []).filter((k) => inRange(calendarDayInParisFromIso(k.created_at)))
  const voiceRows = ((voicesRes.data ?? []) as VoiceRow[]).filter((v) => inRange(calendarDayInParisFromIso(v.created_at)))
  const inspirationRows = (inspirationsRes.data ?? []) as InspirationRow[]
  const remarkRows = ((remarksRes.data ?? []) as RemarkRow[]).filter((n) => inRange(calendarDayInParisFromIso(n.created_at)))
  const authorIds = [
    ...new Set(
      [
        ...rows.map((r) => r.author_id),
        ...creationRows.map((k) => k.author_id),
        ...voiceRows.map((v) => v.user_id),
        ...inspirationRows.map((p) => p.author_id),
        ...remarkRows.map((n) => n.author_id),
        ...((ideaChangesRes.data ?? []) as IdeaChangeRow[]).map((r) => r.changed_by),
        ...versions.map((v) => v.changed_by),
      ].filter((x): x is string => !!x),
    ),
  ]
  const voiceIds = [...new Set(rows.map((r) => r.voice_note_id).filter((v): v is string => !!v))]
  // Voice notes of the run not carried by its entries: their transcript entry may sit on another day.
  const carriedHere = new Set(voiceIds)
  const voiceIdsToCheck = voiceRows.map((v) => v.id).filter((id) => !carriedHere.has(id))

  // Wave 2: what the rows point to (links → works is the only chain left).
  const linksAndWorks = (async () => {
    const links = entryIds.length
      ? (((await supabase.from('journal_entry_link').select('*').in('entry_id', entryIds)).data ?? []) as LinkRow[])
      : []
    const workIds = [
      ...new Set([
        ...links.filter((l) => l.oeuvre_id != null).map((l) => l.oeuvre_id as number),
        ...changedIds,
        ...remarkRows.map((n) => n.oeuvre_id).filter((x): x is number => x != null),
      ]),
    ]
    // People named with `@` (journal_step_b2.sql): their list name; a contact the reader cannot see is left out.
    const personIds = [...new Set(links.filter((l) => l.contact_id != null && l.validated_at).map((l) => Number(l.contact_id)))]
    const [worksRes, peopleRes] = await Promise.all([
      workIds.length ? supabase.from('Oeuvres').select('*').in('OeuvreID', workIds) : Promise.resolve({ data: [] }),
      personIds.length ? supabase.from('Contact').select('*').in('ContactID', personIds) : Promise.resolve({ data: [] }),
    ])
    const works = (worksRes.data ?? []) as Array<Record<string, unknown>>
    const people = new Map<number, string>()
    for (const c of (peopleRes.data ?? []) as Array<Record<string, unknown>>) {
      people.set(Number(c.ContactID), contactListLabel(c as Parameters<typeof contactListLabel>[0], { fallback: `#${c.ContactID}` }))
    }
    return { links, works, people }
  })()
  // Step B (journal_step_b.sql): labels and suites. Before that SQL is live these reads fail and are empty.
  type LabelRow = { id: number; entry_id: number; label: string }
  type SuiteLinkRow = { entry_id: number; target_entry_id: number }
  const stepB = (async () => {
    if (!entryIds.length) return { labels: [] as LabelRow[], incoming: [] as SuiteLinkRow[] }
    const loose = supabase as unknown as { from: (t: string) => any }
    const [labelsRes, incomingRes] = await Promise.all([
      loose.from('journal_entry_label').select('id, entry_id, label').in('entry_id', entryIds).is('removed_at', null).limit(2000),
      loose.from('journal_entry_link').select('entry_id, target_entry_id').in('target_entry_id', entryIds).eq('relation', 'suite').not('validated_at', 'is', null).limit(500),
    ])
    return { labels: (labelsRes.error ? [] : labelsRes.data ?? []) as LabelRow[], incoming: (incomingRes.error ? [] : incomingRes.data ?? []) as SuiteLinkRow[] }
  })()
  const [{ links: linkRows, works, people }, laterRes, contactsRes, audioRes, carriedRes, stepBRes] = await Promise.all([
    linksAndWorks,
    changedIds.length
      ? supabase
          .from('oeuvre_versions')
          // `*`: also `changed_via` / `approved_by` (oeuvre_version_author.sql) once live; before, the read still works.
          .select('*')
          .in('oeuvre_id', changedIds)
          .gte('changed_at', win.from)
          .order('changed_at', { ascending: true })
          .limit(4000)
      : Promise.resolve({ data: [] as Array<{ oeuvre_id: number; changed_at: string; snapshot: unknown }> }),
    // `select('*')`: the typed select parser rejects the accented `Prénom` column name.
    authorIds.length ? supabase.from('Contact').select('*').in('auth_user_id', authorIds) : Promise.resolve({ data: [] }),
    voiceIds.length
      ? supabase
          .from('voice_note')
          .select('id, audio_r2_key, subject, oeuvre_id, concept_id, process_id, condition_report_id, transcript')
          .in('id', voiceIds)
      : Promise.resolve({ data: [] as Array<VoiceNoteLinks & { id: string; audio_r2_key: string | null; transcript: string | null }> }),
    voiceIdsToCheck.length
      ? supabase.from('journal_entry').select('voice_note_id').in('voice_note_id', voiceIdsToCheck)
      : Promise.resolve({ data: [] as Array<{ voice_note_id: string | null }> }),
    stepB,
  ])
  // Wave 3 (Step B only): the entries on the other end of suites — the earlier note a suite answers, and the
  // later suites of an entry — with their day and their latest correction.
  const outgoing = (linkRows as Array<LinkRow & { target_entry_id?: number | null; relation?: string | null }>).filter(
    (l) => l.target_entry_id != null && l.relation === 'suite' && l.validated_at,
  )
  const otherIds = [...new Set([...outgoing.map((l) => Number(l.target_entry_id)), ...stepBRes.incoming.map((l) => Number(l.entry_id))])]
  const others = new Map<number, { id: number; day: string; created_at: string; body: string }>()
  if (otherIds.length) {
    const [othersRes, otherFixRes] = await Promise.all([
      supabase.from('journal_entry').select('id, event_on, created_at, body, hidden_at').in('id', otherIds),
      supabase.from('journal_entry').select('corrects_id, body, created_at, hidden_at').in('corrects_id', otherIds),
    ])
    const fix = latestCorrections(otherFixRes.data ?? [])
    for (const o of othersRes.data ?? []) {
      if (o.hidden_at && !isAdmin) continue
      others.set(Number(o.id), { id: Number(o.id), day: String(o.event_on), created_at: o.created_at, body: fix.get(Number(o.id)) ?? o.body })
    }
  }
  const snippet = (t: string) => (t.length > 80 ? `${t.slice(0, 80)}…` : t)

  const titles = new Map<number, string | null>()
  const covers = new Map<number, string | null>()
  const current = new Map<number, Record<string, unknown>>()
  for (const w of works) {
    titles.set(w.OeuvreID as number, (w.Titre as string | null) ?? null)
    covers.set(w.OeuvreID as number, (w.txtImageNameLink as string | null) ?? null)
    current.set(w.OeuvreID as number, w)
  }

  const conceptOptions = (conceptsRes.data ?? [])
    .filter((c) => (c.titre ?? '').trim())
    .map((c) => ({ id: c.id, title: (c.titre as string).trim() }))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base', numeric: true })) // A → Z (Pem 2026-11-23)

  const out = new Map<string, JournalDayExtras>()
  const dayOf = (day: string) => {
    let d = out.get(day)
    if (!d) {
      d = emptyDay(isAdmin, conceptOptions)
      out.set(day, d)
    }
    return d
  }
  for (let t = Date.parse(`${from}T12:00:00Z`), end = Date.parse(`${to}T12:00:00Z`); t <= end; t += 86_400_000) {
    dayOf(new Date(t).toISOString().slice(0, 10))
  }

  // Field changes: each version row is the work BEFORE a save; the state after is the next version row
  // of that work, or the current row. Grouped by the Paris day of the save.
  // Who made each change (badges, design 2026-11-23 WorkChangeBadges): one line per work per day, its authors
  // in order of their first change that day.
  type VersionRow = AuthorRow & { oeuvre_id: number; changed_at: string; snapshot: Record<string, unknown> }
  const laterRows = (laterRes.data ?? []) as unknown as VersionRow[]
  const authorContacts = new Map<string, AuthorContactRow>()
  for (const c of (contactsRes.data ?? []) as AuthorContactRow[]) if (c.auth_user_id) authorContacts.set(c.auth_user_id, c)
  {
    const missing = authorIdsOf(laterRows).filter((id) => !authorContacts.has(id))
    if (missing.length) {
      const { data } = await supabase.from('Contact').select('*').in('auth_user_id', missing)
      for (const c of (data ?? []) as AuthorContactRow[]) if (c.auth_user_id) authorContacts.set(c.auth_user_id, c)
    }
  }
  if (changedIds.length) {
    const byWork = new Map<number, VersionRow[]>()
    for (const v of laterRows) {
      const list = byWork.get(v.oeuvre_id) ?? []
      list.push(v)
      byWork.set(v.oeuvre_id, list)
    }
    const perDay = new Map<string, Map<number, Set<string>>>()
    const authorsPerDay = new Map<string, Map<number, ChangeAuthor[]>>()
    for (const oid of changedIds) {
      const list = byWork.get(oid) ?? []
      list.forEach((v, i) => {
        const day = calendarDayInParisFromIso(v.changed_at)
        if (!inRange(day) || !detailIds.get(day)?.has(oid)) return
        const after = list[i + 1]?.snapshot ?? current.get(oid) ?? null
        const fields = changedVersionFields(v.snapshot, after).map((c) => c.field)
        if (!fields.length) return
        const m = perDay.get(day) ?? new Map<number, Set<string>>()
        const s = m.get(oid) ?? new Set<string>()
        fields.forEach((f) => s.add(f))
        m.set(oid, s)
        perDay.set(day, m)
        const am = authorsPerDay.get(day) ?? new Map<number, ChangeAuthor[]>()
        const by = am.get(oid) ?? []
        addAuthor(by, authorOfRow(v, authorContacts))
        am.set(oid, by)
        authorsPerDay.set(day, am)
      })
    }
    for (const [day, m] of perDay) {
      const changes: JournalDayChange[] = [...m].map(([oid, s]) => ({
        oeuvre_id: oid,
        title: titles.get(oid) ?? null,
        fields: [...s],
        by: authorsPerDay.get(day)?.get(oid) ?? [],
      }))
      dayOf(day).changes = changes
    }
  }

  for (const [day, ids] of worksByDay) dayOf(day).changedWorks = ids.length

  // Idea lines: one per idea and kind of change per day; the text saved five times that day is one line « ×5 ».
  {
    const ideaRows = (ideaChangesRes.data ?? []) as IdeaChangeRow[]
    const ideaIds = [...new Set(ideaRows.map((r) => r.concept_id))]
    const { data: ideaNames } = ideaIds.length ? await supabase.from('concept').select('id, titre').in('id', ideaIds) : { data: [] as Array<{ id: string; titre: string | null }> }
    const ideaTitle = new Map((ideaNames ?? []).map((c) => [c.id as string, (c.titre as string | null) ?? null]))
    const perDay = new Map<string, Map<string, JournalDayIdeaChange>>()
    for (const r of ideaRows) {
      const day = calendarDayInParisFromIso(r.changed_at)
      if (!inRange(day)) continue
      const k = `${r.concept_id}:${r.what}`
      const m = perDay.get(day) ?? new Map<string, JournalDayIdeaChange>()
      const prev = m.get(k)
      m.set(k, {
        key: `idea-${r.id}`,
        at: r.changed_at,
        conceptId: r.concept_id,
        title: ideaTitle.get(r.concept_id) ?? null,
        what: r.what as JournalDayIdeaChange['what'],
        to: r.to_value,
        count: (prev?.count ?? 0) + 1,
        by: r.changed_by,
      })
      perDay.set(day, m)
    }
    for (const [day, m] of perDay) dayOf(day).ideaChanges = [...m.values()]
  }

  const names: Record<string, string> = {}
  for (const c of (contactsRes.data ?? []) as { auth_user_id: string | null; Prénom: string | null; Nom: string | null }[]) {
    if (c.auth_user_id) names[c.auth_user_id] = [c.Prénom, c.Nom].filter(Boolean).join(' ').trim() || '—'
  }
  for (const d of out.values()) for (const x of d.ideaChanges ?? []) x.by = x.by ? names[x.by] ?? null : null

  const audioKeys = new Map<string, string | null>()
  const voiceLinks = new Map<string, VoiceNoteLinks>()
  const liveWords = new Map<string, string | null>()
  for (const v of audioRes.data ?? []) {
    audioKeys.set(v.id, v.audio_r2_key)
    liveWords.set(v.id, v.transcript?.trim() || null)
    voiceLinks.set(v.id, {
      subject: v.subject,
      oeuvre_id: v.oeuvre_id,
      concept_id: v.concept_id,
      process_id: v.process_id,
      condition_report_id: v.condition_report_id,
    })
  }

  // A correction (`corrects_id`) is shown in place of its original, never as a card of its own.
  const latestFix = latestCorrections(rows)
  const fixRows = latestCorrectionRows(rows)

  const photoEntries = new Map<string, number>()
  const worksOf = (id: number) =>
    linkRows
      .filter((l) => l.entry_id === id && l.oeuvre_id != null && l.validated_at)
      .map((l) => ({ id: l.oeuvre_id as number, title: titles.get(l.oeuvre_id as number) ?? null, thumb: covers.get(l.oeuvre_id as number) ?? null }))
  const conceptsOf = (id: number) =>
    linkRows
      .filter((l) => l.entry_id === id && l.concept_id != null && l.validated_at)
      .map((l) => ({ id: l.concept_id as string, title: conceptTitles.get(l.concept_id as string) ?? null }))
  const peopleOf = (id: number) =>
    linkRows
      .filter((l) => l.entry_id === id && l.contact_id != null && l.validated_at && people.has(Number(l.contact_id)))
      .map((l) => ({ id: Number(l.contact_id), name: people.get(Number(l.contact_id)) as string }))

  for (const r of rows) {
    if (r.corrects_id != null || (r.hidden_at && !isAdmin)) continue
    // A photo's text is its entry (journal_step_b2.sql): drawn on the photo's card, never as a card of its own.
    const photoId = (r as { photo_id?: string | null }).photo_id
    if (photoId) {
      photoEntries.set(photoId, r.id)
      continue
    }
    const entry: JournalDayEntry = {
      id: r.id,
      created_at: r.created_at,
      event_on: r.event_on,
      event_precision: r.event_precision,
      kind: r.kind,
      body: latestFix.get(r.id) ?? r.body,
      provenance: r.provenance,
      // The text shown is the latest correction: its own check state (a PC transcript stays « non vérifié »).
      verification: fixRows.get(r.id)?.verification ?? r.verification,
      textId: fixRows.get(r.id)?.id ?? r.id,
      pcProposal: (() => {
        const p = rows
          .filter((x) => x.corrects_id === r.id && x.hidden_at && (x.engine ?? '').endsWith('→ proposition') && x.verification === 'unverified' && !isPlaceholderText(x.body))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
        const shown = fixRows.get(r.id)?.body ?? r.body
        return p && p.body.trim() !== shown.trim() ? { id: Number(p.id), body: p.body } : null
      })(),
      pcTouched: rows.some((x) => x.corrects_id === r.id && (x.engine ?? '').startsWith('faster-whisper')),
      visibility: r.visibility,
      // The first text, under « voir le texte d'origine » — never a placeholder, never the same words again.
      original: latestFix.has(r.id) && !isPlaceholderText(r.body) && (latestFix.get(r.id) ?? '').trim() !== r.body.trim() ? r.body : null,
      author: (r.author_id && names[r.author_id]) || '—',
      mine: r.author_id === userId,
      hidden: !!r.hidden_at,
      voiceNoteId: r.voice_note_id ?? null,
      audioKey: r.voice_note_id ? audioKeys.get(r.voice_note_id) ?? null : null,
      voiceLinks: r.voice_note_id ? voiceLinks.get(r.voice_note_id) ?? null : null,
      engine: fixRows.get(r.id)?.engine ?? r.engine ?? null,
      liveWords: r.voice_note_id ? liveWords.get(r.voice_note_id) ?? null : null,
      works: linkRows
        .filter((l) => l.entry_id === r.id && l.oeuvre_id != null && l.validated_at)
        .map((l) => ({ id: l.oeuvre_id as number, title: titles.get(l.oeuvre_id as number) ?? null, thumb: covers.get(l.oeuvre_id as number) ?? null })),
      concepts: linkRows
        .filter((l) => l.entry_id === r.id && l.concept_id != null && l.validated_at)
        .map((l) => ({ id: l.concept_id as string, title: conceptTitles.get(l.concept_id as string) ?? null })),
      people: peopleOf(r.id),
      labels: stepBRes.labels.filter((l) => Number(l.entry_id) === r.id).map((l) => ({ id: Number(l.id), label: l.label })),
      suiteOf: (() => {
        const l = outgoing.find((x) => x.entry_id === r.id)
        const o = l ? others.get(Number(l.target_entry_id)) : undefined
        return o ? { id: o.id, day: o.day, snippet: snippet(o.body) } : null
      })(),
      suites: stepBRes.incoming
        .filter((l) => Number(l.target_entry_id) === r.id)
        .map((l) => others.get(Number(l.entry_id)))
        .filter((o): o is { id: number; day: string; created_at: string; body: string } => !!o)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      proposals: linkRows
        .filter((l) => l.entry_id === r.id && l.proposed_by === 'ai' && !l.validated_at && !l.rejected_at)
        .map((l) => ({
          linkId: l.id,
          workId: l.oeuvre_id,
          conceptId: l.concept_id,
          title: l.oeuvre_id != null ? titles.get(l.oeuvre_id) ?? null : conceptTitles.get(l.concept_id as string) ?? null,
          thumb: l.oeuvre_id != null ? covers.get(l.oeuvre_id) ?? null : null,
        })),
    }
    dayOf(r.event_on).entries.push(entry)
  }

  const withEntry = new Set([
    ...carriedHere,
    ...(carriedRes.data ?? []).map((r) => r.voice_note_id).filter((v): v is string => !!v),
  ])
  for (const { audio_r2_key, user_id, ...v } of voiceRows) {
    dayOf(calendarDayInParisFromIso(v.created_at)).voices.push({
      ...v,
      audioKey: audio_r2_key,
      author: names[user_id] || '—',
      mine: user_id === userId,
      hasEntry: withEntry.has(v.id),
    })
  }

  for (const k of creationRows) {
    const item: JournalDayCreation = {
      id: k.id,
      created_at: k.created_at,
      title: k.title,
      body: k.body ?? '',
      author: (k.author_id && names[k.author_id]) || '—',
      done: !!k.done_at,
      works: (k.work_ids ?? []) as number[],
    }
    dayOf(calendarDayInParisFromIso(k.created_at)).creation.push(item)
  }

  for (const { author_id, hidden_at, ...p } of inspirationRows) {
    // Removed with its text (journal_step_b2.sql): hidden, never gone — only an admin sees it, to bring it back.
    if (hidden_at && !isAdmin) continue
    const entryId = photoEntries.get(p.id) ?? null
    dayOf(String(p.day)).inspirations.push({
      ...p,
      conceptTitle: p.concept_id ? conceptTitles.get(p.concept_id) ?? null : null,
      author: names[author_id] || '—',
      entryId,
      hidden: !!hidden_at,
      meta: (p as { meta?: Record<string, unknown> | null }).meta ?? null,
      works: entryId != null ? worksOf(entryId) : [],
      concepts: entryId != null ? conceptsOf(entryId) : [],
      people: entryId != null ? peopleOf(entryId) : [],
    })
  }

  for (const n of remarkRows) {
    const remark: JournalDayRemark = {
      id: n.id,
      created_at: n.created_at,
      body: n.body,
      imageKey: n.image_key,
      oeuvreId: n.oeuvre_id,
      workTitle: n.oeuvre_id != null ? titles.get(n.oeuvre_id) ?? null : null,
      workThumb: n.oeuvre_id != null ? covers.get(n.oeuvre_id) ?? null : null,
      conceptId: n.concept_id,
      conceptTitle: n.concept_id ? conceptTitles.get(n.concept_id) ?? null : null,
      author: (n.author_id && names[n.author_id]) || '—',
    }
    dayOf(calendarDayInParisFromIso(n.created_at)).remarks.push(remark)
  }

  return out
}
