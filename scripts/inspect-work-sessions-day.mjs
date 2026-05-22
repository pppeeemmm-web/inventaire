/**
 * Inspect work_session rows for a calendar day (Europe/Paris matching).
 * Usage: node scripts/inspect-work-sessions-day.mjs 2025-05-20
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const calendarDay = process.argv[2] ?? '2025-05-20'
if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDay)) {
  console.error('Usage: node scripts/inspect-work-sessions-day.mjs YYYY-MM-DD')
  process.exit(1)
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

function parisDay(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') return { session_day: null, items: 0, topShots: 0, itemShots: 0 }
  const p = payload
  const items = Array.isArray(p.items) ? p.items : []
  const topShots = Array.isArray(p.shots) ? p.shots.length : 0
  let itemShots = 0
  let contentItems = 0
  for (const item of items) {
    const shots = Array.isArray(item?.shots) ? item.shots.length : 0
    itemShots += shots
    const has =
      (typeof item?.oeuvre_id === 'number' && item.oeuvre_id > 0)
      || (typeof item?.title_hint === 'string' && item.title_hint.trim())
      || shots > 0
      || (typeof item?.applied_shot_count === 'number' && item.applied_shot_count > 0)
    if (has) contentItems += 1
  }
  return {
    session_day: typeof p.session_day === 'string' ? p.session_day : null,
    session_at: typeof p.session_at === 'string' ? p.session_at : null,
    items: items.length,
    contentItems,
    topShots,
    itemShots,
  }
}

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(url, key)

const { data: rows, error } = await supabase
  .from('work_session')
  .select('id,user_id,status,oeuvre_id,created_at,updated_at,payload')
  .order('updated_at', { ascending: false })
  .limit(500)

if (error) {
  console.error('Query error:', error.message)
  process.exit(1)
}

const byStored = rows.filter((r) => {
  const p = r.payload
  return p && typeof p === 'object' && p.session_day === calendarDay
})

const byParis = rows.filter((r) => {
  const p = r.payload
  const at = p && typeof p === 'object' && typeof p.session_at === 'string' ? p.session_at : r.created_at
  return parisDay(at) === calendarDay
})

const seen = new Set()
const matched = []
for (const r of [...byStored, ...byParis]) {
  if (seen.has(r.id)) continue
  seen.add(r.id)
  matched.push(r)
}

console.log(`\n=== work_session for calendar day ${calendarDay} (Paris) ===`)
console.log(`Total rows scanned: ${rows.length}`)
console.log(`Matched: ${matched.length} (by session_day: ${byStored.length}, by session_at/created Paris: ${byParis.length})\n`)

for (const r of matched) {
  const s = summarizePayload(r.payload)
  console.log({
    id: r.id.slice(0, 8) + '…',
    status: r.status,
    user: r.user_id.slice(0, 8) + '…',
    oeuvre_id: r.oeuvre_id,
    updated_at: r.updated_at,
    ...s,
    paris_from_session_at: parisDay(s.session_at ?? r.created_at),
  })
}

if (matched.length === 0) {
  console.log('No rows for this day. Recent distinct session_day / Paris days in sample:')
  const days = new Map()
  for (const r of rows.slice(0, 80)) {
    const s = summarizePayload(r.payload)
    const d = s.session_day || parisDay(s.session_at ?? r.created_at)
    if (d) days.set(d, (days.get(d) ?? 0) + 1)
  }
  console.log([...days.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 20))
}
