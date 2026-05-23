import type { MessageKey } from '../messages'
import type { DictKey as LegacyDictKey, Lang, Dictionary as LegacyDictionary } from './types'
import { featureMessagesByLang, legacyDict } from '../resolve-message'

export type { Lang } from './types'
export type DictKey = LegacyDictKey | MessageKey
export type Dictionary = LegacyDictionary & Record<MessageKey, string>

/** Server/RSC: merged lookup (feature keys overlay legacy). Client `t()` uses `resolveMessage` for precedence + miss warnings. */
export const dict: Record<Lang, Dictionary> = {
  fr: { ...legacyDict.fr, ...featureMessagesByLang.fr } as Dictionary,
  en: { ...legacyDict.en, ...featureMessagesByLang.en } as Dictionary,
}

export { legacyDict, featureMessagesByLang } from '../resolve-message'
export { resolveMessage, warnMissingI18nKey } from '../resolve-message'
