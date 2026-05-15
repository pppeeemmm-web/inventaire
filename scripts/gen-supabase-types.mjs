/**
 * Writes lib/types/supabase.generated.ts from your hosted Supabase schema.
 *
 * Prerequisites:
 * 1. Migrations applied on that project (e.g. voice_note / sketchbook SQL in Supabase).
 * 2. .env.local contains NEXT_PUBLIC_SUPABASE_URL (already used by the app).
 * 3. .env.local contains SUPABASE_ACCESS_TOKEN — create at:
 *    https://supabase.com/dashboard/account/tokens
 *
 * Run: npm run gen:types
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadDotEnvLocal() {
  const p = path.join(root, '.env.local')
  if (!existsSync(p)) return {}
  const raw = readFileSync(p, 'utf8')
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim()
    if (!s || s.startsWith('#')) continue
    const eq = s.indexOf('=')
    if (eq <= 0) continue
    const key = s.slice(0, eq).trim()
    let val = s.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const fileEnv = loadDotEnvLocal()
const urlStr = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL
const token = process.env.SUPABASE_ACCESS_TOKEN ?? fileEnv.SUPABASE_ACCESS_TOKEN

if (!urlStr) {
  console.error('[gen:types] Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}

let ref
try {
  const host = new URL(urlStr).hostname
  ref = host.split('.')[0]
} catch {
  console.error('[gen:types] Invalid NEXT_PUBLIC_SUPABASE_URL')
  process.exit(1)
}

if (!token) {
  console.error(`
[gen:types] Missing SUPABASE_ACCESS_TOKEN in .env.local

Do this once:
  1. Open https://supabase.com/dashboard/account/tokens
  2. Create a new access token (copy it once).
  3. Add a line to .env.local (same folder as package.json):
       SUPABASE_ACCESS_TOKEN=paste_token_here
  4. Never commit .env.local.

Then run again: npm run gen:types
`)
  process.exit(1)
}

const outFile = path.join(root, 'lib', 'types', 'supabase.generated.ts')
console.log('[gen:types] project ref:', ref)
console.log('[gen:types] output:', outFile)

const types = execSync(`npx --yes supabase gen types typescript --project-id ${ref}`, {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
  maxBuffer: 50 * 1024 * 1024,
})

writeFileSync(outFile, types, 'utf8')
console.log('[gen:types] done. In the file, search for "voice_note" to confirm new tables.')
