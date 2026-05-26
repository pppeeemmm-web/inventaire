import type { Metadata } from 'next'
import { Suspense } from 'react'
import EnquiryClient from '@/components/public/EnquiryClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'
import { loadPublicSiteTheme } from '@/lib/public-site-theme.server'
import { loadPortfolioSectionsCached } from '@/lib/portfolio-sections-from-r2'
import type { LandingConfig } from '@/lib/portfolio-config-types'
import { landingShadowTuningFromLanding } from '@/lib/landing-text-shadow'

export const metadata: Metadata = routeMetadata('enquiry', 'en')

export default async function EnquiryPage() {
  const siteTheme = await loadPublicSiteTheme()
  let landingPartial: Partial<LandingConfig> | undefined
  try {
    const { config } = await loadPortfolioSectionsCached()
    landingPartial = config.landing as Partial<LandingConfig> | undefined
  } catch (e) {
    console.error('[EnquiryPage] portfolio sections load failed', e)
  }
  const shadowTuning = landingShadowTuningFromLanding(
    landingPartial,
    siteTheme.bottomHex,
    siteTheme.topHex,
  )
  return (
    <Suspense fallback={null}>
      <EnquiryClient siteTheme={siteTheme} shadowTuning={shadowTuning} />
    </Suspense>
  )
}
