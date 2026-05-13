/**
 * Loads `portfolio_sections.json` from R2 + document list from Supabase (service role).
 * Plain server module (no `'use server'`) so `generateMetadata` and server pages can import it.
 */

import { createServiceClient } from '@/lib/supabase/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export const PORTFOLIO_SECTIONS_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'
export const PORTFOLIO_SECTIONS_R2_KEY = 'portfolio_sections.json'

export function createPortfolioConfigS3Client(): S3Client {
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

export async function loadPortfolioSectionsFromR2(): Promise<{
  config: Record<string, unknown>
  documents: { id: string; name: string }[]
}> {
  const hasServiceCreds = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  )
  const sb = hasServiceCreds ? createServiceClient() : null
  const s3 = createPortfolioConfigS3Client()

  const [docsResult, r2Result] = await Promise.allSettled([
    sb
      ? (sb.from('document') as any).select('id, name').order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    s3.send(new GetObjectCommand({ Bucket: PORTFOLIO_SECTIONS_BUCKET, Key: PORTFOLIO_SECTIONS_R2_KEY })),
  ])

  const documents = docsResult.status === 'fulfilled'
    ? ((docsResult.value.data ?? []) as { id: string; name: string }[])
    : []

  let config: Record<string, unknown> = {
    general: {
      artist_name: '',
      about_intro: '',
      contact_email: '',
      instagram: '',
    },
    landing: { hero_image_url: '' },
    sections:          [],
    works_collections: [],
    works_modes:       [],
    statement_doc_id:  null,
    cv_doc_id:         null,
  }

  if (r2Result.status === 'fulfilled') {
    const body = r2Result.value.Body
    if (body) {
      const text = await body.transformToString('utf-8')
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>
        const landingRaw = parsed.landing
        const landing = landingRaw && typeof landingRaw === 'object' && !Array.isArray(landingRaw)
          ? {
              hero_image_url: String(
                (landingRaw as { hero_image_url?: unknown }).hero_image_url ?? '',
              ).trim(),
            }
          : { hero_image_url: '' }

        config = {
          general:           parsed.general           || config.general,
          landing,
          about:             parsed.about             || null,
          practice:          parsed.practice          || null,
          sections:          parsed.sections          || [],
          works_collections: parsed.works_collections || [],
          works_modes:       Array.isArray(parsed.works_modes) ? parsed.works_modes : [],
          statement_doc_id:  parsed.statement_doc_id  || null,
          cv_doc_id:         parsed.cv_doc_id         || null,
        }
      } catch (e) {
        console.error('[loadPortfolioSectionsFromR2] JSON parse error:', e)
      }
    }
  }

  return { config, documents }
}
