'use server'

// Portfolio server action — saves config JSON to R2 and upserts document record.
// TipTap HTML fields are sanitized server-side before persistence (see lib/portfolio-html-sanitize.ts).
// Uses service_role to bypass RLS on the document table.

import { revalidatePath, revalidateTag } from 'next/cache'
import { logError } from '@/lib/error-reporter/server'
import { createServiceClient } from '@/lib/supabase/server'
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import {
  createPortfolioConfigS3Client,
  loadPortfolioSectionsFromR2,
  PORTFOLIO_SECTIONS_BUCKET,
  PORTFOLIO_SECTIONS_R2_KEY,
} from '@/lib/portfolio-sections-from-r2'
import { sanitizePortfolioConfigForPersist } from '@/lib/portfolio-html-sanitize'
import { PORTFOLIO_SAVE_ERR } from '@/lib/portfolio-save-errors'
import { recordStorageObject } from '@/lib/storage-object-ledger'

export type SaveConfigResult =
  | { error: string }
  | { ok: true; etag: string | null }
export type LoadConfigResult = { error: string } | { ok: true; config: any; documents: any[]; etag: string | null }
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
    await logError('getDocSignedUrls failed', e, { source: 'getDocSignedUrls' })
    return { statementUrl: null, cvUrl: null }
  }
}

export async function loadPortfolioConfig(): Promise<LoadConfigResult> {
  try {
    const { config, documents, objectEtag } = await loadPortfolioSectionsFromR2()
    return { ok: true, config, documents, etag: objectEtag }
  } catch (e: any) {
    console.error('[loadPortfolioConfig]', e)
    return { error: e.message ?? String(e) }
  }
}

/** Lightweight etag read for tab-focus checks (no JSON download). */
export async function getPortfolioConfigEtag(): Promise<
  { ok: true; etag: string | null } | { error: string }
> {
  try {
    const s3 = createPortfolioConfigS3Client()
    try {
      const head = await s3.send(
        new HeadObjectCommand({
          Bucket: PORTFOLIO_SECTIONS_BUCKET,
          Key: PORTFOLIO_SECTIONS_R2_KEY,
        }),
      )
      return { ok: true, etag: stripS3Etag(head.ETag) }
    } catch (e) {
      if (isS3NotFound(e)) return { ok: true, etag: null }
      throw e
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[getPortfolioConfigEtag]', e)
    return { error: msg }
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

function stripS3Etag(etag: string | undefined): string | null {
  if (!etag || typeof etag !== 'string') return null
  const t = etag.replace(/^"|"$/g, '')
  return t || null
}

function isS3NotFound(err: unknown): boolean {
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
  return (
    e?.name === 'NotFound' ||
    e?.Code === 'NoSuchKey' ||
    e?.$metadata?.httpStatusCode === 404
  )
}

export async function savePortfolioConfig(
  config: unknown,
  opts?: { ifMatch?: string | null }
): Promise<SaveConfigResult> {
  try {
    const c = config as Record<string, unknown>
    const modes = Array.isArray(c.works_modes) ? (c.works_modes as { collections?: unknown[] }[]) : []
    const m0 = modes[0]
    const normalized =
      m0 && Array.isArray(m0.collections)
        ? { ...c, works_collections: JSON.parse(JSON.stringify(m0.collections)) as unknown }
        : { ...c }

    const sanitized = sanitizePortfolioConfigForPersist(normalized as Record<string, unknown>)
    const json = JSON.stringify(sanitized, null, 2)
    const buf  = Buffer.from(json, 'utf-8')

    const s3 = createPortfolioConfigS3Client()

    const ifMatch = opts?.ifMatch
    if (ifMatch !== undefined) {
      let headEtag: string | null = null
      try {
        const head = await s3.send(
          new HeadObjectCommand({
            Bucket: PORTFOLIO_SECTIONS_BUCKET,
            Key: PORTFOLIO_SECTIONS_R2_KEY,
          }),
        )
        headEtag = stripS3Etag(head.ETag)
      } catch (e) {
        if (!isS3NotFound(e)) throw e
        headEtag = null
      }

      if (ifMatch === null) {
        if (headEtag !== null) {
          return { error: PORTFOLIO_SAVE_ERR.OBJECT_EXISTS }
        }
      } else if (headEtag !== ifMatch) {
        return { error: PORTFOLIO_SAVE_ERR.ETAG_MISMATCH }
      }
    }

    const putOut = await s3.send(
      new PutObjectCommand({
        Bucket: PORTFOLIO_SECTIONS_BUCKET,
        Key: PORTFOLIO_SECTIONS_R2_KEY,
        Body: buf,
        ContentType: 'application/json',
      }),
    )

    const newEtag = stripS3Etag(putOut.ETag)
    await recordStorageObject({
      bucket: PORTFOLIO_SECTIONS_BUCKET,
      objectKey: PORTFOLIO_SECTIONS_R2_KEY,
      sizeBytes: buf.byteLength,
      contentType: 'application/json',
      etag: newEtag,
      source: 'portfolio_config',
      classification: 'linked',
      linkedRefs: [{ table: 'document', column: 'storage_path' }],
    })

    const sb = createServiceClient()
    const { data: existing } = await (sb.from('document') as any)
      .select('id')
      .eq('name', PORTFOLIO_SECTIONS_R2_KEY)
      .maybeSingle()

    const payload = {
      name:         PORTFOLIO_SECTIONS_R2_KEY,
      storage_path: PORTFOLIO_SECTIONS_R2_KEY,
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

    revalidateTag('portfolio')
    revalidatePath('/')

    return { ok: true, etag: newEtag }
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
      .is('deleted_at', null)
    if (error) throw error
    return { ok: true }
  } catch (e: any) {
    console.error('[setWorkPublic]', e)
    return { error: e.message ?? String(e) }
  }
}
