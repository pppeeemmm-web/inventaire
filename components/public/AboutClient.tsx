'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import PublicNav from './PublicNav'
import { loadPortfolioConfig } from '@/app/atelier/(portal)/portfolio/actions'
import { hiddenNavRoutes, orderedNavRoutes } from '@/lib/site-block-visibility'
import { migrate, type SiteBlock, type Block } from '@/lib/portfolio-config-types'
import { trackView } from '@/lib/track'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import { publicNavBarCss, publicSiteBaseCss } from '@/lib/public-site-theme'
// Block registry: imports `lib/site-blocks/index` (the barrel) so all
// descriptors register before lookup. Today only `text` is shipped; future
// kinds layer in by adding descriptors in that folder.
import { getDescriptor } from '@/lib/site-blocks'


function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

export default function AboutClient({ siteTheme }: { siteTheme: PublicSiteTheme }) {
  const { t, lang } = useI18n()
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    void trackView('/about', null, null, getOrCreatePublicVisitorId())
    async function fetchData() {
      const result = await loadPortfolioConfig()
      if (!('ok' in result)) return
      // Migrate so `pages` is populated for the registry-iteration pass below.
      setConfig(migrate(result.config))
    }
    fetchData()
  }, [])

  const hidden = useMemo(
    () => config?.site_blocks ? hiddenNavRoutes(config.site_blocks as SiteBlock[]) : [],
    [config],
  )
  const navOrder = useMemo(
    () => config?.site_blocks ? orderedNavRoutes(config.site_blocks as SiteBlock[]) : undefined,
    [config],
  )
  const artistName = config?.general?.artist_name || 'the pem workshop'
  const bioIntro = lang === 'en'
    ? (config?.about?.intro_en || config?.about?.intro_fr)
    : (config?.about?.intro_fr || config?.about?.intro_en)

  // Registry-driven blocks on /about — filter to blocks whose `kind` has a
  // registered descriptor. Auto-generated blocks (uid starts with `auto_`)
  // use migrated data from existing config fields.
  const registryBlocks = useMemo<Block[]>(() => {
    const list: Block[] = config?.pages?.about ?? []
    return list
      .filter(b => b.visible !== false)
      .filter(b => !!getDescriptor(b.kind))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [config])

  // When biographie descriptor is registered, the registry renders the bio
  // paragraphs and the inline section below skips them to avoid double
  // rendering. The artist name h1 always stays in AboutClient (it's the
  // page's structural heading, not block content).
  const biographieHandledByRegistry = !!getDescriptor('biographie')
    && registryBlocks.some(b => b.kind === 'biographie')

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: auto; }
        ${publicSiteBaseCss(siteTheme)}
        body { overflow-y: auto; min-height: 100vh; }
        .a-nav {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: clamp(14px, 2.5vw, 20px) clamp(16px, 5vw, 40px);
        }
        ${publicNavBarCss('a', siteTheme)}
        .a-navlinks { display: flex; gap: clamp(16px, 3.5vw, 32px); align-items: center; }
        .a-navlink { font-size: clamp(8px, 1.2vw, 9px); letter-spacing: 2px; text-transform: uppercase; text-decoration: none; transition: color .15s; }
        .a-lang {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          background: none;
          padding: 3px 8px; cursor: pointer; transition: all .15s;
          font-family: inherit;
          min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
        }
        .a-body { max-width: 860px; margin: 0 auto; padding: clamp(40px, 8vw, 72px) clamp(16px, 5vw, 40px) clamp(60px, 12vw, 120px); }
        .a-section { margin-bottom: 72px; }
        .a-section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: ${siteTheme.bodyMutedText}; margin-bottom: clamp(20px, 4vw, 32px); padding-bottom: 12px; border-bottom: 1px solid ${siteTheme.chromeBorder}; }
        .a-name {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(28px,4vw,52px); font-weight: 400;
          color: ${siteTheme.bodyText}; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 40px;
          text-wrap: balance;
        }
        .a-bio { font-size: clamp(12px, 1.6vw, 13px); line-height: 2; color: ${siteTheme.bodyMutedText}; max-width: 64ch; }
        .a-bio p + p { margin-top: 1.4em; }
        /* Registry-rendered blocks under the name heading. Inherit muted
         * body text colour; each block renderer brings its own type rules. */
        .a-blocks { color: ${siteTheme.bodyMutedText}; }
        .a-block + .a-block { margin-top: 48px; }
        .a-footer { text-align: center; padding: 40px; border-top: 1px solid ${siteTheme.chromeBorder}; font-size: 9px; color: ${siteTheme.bodyMutedText}; letter-spacing: 2px; text-transform: uppercase; }
        a.a-ext { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
        a.a-ext:hover { color: ${siteTheme.bodyText}; }
        @media (max-width: 640px) {
          .a-navlinks { gap: clamp(10px, 2.5vw, 16px); }
          .a-navlink { letter-spacing: 1px; }
        }
      `}</style>

      <PublicNav active="about" prefix="a" hiddenNavRoutes={hidden} navOrder={navOrder} />

      <div className="a-body pem-fadeIn pem-grain">

        <section className="a-section">
          <div className="a-section-label">{t('pub_biography')}</div>
          <h1 className="a-name">
            {artistName.split(' ').map((part: string, i: number) => <span key={i}>{part}<br /></span>)}
          </h1>
          {!biographieHandledByRegistry && (
            <div className="a-bio">
              {hasContent(bioIntro) ? (
                <div dangerouslySetInnerHTML={{ __html: bioIntro! }} />
              ) : (
                <>
                  <p>
                    Né en 1979 à Marseille. Études à Sciences Po Aix-en-Provence, parallèlement
                    à une pratique picturale indépendante à l&apos;acrylique.
                    Candidature à l&apos;École des Beaux-Arts de Paris en 2000.
                  </p>
                  <p>
                    Expérience professionnelle à Paris au coeur du marché de l&apos;art ancien et
                    moderne — Galerie Bailly (quai Voltaire), Galerie de Bayser et Cabinet Éric Turquin
                    (rue Sainte-Anne). Cette période a permis d&apos;acquérir une connaissance rigoureuse
                    de l&apos;histoire de l&apos;art, du connoisseurship et de la culture matérielle de la peinture.
                  </p>
                  <p>
                    Expatriation en Irlande en 2011. Retour à la pratique plastique fin 2019 —
                    apprentissage de l&apos;huile. Formation en design graphique et motion design en 2022.
                    Sélectionné deux fois au Waterford International Film Festival (photographie).
                    Exposition collective à Ennistymon, Irlande, été 2023.
                  </p>
                  <p>
                    Retour à Marseille en juin 2024. Corpus actif de plus de mille oeuvres depuis 2019 —
                    peintures à l&apos;huile, pastel, encre, bâton d&apos;huile, crayons.
                  </p>
                </>
              )}
            </div>
          )}
          {registryBlocks.length > 0 && (
            <div className="a-blocks">
              {registryBlocks.map(block => {
                const desc = getDescriptor(block.kind)
                if (!desc) return null
                const Renderer = desc.renderer
                const fields = desc.migrateFields
                  ? desc.migrateFields(block.fields)
                  : block.fields
                return (
                  <div key={block.uid} className="a-block">
                    <Renderer
                      block={block}
                      fields={fields}
                      ctx={{ page: 'about', lang }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>

      <footer className="a-footer">
        &copy; {new Date().getFullYear()} the pem workshop
      </footer>
    </>
  )
}
