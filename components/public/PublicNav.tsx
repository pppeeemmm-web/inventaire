'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  active?: 'works' | 'about' | 'practice' | 'enquiry'
  prefix?: string // CSS class prefix, e.g. 'w' → .w-nav, .w-logo etc.
  hiddenNavRoutes?: string[]
}

export default function PublicNav({ active, prefix = 'n', hiddenNavRoutes = [] }: Props) {
  const { lang, setLang, t } = useI18n()
  const hiddenSet = useMemo(() => new Set(hiddenNavRoutes), [hiddenNavRoutes])

  const p = prefix
  const links: [string, string, string][] = [
    ['/works',    'works',    t('pub_works')],
    ['/about',    'about',    t('pub_about')],
    ['/practice', 'practice', t('pub_practice')],
    ['/enquiry',  'enquiry',  t('pub_enquiry')],
  ]

  return (
    <nav className={`${p}-nav`}>
      <Link href="/" className={`${p}-logo`} aria-label={t('pub_aria_go_home')}>
        <span className="pub-logo-arrow" aria-hidden>←</span>
        {t('pub_logo_text')}
      </Link>
      <div className={`${p}-navlinks`} style={{ flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 6 }}>
        {links.filter(([href]) => !hiddenSet.has(href)).map(([href, key, label]) => (
          <Link key={href} href={href} className={`${p}-navlink${active === key ? ' active' : ''}`}>{label}</Link>
        ))}
        <button
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className={`${p}-lang`}
          aria-label={t('pub_aria_switch_language')}
        >
          {t(lang === 'fr' ? 'pub_lang_target_en' : 'pub_lang_target_fr')}
        </button>
      </div>
    </nav>
  )
}
