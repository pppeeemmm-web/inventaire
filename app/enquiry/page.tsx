import type { Metadata } from 'next'
import { Suspense } from 'react'
import EnquiryClient from '@/components/public/EnquiryClient'
import { trackView } from '@/lib/track'

export const metadata: Metadata = {
  title: 'Enquiry — Pierre Emmanuel Moulin',
  description: 'Contact Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

export default async function EnquiryPage() {
  await trackView('/enquiry')
  return (
    <Suspense fallback={null}>
      <EnquiryClient />
    </Suspense>
  )
}
