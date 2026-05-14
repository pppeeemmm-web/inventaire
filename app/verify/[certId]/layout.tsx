import type { Metadata } from 'next'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('verify', 'en')

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children
}
