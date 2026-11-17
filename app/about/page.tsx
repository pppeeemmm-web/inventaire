import type { Metadata } from 'next'
import AboutClient, { type PublicAboutConfig } from '@/components/public/AboutClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'
import { loadPublicSiteTheme } from '@/lib/public-site-theme.server'
import { loadPortfolioSectionsCached } from '@/lib/portfolio-sections-from-r2'
import { migrate } from '@/lib/portfolio-config-types'

export const metadata: Metadata = routeMetadata('about', 'en')

/** Server-rendered from the cached Site JSON so the saved bio is in the HTML (search, previews). */
async function loadAboutConfig(): Promise<PublicAboutConfig | null> {
  try {
    const { config } = await loadPortfolioSectionsCached()
    const cfg = migrate(config)
    return {
      general: { artist_name: cfg.general.artist_name },
      about: { intro_fr: cfg.about.intro_fr, intro_en: cfg.about.intro_en },
      site_blocks: cfg.site_blocks,
      pages: { about: cfg.pages?.about ?? [] },
    }
  } catch (e) {
    console.error('[AboutPage] portfolio sections load failed', e)
    return null
  }
}

export default async function AboutPage() {
  const [siteTheme, config] = await Promise.all([loadPublicSiteTheme('about'), loadAboutConfig()])
  return <AboutClient siteTheme={siteTheme} config={config} />
}
