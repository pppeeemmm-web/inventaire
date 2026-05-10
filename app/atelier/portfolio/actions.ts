'use server'

// Portfolio server action — saves config JSON to R2 and upserts document record.
// Uses service_role to bypass RLS on the document table.

import { createServiceClient } from '@/lib/supabase/server'
import {
  S3Client, PutObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3'

interface MammothLib {
  extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }>
  convertToHtml(opts: { buffer: Buffer }): Promise<{ value: string; messages: any[] }>
}

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

export type SaveConfigResult     = { error: string } | { ok: true }
export type LoadConfigResult     = { error: string } | { ok: true; config: any; documents: any[] }
export type ExtractTextResult    = { error: string } | { ok: true; text: string }
export type DocSignedUrlsResult  = { statementUrl: string | null; cvUrl: string | null }

export async function getDocSignedUrls(
  statementDocId: string | null,
  cvDocId: string | null,
): Promise<DocSignedUrlsResult> {
  const ids = [statementDocId, cvDocId].filter(Boolean) as string[]
  if (!ids.length) return { statementUrl: null, cvUrl: null }

  try {
    const sb = createServiceClient()
    const { data: docs } = await (sb.from('document') as any)
      .select('id, storage_path')
      .in('id', ids)

    if (!docs?.length) return { statementUrl: null, cvUrl: null }

    async function signed(docId: string | null): Promise<string | null> {
      if (!docId) return null
      const doc = docs.find((d: any) => d.id === docId)
      if (!doc) return null
      const { data } = await sb.storage.from('vault').createSignedUrl(doc.storage_path, 3600)
      return data?.signedUrl ?? null
    }

    const [statementUrl, cvUrl] = await Promise.all([
      signed(statementDocId),
      signed(cvDocId),
    ])
    return { statementUrl, cvUrl }
  } catch (e) {
    console.error('[getDocSignedUrls]', e)
    return { statementUrl: null, cvUrl: null }
  }
}

export async function loadPortfolioConfig(): Promise<LoadConfigResult> {
  try {
    const sb = createServiceClient()
    const s3 = r2Client()

    const [docsResult, r2Result] = await Promise.allSettled([
      (sb.from('document') as any).select('id, name').order('name'),
      s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: CONFIG_KEY })),
    ])

    const documents = docsResult.status === 'fulfilled' ? (docsResult.value.data ?? []) : []

    let config: any = {
      general: { artist_name: '', about_intro: '', contact_email: '', instagram: '' },
      sections: [],
      works_collections: [],
      works_modes: [],
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
            about:             parsed.about             || null,
            practice:          parsed.practice          || null,
            sections:          parsed.sections          || [],
            works_collections: parsed.works_collections || [],
            works_modes:       Array.isArray(parsed.works_modes) ? parsed.works_modes : [],
            statement_doc_id:  parsed.statement_doc_id  || null,
            cv_doc_id:         parsed.cv_doc_id         || null,
          }
        } catch (e) {
          console.error('[loadPortfolioConfig] JSON parse error:', e)
        }
      }
    }

    return { ok: true, config, documents }
  } catch (e: any) {
    console.error('[loadPortfolioConfig]', e)
    return { error: e.message ?? String(e) }
  }
}

/**
 * Extract plain text from an uploaded .txt or .docx file.
 * Receives FormData with a single 'file' entry.
 */
export async function extractDocumentText(formData: FormData): Promise<ExtractTextResult> {
  try {
    const file = formData.get('file')
    if (!file || typeof file === 'string') return { error: 'No file provided' }

    const fname = (file as File).name.toLowerCase()
    const buf   = Buffer.from(await (file as File).arrayBuffer())

    if (fname.endsWith('.txt')) {
      return { ok: true, text: buf.toString('utf-8').trim() }
    }

    if (fname.endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml({ buffer: buf })
      return { ok: true, text: result.value }
    }

    return { error: 'Format non supporte. Utiliser .txt ou .docx.' }
  } catch (e: any) {
    console.error('[extractDocumentText]', e)
    return { error: e.message ?? String(e) }
  }
}

export async function savePortfolioConfig(config: unknown): Promise<SaveConfigResult> {
  try {
    const c = config as Record<string, unknown>
    const modes = Array.isArray(c.works_modes) ? (c.works_modes as { collections?: unknown[] }[]) : []
    const m0 = modes[0]
    const normalized =
      m0 && Array.isArray(m0.collections)
        ? { ...c, works_collections: JSON.parse(JSON.stringify(m0.collections)) as unknown }
        : { ...c }

    const json = JSON.stringify(normalized, null, 2)
    const buf  = Buffer.from(json, 'utf-8')

    const s3 = r2Client()
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         CONFIG_KEY,
      Body:        buf,
      ContentType: 'application/json',
    }))

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

// Sets a work to statusId=2 (Disponible) so the trigger makes it public.
// Requires an authenticated admin session.
export async function setWorkPublic(oeuvreId: number): Promise<{ ok: true } | { error: string }> {
  try {
    const { createClient: createUserClient } = await import('@/lib/supabase/server')
    const userSb = await createUserClient()
    const { data: { user } } = await userSb.auth.getUser()
    if (!user) return { error: 'Non authentifié' }
    const { data: isAdmin } = await userSb.rpc('is_admin')
    if (!isAdmin) return { error: 'Accès refusé' }

    const sb = createServiceClient()
    const { error } = await (sb.from('Oeuvres') as any)
      .update({ statusId: 2 })
      .eq('OeuvreID', oeuvreId)
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    console.error('[setWorkPublic]', e)
    return { error: e.message ?? String(e) }
  }
}
