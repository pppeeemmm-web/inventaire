import type { Metadata } from 'next'
import LandingPage from '@/components/public/LandingPage'
import { dict } from '@/lib/i18n/dictionary'
import { getMetadataBase } from '@/lib/seo/site-url'
import { LANDING_HERO_IMAGE_URL } from '@/lib/seo/landing-hero'

const ARTIST = 'Pierre Emmanuel Moulin'

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: dict.en.seo_home_meta_title,
  description: dict.en.seo_home_meta_description,
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: '/',
    siteName: ARTIST,
    title: dict.en.seo_home_meta_title,
    description: dict.en.seo_home_meta_description,
    images: [
      {
        url: LANDING_HERO_IMAGE_URL,
        width: 400,
        height: 400,
        alt: ARTIST,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: dict.en.seo_home_meta_title,
    description: dict.en.seo_home_meta_description,
    images: [LANDING_HERO_IMAGE_URL],
  },
}

export default function HomePage() {
  return <LandingPage />
}
