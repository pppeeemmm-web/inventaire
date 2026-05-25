/**
 * Loads `portfolio_sections.json` from R2 + document list from Supabase (service role).
 * Plain server module (no `'use server'`) so `generateMetadata` and server pages can import it.
 */

import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import {
  DEFAULT_HERO_CAPTION_EN,
  DEFAULT_HERO_CAPTION_FR,
  migrateSiteBlocks,
} from '@/lib/portfolio-config-types'
import {
  applyLandingBlendTransition,
  DEFAULT_LANDING_GRADIENT_STOPS,
  LANDING_BG_BLEND_POSITION_DEFAULT,
  LANDING_BG_BLEND_SOFTNESS_DEFAULT,
  migrateLandingGradientStops,
} from '@/lib/landing-background'
import {
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  LANDING_HERO_BEVEL_PX_DEFAULT,
  migrateHeroBevelProfile,
  migrateHeroBevelPx,
} from '@/lib/landing-hero-bevel'
import {
  LANDING_HERO_GLOSS_BLEND_DEFAULT,
  LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
  LANDING_HERO_GLOSS_POSITION_DEFAULT,
  LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
  migrateHeroGlossBlend,
} from '@/lib/landing-hero-gloss'
import type { SiteBlock, SiteBlockKind } from '@/lib/portfolio-config-types'

export const PORTFOLIO_SECTIONS_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'
export const PORTFOLIO_SECTIONS_R2_KEY = 'portfolio_sections.json'

function parseLandingPct(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, Math.round(n)))
}

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
  /** Strong ETag of `portfolio_sections.json` in R2, or null if object missing / unread. */
  objectEtag: string | null
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
    landing: {
      hero_image_url: '',
      hero_caption_fr: DEFAULT_HERO_CAPTION_FR,
      hero_caption_en: DEFAULT_HERO_CAPTION_EN,
      bg_gradient_stops: applyLandingBlendTransition(
        DEFAULT_LANDING_GRADIENT_STOPS,
        LANDING_BG_BLEND_POSITION_DEFAULT,
        LANDING_BG_BLEND_SOFTNESS_DEFAULT,
      ),
      bg_blend_position_pct: LANDING_BG_BLEND_POSITION_DEFAULT,
      bg_blend_softness_pct: LANDING_BG_BLEND_SOFTNESS_DEFAULT,
      hero_gloss_blend: LANDING_HERO_GLOSS_BLEND_DEFAULT,
      hero_gloss_strength_pct: LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
      hero_gloss_position_pct: LANDING_HERO_GLOSS_POSITION_DEFAULT,
      hero_gloss_falloff_pct: LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
      hero_bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
      hero_bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
    },
    sections:          [],
    works_collections: [],
    works_modes:       [],
    pdf_profiles:      {},
    statement_doc_id:  null,
    cv_doc_id:         null,
  }

  let objectEtag: string | null = null

  if (r2Result.status === 'fulfilled') {
    const res = r2Result.value
    if (typeof res.ETag === 'string') {
      objectEtag = res.ETag.replace(/^"|"$/g, '')
    }
    const body = res.Body
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
              hero_caption_fr: String(
                (landingRaw as { hero_caption_fr?: unknown }).hero_caption_fr ?? '',
              ).trim() || DEFAULT_HERO_CAPTION_FR,
              hero_caption_en: String(
                (landingRaw as { hero_caption_en?: unknown }).hero_caption_en ?? '',
              ).trim() || DEFAULT_HERO_CAPTION_EN,
              bg_gradient_stops: migrateLandingGradientStops(landingRaw),
              bg_blend_position_pct: parseLandingPct(
                (landingRaw as { bg_blend_position_pct?: unknown }).bg_blend_position_pct,
                LANDING_BG_BLEND_POSITION_DEFAULT,
              ),
              bg_blend_softness_pct: parseLandingPct(
                (landingRaw as { bg_blend_softness_pct?: unknown }).bg_blend_softness_pct,
                LANDING_BG_BLEND_SOFTNESS_DEFAULT,
              ),
              hero_gloss_blend: migrateHeroGlossBlend(
                (landingRaw as { hero_gloss_blend?: unknown }).hero_gloss_blend,
              ),
              hero_gloss_strength_pct: parseLandingPct(
                (landingRaw as { hero_gloss_strength_pct?: unknown }).hero_gloss_strength_pct,
                LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
              ),
              hero_gloss_position_pct: parseLandingPct(
                (landingRaw as { hero_gloss_position_pct?: unknown }).hero_gloss_position_pct,
                LANDING_HERO_GLOSS_POSITION_DEFAULT,
              ),
              hero_gloss_falloff_pct: parseLandingPct(
                (landingRaw as { hero_gloss_falloff_pct?: unknown }).hero_gloss_falloff_pct,
                LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
              ),
              hero_bevel_px: migrateHeroBevelPx(
                (landingRaw as { hero_bevel_px?: unknown }).hero_bevel_px,
              ),
              hero_bevel_profile: migrateHeroBevelProfile(
                (landingRaw as { hero_bevel_profile?: unknown }).hero_bevel_profile,
              ),
            }
          : {
              hero_image_url: '',
              hero_caption_fr: DEFAULT_HERO_CAPTION_FR,
              hero_caption_en: DEFAULT_HERO_CAPTION_EN,
              bg_gradient_stops: applyLandingBlendTransition(
                DEFAULT_LANDING_GRADIENT_STOPS,
                LANDING_BG_BLEND_POSITION_DEFAULT,
                LANDING_BG_BLEND_SOFTNESS_DEFAULT,
              ),
              bg_blend_position_pct: LANDING_BG_BLEND_POSITION_DEFAULT,
              bg_blend_softness_pct: LANDING_BG_BLEND_SOFTNESS_DEFAULT,
              hero_gloss_blend: LANDING_HERO_GLOSS_BLEND_DEFAULT,
              hero_gloss_strength_pct: LANDING_HERO_GLOSS_STRENGTH_DEFAULT,
              hero_gloss_position_pct: LANDING_HERO_GLOSS_POSITION_DEFAULT,
              hero_gloss_falloff_pct: LANDING_HERO_GLOSS_FALLOFF_DEFAULT,
              hero_bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
              hero_bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
            }

        const siteBlocks = migrateSiteBlocks(parsed)

        config = {
          general:           parsed.general           || config.general,
          landing,
          about:             parsed.about             || null,
          practice:          parsed.practice          || null,
          sections:          parsed.sections          || [],
          works_collections: parsed.works_collections || [],
          works_modes:       Array.isArray(parsed.works_modes) ? parsed.works_modes : [],
          pdf_profiles:      parsed.pdf_profiles && typeof parsed.pdf_profiles === 'object' ? parsed.pdf_profiles : {},
          site_blocks:       siteBlocks,
          statement_doc_id:  parsed.statement_doc_id  || null,
          cv_doc_id:         parsed.cv_doc_id         || null,
        }
      } catch (e) {
        console.error('[loadPortfolioSectionsFromR2] JSON parse error:', e)
      }
    }
  }

  return { config, documents, objectEtag }
}

/** Cached R2 + document list; invalidated from `savePortfolioConfig` via `revalidateTag('portfolio')`. */
export const loadPortfolioSectionsCached = unstable_cache(
  async () => loadPortfolioSectionsFromR2(),
  ['portfolio-sections-from-r2'],
  { tags: ['portfolio'] },
)
