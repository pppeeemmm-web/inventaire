import type { Metadata } from 'next'
import LandingPage from '@/components/public/LandingPage'
import { dict } from '@/lib/i18n/dictionary'
import { getMetadataBase } from '@/lib/seo/site-url'
import {
  LANDING_HERO_IMAGE_URL,
  resolveLandingHeroImageUrl,
  resolveArtistDisplayName,
  isLandingHeroUnoptimized,
} from '@/lib/seo/landing-hero'
import { loadPortfolioSectionsCached } from '@/lib/portfolio-sections-from-r2'
import {
  hiddenNavRoutes,
  orderedNavRoutes,
  isLandingHeroLinked,
  DEFAULT_NAV_ORDER,
} from '@/lib/site-block-visibility'
import {
  DEFAULT_HERO_CAPTION_EN,
  DEFAULT_HERO_CAPTION_FR,
  migrate,
} from '@/lib/portfolio-config-types'
import { resolveLandingBackground } from '@/lib/landing-background'
import { resolveHeroGloss } from '@/lib/landing-hero-gloss'
import { landingShadowTuningFromLanding } from '@/lib/landing-text-shadow'
import type { LandingConfig, SiteBlock } from '@/lib/portfolio-config-types'

export async function generateMetadata(): Promise<Metadata> {
  const base = getMetadataBase()
  let heroUrl = LANDING_HERO_IMAGE_URL
  let siteName = resolveArtistDisplayName(undefined)
  try {
    const { config } = await loadPortfolioSectionsCached()
    const g = config.general as { artist_name?: string } | undefined
    const l = config.landing as { hero_image_url?: string; hero_image_key?: string } | undefined
    heroUrl = resolveLandingHeroImageUrl(l ?? undefined)
    siteName = resolveArtistDisplayName(g?.artist_name)
  } catch (e) {
    console.error('[HomePage] generateMetadata: portfolio sections load failed', e)
  }

  return {
    metadataBase: base,
    title: dict.en.seo_home_meta_title,
    description: dict.en.seo_home_meta_description,
    robots: { index: true, follow: true },
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'en_GB',
      url: '/',
      siteName,
      title: dict.en.seo_home_meta_title,
      description: dict.en.seo_home_meta_description,
      images: [
        {
          url: heroUrl,
          width: 400,
          height: 400,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.en.seo_home_meta_title,
      description: dict.en.seo_home_meta_description,
      images: [heroUrl],
    },
  }
}

export default async function HomePage() {
  let heroImageUrl = LANDING_HERO_IMAGE_URL
  let artistName = resolveArtistDisplayName(undefined)
  let heroImageUnoptimized = isLandingHeroUnoptimized(LANDING_HERO_IMAGE_URL)
  let hidden: string[] = []
  let navOrder: string[] = [...DEFAULT_NAV_ORDER]
  let heroCaptionFr = DEFAULT_HERO_CAPTION_FR
  let heroCaptionEn = DEFAULT_HERO_CAPTION_EN
  let heroLinked = true
  let landingBg = resolveLandingBackground()
  let heroGloss = resolveHeroGloss()
  let landingPartial: Partial<LandingConfig> | undefined
  try {
    const { config } = await loadPortfolioSectionsCached()
    const g = config.general as { artist_name?: string } | undefined
    const l = config.landing as Partial<LandingConfig> | undefined
    landingPartial = l
    landingBg = resolveLandingBackground(l)
    heroGloss = resolveHeroGloss(l)
    heroImageUrl = resolveLandingHeroImageUrl(l ?? undefined)
    heroImageUnoptimized = isLandingHeroUnoptimized(heroImageUrl)
    artistName = resolveArtistDisplayName(g?.artist_name)
    heroCaptionFr = (l?.hero_caption_fr ?? '').trim() || DEFAULT_HERO_CAPTION_FR
    heroCaptionEn = (l?.hero_caption_en ?? '').trim() || DEFAULT_HERO_CAPTION_EN
    const blocks = config.site_blocks as SiteBlock[] | undefined
    if (blocks) {
      hidden = hiddenNavRoutes(blocks)
      navOrder = orderedNavRoutes(blocks)
      heroLinked = isLandingHeroLinked(blocks)
    }

    // ── Registry-driven overlay from pages.landing blocks ────────────────
    // PagesEditor block visibility + field edits take effect here once the
    // artist saves via Publier. Hero renderer is still null (LandingPage handles
    // its own rendering), but block metadata drives caption and identity.
    const migrated = migrate(config)
    const landingBlocks = migrated.pages?.landing ?? []

    const heroBlock = landingBlocks.find(b => b.kind === 'hero')
    const identityBlock = landingBlocks.find(b => b.kind === 'identity')

    // If the identity block is hidden, suppress the artist name ring.
    if (identityBlock && !identityBlock.visible) {
      artistName = ''
    } else if (identityBlock?.fields) {
      // Prefer block field if it was explicitly set via PagesEditor and differs.
      const blockName = typeof identityBlock.fields.artist_name === 'string'
        ? identityBlock.fields.artist_name.trim()
        : ''
      if (blockName) artistName = resolveArtistDisplayName(blockName)
    }

    // If the hero block is hidden, suppress caption and hero link.
    if (heroBlock && !heroBlock.visible) {
      heroCaptionFr = ''
      heroCaptionEn = ''
      heroLinked = false
    } else if (heroBlock?.fields) {
      // Prefer block caption fields if they were explicitly set via PagesEditor.
      const blockCapFr = typeof heroBlock.fields.hero_caption_fr === 'string'
        ? heroBlock.fields.hero_caption_fr.trim()
        : ''
      const blockCapEn = typeof heroBlock.fields.hero_caption_en === 'string'
        ? heroBlock.fields.hero_caption_en.trim()
        : ''
      if (blockCapFr) heroCaptionFr = blockCapFr
      if (blockCapEn) heroCaptionEn = blockCapEn
    }
  } catch (e) {
    console.error('[HomePage] portfolio sections load failed', e)
  }

  return (
    <LandingPage
      heroImageUrl={heroImageUrl}
      artistName={artistName}
      heroImageUnoptimized={heroImageUnoptimized}
      heroCaptionFr={heroCaptionFr}
      heroCaptionEn={heroCaptionEn}
      heroLinked={heroLinked}
      hiddenNavRoutes={hidden}
      navOrder={navOrder}
      landingBackgroundCss={landingBg.backgroundCss}
      landingBottomHex={landingBg.bottomHex}
      landingToolbarBackground={landingBg.toolbarBackground}
      landingChromeText={landingBg.chromeText}
      landingChromeTextHover={landingBg.chromeTextHover}
      landingChromeBorder={landingBg.chromeBorder}
      landingBodyMutedText={landingBg.bodyMutedText}
      landingBodyText={landingBg.bodyText}
      heroGlossEnabled={heroGloss.enabled}
      heroGlossBackground={heroGloss.background}
      heroGlossMixBlendMode={heroGloss.mixBlendMode}
      heroWhiteKey={false}
      shadowTuning={landingShadowTuningFromLanding(landingPartial, landingBg.bottomHex, landingBg.topHex)}
    />
  )
}
