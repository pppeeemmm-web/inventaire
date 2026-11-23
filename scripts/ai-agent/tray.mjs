/**
 * Journal tray — photos the iPhone sends to this PC by Syncthing (Synctrain), made ready for the desk Journal.
 * Design: docs/design/2026-11-23/JournalDesk.md §6 (Pem 2026-11-23).
 *
 * Runs at the start of every PC agent pass (scripts/ai-agent/index.mjs), or alone: `npm run ai:agent -- --tray`.
 *   reads   JOURNAL_SYNC_DIR  (default %USERPROFILE%\Desktop\Sync all) — READ ONLY: nothing there is ever written,
 *           moved, renamed or deleted (a change would travel back to the iPhone).
 *   writes  JOURNAL_TRAY_DIR  (default %USERPROFILE%\Desktop\PEM-Tray, beside « Sync all » so the folder picker
 *           finds it — Pem 2026-11-23) — only there, only on this PC:
 *           previews/<h>.jpg (480 px), send/<h>.jpg (2100 px JPEG, what the browser sends), tray.json (the list).
 * Sends nothing anywhere: no database, no R2. A photo reaches the hub only when Pem picks it in the desk Journal,
 * which sends `send/<h>.jpg` through the same door as a paste (`addInspirationPhoto`).
 *
 * ImageMagick (`magick`, MAGICK_PATH to override) converts every format, HEIC included (Sharp has no HEIC
 * decoder; Windows' own decoder fails on some iPhone HEIC — both checked 2026-11-23), turns the picture upright
 * and reads the photo's own data (date taken, phone, lens, exposure, place) before stripping it from the copies.
 * Skipped: AVIF (Pem's Lightroom edits of works, already in the catalogue), hidden / Syncthing temp files,
 * files changed in the last minute (still arriving).
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SYNC_DIR = process.env.JOURNAL_SYNC_DIR?.trim() || path.join(os.homedir(), 'Desktop', 'Sync all')
const TRAY_DIR = process.env.JOURNAL_TRAY_DIR?.trim() || path.join(os.homedir(), 'Desktop', 'PEM-Tray')
const MAGICK = process.env.MAGICK_PATH?.trim() || 'magick'
const EXT = /\.(heic|heif|jpe?g|png|webp)$/i
const DAY_DIR = /^\d{4}-\d{2}-\d{2}$/
const SETTLE_MS = 60_000
const SEND_EDGE = 2100
const PREVIEW_EDGE = 480

/** The Journal's day (Europe/Paris) of a moment. */
const parisDay = (ms) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))

/** Same formula as the desk (components/journal/DeskImageCapture.tsx `idFromBytes`): a UUID from the SHA-256. */
export function idFromHash(h) {
  const v = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256')
    createReadStream(file).on('data', (b) => h.update(b)).on('error', reject).on('end', () => resolve(h.digest('hex')))
  })
}

function run(cmd, args) {
  return new Promise((resolve) => {
    let out = ''
    let err = ''
    const p = spawn(cmd, args, { windowsHide: true })
    p.stdout.on('data', (b) => (out += b))
    p.stderr.on('data', (b) => (err += b))
    p.on('error', (e) => resolve({ code: -1, out, err: e.message }))
    p.on('close', (code) => resolve({ code: code ?? -1, out, err }))
  })
}

/** « 43/1, 17/1, 1234/100 » + « N » → 43.2867… */
function gpsDecimal(v, ref) {
  const parts = String(v ?? '').split(',').map((s) => {
    const [a, b] = s.trim().split('/').map(Number)
    return b ? a / b : a
  })
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null
  const d = parts[0] + parts[1] / 60 + parts[2] / 3600
  return Math.round((/^[SW]/i.test(ref ?? '') ? -d : d) * 1e6) / 1e6
}

const FIELDS = ['DateTimeOriginal', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'PhotographicSensitivity', 'GPSLatitude', 'GPSLatitudeRef', 'GPSLongitude', 'GPSLongitudeRef']

/** One magick call: prints the photo's data, writes the upright 2100 px copy and the 480 px preview, both stripped. */
async function convert(src, sendOut, previewOut) {
  const fmt = `${FIELDS.map((f) => `%[EXIF:${f}]`).join('\t')}\t%w\t%h\n`
  const r = await run(MAGICK, [
    src,
    '-print', fmt,
    '-auto-orient', '-strip',
    '(', '+clone', '-resize', `${SEND_EDGE}x${SEND_EDGE}>`, '-quality', '88', '-write', `${sendOut}.part.jpg`, '+delete', ')',
    '-resize', `${PREVIEW_EDGE}x${PREVIEW_EDGE}>`, '-quality', '80', `${previewOut}.part.jpg`,
  ])
  if (r.code !== 0 || !existsSync(`${sendOut}.part.jpg`) || !existsSync(`${previewOut}.part.jpg`)) {
    await rm(`${sendOut}.part.jpg`, { force: true })
    await rm(`${previewOut}.part.jpg`, { force: true })
    return { error: (r.err || `exit ${r.code}`).replace(/\s+/g, ' ').slice(0, 200) }
  }
  await rename(`${sendOut}.part.jpg`, sendOut)
  await rename(`${previewOut}.part.jpg`, previewOut)
  const v = r.out.trim().split('\n').pop().split('\t')
  const get = (f) => (v[FIELDS.indexOf(f)] ?? '').trim() || null
  const lat = gpsDecimal(get('GPSLatitude'), get('GPSLatitudeRef'))
  const lon = gpsDecimal(get('GPSLongitude'), get('GPSLongitudeRef'))
  return {
    meta: {
      taken: get('DateTimeOriginal'),
      camera: get('Model'),
      lens: get('LensModel'),
      fnumber: get('FNumber'),
      exposure: get('ExposureTime'),
      iso: get('PhotographicSensitivity'),
      gps: lat != null && lon != null ? { lat, lon } : null,
    },
    w: Number(v[FIELDS.length]) || null,
    h: Number(v[FIELDS.length + 1]) || null,
  }
}

/** « 2026:06:03 11:17:11 » (the phone's clock, Paris) → « 2026-06-03 ». */
const takenDay = (s) => (/^(\d{4}):(\d{2}):(\d{2})/.exec(s ?? '') ?? []).slice(1, 4).join('-') || null

async function listFiles() {
  const out = []
  const walk = async (dir, rel) => {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') || ent.name.startsWith('~syncthing~')) continue
      const r = rel ? `${rel}/${ent.name}` : ent.name
      if (ent.isDirectory()) {
        if (!rel) await walk(path.join(dir, ent.name), r) // the phone's day folders, one level
      } else if (EXT.test(ent.name)) out.push(r)
    }
  }
  await walk(SYNC_DIR, '')
  return out
}

/**
 * One pass. `log` prints a line (the agent's log). Returns counts. Never throws for one bad file: it is listed
 * under `failed` in tray.json and tried again next pass.
 */
export async function runTray(log = console.log) {
  // The copies must never land in the synced folder (they would travel to the iPhone; the cleanup would delete there).
  const inside = (a, b) => !path.relative(a, b).startsWith('..') && !path.isAbsolute(path.relative(a, b))
  if (inside(path.resolve(SYNC_DIR), path.resolve(TRAY_DIR)) || inside(path.resolve(TRAY_DIR), path.resolve(SYNC_DIR))) {
    log(`tray: JOURNAL_TRAY_DIR and JOURNAL_SYNC_DIR overlap (${TRAY_DIR} / ${SYNC_DIR}) — skipped`)
    return { added: 0, total: 0 }
  }
  if (!existsSync(SYNC_DIR)) {
    log(`tray: no Syncthing folder at ${SYNC_DIR} — skipped`)
    return { added: 0, total: 0 }
  }
  await mkdir(path.join(TRAY_DIR, 'previews'), { recursive: true })
  await mkdir(path.join(TRAY_DIR, 'send'), { recursive: true })
  const listPath = path.join(TRAY_DIR, 'tray.json')
  let prev = { v: 1, from: null, items: [] }
  try {
    prev = JSON.parse(await readFile(listPath, 'utf8'))
    // eslint-disable-next-line pem-i18n/no-silent-catch -- first pass: no tray.json yet
  } catch {
    /* first pass */
  }
  // The tray starts on the day it goes live (Pem 2026-11-23); older photos are listed too, behind « plus anciens ».
  const from = process.env.JOURNAL_TRAY_FROM?.trim() || prev.from || parisDay(Date.now())
  const known = new Map((prev.items ?? []).map((it) => [`${it.rel}|${it.size}|${it.mtimeMs}`, it]))
  const items = []
  const failed = []
  let added = 0
  const now = Date.now()
  for (const rel of await listFiles()) {
    const abs = path.join(SYNC_DIR, rel)
    let st
    try {
      st = await stat(abs)
      // eslint-disable-next-line pem-i18n/no-silent-catch -- file gone since the listing: skipped
    } catch {
      continue
    }
    if (now - st.mtimeMs < SETTLE_MS) continue
    const old = known.get(`${rel}|${st.size}|${Math.round(st.mtimeMs)}`)
    if (old && existsSync(path.join(TRAY_DIR, old.send)) && existsSync(path.join(TRAY_DIR, old.preview))) {
      items.push(old)
      continue
    }
    try {
      const hash = await sha256(abs)
      const h16 = hash.slice(0, 16)
      const send = `send/${h16}.jpg`
      const preview = `previews/${h16}.jpg`
      const c = await convert(abs, path.join(TRAY_DIR, send), path.join(TRAY_DIR, preview))
      if ('error' in c) {
        failed.push({ rel, reason: c.error })
        continue
      }
      const folder = rel.includes('/') ? rel.split('/')[0] : ''
      const fromTaken = takenDay(c.meta.taken)
      const [day, dayFrom] = DAY_DIR.test(folder) ? [folder, 'folder'] : fromTaken ? [fromTaken, 'taken'] : [parisDay(st.mtimeMs), 'file']
      items.push({ id: idFromHash(hash), hash, rel, name: path.basename(rel), day, dayFrom, size: st.size, mtimeMs: Math.round(st.mtimeMs), w: c.w, h: c.h, meta: c.meta, send, preview })
      added++
      // eslint-disable-next-line pem-i18n/no-silent-catch -- kept in tray.json « failed », tried again next pass
    } catch (e) {
      failed.push({ rel, reason: e instanceof Error ? e.message : String(e) })
    }
  }
  // The same photo in two places (same bytes) is one item.
  const byId = new Map()
  for (const it of items) if (!byId.has(it.id)) byId.set(it.id, it)
  const list = [...byId.values()].sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name))
  // Copies of photos no longer in the folder go (only inside the tray folder).
  const keep = new Set(list.flatMap((it) => [it.send, it.preview]))
  for (const sub of ['send', 'previews'])
    for (const f of await readdir(path.join(TRAY_DIR, sub)))
      if (!keep.has(`${sub}/${f}`)) await rm(path.join(TRAY_DIR, sub, f), { force: true })
  const body = JSON.stringify({ v: 1, from, updatedAt: new Date().toISOString(), items: list, failed }, null, 1)
  await writeFile(`${listPath}.part`, body, 'utf8')
  await rename(`${listPath}.part`, listPath)
  log(`tray: ${list.length} photo(s) ready (${added} new${failed.length ? `, ${failed.length} failed` : ''}), from ${from} — ${TRAY_DIR}`)
  return { added, total: list.length, failed: failed.length }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runTray().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
