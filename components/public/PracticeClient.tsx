'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import PublicNav from './PublicNav'
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'

export default function PracticeClient() {
  const { t } = useI18n()
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      const result = await loadPortfolioConfig()
      if ('ok' in result) setConfig(result.config)
    }
    fetchData()
  }, [])

  const approach = config?.practice?.approach
  const themes = config?.practice?.themes && config.practice.themes.length > 0 ? config.practice.themes : [
    'La physiologie de la perception et la théorie de la Gestalt',
    "La trace comme vecteur d'énergie",
    "La relation entre l'impression et l'image",
    "Le rôle du spectateur dans l'achèvement du sens",
  ]
  const materials = config?.practice?.materials

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #6b6760; }
        body { overflow-y: auto; }
        .p-nav {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 40px;
          background: rgba(237,234,228,.92); backdrop-filter: blur(8px);
          border-bottom: 1px solid #dedad4;
        }
        .p-logo { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; text-decoration: none; }
        .p-navlinks { display: flex; gap: 32px; align-items: center; }
        .p-navlink { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #b0aca6; text-decoration: none; transition: color .15s; }
        .p-navlink:hover, .p-navlink.active { color: #6b6760; }
        .p-lang {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 3px 8px; cursor: pointer; transition: all .15s;
          font-family: inherit;
        }
        .p-lang:hover { color: #6b6760; border-color: #b0aca6; }
        .p-body { max-width: 860px; margin: 0 auto; padding: 72px 40px 120px; }
        .p-section { margin-bottom: 72px; }
        .p-section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; margin-bottom: 32px; padding-bottom: 12px; border-bottom: 1px solid #dedad4; }
        .p-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(28px,4vw,52px); font-weight: 400;
          color: #3a3834; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 40px;
        }
        .p-title em { font-style: italic; color: #9a9690; }
        .p-text { font-size: 13px; line-height: 2.1; color: #7a7670; max-width: 64ch; }
        .p-text p + p { margin-top: 1.6em; }
        .p-pull {
          margin: 52px 0;
          padding: 0 0 0 28px;
          border-left: 1px solid #c8c4be;
          font-family: 'Instrument Serif', serif;
          font-size: clamp(16px,2.2vw,22px);
          font-style: italic; color: #9a9690; line-height: 1.7;
        }
        .p-themes { margin-top: 40px; display: flex; flex-direction: column; gap: 12px; }
        .p-theme { display: flex; gap: 16px; align-items: baseline; font-size: 11px; color: #7a7670; line-height: 1.6; }
        .p-theme::before { content: '·'; color: #b0aca6; flex-shrink: 0; }
        .p-footer { text-align: center; padding: 40px; border-top: 1px solid #dedad4; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
      `}</style>

      <PublicNav active="practice" prefix="p" />

      <div className="p-body">

        <section className="p-section">
          <div className="p-section-label">{t('pub_approach')}</div>
          <h1 className="p-title">Des caprices<br /><em>kaléidoscopiques</em></h1>

          <div className="p-text">
            {approach ? (
              <p style={{ whiteSpace: 'pre-wrap' }}>{approach}</p>
            ) : (
              <>
                <p>
                  Je peins des caprices. En apparence disjointes, ces impressions sont des intuitions
                  kaléidoscopiques — issues de mon expérience et de toutes sortes de conjectures :
                  sur la matière première, la métamorphose, l'infrastructure physique.
                </p>
                <p>
                  Dans la conception, j'opère à la lisière de la mémoire, de la perception et de la figuration.
                  Dans ce temps arraché, je déploie mes visions et interrogations. J'y vois une fascination
                  pour la frontière — entre formes, entre couleurs, en palimpseste parfois. Avec des dégradés,
                  des blocs colorés mats, des transparences brillantes, des noirs absolus.
                </p>
              </>
            )}
          </div>

          {!approach && (
            <blockquote className="p-pull">
              « Une révélation progressive — comme la corne broyée que l'on ajoute à la terre. »
            </blockquote>
          )}

          {!approach && (
            <div className="p-text">
              <p>
                Pour construire mes topographies, je puise aussi dans la tradition de la peinture.
                À bien regarder, tout est connexion : les cycles recommencent — impressions, crêtes et creux —
                vers une nouvelle appréciation de l'émotion comme un voyage de l'esprit.
              </p>
            </div>
          )}
        </section>

        <section className="p-section">
          <div className="p-section-label">{t('pub_central_themes')}</div>
          <div className="p-themes">
            {themes.map((th: any, i: number) => (
              <div key={i} className="p-theme">{th}</div>
            ))}
          </div>
        </section>

        <section className="p-section">
          <div className="p-section-label">{t('pub_media_materials')}</div>
          <div className="p-text">
            {materials ? (
              <p style={{ whiteSpace: 'pre-wrap' }}>{materials}</p>
            ) : (
              <>
                <p>
                  Peinture à l'huile sur toile, bois préparé et papier texturé. Acrylique.
                  Pastel, encre, bâton d'huile, crayons — pierre noire, craie. Photographie.
                </p>
                <p>
                  Un intérêt soutenu pour les propriétés matérielles du médium : pigments à interférence,
                  préparations au gesso structuré, optique des surfaces stratifiées, noir Musou.
                </p>
              </>
            )}
          </div>
        </section>

      </div>

      <footer className="p-footer">
        &copy; {new Date().getFullYear()} Pierre Emmanuel Moulin
      </footer>
    </>
  )
}
