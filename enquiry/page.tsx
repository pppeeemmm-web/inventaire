import type { Metadata } from 'next'
import EnquiryClient from '@/components/public/EnquiryClient'

export const metadata: Metadata = {
  title: 'Enquiry — Pierre Emmanuel Moulin',
  description: 'Contact Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

export default function EnquiryPage() {
  return <EnquiryClient />
}
