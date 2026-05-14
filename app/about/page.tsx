import type { Metadata } from 'next'
import AboutClient from '@/components/public/AboutClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('about', 'en')

export default function AboutPage() {
  return <AboutClient />
}
