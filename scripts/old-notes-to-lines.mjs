#!/usr/bin/env node
/**
 * Old work notes → note lines: PREVIEW ONLY (R1 step 7, 2026-11-17). Reads, never writes.
 *
 * Shows how each work's old `Oeuvres.Commentaires` / `Oeuvres.Historique` text would split into
 * `note_line` rows (target_kind 'work'): one row per paragraph / dated entry, with an author and a date.
 *   - Date: the line's own date when it has one (`[22/04/2026] …`, `[2026/05/31] …`, `2026/06/03 - Pem - …`,
 *     or a trailing `13/10/2026`), else the day the line first appeared in `oeuvre_versions`.
 *   - Author: whoever saved the change that first showed the line (`oeuvre_versions.changed_by`), else
 *     unknown (the text predates the version history, 2026-11).
 *   - Kind: `event` for lines the app wrote itself (status changes, sessions, places, gifts),
 *     `placeholder` for `?`-only lines, else `note`. Pem decides from the preview what becomes a line.
 *
 * Usage (from the repo root, needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local):
 *   node scripts/old-notes-to-lines.mjs                 summary + every work, before → after
 *   node scripts/old-notes-to-lines.mjs --json out.json the full proposal as JSON (local file)
 *   node scripts/old-notes-to-lines.mjs --work 2287     one work
 * There is no write mode: moving the text needs Pem's look at the preview and its own GO.
 */
import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'node:fs/promises'

loadDotenv({ path: '.env.local', override: false, quiet: true })

const args = process.argv.slice(2)
if (args.some((a) => /^--(apply|write|commit)$/.test(a))) {
  console.error('old-notes-to-lines: read-only preview. Moving old notes needs its own GO; nothing written.')
  process.exit(2)
}
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const onlyWork = argVal('--work') ? Number(argVal('--work')) : null
const jsonOut = argVal('--json')

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

// ── Splitting ───────────────────────────────────────────────────────────────────

function clean(s) {
  return String(s ?? '').replace(/\r\n?/g, '\n').trim()
}

function isoFrom(d, m, y) {
  const dd = Number(d)
  const mm = Number(m)
  const yy = Number(y.length === 2 ? `20${y}` : y)
  if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yy >= 1900 && yy <= 2100)) return null
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/** A date written in the line itself → { date, body } (body without the date prefix). */
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

// Lines the app wrote itself: status / place changes, sessions, gifts, the custody line `date - who - place`.
const EVENT_RE = /→|^Statut\b|^Session terrain$|^Localisation\b|^Don à\s|^Atelier$/
const CUSTODY_RE = /^\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\s*-\s*.+\s-\s/
/** `?`, `???`: a placeholder, not a note. */
const PLACEHOLDER_RE = /^[?\s.-]*$/

function splitField(field, text) {
  return clean(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      const { date, body } = ownDate(raw)
      const text = body.trim() || raw
      const kind = PLACEHOLDER_RE.test(text)
        ? 'placeholder'
        : field === 'historique' && (EVENT_RE.test(text) || CUSTODY_RE.test(raw))
          ? 'event'
          : 'note'
      return { field, raw, body: text, ownDate: date, kind }
    })
}

/** First version transition where the line shows up: (old snapshot lacks it, next state has it). */
function attribute(work, field, raw, list) {
  const col = field === 'commentaires' ? 'Commentaires' : 'Historique'
  const has = (txt) => clean(txt).split('\n').some((l) => l.trim() === raw)
  if (!list.length) return { by: null, at: null, before: true }
  if (has(list[0].snapshot?.[col])) return { by: null, at: null, before: true }
  for (let i = 0; i < list.length; i++) {
    const next = i + 1 < list.length ? list[i + 1].snapshot?.[col] : work[col]
    if (!has(list[i].snapshot?.[col]) && has(next)) {
      return { by: list[i].changed_by, at: list[i].changed_at.slice(0, 10), before: false }
    }
  }
  return { by: null, at: null, before: true }
}

const byWork = new Map()
for (const v of versions) {
  const l = byWork.get(v.oeuvre_id) ?? []
  l.push(v)
  byWork.set(v.oeuvre_id, l)
}

const proposal = withText.map((w) => {
  const list = byWork.get(w.OeuvreID) ?? []
  const lines = [...splitField('commentaires', w.Commentaires), ...splitField('historique', w.Historique)].map((l) => {
    const a = attribute(w, l.field, l.raw, list)
    return {
      ...l,
      date: l.ownDate ?? a.at,
      dateFrom: l.ownDate ? 'text' : a.at ? 'history' : null,
      author: a.by ? nameOf.get(a.by) ?? 'compte inconnu' : null,
      authorFrom: a.by ? 'history' : null,
    }
  })
  return {
    oeuvre_id: w.OeuvreID,
    title: w.Titre,
    before: { commentaires: clean(w.Commentaires), historique: clean(w.Historique) },
    lines,
  }
})

// ── Report ──────────────────────────────────────────────────────────────────────

const all = proposal.flatMap((p) => p.lines)
const count = (f) => all.filter(f).length
const stats = {
  works_total: works.length,
  works_with_text: proposal.length,
  works_with_commentaires: proposal.filter((p) => p.before.commentaires).length,
  works_with_historique: proposal.filter((p) => p.before.historique).length,
  lines_total: all.length,
  lines_commentaires: count((l) => l.field === 'commentaires'),
  lines_historique: count((l) => l.field === 'historique'),
  notes: count((l) => l.kind === 'note'),
  events: count((l) => l.kind === 'event'),
  placeholders: count((l) => l.kind === 'placeholder'),
  dated_from_text: count((l) => l.dateFrom === 'text'),
  dated_from_history: count((l) => l.dateFrom === 'history'),
  undated: count((l) => !l.date),
  author_from_history: count((l) => l.author),
  author_unknown: count((l) => !l.author),
  max_lines_one_work: Math.max(0, ...proposal.map((p) => p.lines.length)),
  works_with_versions: proposal.filter((p) => (byWork.get(p.oeuvre_id) ?? []).length).length,
}

const fmtDate = (d) => (d ? d.split('-').reverse().join('/') : 'date ?')
console.log('old-notes-to-lines — DRY RUN, nothing written')
console.log(JSON.stringify(stats, null, 2))
for (const p of proposal) {
  console.log(`\n#${p.oeuvre_id} ${p.title ?? ''}`.trimEnd())
  if (p.before.commentaires) console.log(`  before Commentaires: ${JSON.stringify(p.before.commentaires)}`)
  if (p.before.historique) console.log(`  before Historique:   ${JSON.stringify(p.before.historique)}`)
  for (const l of p.lines) {
    console.log(`  → [${l.kind}] ${l.author ?? '?'} · ${fmtDate(l.date)} — ${l.body}`)
  }
}
if (jsonOut) {
  await writeFile(jsonOut, JSON.stringify({ stats, proposal }, null, 2))
  console.log(`\nJSON written to ${jsonOut} (local file only)`)
}
