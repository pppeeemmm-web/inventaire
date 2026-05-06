'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import PublicNav from './PublicNav'
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import { createClient } from '@/lib/supabase/client'

const expositions = [
  { year: '2026', text: 'Salon de Montrouge — candidature en cours' },
  { year: '2026', text: 'CoG — Londres' },
  { year: '2025', text: 'Therapeia — Paris' },
  { year: '2023', text: 'Exposition collective — Ennistymon, Irlande' },
  { year: '2022', text: 'Waterford International Film Festival — sélection photographie (2x consécutif)' },
]

const formation = [
  { year: '2022', text: 'Design graphique et motion design' },
  { year: '2019', text: "Apprentissage de la peinture à l'huile — pratique autodidacte intensive" },
  { year: '2000', text: "Candidature, École des Beaux-Arts de Paris" },
  { year: '1997', text: 'Sciences Po Aix-en-Provence' },
]

export default function AboutClient() {
  const { t } = useI18n()
  const [statementUrl, setStatementUrl] = useState<string | null>(null)
  const [cvUrl, setCvUrl] = useState<string | null>(null)
  const [config, setConfig] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      const result = await loadPortfolioConfig()
      if (!('ok' in result)) return
      const cfg = result.config
      setConfig(cfg)

      const sId = cfg.about?.statement_doc_id || cfg.statement_doc_id
      const cId = cfg.about?.cv_doc_id || cfg.cv_doc_id
      const ids = [sId, cId].filter(Boolean)
      
      if (!ids.length) return
      const sb = createClient()
      const { data: docs } = await (sb.from('document') as any).select('id, storage_path').in('id', ids)
      if (!docs) return

      const sDoc = docs.find((d: any) => d.id === sId)
      if (sDoc) {
        const { data } = await sb.storage.from('vault').createSignedUrl(sDoc.storage_path, 3600)
        if (data?.signedUrl) setStatementUrl(data.signedUrl)
      }
      const cDoc = docs.find((d: any) => d.id === cId)
      if (cDoc) {
        const { data } = await sb.storage.from('vault').createSignedUrl(cDoc.storage_path, 3600)
        if (data?.signedUrl) setCvUrl(data.signedUrl)
      }
    }
    fetchData()
  }, [])

  const artistName = config?.general?.artist_name || 'Pierre Emmanuel Moulin'
  const bioIntro = config?.about?.intro || config?.general?.about_intro

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: auto; }
        html, body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #6b6760; }
        body { overflow-y: auto; min-height: 100vh; }
        .a-nav {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 40px;
          background: rgba(237,234,228,.92); backdrop-filter: blur(8px);
          border-bottom: 1px solid #dedad4;
        }
        .a-logo { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; text-decoration: none; }
        .a-navlinks { display: flex; gap: 32px; align-items: center; }
        .a-navlink { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #b0aca6; text-decoration: none; transition: color .15s; }
        .a-navlink:hover, .a-navlink.active { color: #6b6760; }
        .a-lang {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #b0aca6; background: none; border: 1px solid #dedad4;
          padding: 3px 8px; cursor: pointer; transition: all .15s;
          font-family: inherit;
        }
        .a-lang:hover { color: #6b6760; border-color: #b0aca6; }
        .a-body { max-width: 860px; margin: 0 auto; padding: 72px 40px 120px; }
        .a-section { margin-bottom: 72px; }
        .a-section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; margin-bottom: 32px; padding-bottom: 12px; border-bottom: 1px solid #dedad4; }
        .a-name {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(28px,4vw,52px); font-weight: 400;
          color: #3a3834; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 40px;
          text-wrap: balance;
        }
        .a-bio { font-size: 13px; line-height: 2; color: #7a7670; max-width: 64ch; }
        .a-bio p + p { margin-top: 1.4em; }
        .a-cv-entries { display: flex; flex-direction: column; gap: 20px; }
        .a-cv-entry { display: grid; grid-template-columns: 90px 1fr; gap: 20px; align-items: baseline; }
        .a-cv-year { font-size: 9px; color: #b0aca6; letter-spacing: 1px; padding-top: 2px; }
        .a-cv-text { font-size: 11px; color: #6b6760; line-height: 1.7; }
        .a-footer { text-align: center; padding: 40px; border-top: 1px solid #dedad4; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
        a.a-ext { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
        a.a-ext:hover { color: #3a3834; }
        .btn-doc {
          display: inline-flex; align-items: center; gap: 12px;
          padding: 12px 24px; border: 1px solid #dedad4;
          text-decoration: none; color: #6b6760; font-size: 10px;
          letter-spacing: 1.5px; text-transform: uppercase;
          transition: all .2s; margin-right: 16px; margin-top: 24px;
        }
        .btn-doc:hover { background: #fff; border-color: #3a3834; color: #3a3834; }
      `}</style>

      <PublicNav active="about" prefix="a" />

      <div className="a-body">

        <section className="a-section">
          <div className="a-section-label">{t('pub_biography')}</div>
          <h1 className="a-name">
            {artistName.split(' ').map((part, i) => <span key={i}>{part}<br /></span>)}
          </h1>
          <div className="a-bio">
            {bioIntro ? (
              <p style={{ whiteSpace: 'pre-wrap' }}>{bioIntro}</p>
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

            <div style={{ marginTop: 40 }}>
              {statementUrl && (
                <a href={statementUrl} target="_blank" rel="noreferrer" className="btn-doc">
                  {t('pub_read_statement')}
                </a>
              )}
              {cvUrl && (
                <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-doc">
                  {t('pub_download_cv')}
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="a-section">
          <div className="a-section-label">{t('pub_exhibitions_selected')}</div>
          <div className="a-cv-entries">
            {expositions.map((e, i) => (
              <div key={i} className="a-cv-entry">
                <span className="a-cv-year">{e.year}</span>
                <span className="a-cv-text">{e.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="a-section">
          <div className="a-section-label">{t('pub_education')}</div>
          <div className="a-cv-entries">
            {formation.map((e, i) => (
              <div key={i} className="a-cv-entry">
                <span className="a-cv-year">{e.year}</span>
                <span className="a-cv-text">{e.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="a-section">
          <div className="a-section-label">{t('pub_contact')}</div>
          <div className="a-bio">
            <p>Marseille, France &nbsp;&middot;&nbsp; +33 6 17 69 05 22</p>
            <p><Link href="/enquiry" className="a-ext">{t('pub_enquiry')}</Link></p>
            <p><a href="https://moulinfineart.myportfolio.com/" target="_blank" rel="noreferrer" className="a-ext">moulinfineart.myportfolio.com</a></p>
          </div>
        </section>

      </div>

      <footer className="a-footer">
        &copy; {new Date().getFullYear()} Pierre Emmanuel Moulin
      </footer>
    </>
  )
}
