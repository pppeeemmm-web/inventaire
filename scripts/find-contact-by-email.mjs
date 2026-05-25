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
const needle = (process.argv[2] ?? 'mmetegill@gmail.com').toLowerCase()
const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: auth } = await sb.auth.admin.listUsers({ perPage: 500 })
const authHit = auth.users.find((u) => u.email?.toLowerCase() === needle)
console.log('Auth user:', authHit ? { id: authHit.id, email: authHit.email } : 'NOT FOUND')

const { data: contacts } = await sb
  .from('Contact')
  .select('ContactID, Nom, Prenom, Email, auth_user_id, is_team_member')
  .ilike('Email', `%${needle.split('@')[0]}%`)

console.log('\nContacts (Email column):')
for (const c of contacts ?? []) console.log(c)

const { data: subs } = await sb.from('contact_emails').select('contact_id, email, is_primary').ilike('email', `%${needle.split('@')[0]}%`)
console.log('\ncontact_emails:')
for (const e of subs ?? []) console.log(e)

for (const id of [939, 969]) {
  const { data: c, error: ce } = await sb.from('Contact').select('ContactID, Email, auth_user_id, is_team_member').eq('ContactID', id).maybeSingle()
  if (ce) console.log('err', id, ce.message)
  const { data: em } = await sb.from('contact_emails').select('email, is_primary').eq('contact_id', id)
  console.log(`\nContact #${id}:`, c, 'emails:', em)
}
