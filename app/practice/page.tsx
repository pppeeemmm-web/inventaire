import type { Metadata } from 'next'
import PracticeClient from '@/components/public/PracticeClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'
import { loadPublicSiteTheme } from '@/lib/public-site-theme.server'

export const metadata: Metadata = routeMetadata('practice', 'en')

export default async function PracticePage() {
  const siteTheme = await loadPublicSiteTheme('practice')
  return <PracticeClient siteTheme={siteTheme} />
}
