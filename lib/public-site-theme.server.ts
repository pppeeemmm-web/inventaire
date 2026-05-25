import 'server-only'

import { loadPortfolioSectionsCached } from '@/lib/portfolio-sections-from-r2'
import { migrate, type LandingConfig } from '@/lib/portfolio-config-types'
import type { PublicPageKey } from '@/lib/page-background'
import {
  resolvePublicNavBarStyle,
  resolvePublicSiteThemeForPage,
  type PublicSiteTheme,
} from '@/lib/public-site-theme'

export type { PublicPageKey, PublicSiteTheme }

export async function loadPublicSiteTheme(
  page: PublicPageKey = 'landing',
): Promise<PublicSiteTheme> {
  try {
    const { config } = await loadPortfolioSectionsCached()
    const cfg = migrate(config)
    return resolvePublicSiteThemeForPage(page, cfg.landing, cfg.site_blocks)
  } catch (e) {
    console.error('[loadPublicSiteTheme] portfolio sections load failed', e)
    return resolvePublicSiteThemeForPage(page)
  }
}

export async function loadPublicNavBarStyle(
  page: PublicPageKey,
): Promise<'transparent' | 'bar'> {
  try {
    const { config } = await loadPortfolioSectionsCached()
    const cfg = migrate(config)
    return resolvePublicNavBarStyle(page, cfg.site_blocks)
  } catch {
    return resolvePublicNavBarStyle(page)
  }
}
