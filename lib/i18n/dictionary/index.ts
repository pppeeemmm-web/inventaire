import type { MessageKey } from '../messages'
import type { DictKey as LegacyDictKey, Lang, Dictionary as LegacyDictionary } from './types'
import { flattenMessages } from '../message-core'
import { featureMessages } from '../messages'
import { fr } from './fr'
import { en } from './en'

export type { Lang } from './types'
export type DictKey = LegacyDictKey | MessageKey
export type Dictionary = LegacyDictionary & Record<MessageKey, string>

export const dict = {
  fr: { ...fr, ...flattenMessages(featureMessages, 'fr') },
  en: { ...en, ...flattenMessages(featureMessages, 'en') },
} satisfies Record<Lang, Dictionary>
