#!/usr/bin/env node
/**
 * Old work notes → note lines (R1 step 7, 2026-11-17). Dry run by default; `--apply` writes (Pem's GO
 * 2026-11-17, « go all »). The old `Oeuvres.Commentaires` / `Historique` text is never touched.
 *
 * Shows the `note_line` rows (target_kind 'work') the old `Oeuvres.Commentaires` / `Oeuvres.Historique`
 * text would become, under Pem's answers (2026-11-17, preview docs/design/2026-11-17/R1_OldNotes.preview.md):
 *   1. Historique stays the work's log: only its hand-written lines move (one row each). Lines the app
 *      wrote (status / place changes, sessions, gifts, the `date - who - place` custody line) stay.
 *   2. Unknown author → Pem (the only admin account).
 *   3. Commentaires → ONE row per work, paragraphs kept together (line breaks kept), for readability.
 *   4. `?`-only placeholders are dropped (a whole field, or a `?`-only paragraph inside it).
 * Date: a date written in the text when there is one (`[22/04/2026] …`, `2026/06/03 - …`, `13/10/2026`),
 * else the day the text first appeared in `oeuvre_versions` (history since 2026-05-12), else none: the row
 * then carries OLD_NOTE_UNDATED_AT (2026-05-01T00:00Z), shown by the app as « avant mai 2026 »
 * (lib/note-line-dates.ts). Author: whoever saved that change, else Pem.
 *
 * Usage (from the repo root, needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local):
 *   node scripts/old-notes-to-lines.mjs                 summary + every work, before → after
 *   node scripts/old-notes-to-lines.mjs --json out.json the full proposal (rows as they would be inserted)
 *   node scripts/old-notes-to-lines.mjs --work 2287     one work
 *   node scripts/old-notes-to-lines.mjs --apply --expect 98
 *       writes the rows in ONE insert (all or nothing). Refuses when the row count isn't `--expect`, with
 *       `--work`, or when any of these lines is already on its work (a second run inserts nothing).
 */
import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'

loadDotenv({ path: '.env.local', override: false, quiet: true })

const args = process.argv.slice(2)
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const onlyWork = argVal('--work') ? Number(argVal('--work')) : null
const jsonOut = argVal('--json')
const apply = args.includes('--apply')
const expect = argVal('--expect') != null ? Number(argVal('--expect')) : null
const refuse = (msg) => {
  console.error(`old-notes-to-lines: ${msg} Nothing written.`)
  process.exit(2)
}
if (args.some((a) => /^--(write|commit)$/.test(a))) refuse('use --apply --expect <n>.')
if (apply && onlyWork != null) refuse('--apply moves every work at once; drop --work.')
if (apply && !Number.isInteger(expect)) refuse('--apply needs --expect <row count from the dry run>.')

/** Same value as OLD_NOTE_UNDATED_AT in lib/note-line-dates.ts: the app shows it as « avant mai 2026 ». */
const OLD_NOTE_UNDATED_AT = '2026-05-01T00:00:00.000Z'

const env = (name) => {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`Missing ${name} in .env.local`)
  return v
}
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

// ── Reads (select only) ─────────────────────────────────────────────────────────

async function readAll(table, columns, build = (q) => q, page = 1000) {
  const out = []
  for (let from = 0; ; from += page) {
    const { data, error } = await build(sb.from(table).select(columns)).range(from, from + page - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < page) return out
  }
}

function clean(s) {
  return String(s ?? '').replace(/\r\n?/g, '\n').trim()
}

const works = await readAll('Oeuvres', 'OeuvreID, Titre, Commentaires, Historique, deleted_at', (q) =>
  q.is('deleted_at', null).order('OeuvreID', { ascending: true }),
)
const withText = works.filter(
  (w) => (onlyWork == null || w.OeuvreID === onlyWork) && (clean(w.Commentaires) || clean(w.Historique)),
)
const ids = withText.map((w) => w.OeuvreID)

const versions = []
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100)
  versions.push(
    ...(await readAll('oeuvre_versions', 'oeuvre_id, changed_at, changed_by, snapshot', (q) =>
      q.in('oeuvre_id', chunk).order('changed_at', { ascending: true }),
    )),
  )
}
const contacts = await readAll('Contact', '*', (q) => q.not('auth_user_id', 'is', null))
const nameOf = new Map(
  contacts.map((c) => [c.auth_user_id, [c['Prénom'], c.Nom].filter(Boolean).join(' ').trim() || 'compte sans nom']),
)
const admins = contacts.filter((c) => c.is_admin === true)
if (admins.length !== 1) throw new Error(`expected exactly one admin account (Pem), found ${admins.length}`)
const PEM = admins[0].auth_user_id

// ── Shaping ─────────────────────────────────────────────────────────────────────

function isoFrom(d, m, y) {
  const dd = Number(d)
  const mm = Number(m)
  const yy = Number(y.length === 2 ? `20${y}` : y)
  if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2100)) return null
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** A date written in the line itself → { date, body } (body without a leading date prefix). */
function ownDate(line) {
  let m = line.match(/^\[(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\]\s*(.*)$/)
  if (m) return { date: isoFrom(m[3], m[2], m[1]), body: m[4] }
  m = line.match(/^\[(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\]\s*(.*)$/)
  if (m) return { date: isoFrom(m[1], m[2], m[3]), body: m[4] }
  m = line.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\s*-\s*(.*)$/)
  if (m) return { date: isoFrom(m[3], m[2], m[1]), body: m[4] }
  m = line.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})\s*$/)
  if (m) return { date: isoFrom(m[1], m[2], m[3]), body: line }
  return { date: null, body: line }
}

// Lines the app wrote itself (they stay in Historique): status / place changes, sessions, gifts,
// the custody line `date - who - place`.
const EVENT_RE = /→|^Statut\b|^Session terrain$|^Localisation\b|^Don à\s|^Atelier$/
const CUSTODY_RE = /^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\s*-\s*.+\s-\s/
/** `?`, `???`: a placeholder, not a note (dropped). */
const PLACEHOLDER_RE = /^[?\s.-]*$/

const paragraphs = (text) =>
  clean(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** First version transition where `has` turns true (old snapshot lacks it, next state has it). */
function firstSeen(work, col, has, list) {
  if (!list.length || has(list[0].snapshot?.[col])) return null
  for (let i = 0; i < list.length; i++) {
    const next = i + 1 < list.length ? list[i + 1].snapshot?.[col] : work[col]
    if (!has(list[i].snapshot?.[col]) && has(next)) return { by: list[i].changed_by, at: list[i].changed_at.slice(0, 10) }
  }
  return null
}

function row(work, field, body, own, seen) {
  const authorId = seen?.by ?? PEM
  return {
    field,
    // As it would be inserted (note_line): target_kind 'work'.
    insert: {
      target_kind: 'work',
      oeuvre_id: work.OeuvreID,
      body,
      author_id: authorId,
      // Noon UTC keeps the Paris calendar day; no date at all → « avant mai 2026 ».
      created_at: own || seen?.at ? `${own ?? seen.at}T12:00:00.000Z` : OLD_NOTE_UNDATED_AT,
    },
    author: nameOf.get(authorId) ?? 'compte inconnu',
    authorFrom: seen?.by ? 'history' : 'pem-default',
    dateFrom: own ? 'text' : seen?.at ? 'history' : 'before-may-2026',
  }
}

const byWork = new Map()
for (const v of versions) {
  const l = byWork.get(v.oeuvre_id) ?? []
  l.push(v)
  byWork.set(v.oeuvre_id, l)
}

const dropped = { placeholderFields: 0, placeholderParagraphs: 0, historiqueKept: 0 }
const proposal = withText.map((w) => {
  const list = byWork.get(w.OeuvreID) ?? []
  const rows = []

  // 3 + 4. Commentaires: one row, paragraphs kept together; `?`-only paragraphs dropped.
  const paras = paragraphs(w.Commentaires)
  const kept = paras.filter((p) => !PLACEHOLDER_RE.test(p))
  dropped.placeholderParagraphs += paras.length - kept.length
  if (paras.length && !kept.length) dropped.placeholderFields += 1
  if (kept.length) {
    const own = kept.map((p) => ownDate(p).date).filter(Boolean).sort()[0] ?? null
    const has = (txt) => {
      const now = paragraphs(txt)
      return kept.some((p) => now.includes(p))
    }
    rows.push(row(w, 'commentaires', kept.join('\n'), own, firstSeen(w, 'Commentaires', has, list)))
  }

  // 1. Historique: only hand-written lines move, one row each; the app's own lines stay.
  for (const raw of paragraphs(w.Historique)) {
    const { date, body } = ownDate(raw)
    const text = body.trim() || raw
    if (PLACEHOLDER_RE.test(text)) {
      dropped.placeholderParagraphs += 1
      continue
    }
    if (EVENT_RE.test(text) || CUSTODY_RE.test(raw)) {
      dropped.historiqueKept += 1
      continue
    }
    const has = (txt) => paragraphs(txt).includes(raw)
    rows.push(row(w, 'historique', text, date, firstSeen(w, 'Historique', has, list)))
  }

  return {
    oeuvre_id: w.OeuvreID,
    title: w.Titre,
    before: { commentaires: clean(w.Commentaires), historique: clean(w.Historique) },
    rows,
  }
})

// ── Report ──────────────────────────────────────────────────────────────────────

const all = proposal.flatMap((p) => p.rows)
const count = (f) => all.filter(f).length
const stats = {
  works_total: works.length,
  works_with_old_text: proposal.length,
  works_getting_lines: proposal.filter((p) => p.rows.length).length,
  rows_total: all.length,
  rows_commentaires: count((r) => r.field === 'commentaires'),
  rows_historique: count((r) => r.field === 'historique'),
  multi_paragraph_rows: count((r) => r.insert.body.includes('\n')),
  dated_from_text: count((r) => r.dateFrom === 'text'),
  dated_from_history: count((r) => r.dateFrom === 'history'),
  undated_before_may_2026: count((r) => r.dateFrom === 'before-may-2026'),
  author_from_history: count((r) => r.authorFrom === 'history'),
  author_pem_default: count((r) => r.authorFrom === 'pem-default'),
  historique_lines_staying_as_log: dropped.historiqueKept,
  placeholder_fields_dropped: dropped.placeholderFields,
  placeholder_paragraphs_dropped: dropped.placeholderParagraphs,
}

const fmtDate = (iso) => (iso === OLD_NOTE_UNDATED_AT ? 'avant mai 2026' : iso.slice(0, 10).split('-').reverse().join('/'))
console.log(apply ? 'old-notes-to-lines — APPLY' : 'old-notes-to-lines — DRY RUN, nothing written')
console.log(JSON.stringify(stats, null, 2))
for (const p of proposal) {
  console.log(`\n#${p.oeuvre_id} ${p.title ?? ''}`.trimEnd())
  if (p.before.commentaires) console.log(`  before Commentaires: ${JSON.stringify(p.before.commentaires)}`)
  if (p.before.historique) console.log(`  before Historique:   ${JSON.stringify(p.before.historique)}`)
  if (!p.rows.length) console.log('  → no line (placeholders / app log only)')
  for (const r of p.rows) {
    console.log(`  → [${r.field}] ${r.author} · ${fmtDate(r.insert.created_at)} — ${JSON.stringify(r.insert.body)}`)
  }
}
if (jsonOut) {
  await writeFile(jsonOut, JSON.stringify({ stats, proposal }, null, 2))
  console.log(`\nJSON written to ${jsonOut} (local file only)`)
}

// ── Write (--apply) ─────────────────────────────────────────────────────────────

if (apply) {
  const rows = all.map((r) => r.insert)
  if (rows.length !== expect) refuse(`${rows.length} rows to write, --expect says ${expect}.`)
  // Idempotent: any of these lines already on its work (same work, same text) → stop.
  const existing = await readAll('note_line', 'oeuvre_id, body', (q) =>
    q.eq('target_kind', 'work').in('oeuvre_id', [...new Set(rows.map((r) => r.oeuvre_id))]),
  )
  const key = (r) => `${r.oeuvre_id}|${r.body}`
  const have = new Set(existing.map(key))
  const already = rows.filter((r) => have.has(key(r)))
  if (already.length) refuse(`${already.length} of these lines are already on their work (moved before?).`)
  // One INSERT statement: all rows or none.
  const { data, error } = await sb.from('note_line').insert(rows).select('id')
  if (error) refuse(`insert failed: ${error.message}.`)
  console.log(`\nAPPLIED: ${data.length} note_line rows inserted (ids ${data[0]?.id}–${data[data.length - 1]?.id}).`)
}
