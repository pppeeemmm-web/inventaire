import type { Metadata } from 'next'
import type { DictKey, Lang } from '@/lib/i18n/dictionary'
import { resolveMessage } from '@/lib/i18n/resolve-message'
import { getMetadataBase } from '@/lib/seo/site-url'

/** Static public routes — title/description keys live in `dict` (fr + en). */
export type RouteMetaKey =
  | 'works'
  | 'enquiry'
  | 'about'
  | 'practice'
  | 'login'
  | 'maps'
  | 'card'
  | 'verify'

type RouteSpec = {
  titleKey: DictKey
  descKey?: DictKey
  canonical: string
  index: boolean
}

const ROUTES: Record<RouteMetaKey, RouteSpec> = {
  works: {
    titleKey: 'seo_works_meta_title',
    descKey: 'seo_works_meta_description',
    canonical: '/works',
    index: true,
  },
  enquiry: {
    titleKey: 'seo_enquiry_meta_title',
    descKey: 'seo_enquiry_meta_description',
    canonical: '/enquiry',
    index: true,
  },
  about: {
    titleKey: 'seo_about_meta_title',
    descKey: 'seo_about_meta_description',
    canonical: '/about',
    index: true,
  },
  practice: {
    titleKey: 'seo_practice_meta_title',
    descKey: 'seo_practice_meta_description',
    canonical: '/practice',
    index: true,
  },
  login: {
    titleKey: 'seo_login_meta_title',
    canonical: '/login',
    index: false,
  },
  maps: {
    titleKey: 'seo_maps_meta_title',
    canonical: '/maps',
    index: false,
  },
  card: {
    titleKey: 'seo_card_meta_title',
    canonical: '/card',
    index: false,
  },
  verify: {
    titleKey: 'seo_verify_meta_title',
    descKey: 'seo_verify_meta_description',
    canonical: '/verify',
    index: true,
  },
}

/** Server Components: use this instead of hardcoded `metadata` strings. */
export function routeMetadata(route: RouteMetaKey, lang: Lang): Metadata {
  const spec = ROUTES[route]
  const title = resolveMessage(lang, spec.titleKey)
  const description = spec.descKey ? resolveMessage(lang, spec.descKey) : undefined
  const base = getMetadataBase()
  const ogLocale = lang === 'fr' ? 'fr_FR' : 'en_GB'

  return {
    metadataBase: base,
    title,
    ...(description ? { description } : {}),
    robots: { index: spec.index, follow: spec.index },
    alternates: { canonical: spec.canonical },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: spec.canonical,
      title,
      ...(description ? { description } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      ...(description ? { description } : {}),
    },
  }
}
