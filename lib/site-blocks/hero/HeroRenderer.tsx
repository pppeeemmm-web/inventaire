/**
 * hero public renderer.
 *
 * The / (landing) page still renders via the legacy LandingPage path.
 * This renderer returns null — public routing is unchanged until LandingPage
 * is refactored to iterate pages.landing via the block registry.
 */

export type HeroFields = {
  /** R2 storage key — resolved via thumbUrl() / imageUrl() for preview. */
  hero_image_key?: string
  hero_caption_fr?: string
  hero_caption_en?: string
}

export const HERO_DEFAULTS: HeroFields = {
  hero_image_key: '',
  hero_caption_fr: '',
  hero_caption_en: '',
}

export default function HeroRenderer(): null {
  return null
}
