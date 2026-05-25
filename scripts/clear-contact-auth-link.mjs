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
if (!contactId) {
  console.error('Usage: node scripts/clear-contact-auth-link.mjs <ContactID>')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await sb
  .from('Contact')
  .update({ auth_user_id: null })
  .eq('ContactID', contactId)
  .select('ContactID, Email, auth_user_id')
if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log('Cleared:', data)
