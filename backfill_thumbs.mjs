/**
 * Backfill thumbnails for all existing images in R2.
 * Downloads each original, generates a 400px JPEG via sharp,
 * uploads to thumbs/<filename>.jpg in the same R2 bucket.
 * Safe to re-run — skips files already in thumbs/.
 *
 * Run: node backfill_thumbs.mjs
 */

import fs     from 'fs'
import path   from 'path'
import crypto from 'crypto'
import sharp  from 'sharp'

// ── Load .env.local ────────────────────────────────────────────────────────
const envPath = path.join(import.meta.dirname, '.env.local')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#') || !t.includes('=')) continue
  const [k, ...rest] = t.split('=')
  env[k.trim()] = rest.join('=').trim()
}

const R2_ACCOUNT = env['R2_ACCOUNT_ID']
const R2_ACCESS  = env['R2_ACCESS_KEY_ID']
const R2_SECRET  = env['R2_SECRET_ACCESS_KEY']
const R2_BUCKET  = env['R2_BUCKET'] ?? 'paintings'
const ENDPOINT   = `https://${R2_ACCOUNT}.eu.r2.cloudflarestorage.com`

// ── AWS Sig V4 ─────────────────────────────────────────────────────────────
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest()
}
function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function makeHeaders(method, pathname, buf, contentType) {
  const host      = `${R2_ACCOUNT}.eu.r2.cloudflarestorage.com`
  const now       = new Date()
  const amzDate   = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
  const dateStamp = amzDate.slice(0, 8)
  const bodyHash  = buf ? sha256Hex(buf) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  const headers = {
    'host':                  host,
    'x-amz-date':           amzDate,
    'x-amz-content-sha256': bodyHash,
  }
  if (contentType) headers['content-type'] = contentType
  if (buf)         headers['content-length'] = String(buf.length)

  const sortedKeys       = Object.keys(headers).sort()
  const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join('')
  const signedHeaderStr  = sortedKeys.join(';')
  const canonicalRequest = [method, pathname, '', canonicalHeaders, signedHeaderStr, bodyHash].join('\n')

  const region    = 'auto'
  const service   = 's3'
  const credScope = `${dateStamp}/${region}/${service}/aws4_request`
  const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, sha256Hex(canonicalRequest)].join('\n')
  const sigKey    = hmac(hmac(hmac(hmac('AWS4' + R2_SECRET, dateStamp), region), service), 'aws4_request')
  const sig       = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

  return headers
}

async function r2List(prefix = '') {
  const keys = []
  let token  = ''
  while (true) {
    let qs = `?list-type=2`
    if (prefix) qs += `&prefix=${encodeURIComponent(prefix)}`
    if (token)  qs += `&continuation-token=${encodeURIComponent(token)}`
    const pathname = `/${R2_BUCKET}`
    const fullUrl  = `${ENDPOINT}${pathname}${qs}`
    const headers  = makeHeaders('GET', pathname, null, null)
    const res      = await fetch(fullUrl, { headers })
    const xml      = await res.text()
    const matches  = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)]
    keys.push(...matches.map(m => m[1]))
    const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
    if (!next) break
    token = next[1]
  }
  return keys
}

async function r2Get(key) {
  const pathname = `/${R2_BUCKET}/${encodeURIComponent(key)}`
  const url      = `${ENDPOINT}${pathname}`
  const headers  = makeHeaders('GET', pathname, null, null)
  const res      = await fetch(url, { headers })
  if (!res.ok) throw new Error(`GET ${res.status}: ${key}`)
  return Buffer.from(await res.arrayBuffer())
}

async function r2Put(key, buf, contentType) {
  const pathname = `/${R2_BUCKET}/${encodeURIComponent(key)}`
  const url      = `${ENDPOINT}${pathname}`
  const headers  = makeHeaders('PUT', pathname, buf, contentType)
  const res      = await fetch(url, { method: 'PUT', headers, body: buf })
  if (!res.ok) throw new Error(`PUT ${res.status}: ${await res.text()}`)
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('Listing originals in R2...')
const allKeys   = await r2List('')
const originals = allKeys.filter(k => !k.startsWith('thumbs/'))
const existing  = new Set(allKeys.filter(k => k.startsWith('thumbs/')))

console.log(`  ${originals.length} originals found`)
console.log(`  ${existing.size} thumbnails already exist\n`)

let ok = 0, skipped = 0, failed = 0
const failures = []

for (let i = 0; i < originals.length; i++) {
  const key      = originals[i]
  const base     = key.replace(/\.[^.]+$/, '')
  const thumbKey = `thumbs/${base}.jpg`

  if (existing.has(thumbKey)) {
    skipped++
    continue
  }

  try {
    const buf      = await r2Get(key)
    const thumbBuf = await sharp(buf)
      .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()

    await r2Put(thumbKey, thumbBuf, 'image/jpeg')
    ok++
    if (ok <= 5 || ok % 50 === 0) {
      console.log(`  [${i+1}/${originals.length}] OK  ${key}  → ${Math.round(thumbBuf.length/1024)}KB`)
    }
  } catch (e) {
    console.log(`  [${i+1}/${originals.length}] FAIL  ${key}  (${e.message})`)
    failures.push([key, e.message])
    failed++
  }
}

console.log()
console.log('='.repeat(60))
console.log(`  Generated : ${ok}`)
console.log(`  Skipped   : ${skipped}  (already exist)`)
console.log(`  Failed    : ${failed}`)
console.log('='.repeat(60))

if (failures.length) {
  console.log('\nFailed:')
  failures.forEach(([k, e]) => console.log(`  ${k}: ${e}`))
  process.exit(1)
} else {
  console.log('\nAll done. Thumbnails live at R2/thumbs/<filename>.jpg')
}
