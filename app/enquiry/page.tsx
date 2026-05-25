import type { Metadata } from 'next'
import { Suspense } from 'react'
import EnquiryClient from '@/components/public/EnquiryClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'
import { loadPublicSiteTheme } from '@/lib/public-site-theme.server'

export const metadata: Metadata = routeMetadata('enquiry', 'en')

export default async function EnquiryPage() {
  const siteTheme = await loadPublicSiteTheme()
  return (
    <Suspense fallback={null}>
      <EnquiryClient siteTheme={siteTheme} />
    </Suspense>
  )
}
