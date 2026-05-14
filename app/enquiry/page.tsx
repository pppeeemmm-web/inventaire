import type { Metadata } from 'next'
import { Suspense } from 'react'
import EnquiryClient from '@/components/public/EnquiryClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('enquiry', 'en')

export default function EnquiryPage() {
  return (
    <Suspense fallback={null}>
      <EnquiryClient />
    </Suspense>
  )
}
