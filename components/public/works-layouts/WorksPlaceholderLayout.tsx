'use client'

import { useI18n } from '@/lib/i18n/context'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import type { WorksLayout } from '@/lib/portfolio-config-types'

interface Props {
  layout: WorksLayout
  siteTheme: PublicSiteTheme
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

const PLACEHOLDER_MESSAGE_KEY: Partial<Record<WorksLayout, string>> = {
  map: 'pub_works_placeholder_map',
  constellation: 'pub_works_placeholder_constellation',
  diptych: 'pub_works_placeholder_diptych',
}

/** Selectable layouts that don't have a real implementation yet — render an
 *  honest explanation rather than silently falling back to the carousel. */
export default function WorksPlaceholderLayout({ layout, siteTheme, hiddenNavRoutes, navOrder }: Props) {
  const { t, tDynamic } = useI18n()
  const titleKey = `site_works_layout_${layout}`
  const messageKey = PLACEHOLDER_MESSAGE_KEY[layout] ?? 'pub_works_placeholder_generic'
  return (
    <main
        className="col center"
        style={{
          minHeight: '70vh',
          padding: 'clamp(48px, 8vh, 96px) 24px',
          textAlign: 'center',
          gap: 16,
          color: siteTheme.bodyText,
        }}
      >
        <h1 className="t-serif" style={{ fontSize: 'clamp(20px, 3vw, 32px)', margin: 0 }}>
          {tDynamic(titleKey)}
        </h1>
        <p className="t-mono-sm" style={{ maxWidth: 520, opacity: 0.75, lineHeight: 1.55 }}>
          {tDynamic(messageKey)}
        </p>
        <p className="t-mono-xs" style={{ opacity: 0.5, letterSpacing: 2, textTransform: 'uppercase' }}>
          {t('site_works_layout_placeholder_badge')}
        </p>
      </main>
  )
}
