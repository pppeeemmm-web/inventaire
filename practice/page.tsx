import type { Metadata } from 'next'
import PracticeClient from '@/components/public/PracticeClient'

export const metadata: Metadata = {
  title: 'Practice — Pierre Emmanuel Moulin',
  description: 'Démarche artistique de Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

export default function PracticePage() {
  return <PracticeClient />
}
