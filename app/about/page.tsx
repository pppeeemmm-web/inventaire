import type { Metadata } from 'next'
import AboutClient from '@/components/public/AboutClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'
import { loadPublicSiteTheme } from '@/lib/public-site-theme.server'

export const metadata: Metadata = routeMetadata('about', 'en')

export default async function AboutPage() {
  const siteTheme = await loadPublicSiteTheme('about')
  return <AboutClient siteTheme={siteTheme} />
}
