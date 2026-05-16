import type { DictKey as DictionaryKey } from './keys'

export type Lang = 'fr' | 'en'
export type { DictKey } from './keys'

export type Dictionary = Record<DictionaryKey, string>
export type LegacyDictionary = Dictionary
