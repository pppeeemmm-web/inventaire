'use client'

import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
  type ReactNode,
} from 'react'
import type { Lang, DictKey } from './dictionary'
import { warnMissingI18nKey } from './message-core'
import type { Catalog } from './catalog/build'
// French is what the server renders and the page hydrates with, so it ships with the page.
// English is a separate chunk, loaded only when the viewer picks it (production build: one language per chunk).
import frCatalog from './catalog/fr'

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: DictKey) => string
  /** Like `t` but accepts any string key — use for runtime-dynamic keys (template literals, record lookups). */
  tDynamic: (key: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const catalogs: Partial<Record<Lang, Catalog>> = { fr: frCatalog }

function loadCatalog(lang: Lang): Promise<Catalog> {
  const ready = catalogs[lang]
  if (ready) return Promise.resolve(ready)
  return import('./catalog/en').then((m) => (catalogs.en = m.default))
}

function lookup(catalog: Catalog, lang: Lang, key: string): string {
  if (Object.prototype.hasOwnProperty.call(catalog, key)) return catalog[key]
  warnMissingI18nKey(key, lang)
  return key
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')
  /** Last language asked for: a slow load must not override a newer choice. */
  const wanted = useRef<Lang>('fr')

  const show = useCallback((l: Lang) => {
    wanted.current = l
    loadCatalog(l).then(
      () => { if (wanted.current === l) setLangState(l) },
      (err: unknown) => console.error('[i18n] could not load the copy for', l, err),
    )
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('pem_lang') as Lang | null
    if (stored === 'fr' || stored === 'en') show(stored)
  }, [show])

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem('pem_lang', l)
    show(l)
  }, [show])

  const catalog = catalogs[lang] ?? frCatalog
  const t = useCallback((key: DictKey): string => lookup(catalog, lang, String(key)), [catalog, lang])
  const tDynamic = useCallback((key: string): string => lookup(catalog, lang, key), [catalog, lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t, tDynamic }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
