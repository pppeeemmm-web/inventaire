/**
 * Delete orphan JPEG objects under thumbs/ (app only uses thumbs/*.avif for works).
 *
 *   node scripts/delete-thumbs-jpg.mjs --dry-run
 *   node scripts/delete-thumbs-jpg.mjs --execute
 *
 * Uses R2_* vars from .env.local (same as regen-work-thumbs.mjs).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
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

const JPEG_EXT = /\.jpe?g$/i

async function main() {
  const execute = process.argv.includes('--execute')
  const dryRun = process.argv.includes('--dry-run') || !execute

  if (!execute && !process.argv.includes('--dry-run')) {
    console.error('Usage: node scripts/delete-thumbs-jpg.mjs --dry-run | --execute')
    process.exit(1)
  }

  const bucket = (process.env.R2_BUCKET ?? 'paintings').trim()
  const s3 = paintingsS3()
  const targets = []

  let token
  do {
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'thumbs/',
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    )
    for (const obj of out.Contents ?? []) {
      const key = obj.Key
      if (key && JPEG_EXT.test(key)) targets.push(key)
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined
  } while (token)

  console.log(`bucket=${bucket} prefix=thumbs/ jpeg_objects=${targets.length}`)

  if (dryRun) {
    for (const k of targets) console.log(`DRY-RUN delete: ${k}`)
    console.log('\nPass --execute to delete.')
    return
  }

  let ok = 0
  let fail = 0
  for (const key of targets) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
      console.log(`DELETED: ${key}`)
      ok++
    } catch (e) {
      console.error(`FAIL: ${key}: ${e?.message ?? e}`)
      fail++
    }
  }
  console.log(`\nDone. deleted=${ok} fail=${fail}`)
  if (fail) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
