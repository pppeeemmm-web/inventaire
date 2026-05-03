import type { Metadata } from 'next'
import AboutClient from '@/components/public/AboutClient'

export const metadata: Metadata = {
  title: 'About — Pierre Emmanuel Moulin',
  description: 'Biographie et CV de Pierre Emmanuel Moulin, peintre.',
  robots: { index: true, follow: true },
}

export default function AboutPage() {
  return <AboutClient />
}
