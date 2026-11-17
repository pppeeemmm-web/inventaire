import { resolveMessage } from '@/lib/i18n/resolve-message'
import { siteOgImageResponse } from '@/lib/seo/og-image'

/** 1200×630 JPEG social preview (hero work on the page's sky) — `lib/seo/og-image.ts`. */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/jpeg'
export const alt = resolveMessage('en', 'pub_og_image_alt')
export const revalidate = 3600

export default function Image() {
  return siteOgImageResponse('about')
}
