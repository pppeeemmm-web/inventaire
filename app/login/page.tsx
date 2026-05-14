import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginClient } from './LoginClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('login', 'en')

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  )
}
