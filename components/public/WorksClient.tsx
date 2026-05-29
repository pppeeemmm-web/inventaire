'use client'

import { useEffect, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { trackView } from '@/lib/track'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'
import PublicNav from './PublicNav'
import WorksModeGallery from './WorksModeGallery'
import { WorksRenderCtx } from '@/lib/site-blocks/works_modes/WorksRenderCtx'
import type { Work, WorksMode } from './works-utils'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import { publicNavBarCss, publicSiteBaseCss } from '@/lib/public-site-theme'

interface Props {
  works: Work[]
  modes: WorksMode[]
  hiddenNavRoutes?: string[]
  navOrder?: string[]
  siteTheme: PublicSiteTheme
  /** Gradient flush to viewport top (no nav bar sleeve). */
  navTransparent?: boolean
}

export default function WorksClient({
  works, modes, hiddenNavRoutes, navOrder, siteTheme, navTransparent = true,
}: Props) {
  const { t } = useI18n()

  const safeModes: WorksMode[] = modes.length > 0 ? modes : [{
    id: 'default', label_fr: 'Œuvres', label_en: 'Works',
    layout: 'carousel', collections: [], outro_fr: '', outro_en: '',
  } as WorksMode]

  const modeMap = useMemo(() => new Map(safeModes.map(m => [m.id, m])), [safeModes])

  useEffect(() => {
    void trackView('/works', null, null, getOrCreatePublicVisitorId())
  }, [])

  const activeMode = safeModes[0]

  return (
    <WorksRenderCtx.Provider value={{ works, modeMap, siteTheme }}>
      <div className="w-page-enter">
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          ${publicSiteBaseCss(siteTheme)}
          ${publicNavBarCss('w', siteTheme, { transparent: navTransparent })}
          html, body {
            height: 100vh; overflow: hidden; -webkit-font-smoothing: antialiased;
          }
          @keyframes w-fadein { from { opacity: 0; } to { opacity: 1; } }
          .w-page-enter { animation: w-fadein 1.2s ease forwards; }
        `}</style>
        <PublicNav active="works" prefix="w" hiddenNavRoutes={hiddenNavRoutes} navOrder={navOrder} />
        <h1 className="w-page-h1-sr-only">{t('pub_works')}</h1>
        {activeMode && (
          <WorksModeGallery works={works} mode={activeMode} siteTheme={siteTheme} />
        )}
      </div>
    </WorksRenderCtx.Provider>
  )
}
