import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ResetPasswordClient } from '../ResetPasswordClient'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('login', 'en')

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordClient />
    </Suspense>
  )
}
