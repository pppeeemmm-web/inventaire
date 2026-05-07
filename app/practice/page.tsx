import type { Metadata } from 'next'
import PracticeClient from '@/components/public/PracticeClient'
import { trackView } from '@/lib/track'

export const metadata: Metadata = {
  title: 'Practice — Pierre Emmanuel Moulin',
  description: 'Démarche artistique de Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

export default async function PracticePage() {
  await trackView('/practice')
  return <PracticeClient />
}
