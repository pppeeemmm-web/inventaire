#!/usr/bin/env node

import 'dotenv/config'
import { config as loadDotenv } from 'dotenv'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

loadDotenv({ path: '.env.local', override: false })

const WRITE = process.argv.includes('--write')
const LIMIT_BUCKET = process.argv.find((arg) => arg.startsWith('--bucket='))?.slice('--bucket='.length)
const PAGE_SIZE = 1000
const UPSERT_BATCH = 500

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function r2Client() {
  const accountId = requireEnv('R2_ACCOUNT_ID')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
}

function supabaseAdmin() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  )
}

function configuredBuckets() {
  const buckets = new Map()
  const add = (name, role) => {
    const clean = name?.trim()
    if (!clean) return
    if (LIMIT_BUCKET && clean !== LIMIT_BUCKET) return
    const current = buckets.get(clean)
    buckets.set(clean, current ? `${current},${role}` : role)
  }
  add(process.env.R2_VAULT_BUCKET ?? 'vault', 'vault')
  add(process.env.R2_BUCKET ?? 'paintings', 'paintings')
  add(process.env.R2_BACKUP_BUCKET, 'backup')
  return [...buckets.entries()].map(([name, role]) => ({ name, role }))
}

function addRef(refs, bucket, key, ref) {
  if (!key) return
  const scopedKey = `${bucket}\0${key}`
  const list = refs.get(scopedKey) ?? []
  list.push(ref)
  refs.set(scopedKey, list)
}

async function selectAll(supabase, table, columns) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase.from(table).select(columns).range(from, to)
    if (error) {
      console.warn(`[refs] skip ${table}: ${error.message}`)
      return rows
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

async function buildReferenceMap(supabase, bucketByRole) {
  const refs = new Map()
  const vaultBucket = bucketByRole.vault
  const paintingsBucket = bucketByRole.paintings

  for (const row of await selectAll(supabase, 'document', 'id,storage_path')) {
    addRef(refs, vaultBucket, row.storage_path, { table: 'document', column: 'storage_path', row_id: row.id })
  }

  for (const row of await selectAll(supabase, 'sale_order', 'id,pdf_path')) {
    addRef(refs, vaultBucket, row.pdf_path, { table: 'sale_order', column: 'pdf_path', row_id: row.id })
  }

  for (const row of await selectAll(supabase, 'consignment_order', 'id,pdf_path')) {
    addRef(refs, vaultBucket, row.pdf_path, { table: 'consignment_order', column: 'pdf_path', row_id: row.id })
  }

  for (const row of await selectAll(supabase, 'tblImage', 'ImageID,txtImageNameLink')) {
    addRef(refs, paintingsBucket, row.txtImageNameLink, {
      table: 'tblImage',
      column: 'txtImageNameLink',
      row_id: row.ImageID,
    })
    if (row.txtImageNameLink) {
      const thumbKey = `thumbs/${row.txtImageNameLink.replace(/\.[^.]+$/, '')}.avif`
      addRef(refs, paintingsBucket, thumbKey, {
        table: 'tblImage',
        column: 'txtImageNameLink',
        row_id: row.ImageID,
        label: 'generated_thumb',
      })
    }
  }

  for (const row of await selectAll(supabase, 'share_inbox', 'id,payload')) {
    for (const file of row.payload?.files ?? []) {
      addRef(refs, paintingsBucket, file.r2_key, { table: 'share_inbox', column: 'payload.files.r2_key', row_id: row.id })
    }
  }

  for (const row of await selectAll(supabase, 'voice_note', 'id,audio_r2_key')) {
    addRef(refs, paintingsBucket, row.audio_r2_key, { table: 'voice_note', column: 'audio_r2_key', row_id: row.id })
  }

  for (const row of await selectAll(supabase, 'work_session', 'id,payload')) {
    for (const shot of row.payload?.shots ?? []) {
      addRef(refs, paintingsBucket, shot.r2_key, { table: 'work_session', column: 'payload.shots.r2_key', row_id: row.id })
      addRef(refs, paintingsBucket, shot.thumb_r2_key, {
        table: 'work_session',
        column: 'payload.shots.thumb_r2_key',
        row_id: row.id,
      })
    }
  }

  for (const row of await selectAll(supabase, 'studio_task', 'id,photo_r2_key')) {
    addRef(refs, paintingsBucket, row.photo_r2_key, { table: 'studio_task', column: 'photo_r2_key', row_id: row.id })
  }

  for (const row of await selectAll(supabase, 'Contact', 'ContactID,signature_r2_key')) {
    addRef(refs, paintingsBucket, row.signature_r2_key, {
      table: 'Contact',
      column: 'signature_r2_key',
      row_id: row.ContactID,
    })
  }

  for (const row of await selectAll(supabase, 'concept', 'id,image_note')) {
    addRef(refs, paintingsBucket, row.image_note, { table: 'concept', column: 'image_note', row_id: row.id })
  }

  for (const row of await selectAll(supabase, 'constellation_map', 'id,r2_key')) {
    addRef(refs, paintingsBucket, row.r2_key, { table: 'constellation_map', column: 'r2_key', row_id: row.id })
  }

  for (const row of await selectAll(supabase, 'exhibition_layout', 'id,floorplan_path')) {
    addRef(refs, paintingsBucket, row.floorplan_path, {
      table: 'exhibition_layout',
      column: 'floorplan_path',
      row_id: row.id,
    })
  }

  for (const row of await selectAll(supabase, 'system_log', 'id,attachments')) {
    for (const attachment of row.attachments ?? []) {
      addRef(refs, paintingsBucket, attachment.key, { table: 'system_log', column: 'attachments', row_id: row.id })
    }
  }

  return refs
}

async function listBucketObjects(s3, bucket) {
  const objects = []
  let ContinuationToken
  do {
    const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }))
    for (const obj of out.Contents ?? []) {
      if (!obj.Key) continue
      objects.push(obj)
    }
    ContinuationToken = out.NextContinuationToken
  } while (ContinuationToken)
  return objects
}

function classifyObject(bucketRole, key, refs) {
  if (refs.length > 0) return 'linked'
  if (bucketRole.includes('backup')) return 'backup'
  if (key.startsWith('recycle/')) return 'recycle'
  if (key.startsWith('work-session/') || key.startsWith('thumbs/work-session/') || key.startsWith('share-inbox/')) {
    return 'transient'
  }
  return 'unidentified'
}

function prefixOf(key) {
  return key.includes('/') ? key.split('/')[0] : '(root)'
}

async function upsertRows(supabase, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase
      .from('storage_object_ledger')
      .upsert(batch, { onConflict: 'bucket,object_key' })
    if (error) throw new Error(`ledger upsert failed: ${error.message}`)
  }
}

async function main() {
  const buckets = configuredBuckets()
  if (buckets.length === 0) throw new Error('No R2 buckets configured')

  const bucketByRole = {
    vault: buckets.find((bucket) => bucket.role.includes('vault'))?.name ?? 'vault',
    paintings: buckets.find((bucket) => bucket.role.includes('paintings'))?.name ?? 'paintings',
  }

  const supabase = supabaseAdmin()
  const refs = await buildReferenceMap(supabase, bucketByRole)
  const s3 = r2Client()
  const rows = []
  const summary = new Map()
  const unidentifiedPrefixes = new Map()

  for (const bucket of buckets) {
    const objects = await listBucketObjects(s3, bucket.name)
    for (const obj of objects) {
      const keyRefs = refs.get(`${bucket.name}\0${obj.Key}`) ?? []
      const classification = classifyObject(bucket.role, obj.Key, keyRefs)
      const status = obj.Key.startsWith('recycle/') ? 'recycled' : 'present'
      rows.push({
        provider: 'r2',
        bucket: bucket.name,
        object_key: obj.Key,
        size_bytes: obj.Size ?? null,
        content_type: null,
        etag: obj.ETag?.replace(/^"|"$/g, '') ?? null,
        last_modified_at: obj.LastModified?.toISOString() ?? null,
        last_seen_at: new Date().toISOString(),
        status,
        source: `backfill:${bucket.role}`,
        classification,
        linked_refs: keyRefs,
        metadata: { bucket_role: bucket.role },
      })

      const key = `${bucket.name}:${classification}`
      summary.set(key, (summary.get(key) ?? 0) + 1)
      if (classification === 'unidentified') {
        const prefix = `${bucket.name}/${prefixOf(obj.Key)}`
        unidentifiedPrefixes.set(prefix, (unidentifiedPrefixes.get(prefix) ?? 0) + 1)
      }
    }
  }

  if (WRITE) {
    await upsertRows(supabase, rows)
  }

  console.log(`storage-ledger-backfill ${WRITE ? 'write' : 'dry-run'}`)
  console.log(`objects_seen=${rows.length}`)
  for (const [key, count] of [...summary.entries()].sort()) {
    console.log(`${key}=${count}`)
  }
  console.log('top_unidentified_prefixes:')
  for (const [prefix, count] of [...unidentifiedPrefixes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`${prefix}=${count}`)
  }
  if (!WRITE) console.log('dry_run=true; rerun with --write to upsert public.storage_object_ledger')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
