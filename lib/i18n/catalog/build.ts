import { featureMessagesByLang, legacyDict } from '../resolve-message'
import type { Lang } from '../dictionary/types'

/** One language's copy, flat: key → text. */
export type Catalog = Readonly<Record<string, string>>

/**
 * Every key with the same precedence as `resolveMessage`: feature[lang] → feature.fr → legacy[lang] → legacy.fr.
 * Runs at build time only in the production browser build (scripts/i18n-catalog-loader.cjs), so the
 * browser gets one language; elsewhere (dev, tsc, SSR) it runs as plain code.
 */
export function buildCatalog(lang: Lang): Catalog {
  const sources = [legacyDict.fr, legacyDict[lang], featureMessagesByLang.fr, featureMessagesByLang[lang]]
  const out: Record<string, string> = {}
  for (const source of sources) {
    for (const [key, value] of Object.entries(source as Record<string, string | undefined>)) {
      if (value !== undefined) out[key] = value
    }
  }
  return out
}
