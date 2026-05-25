/** Link auth UID to a specific ContactID. Usage: node scripts/link-contact-id.mjs <ContactID> <auth_uuid> */
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
const contactId = Number(process.argv[2])
const uid = process.argv[3]?.trim()
if (!contactId || !uid) {
  console.error('Usage: node scripts/link-contact-id.mjs <ContactID> <auth_user_uuid>')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data, error } = await sb
  .from('Contact')
  .update({
    auth_user_id: uid,
    is_team_member: true,
    IsTeamMember: true,
    is_private: false,
    Actif: true,
  })
  .eq('ContactID', contactId)
  .select('ContactID, Email, auth_user_id, is_team_member')
  .single()

if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log('LINKED:', data)
