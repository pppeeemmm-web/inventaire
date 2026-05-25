/**
 * One-shot: link a Supabase auth user to a team Contact row.
 * Usage: node scripts/link-auth-contact.mjs <email> <auth_user_uuid>
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

const email = process.argv[2]?.trim().toLowerCase()
const uid = process.argv[3]?.trim()
if (!email || !uid) {
  console.error('Usage: node scripts/link-auth-contact.mjs <email> <auth_user_uuid>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(url, key)

let contactId = null

const { data: byPrimary } = await sb
  .from('Contact')
  .select('ContactID,Email,auth_user_id,is_team_member,Nom,Prenom')
  .ilike('Email', email)
  .limit(5)

if (byPrimary?.length === 1) {
  contactId = byPrimary[0].ContactID
  console.log('Match: Contact.Email', byPrimary[0])
} else if (byPrimary && byPrimary.length > 1) {
  console.error('Multiple Contact rows with this Email — fix manually:', byPrimary)
  process.exit(2)
}

if (!contactId) {
  const { data: sub } = await sb
    .from('contact_emails')
    .select('ContactID,email')
    .ilike('email', email)
    .limit(5)
  if (sub?.length === 1) {
    contactId = sub[0].ContactID
    console.log('Match: contact_emails', sub[0])
  } else if (sub && sub.length > 1) {
    console.error('Multiple contact_emails — fix manually:', sub)
    process.exit(2)
  }
}

if (!contactId) {
  const needle = email.split('@')[0]
  const { data: fuzzy } = await sb
    .from('Contact')
    .select('ContactID,Email,auth_user_id,is_team_member,Nom,Prenom')
    .or(`Email.ilike.%${needle}%,Nom.ilike.%${needle}%,Prenom.ilike.%${needle}%`)
    .limit(10)
  console.log('No exact email match. Fuzzy:', fuzzy ?? [])
  if (fuzzy?.length === 1) {
    contactId = fuzzy[0].ContactID
    console.log('Using sole fuzzy match ContactID', contactId)
  } else if (process.argv.includes('--create')) {
    const local = email.split('@')[0] ?? 'team'
    const { data: created, error: createErr } = await sb
      .from('Contact')
      .insert({
        Email: email,
        Nom: local,
        Actif: true,
        is_team_member: true,
        IsTeamMember: true,
        auth_user_id: uid,
      })
      .select('ContactID,Email,auth_user_id,is_team_member,Nom')
      .single()
    if (createErr) {
      console.error('CREATE failed:', createErr.message)
      process.exit(1)
    }
    console.log('CREATED + LINKED:', created)
    process.exit(0)
  } else {
    console.error('NO Contact in database for this email. Re-run with --create to add a team Contact row.')
    process.exit(1)
  }
}

const { data: updated, error } = await sb
  .from('Contact')
  .update({
    auth_user_id: uid,
    is_team_member: true,
    Email: email,
  })
  .eq('ContactID', contactId)
  .select('ContactID,Email,auth_user_id,is_team_member,Nom')
  .single()

if (error) {
  console.error('UPDATE failed:', error.message)
  process.exit(1)
}

console.log('LINKED OK:', updated)
