import { flattenMessages } from './message-core'
import { featureMessages } from './messages'
import { en } from './dictionary/en'
import { fr } from './dictionary/fr'
import type { Lang } from './dictionary/types'
import type { DictKey } from './dictionary'

/** Legacy dictionary only (no `defineMessages` overlay). */
export const legacyDict = { fr, en } as const

/** `defineMessages` modules flattened per language (Slice 4 precedence source). */
export const featureMessagesByLang: Record<Lang, Record<string, string>> = {
  fr: flattenMessages(featureMessages, 'fr'),
  en: flattenMessages(featureMessages, 'en'),
}

const warnedKeys = new Set<string>()

export function warnMissingI18nKey(key: string, lang: Lang): void {
  if (process.env.NODE_ENV === 'production') return
  const token = `${lang}:${key}`
  if (warnedKeys.has(token)) return
  warnedKeys.add(token)
  console.warn(`[i18n] missing key "${key}" (${lang})`)
}

/**
 * Resolve copy: `defineMessages` first, then legacy `fr.ts` / `en.ts`, then key as fallback.
 */
export function resolveMessage(lang: Lang, key: DictKey): string {
  const k = String(key)
  const fromFeature = featureMessagesByLang[lang][k] ?? featureMessagesByLang.fr[k]
  if (fromFeature !== undefined) return fromFeature

  const legacy = legacyDict[lang] as Record<string, string | undefined>
  const legacyFr = legacyDict.fr as Record<string, string | undefined>
  const fromLegacy = legacy[key] ?? legacyFr[key]
  if (fromLegacy !== undefined) return fromLegacy

  warnMissingI18nKey(String(key), lang)
  return String(key)
}
