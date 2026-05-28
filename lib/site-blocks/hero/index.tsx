import type { BlockDescriptor } from '@/lib/site-blocks/registry'
import HeroRenderer, { HERO_DEFAULTS, type HeroFields } from './HeroRenderer'
import HeroEditor from './HeroEditor'

/**
 * `hero` — landing page hero circle image with gloss, bevel, background gradient.
 *
 * systemManaged = true: auto-generated from config.landing; not manually addable.
 * Renderer returns null — / still dispatches via the legacy LandingPage path.
 * Full migration (renderer + wiring LandingPage to block registry) is a future session.
 */
export const heroDescriptor: BlockDescriptor<HeroFields> = {
  kind: 'hero',
  allowedPages: ['landing'],
  knobFamilies: ['light', 'shadow', 'frame', 'bg'],
  defaultFields: HERO_DEFAULTS,
  systemManaged: true,
  editor: HeroEditor,
  renderer: HeroRenderer,
  migrateFields(raw): HeroFields {
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
    return {
      hero_image_key: typeof r.hero_image_key === 'string' ? r.hero_image_key : undefined,
      hero_caption_fr: typeof r.hero_caption_fr === 'string' ? r.hero_caption_fr : undefined,
      hero_caption_en: typeof r.hero_caption_en === 'string' ? r.hero_caption_en : undefined,
    }
  },
}
