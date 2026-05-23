'use client'

import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react'
import type { Lang, DictKey } from './dictionary'
import { resolveMessage } from './resolve-message'

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: DictKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr')

  useEffect(() => {
    const stored = localStorage.getItem('pem_lang') as Lang | null
    if (stored === 'fr' || stored === 'en') setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('pem_lang', l)
  }

  const t = useCallback((key: DictKey): string => resolveMessage(lang, key), [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
