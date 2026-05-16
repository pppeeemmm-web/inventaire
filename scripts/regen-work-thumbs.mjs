/**
 * Regenerate R2 thumbnails for work image keys (main object → thumbs/<same-base>.avif).
 * Matches Sharp settings in app/atelier/works/actions.ts uploadImage().
 *
 * Prerequisites: .env.local with R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * optional R2_BUCKET (default paintings), R2_S3_API_URL / R2_S3_HOST / R2_JURISDICTION (see lib/r2-s3-host.ts).
 *
 * Usage:
 *   node scripts/regen-work-thumbs.mjs keys.txt
 *   node scripts/regen-work-thumbs.mjs --from-db
 *   node scripts/regen-work-thumbs.mjs [--dry-run] [--only-newer] keys.txt
 *   node scripts/regen-work-thumbs.mjs [--dry-run] [--only-newer] --from-db
 *   node scripts/regen-work-thumbs.mjs [--dry-run] [--only-newer] --from-r2
 *
 * keys.txt: one R2 main key per line (e.g. W_123_01_a1b2c3d4.avif). Lines starting with # ignored.
 * If a line starts with thumbs/, the prefix is stripped to the main key.
 *
 * --from-db: keys from Supabase tblImage (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * --from-r2: keys from bucket listing (Prefix W_ at root only — skips thumbs/ and subpaths). No DB.
 * --only-newer: only regen when main LastModified is newer than thumb, or thumb missing (R2 has no
 *   object versioning; mtime is the only built-in way to detect stale thumbs after a direct overwrite).
 *
 * Optional: THUMB_REGEN_R2_PREFIX (default W_) for ListObjectsV2.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import sharp from 'sharp'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config()

function r2S3Hostname(accountId) {
  const pasteUrl = process.env.R2_S3_API_URL?.trim()
  if (pasteUrl) {
    try {
      const u = new URL(pasteUrl.startsWith('http') ? pasteUrl : `https://${pasteUrl}`)
      return u.hostname
    } catch {
      /* fall through */
    }
  }
  const hostOverride = process.env.R2_S3_HOST?.trim()
  if (hostOverride) {
    return hostOverride.replace(/^https?:\/\//i, '').split('/')[0].replace(/\/$/, '')
  }
  const j = (process.env.R2_JURISDICTION ?? '').trim().toLowerCase()
  if (j === 'eu' || j === 'eu-union' || j === 'weur') {
    return `${accountId}.eu.r2.cloudflarestorage.com`
  }
  if (j === 'fedramp') {
    return `${accountId}.fedramp.r2.cloudflarestorage.com`
  }
  return `${accountId}.r2.cloudflarestorage.com`
}

function paintingsS3() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY')
  }
  const host = r2S3Hostname(accountId)
  return new S3Client({
    region: 'auto',
    endpoint: `https://${host}`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

function normalizeMainKey(line) {
  let k = line.trim()
  if (!k || k.startsWith('#')) return null
  if (k.toLowerCase().startsWith('thumbs/')) {
    k = k.slice('thumbs/'.length)
  }
  return k
}

function thumbKey(mainKey) {
  const base = mainKey.replace(/\.[^.]+$/, '')
  return `thumbs/${base}.avif`
}

async function headModified(s3, bucket, key) {
  try {
    const o = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return o.LastModified ?? null
  } catch (e) {
    const code = e?.$metadata?.httpStatusCode
    const name = e?.name ?? ''
    if (code === 404 || name === 'NotFound') return null
    throw e
  }
}

async function getBuffer(s3, bucket, key) {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!out.Body) throw new Error(`empty body: ${key}`)
  const bytes = await out.Body.transformToByteArray()
  return Buffer.from(bytes)
}

async function makeThumbBuf(mainBuf) {
  return sharp(mainBuf)
    .ensureAlpha()
    .resize({
      width: 400,
      height: 400,
      fit: 'inside',
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .avif({ quality: 70, effort: 3, chromaSubsampling: '4:4:4' })
    .toBuffer()
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  const onlyNewer = argv.includes('--only-newer')
  const fromDb = argv.includes('--from-db')
  const fromR2 = argv.includes('--from-r2')
  const rest = argv.filter(
    (a) =>
      ![
        '--dry-run',
        '--only-newer',
        '--from-db',
        '--from-r2',
      ].includes(a),
  )
  const keysPath = rest.find((a) => !a.startsWith('-'))
  return { dryRun, onlyNewer, fromDb, fromR2, keysPath }
}

/** Root-level work mains only: ListObjects Prefix W_, excludes paths like thumbs/… */
async function fetchKeysFromR2Bucket(s3, bucket) {
  const prefix = (process.env.THUMB_REGEN_R2_PREFIX ?? 'W_').trim() || 'W_'
  const mains = new Set()
  let token
  do {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    )
    for (const obj of out.Contents ?? []) {
      const key = obj.Key
      if (!key || key.endsWith('/')) continue
      if (key.includes('/')) continue
      if (!key.startsWith('W_')) continue
      mains.add(key)
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined
  } while (token)
  return [...mains].sort()
}

/** Paths only; bare W_* keys. Deduped, sorted. */
async function fetchKeysFromSupabase() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!baseUrl || !serviceKey) {
    throw new Error(
      'Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local for --from-db',
    )
  }

  const mains = new Set()
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const u = new URL(`${baseUrl}/rest/v1/tblImage`)
    u.searchParams.set('select', 'txtImageNameLink')
    u.searchParams.set('txtImageNameLink', 'not.is.null')
    u.searchParams.set('order', 'ImageID.asc')
    u.searchParams.set('limit', String(pageSize))
    u.searchParams.set('offset', String(offset))

    const res = await fetch(u.toString(), {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    })
    if (!res.ok) {
      throw new Error(`Supabase tblImage ${res.status}: ${await res.text()}`)
    }
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) break

    for (const r of rows) {
      const raw = r.txtImageNameLink
      if (typeof raw !== 'string') continue
      const k = normalizeMainKey(raw)
      // Canonical work keys: W_{id}_{seq}_{hash8}.{ext} at bucket root (see lib/image-upload.ts)
      if (k && k.startsWith('W_') && !k.includes('/') && !k.includes('..')) mains.add(k)
    }

    if (rows.length < pageSize) break
  }

  return [...mains].sort()
}

async function main() {
  const { dryRun, onlyNewer, fromDb, fromR2, keysPath } = parseArgs(process.argv.slice(2))

  const sourceCount = (fromDb ? 1 : 0) + (fromR2 ? 1 : 0) + (keysPath ? 1 : 0)
  if (sourceCount !== 1) {
    console.error(
      'Usage: node scripts/regen-work-thumbs.mjs [--dry-run] [--only-newer] (--from-db | --from-r2 | <keys.txt>)',
    )
    process.exit(1)
  }

  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  const s3 = paintingsS3()

  let mains
  if (fromDb) {
    mains = await fetchKeysFromSupabase()
    console.log(`Loaded ${mains.length} work image keys from Supabase (tblImage)`)
  } else if (fromR2) {
    const listPrefix = (process.env.THUMB_REGEN_R2_PREFIX ?? 'W_').trim() || 'W_'
    mains = await fetchKeysFromR2Bucket(s3, bucket)
    console.log(
      `Loaded ${mains.length} object keys from R2 bucket "${bucket}" (prefix "${listPrefix}", root keys only)`,
    )
  } else {
    const abs = path.isAbsolute(keysPath) ? keysPath : path.join(process.cwd(), keysPath)
    if (!existsSync(abs)) {
      console.error(`File not found: ${abs}`)
      process.exit(1)
    }
    const raw = readFileSync(abs, 'utf8')
    mains = raw.split(/\r?\n/).map(normalizeMainKey).filter(Boolean)
  }

  if (mains.length === 0) {
    console.error('No keys to process.')
    process.exit(1)
  }
  const concurrency = Math.max(1, Number(process.env.THUMB_REGEN_CONCURRENCY ?? '4') || 4)

  let ok = 0
  let skip = 0
  let fail = 0

  const tasks = mains.map((mainKey) => async () => {
    const tKey = thumbKey(mainKey)
    try {
      if (onlyNewer) {
        const [mTime, tTime] = await Promise.all([
          headModified(s3, bucket, mainKey),
          headModified(s3, bucket, tKey),
        ])
        if (!mTime) {
          console.error(`SKIP (main missing): ${mainKey}`)
          skip++
          return
        }
        if (tTime && mTime.getTime() <= tTime.getTime()) {
          console.log(`SKIP (thumb up to date): ${mainKey}`)
          skip++
          return
        }
      }

      if (dryRun) {
        console.log(`DRY-RUN: ${mainKey} → ${tKey}`)
        ok++
        return
      }

      const mainBuf = await getBuffer(s3, bucket, mainKey)
      const thumbBuf = await makeThumbBuf(mainBuf)
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: tKey,
          Body: thumbBuf,
          ContentType: 'image/avif',
        }),
      )
      console.log(`OK: ${tKey}`)
      ok++
    } catch (e) {
      console.error(`FAIL: ${mainKey}: ${e?.message ?? e}`)
      fail++
    }
  })

  for (let i = 0; i < tasks.length; i += concurrency) {
    await Promise.all(tasks.slice(i, i + concurrency).map((fn) => fn()))
  }

  console.log(
    `\nDone. ok=${ok} skip=${skip} fail=${fail} total=${mains.length}${dryRun ? ' (dry-run)' : ''}`,
  )
  if (fail) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
