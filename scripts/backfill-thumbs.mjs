/**
 * backfill-thumbs.mjs
 *
 * For every image in tblImage, fetch the original from R2, generate a
 * 400px AVIF thumbnail with sharp, and PUT it to thumbs/<base>.avif on R2.
 *
 * Skips files where thumbs/<base>.avif already exists (HEAD check).
 * Run from the app/ directory:
 *   node scripts/backfill-thumbs.mjs
 *
 * Requirements: sharp, @aws-sdk/... not needed — uses raw fetch + manual Sig V4
 * (same approach as actions.ts so no extra deps needed beyond what's installed)
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Load .env.local ────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const R2_ACCOUNT    = env.R2_ACCOUNT_ID
const R2_ACCESS_KEY = env.R2_ACCESS_KEY_ID
const R2_SECRET_KEY = env.R2_SECRET_ACCESS_KEY
const R2_BUCKET     = env.R2_BUCKET ?? 'paintings'
const R2_PUBLIC_URL = env.NEXT_PUBLIC_R2_PUBLIC_URL
const SB_URL        = env.NEXT_PUBLIC_SUPABASE_URL
const SB_SERVICE    = env.SUPABASE_SERVICE_ROLE_KEY

if (!R2_ACCOUNT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !SB_URL || !SB_SERVICE) {
  console.error('Missing env vars — check .env.local')
  process.exit(1)
}

const R2_HOST    = `${R2_ACCOUNT}.eu.r2.cloudflarestorage.com`
const R2_ORIGIN  = `https://${R2_HOST}`

// ── AWS Sig V4 helpers ─────────────────────────────────────────────────────
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function sigV4Headers(method, filename, buf, contentType) {
  const encodedPath = `/${R2_BUCKET}/${filename.split('/').map(encodeURIComponent).join('/')}`
  const now         = new Date()
  const amzDate     = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp   = amzDate.slice(0, 8)
  const bodyHash    = buf
    ? crypto.createHash('sha256').update(buf).digest('hex')
    : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // empty

  const headers = {
    'host':                  R2_HOST,
    'content-type':          contentType,
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': bodyHash,
  }
  if (buf) headers['content-length'] = String(buf.length)

  const sortedKeys       = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr  = sortedKeys.join(';')
  const canonicalReq     = [method, encodedPath, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region    = 'auto'
  const service   = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope,
    crypto.createHash('sha256').update(canonicalReq).digest('hex')].join('\n')

  const sigKey = hmac(hmac(hmac(hmac('AWS4' + R2_SECRET_KEY, dateStamp), region), service), 'aws4_request')
  const sig    = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  return headers
}

async function r2Head(filename) {
  const headers = sigV4Headers('HEAD', filename, null, 'application/octet-stream')
  const url     = `${R2_ORIGIN}/${R2_BUCKET}/${filename.split('/').map(encodeURIComponent).join('/')}`
  const res     = await fetch(url, { method: 'HEAD', headers })
  return res.status
}

async function r2Get(filename) {
  // Fetch from public URL — no auth needed, simpler
  const url = `${R2_PUBLIC_URL}/${filename.split('/').map(encodeURIComponent).join('/')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`R2 GET ${res.status} for ${filename}`)
  return Buffer.from(await res.arrayBuffer())
}

async function r2Put(buf, filename, contentType) {
  const headers = sigV4Headers('PUT', filename, buf, contentType)
  const url     = `${R2_ORIGIN}/${R2_BUCKET}/${filename.split('/').map(encodeURIComponent).join('/')}`
  const res     = await fetch(url, { method: 'PUT', headers, body: buf })
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${await res.text()}`)
}

// ── Main ───────────────────────────────────────────────────────────────────
const sb = createClient(SB_URL, SB_SERVICE)

console.log('Fetching image list from tblImage...')
const { data: images, error } = await sb
  .from('tblImage')
  .select('txtImageNameLink')
  .not('txtImageNameLink', 'is', null)

if (error) { console.error(error); process.exit(1) }

// Deduplicate
const filenames = [...new Set(images.map(r => r.txtImageNameLink).filter(Boolean))]
console.log(`Found ${filenames.length} unique images to process.\n`)

let skipped = 0, generated = 0, failed = 0

for (let i = 0; i < filenames.length; i++) {
  const filename = filenames[i]
  const base     = filename.replace(/\.[^.]+$/, '')     // strip extension
  const thumbKey = `thumbs/${base}.avif`

  process.stdout.write(`[${i + 1}/${filenames.length}] ${filename} ... `)

  // Skip if avif thumb already exists
  try {
    const status = await r2Head(thumbKey)
    if (status === 200) {
      console.log('skip (exists)')
      skipped++
      continue
    }
  } catch {}

  // Fetch original
  let origBuf
  try {
    origBuf = await r2Get(filename)
  } catch (e) {
    console.log(`FETCH ERROR: ${e.message}`)
    failed++
    continue
  }

  // Generate 400px avif thumbnail
  let thumbBuf
  try {
    thumbBuf = await sharp(origBuf)
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 70, effort: 3 })
      .toBuffer()
  } catch (e) {
    console.log(`SHARP ERROR: ${e.message}`)
    failed++
    continue
  }

  // Upload to R2
  try {
    await r2Put(thumbBuf, thumbKey, 'image/avif')
    console.log(`OK (${Math.round(thumbBuf.length / 1024)}kb)`)
    generated++
  } catch (e) {
    console.log(`PUT ERROR: ${e.message}`)
    failed++
  }

  // Small delay to avoid hammering R2
  if (i % 20 === 19) await new Promise(r => setTimeout(r, 500))
}

console.log(`\nDone. Generated: ${generated} | Skipped: ${skipped} | Failed: ${failed}`)
