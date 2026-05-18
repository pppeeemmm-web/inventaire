'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { DEFAULT_NAV_ORDER } from '@/lib/site-block-visibility'

interface Props {
  active?: 'works' | 'about' | 'practice' | 'enquiry'
  prefix?: string
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

export default function PublicNav({ active, prefix = 'n', hiddenNavRoutes = [], navOrder }: Props) {
  const { lang, setLang, t } = useI18n()
  const hiddenSet = useMemo(() => new Set(hiddenNavRoutes), [hiddenNavRoutes])

  const orderedLinks = useMemo(() => {
    const labels: Record<string, string> = {
      '/works': t('pub_works'),
      '/about': t('pub_about'),
      '/practice': t('pub_practice'),
      '/enquiry': t('pub_enquiry'),
    }
    return (navOrder ?? DEFAULT_NAV_ORDER)
      .filter(href => !hiddenSet.has(href) && labels[href])
      .map(href => ({ href, key: href.slice(1), label: labels[href] }))
  }, [navOrder, hiddenSet, t])

  const p = prefix
  return (
    <nav className={`${p}-nav`}>
      <Link href="/" className={`${p}-logo`} aria-label={t('pub_aria_go_home')}>
        <span className="pub-logo-arrow" aria-hidden>←</span>
        {t('pub_logo_text')}
      </Link>
      <div className={`${p}-navlinks`} style={{ flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 6 }}>
        {orderedLinks.map(({ href, key, label }) => (
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
