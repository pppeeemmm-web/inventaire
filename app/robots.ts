import type { MetadataRoute } from 'next'
import { getMetadataBase } from '@/lib/seo/site-url'

/** Public marketing routes stay crawlable; app + portals + APIs are blocked. */
export default function robots(): MetadataRoute.Robots {
  const origin = getMetadataBase().origin
  return {
    rules: [
      {
        userAgent: '*',
        disallow: [
          '/atelier',
          '/hub',
          '/galerie',
          '/collection',
          '/maps',
          '/login',
          '/card',
          '/c/',
          '/api/',
          '/auth',
          '/_next/',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  }
}
