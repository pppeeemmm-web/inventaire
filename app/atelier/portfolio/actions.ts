'use server'

// Portfolio server action — saves config JSON to R2 and upserts document record.
// Uses service_role to bypass RLS on the document table.

import { createServiceClient } from '@/lib/supabase/server'
import {
  S3Client, PutObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3'

const BUCKET     = process.env.R2_VAULT_BUCKET ?? 'vault'
const CONFIG_KEY = 'portfolio_sections.json'

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

export type SaveConfigResult = { error: string } | { ok: true }
export type LoadConfigResult = { error: string } | { ok: true; config: any; documents: any[] }

export async function loadPortfolioConfig(): Promise<LoadConfigResult> {
  try {
    const sb = createServiceClient()
    const s3 = r2Client()

    // Fetch documents list and config from R2 in parallel
    const [docsResult, r2Result] = await Promise.allSettled([
      (sb.from('document') as any).select('id, name').order('name'),
      s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: CONFIG_KEY })),
    ])

    const documents = docsResult.status === 'fulfilled' ? (docsResult.value.data ?? []) : []

    let config: any = {
      general: { artist_name: '', about_intro: '', contact_email: '', instagram: '' },
      sections: [],
      works_collections: [],
      statement_doc_id: null,
      cv_doc_id: null,
    }

    if (r2Result.status === 'fulfilled') {
      const body = r2Result.value.Body
      if (body) {
        const text = await body.transformToString('utf-8')
        try {
          const parsed = JSON.parse(text)
          config = {
            general:           parsed.general           || config.general,
            sections:          parsed.sections          || [],
            works_collections: parsed.works_collections || [],
            statement_doc_id:  parsed.statement_doc_id  || null,
            cv_doc_id:         parsed.cv_doc_id         || null,
          }
        } catch (e) {
          console.error('[loadPortfolioConfig] JSON parse error:', e)
        }
      }
    }
    // If r2Result failed with "NoSuchKey", that's fine — first-time use

    return { ok: true, config, documents }
  } catch (e: any) {
    console.error('[loadPortfolioConfig]', e)
    return { error: e.message ?? String(e) }
  }
}

export async function savePortfolioConfig(config: unknown): Promise<SaveConfigResult> {
  try {
    const json = JSON.stringify(config, null, 2)
    const buf  = Buffer.from(json, 'utf-8')

    // 1. Upload to R2
    const s3 = r2Client()
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         CONFIG_KEY,
      Body:        buf,
      ContentType: 'application/json',
    }))

    // 2. Upsert document record via service_role (bypasses RLS)
    const sb = createServiceClient()
    const { data: existing } = await (sb.from('document') as any)
      .select('id')
      .eq('name', CONFIG_KEY)
      .maybeSingle()

    const payload = {
      name:         CONFIG_KEY,
      storage_path: CONFIG_KEY,
      kind:         'autre',
      mime_type:    'application/json',
      file_size:    buf.byteLength,
    }

    if (existing) {
      const { error } = await (sb.from('document') as any)
        .update(payload)
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await (sb.from('document') as any)
        .insert(payload)
      if (error) throw error
    }

    return { ok: true }
  } catch (e: any) {
    console.error('[savePortfolioConfig]', e)
    return { error: e.message ?? String(e) }
  }
}
