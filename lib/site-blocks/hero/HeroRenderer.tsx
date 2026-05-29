'use client'

import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'
import { useLandingHeroCtx } from './LandingHeroCtx'
import { useI18n } from '@/lib/i18n/context'
import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type HeroFields = {
  /** R2 storage key — resolved via thumbUrl() / imageUrl() for preview. */
  hero_image_key?: string
  hero_caption_fr?: string
  hero_caption_en?: string
}

export const HERO_DEFAULTS: HeroFields = {
  hero_image_key: '',
  hero_caption_fr: '',
  hero_caption_en: '',
}

/**
 * Public landing hero renderer.
 *
 * Renders inside LandingPage which provides LandingHeroCtx — visual props
 * (image URL, gloss, shadow filter, theme colours) flow through context to
 * avoid threading them through BlockRendererProps. Block fields supply
 * caption overrides; context provides fallback values.
 *
 * Renders a Fragment: hero-orbit-wrap div + optional caption paragraph.
 * Both are placed as children of .landing-center in LandingPage, where
 * the CSS classes (hero-orbit-wrap, hero-caption, etc.) are defined.
 */
export default function HeroRenderer({ fields }: BlockRendererProps<HeroFields>) {
  const ctx = useLandingHeroCtx()
  const { lang, t } = useI18n()

  // Block field takes precedence over context fallback; prefer current lang.
  const heroCaption = lang === 'en'
    ? (fields.hero_caption_en?.trim() || ctx.heroCaptionEn || fields.hero_caption_fr?.trim() || ctx.heroCaptionFr)
    : (fields.hero_caption_fr?.trim() || ctx.heroCaptionFr || fields.hero_caption_en?.trim() || ctx.heroCaptionEn)

  const heroSizes = ctx.pubNarrow
    ? '(max-width: 767px) min(80vw, 100vw)'
    : 'min(80vw, 80vh, 1200px)'

  const waving = (
    <WavingCircle
      src={ctx.heroImageUrl}
      alt={ctx.artistName}
      priority
      sizes={heroSizes}
      unoptimized={ctx.heroImageUnoptimized}
      glossEnabled={ctx.heroGlossEnabled}
      glossBackground={ctx.heroGlossBackground}
      glossMixBlendMode={ctx.heroGlossMixBlendMode}
      heroDiscCastFilter={ctx.heroDiscCastFilter}
      heroWhiteKey={ctx.heroWhiteKey}
      heroBackdropCss={ctx.heroBackdropCss}
    />
  )

  return (
    <>
      <div className="hero-orbit-wrap">
        <nav className="circle-wrap" aria-label={t('pub_mobile_nav_heading')}>
          {ctx.heroLinked ? (
            <Link
              href="/works"
              className="hero-hit"
              aria-label={t('pub_landing_hero_works_link_aria')}
            >
              {waving}
            </Link>
          ) : (
            <div className="hero-static">{waving}</div>
          )}
        </nav>
      </div>
      {heroCaption.trim() ? (
        <p className="hero-caption landing-body-shadow">{heroCaption}</p>
      ) : null}
    </>
  )
}
