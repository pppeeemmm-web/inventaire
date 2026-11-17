import type { Metadata } from 'next'
import PracticeClient, { type PublicPracticeConfig } from '@/components/public/PracticeClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'
import { loadPublicSiteTheme } from '@/lib/public-site-theme.server'
import { loadPortfolioSectionsCached } from '@/lib/portfolio-sections-from-r2'
import { migrate } from '@/lib/portfolio-config-types'

export const metadata: Metadata = routeMetadata('practice', 'en')

/** Server-rendered from the cached Site JSON so the saved statement is in the HTML. */
async function loadPracticeConfig(): Promise<PublicPracticeConfig | null> {
  try {
    const { config } = await loadPortfolioSectionsCached()
    const cfg = migrate(config)
    return { practice: cfg.practice, site_blocks: cfg.site_blocks }
  } catch (e) {
    console.error('[PracticePage] portfolio sections load failed', e)
    return null
  }
}

export default async function PracticePage() {
  const [siteTheme, config] = await Promise.all([loadPublicSiteTheme('practice'), loadPracticeConfig()])
  return <PracticeClient siteTheme={siteTheme} config={config} />
}
