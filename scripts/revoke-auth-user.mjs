/**
 * Delete a mistaken Supabase auth user (invalidates invite link; cannot unsend email).
 * Usage: node scripts/revoke-auth-user.mjs <auth_user_uuid>
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

const uid = process.argv[2]?.trim()
if (!uid) {
  console.error('Usage: node scripts/revoke-auth-user.mjs <auth_user_uuid>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(url, key)

const { data: contacts } = await sb.from('Contact').select('ContactID,Email,auth_user_id').eq('auth_user_id', uid)
console.log('Contacts linked to this uid:', contacts ?? [])

const { data: userRes, error: getErr } = await sb.auth.admin.getUserById(uid)
if (getErr) {
  console.error('getUserById:', getErr.message)
  process.exit(1)
}
console.log('User:', {
  email: userRes.user?.email,
  created_at: userRes.user?.created_at,
  invited_at: userRes.user?.invited_at,
  confirmed: userRes.user?.email_confirmed_at,
})

const { error } = await sb.auth.admin.deleteUser(uid)
if (error) {
  console.error('deleteUser failed:', error.message)
  process.exit(1)
}
console.log('Deleted', uid, '— invite magic link no longer works. Email already sent cannot be recalled.')
