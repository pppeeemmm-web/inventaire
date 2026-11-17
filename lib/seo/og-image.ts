import 'server-only'

import sharp from 'sharp'
import { loadPortfolioSectionsCached } from '@/lib/portfolio-sections-from-r2'
import { migrate } from '@/lib/portfolio-config-types'
import { resolveLandingHeroImageUrl } from '@/lib/seo/landing-hero'
import { resolvePublicSiteThemeForPage } from '@/lib/public-site-theme'
import type { PublicPageKey } from '@/lib/page-background'

/** Social preview size (Facebook / LinkedIn / X large card). */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const
const PAD = 40

const HEX = /^#[0-9a-f]{6}$/i
function safeHex(v: string, fallback: string): string {
  return HEX.test(v) ? v : fallback
}

/**
 * 1200×630 JPEG for `og:image`: the landing hero work, whole and uncropped, centred on
 * the page's own sky colours (top → bottom). No text — the title travels in the meta tags.
 * The hero comes from the Site module, so a new hero = a new preview after save.
 */
export async function renderSiteOgJpeg(page: PublicPageKey): Promise<Buffer> {
  let top = '#efebe5'
  let bottom = '#d9d3ca'
  let heroUrl = resolveLandingHeroImageUrl(undefined)
  try {
    const { config } = await loadPortfolioSectionsCached()
    const cfg = migrate(config)
    const theme = resolvePublicSiteThemeForPage(page, cfg.landing, cfg.site_blocks)
    top = safeHex(theme.topHex, top)
    bottom = safeHex(theme.bottomHex, bottom)
    heroUrl = resolveLandingHeroImageUrl(cfg.landing)
  } catch (e) {
    console.error('[og-image] portfolio sections load failed', e)
  }

  const { width, height } = OG_IMAGE_SIZE
  const ground = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>` +
      `</linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  )

  const layers: sharp.OverlayOptions[] = []
  try {
    const res = await fetch(heroUrl)
    if (!res.ok) throw new Error(`hero fetch ${res.status}`)
    const work = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize({ width: width - PAD * 2, height: height - PAD * 2, fit: 'inside', withoutEnlargement: false })
      .toBuffer()
    layers.push({ input: work, gravity: 'center' })
  } catch (e) {
    console.error('[og-image] hero image unavailable, plain ground only', e)
  }

  return sharp(ground).composite(layers).flatten({ background: bottom }).jpeg({ quality: 84, mozjpeg: true }).toBuffer()
}

export async function siteOgImageResponse(page: PublicPageKey): Promise<Response> {
  const jpeg = await renderSiteOgJpeg(page)
  return new Response(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg' },
  })
}
