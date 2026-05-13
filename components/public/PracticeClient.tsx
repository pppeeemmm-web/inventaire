'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import PublicNav from './PublicNav'
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import { trackView } from '@/lib/track'

function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

export default function PracticeClient() {
  const { t, lang } = useI18n()
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    void trackView('/practice')
    async function fetchData() {
      const result = await loadPortfolioConfig()
      if ('ok' in result) setConfig(result.config)
    }
    fetchData()
  }, [])

  const approach = lang === 'en'
    ? (config?.practice?.approach_en || config?.practice?.approach_fr)
    : (config?.practice?.approach_fr || config?.practice?.approach_en)
  const themes: string[] = config?.practice?.themes ?? []
  const materials = lang === 'en'
    ? (config?.practice?.materials_en || config?.practice?.materials_fr)
    : (config?.practice?.materials_fr || config?.practice?.materials_en)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #edeae4; font-family: var(--font-ui, 'Sofia Sans', ui-sans-serif, system-ui, sans-serif); color: #6b6760; }
        body { overflow-y: auto; }
        .p-nav {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: clamp(14px, 2.5vw, 20px) clamp(16px, 5vw, 40px);
          background: rgba(237,234,228,.92); backdrop-filter: blur(8px);
          border-bottom: 1px solid #dedad4;
        }
        .p-logo { font-size: clamp(8px, 1.2vw, 9px); letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; text-decoration: none; }
        .p-navlinks { display: flex; gap: clamp(16px, 3.5vw, 32px); align-items: center; }
        .p-navlink { font-size: clamp(8px, 1.2vw, 9px); letter-spacing: 2px; text-transform: uppercase; color: #b0aca6; text-decoration: none; transition: color .15s; }
        .p-navlink:hover, .p-navlink.active { color: #6b6760; }
        .p-lang {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 3px 8px; cursor: pointer; transition: all .15s;
          font-family: inherit;
          min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
        }
        .p-lang:hover { color: #6b6760; border-color: #b0aca6; }
        .p-body { max-width: 860px; margin: 0 auto; padding: clamp(40px, 8vw, 72px) clamp(16px, 5vw, 40px) clamp(60px, 12vw, 120px); }
        .p-section { margin-bottom: 72px; }
        .p-section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; margin-bottom: clamp(20px, 4vw, 32px); padding-bottom: 12px; border-bottom: 1px solid #dedad4; }
        .p-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(28px,4vw,52px); font-weight: 400;
          color: #3a3834; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 40px;
        }
        .p-title em { font-style: italic; color: #9a9690; }
        .p-text { font-size: clamp(12px, 1.6vw, 13px); line-height: 2.1; color: #7a7670; max-width: 64ch; }
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
        .p-theme { display: flex; gap: 16px; align-items: baseline; font-size: clamp(10px, 1.4vw, 11px); color: #7a7670; line-height: 1.6; }
        .p-theme::before { content: '·'; color: #b0aca6; flex-shrink: 0; }
        .p-footer { text-align: center; padding: 40px; border-top: 1px solid #dedad4; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
        @media (max-width: 640px) {
          .p-navlinks { gap: clamp(10px, 2.5vw, 16px); }
          .p-navlink { letter-spacing: 1px; }
        }
      `}</style>

      <PublicNav active="practice" prefix="p" />

      <div className="p-body">

        <section className="p-section">
          <div className="p-section-label">{t('pub_approach')}</div>
          <h1 className="p-title">
            {t('pub_practice_hero_line1')}
            <br />
            <em>{t('pub_practice_hero_em')}</em>
          </h1>

          {hasContent(approach) && (
            <div className="p-text">
              <div dangerouslySetInnerHTML={{ __html: approach! }} />
            </div>
          )}
        </section>

        {themes.length > 0 && (
          <section className="p-section">
            <div className="p-section-label">{t('pub_central_themes')}</div>
            <div className="p-themes">
              {themes.map((th: string, i: number) => (
                <div key={i} className="p-theme">{th}</div>
              ))}
            </div>
          </section>
        )}

        {hasContent(materials) && (
          <section className="p-section">
            <div className="p-section-label">{t('pub_media_materials')}</div>
            <div className="p-text">
              <p style={{ whiteSpace: 'pre-wrap' }}>{materials}</p>
            </div>
          </section>
        )}

      </div>

      <footer className="p-footer">
        &copy; {new Date().getFullYear()} Pierre Emmanuel Moulin
      </footer>
    </>
  )
}
