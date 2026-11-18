import type { Lang } from '@/lib/i18n/dictionary'
import type { AideChapter, AideGuideId } from './types'
import { TEAM_FR } from './team.fr'
import { TEAM_EN } from './team.en'
import { ADMIN_FR } from './admin.fr'
import { ADMIN_EN } from './admin.en'

/**
 * Chapters per guide and language. The admin guide (batch 5, 2026-11-18) covers only the admin extras; the
 * guide switch in `Aide.tsx` shows it to admins only (help text, not a secret: it ships in the same chunk).
 */
const GUIDES: Record<AideGuideId, Record<Lang, AideChapter[]>> = {
  team: { fr: TEAM_FR, en: TEAM_EN },
  admin: { fr: ADMIN_FR, en: ADMIN_EN },
}

export function aideChapters(guide: AideGuideId, lang: Lang): AideChapter[] {
  return GUIDES[guide][lang]
}

/** Guides this viewer can open, in menu order. */
export function aideGuidesFor(isAdmin: boolean): AideGuideId[] {
  return (['team', 'admin'] as const).filter((g) => (g === 'admin' ? isAdmin : true) && GUIDES[g].fr.length > 0)
}
