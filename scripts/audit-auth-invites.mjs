/**
 * List recent Supabase auth users (invited/created) to find mistaken invite targets.
 * Usage: node scripts/audit-auth-invites.mjs [hoursAgo=48]
 */
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const hours = Number(process.argv[2] ?? 48)
const since = Date.now() - hours * 60 * 60 * 1000

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(url, key)

const recent = []
for (let page = 1; page <= 50; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  for (const u of data.users) {
    const ts = new Date(u.created_at ?? u.invited_at ?? 0).getTime()
    if (ts >= since) {
      recent.push({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        invited_at: u.invited_at,
        confirmed_at: u.confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
      })
    }
  }
  if (data.users.length < 200) break
}

recent.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

console.log(`Auth users created/invited in last ${hours}h: ${recent.length}`)
for (const r of recent) {
  console.log(r)
}

// Contact 969 context if present
const { data: c969 } = await sb
  .from('Contact')
  .select('ContactID, Email, auth_user_id, is_team_member')
  .eq('ContactID', 969)
  .maybeSingle()
console.log('\nContact #969:', c969 ?? 'not found')
