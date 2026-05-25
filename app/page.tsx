import type { Metadata } from 'next'
import { cache } from 'react'
import LandingPage from '@/components/public/LandingPage'
import { dict } from '@/lib/i18n/dictionary'
import { getMetadataBase } from '@/lib/seo/site-url'
import {
  LANDING_HERO_IMAGE_URL,
  resolveLandingHeroImageUrl,
  resolveArtistDisplayName,
  isLandingHeroUnoptimized,
} from '@/lib/seo/landing-hero'
import { loadPortfolioSectionsFromR2 } from '@/lib/portfolio-sections-from-r2'
import {
  hiddenNavRoutes,
  orderedNavRoutes,
  isLandingHeroLinked,
  DEFAULT_NAV_ORDER,
} from '@/lib/site-block-visibility'
import {
  DEFAULT_HERO_CAPTION_EN,
  DEFAULT_HERO_CAPTION_FR,
} from '@/lib/portfolio-config-types'
import type { SiteBlock } from '@/lib/portfolio-config-types'

const getPortfolioSectionsCached = cache(loadPortfolioSectionsFromR2)

export async function generateMetadata(): Promise<Metadata> {
  const base = getMetadataBase()
  let heroUrl = LANDING_HERO_IMAGE_URL
  let siteName = resolveArtistDisplayName(undefined)
  try {
    const { config } = await getPortfolioSectionsCached()
    const g = config.general as { artist_name?: string } | undefined
    const l = config.landing as { hero_image_url?: string } | undefined
    heroUrl = resolveLandingHeroImageUrl(l?.hero_image_url)
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
  try {
    const { config } = await getPortfolioSectionsCached()
    const g = config.general as { artist_name?: string } | undefined
    const l = config.landing as {
      hero_image_url?: string
      hero_caption_fr?: string
      hero_caption_en?: string
    } | undefined
    heroImageUrl = resolveLandingHeroImageUrl(l?.hero_image_url)
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
    />
  )
}
