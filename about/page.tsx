import type { Metadata } from 'next'
import AboutClient from '@/components/public/AboutClient'

export const metadata: Metadata = {
  title: 'About — Pierre Emmanuel Moulin',
  description: 'Biography and CV of Pierre Emmanuel Moulin, painter.',
  robots: { index: true, follow: true },
}

export default function AboutPage() {
  return <AboutClient />
}
