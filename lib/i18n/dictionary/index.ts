import type { Lang, Dictionary } from './types'
import { fr } from './fr'
import { en } from './en'

export type { DictKey } from './keys'
export type { Lang, Dictionary } from './types'

export const dict: Record<Lang, Dictionary> = { fr, en }
