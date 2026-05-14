'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'

interface Props {
  active?: 'works' | 'about' | 'practice' | 'enquiry'
  prefix?: string // CSS class prefix, e.g. 'w' → .w-nav, .w-logo etc.
}

export default function PublicNav({ active, prefix = 'n' }: Props) {
  const { lang, setLang, t } = useI18n()

  const p = prefix
  return (
    <nav className={`${p}-nav`}>
      <Link href="/" className={`${p}-logo`}>Atelier PEM</Link>
      <div className={`${p}-navlinks`} style={{ flexWrap: 'wrap', justifyContent: 'flex-end', rowGap: 6 }}>
        <Link href="/works"     className={`${p}-navlink${active === 'works'     ? ` active` : ''}`}>{t('pub_works')}</Link>
        <Link href="/about"     className={`${p}-navlink${active === 'about'     ? ` active` : ''}`}>{t('pub_about')}</Link>
        <Link href="/practice"  className={`${p}-navlink${active === 'practice'  ? ` active` : ''}`}>{t('pub_practice')}</Link>
        <Link href="/enquiry"   className={`${p}-navlink${active === 'enquiry'   ? ` active` : ''}`}>{t('pub_enquiry')}</Link>
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
