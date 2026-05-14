import type { Metadata } from 'next'
import PracticeClient from '@/components/public/PracticeClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('practice', 'en')

export default function PracticePage() {
  return <PracticeClient />
}
