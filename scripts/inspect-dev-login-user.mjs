import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const devEmail = process.env.DEV_AUTO_LOGIN_EMAIL
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(url, key)

if (!devEmail) {
  console.log('DEV_AUTO_LOGIN_EMAIL is not set in .env.local')
  process.exit(0)
}

const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 200 })
if (error) {
  console.error(error.message)
  process.exit(1)
}

const devUser = users.users.find((u) => u.email?.toLowerCase() === devEmail.toLowerCase())
if (!devUser) {
  console.log(`No Supabase user for DEV_AUTO_LOGIN_EMAIL: ${devEmail}`)
  process.exit(0)
}

console.log('Dev auto-login maps to:')
console.log({ email: devUser.email, user_id: devUser.id })

const { data: contact } = await supabase
  .from('Contact')
  .select('ContactID,is_admin,is_team_member,auth_user_id')
  .eq('auth_user_id', devUser.id)
  .maybeSingle()
console.log('\nContact link:', contact ?? 'NONE (is_team() will be false)')

const { data: isTeam } = await supabase.rpc('is_team', {}, { head: false })
// rpc as service role doesn't set auth.uid - skip

const { data: allSessions } = await supabase
  .from('work_session')
  .select('id,user_id', { count: 'exact', head: true })
console.log('\nTotal work_session rows in DB (service role):', allSessions)

const { data: sessions } = await supabase
  .from('work_session')
  .select('id,status,updated_at,payload')
  .eq('user_id', devUser.id)
  .order('updated_at', { ascending: false })
  .limit(8)

console.log(`\nLast ${sessions?.length ?? 0} work_session rows for this user:`)
for (const r of sessions ?? []) {
  const p = r.payload
  const day = p?.session_day ?? null
  const items = Array.isArray(p?.items) ? p.items.length : 0
  const shots = (Array.isArray(p?.shots) ? p.shots.length : 0)
    + (Array.isArray(p?.items) ? p.items.reduce((s, i) => s + (i?.shots?.length ?? 0), 0) : 0)
  console.log({ id: r.id.slice(0, 8), status: r.status, session_day: day, items, shots, updated_at: r.updated_at })
}

const { data: may20 } = await supabase
  .from('work_session')
  .select('id,user_id,status,payload,updated_at')
  .filter('payload->>session_day', 'eq', '2026-05-20')

console.log('\nAll sessions with payload.session_day = 2026-05-20:')
for (const r of may20 ?? []) {
  const p = r.payload
  const items = Array.isArray(p?.items) ? p.items.length : 0
  const shots = (Array.isArray(p?.shots) ? p.shots.length : 0)
    + (Array.isArray(p?.items) ? p.items.reduce((s, i) => s + (i?.shots?.length ?? 0), 0) : 0)
  const mine = r.user_id === devUser.id
  console.log({ mine, user_id: r.user_id.slice(0, 8), items, shots, status: r.status, updated_at: r.updated_at })
}
