'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import PublicNav from './PublicNav'
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import { trackView } from '@/lib/track'
import { getOrCreatePublicVisitorId } from '@/lib/public-visitor-id'


function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

export default function AboutClient() {
  const { t, lang } = useI18n()
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    void trackView('/about', null, null, getOrCreatePublicVisitorId())
    async function fetchData() {
      const result = await loadPortfolioConfig()
      if (!('ok' in result)) return
      setConfig(result.config)
    }
    fetchData()
  }, [])

  const artistName = config?.general?.artist_name || 'the pem workshop'
  const bioIntro = lang === 'en'
    ? (config?.about?.intro_en || config?.about?.intro_fr)
    : (config?.about?.intro_fr || config?.about?.intro_en)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: auto; }
        html, body { background: #edeae4; font-family: var(--font-ui, 'Sofia Sans', ui-sans-serif, system-ui, sans-serif); color: #6b6760; }
        body { overflow-y: auto; min-height: 100vh; }
        .a-nav {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: clamp(14px, 2.5vw, 20px) clamp(16px, 5vw, 40px);
          background: rgba(237,234,228,.92); backdrop-filter: blur(8px);
          border-bottom: 1px solid #dedad4;
        }
        .a-logo { font-size: clamp(8px, 1.2vw, 9px); letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; text-decoration: none; }
        .a-navlinks { display: flex; gap: clamp(16px, 3.5vw, 32px); align-items: center; }
        .a-navlink { font-size: clamp(8px, 1.2vw, 9px); letter-spacing: 2px; text-transform: uppercase; color: #b0aca6; text-decoration: none; transition: color .15s; }
        .a-navlink:hover, .a-navlink.active { color: #6b6760; }
        .a-lang {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 3px 8px; cursor: pointer; transition: all .15s;
          font-family: inherit;
          min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
        }
        .a-lang:hover { color: #6b6760; border-color: #b0aca6; }
        .a-body { max-width: 860px; margin: 0 auto; padding: clamp(40px, 8vw, 72px) clamp(16px, 5vw, 40px) clamp(60px, 12vw, 120px); }
        .a-section { margin-bottom: 72px; }
        .a-section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; margin-bottom: clamp(20px, 4vw, 32px); padding-bottom: 12px; border-bottom: 1px solid #dedad4; }
        .a-name {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(28px,4vw,52px); font-weight: 400;
          color: #3a3834; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 40px;
          text-wrap: balance;
        }
        .a-bio { font-size: clamp(12px, 1.6vw, 13px); line-height: 2; color: #7a7670; max-width: 64ch; }
        .a-bio p + p { margin-top: 1.4em; }
        .a-footer { text-align: center; padding: 40px; border-top: 1px solid #dedad4; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
        a.a-ext { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
        a.a-ext:hover { color: #3a3834; }
        @media (max-width: 640px) {
          .a-navlinks { gap: clamp(10px, 2.5vw, 16px); }
          .a-navlink { letter-spacing: 1px; }
        }
      `}</style>

      <PublicNav active="about" prefix="a" />

      <div className="a-body pem-fadeIn pem-grain">

        <section className="a-section">
          <div className="a-section-label">{t('pub_biography')}</div>
          <h1 className="a-name">
            {artistName.split(' ').map((part: string, i: number) => <span key={i}>{part}<br /></span>)}
          </h1>
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
        </section>


      </div>

      <footer className="a-footer">
        &copy; {new Date().getFullYear()} the pem workshop
      </footer>
    </>
  )
}
