import { Suspense } from 'react'
import { SessionNewClient } from '@/components/atelier/session/SessionNewClient'

export default function SessionNewPage() {
  return (
    <Suspense fallback={null}>
      <SessionNewClient />
    </Suspense>
  )
}
