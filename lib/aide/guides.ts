import type { Lang } from '@/lib/i18n/dictionary'
import type { AideChapter, AideGuideId } from './types'
import { TEAM_FR } from './team.fr'
import { TEAM_EN } from './team.en'

/**
 * Chapters per guide and language. The admin guide (batch 5) will be added here — the guide switch in
 * `Aide.tsx` only shows once a second guide has chapters, and only to admins.
 */
const GUIDES: Record<AideGuideId, Record<Lang, AideChapter[]>> = {
  team: { fr: TEAM_FR, en: TEAM_EN },
  admin: { fr: [], en: [] },
}

export function aideChapters(guide: AideGuideId, lang: Lang): AideChapter[] {
  return GUIDES[guide][lang]
}

/** Guides this viewer can open, in menu order. */
export function aideGuidesFor(isAdmin: boolean): AideGuideId[] {
  return (['team', 'admin'] as const).filter((g) => (g === 'admin' ? isAdmin : true) && GUIDES[g].fr.length > 0)
}
