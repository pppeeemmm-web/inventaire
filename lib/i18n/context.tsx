'use client'

import {
  createContext, useContext, useState, useEffect,
  type ReactNode,
} from 'react'
import { dict, type Lang, type DictKey } from './dictionary'

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: DictKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('pem_lang') as Lang | null
    if (stored === 'fr' || stored === 'en') setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('pem_lang', l)
  }

  function t(key: DictKey): string {
    return dict[lang][key] ?? dict.fr[key] ?? key
  }

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
