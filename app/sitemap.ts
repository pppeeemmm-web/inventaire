import type { MetadataRoute } from 'next'
import { getMetadataBase } from '@/lib/seo/site-url'

const PUBLIC_PATHS = ['/', '/works', '/about', '/practice', '/enquiry'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getMetadataBase().origin
  const lastModified = new Date()
  return PUBLIC_PATHS.map((path) => ({
    url: path === '/' ? `${base}/` : `${base}${path}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.8,
  }))
}
