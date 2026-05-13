import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Certificate verification — Pierre Emmanuel Moulin',
  description: 'Verify a certificate of authenticity issued by the studio.',
  robots: { index: true, follow: true },
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children
}
