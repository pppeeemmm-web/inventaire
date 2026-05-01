import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'About — Pierre Emmanuel Moulin',
  description: 'Biographie et CV de Pierre Emmanuel Moulin, peintre.',
  robots: { index: true, follow: true },
}

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

export default async function AboutPage() {
  const supabase = await createClient()

  // Fetch config
  let config: any = { statement_doc_id: null, cv_doc_id: null }
  const { data: configDoc } = await supabase
    .from('document')
    .select('storage_path')
    .eq('name', 'portfolio_sections.json')
    .single()

  if (configDoc?.storage_path) {
    const { data: fileData } = await supabase.storage.from('documents').download(configDoc.storage_path)
    if (fileData) {
      try {
        const parsed = JSON.parse(await fileData.text())
        if (!Array.isArray(parsed)) config = parsed
      } catch (e) {}
    }
  }

  // Fetch URLs
  let statementUrl = null
  let cvUrl = null

  if (config.statement_doc_id || config.cv_doc_id) {
    const ids = [config.statement_doc_id, config.cv_doc_id].filter(Boolean)
    const { data: docs } = await supabase.from('document').select('id, storage_path').in('id', ids)
    
    if (docs) {
      const sDoc = docs.find(d => d.id === config.statement_doc_id)
      if (sDoc) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(sDoc.storage_path, 3600)
        statementUrl = data?.signedUrl || null
      }
      const cDoc = docs.find(d => d.id === config.cv_doc_id)
      if (cDoc) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(cDoc.storage_path, 3600)
        cvUrl = data?.signedUrl || null
      }
    }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #6b6760; }
        body { overflow-y: auto; }
        .a-nav {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 40px;
          background: rgba(237,234,228,.92); backdrop-filter: blur(8px);
          border-bottom: 1px solid #dedad4;
        }
        .a-logo { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; text-decoration: none; }
        .a-navlinks { display: flex; gap: 32px; }
        .a-navlink { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #b0aca6; text-decoration: none; transition: color .15s; }
        .a-navlink:hover, .a-navlink.active { color: #6b6760; }
        .a-body { max-width: 860px; margin: 0 auto; padding: 72px 40px 120px; }
        .a-section { margin-bottom: 72px; }
        .a-section-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; margin-bottom: 32px; padding-bottom: 12px; border-bottom: 1px solid #dedad4; }
        .a-name {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(28px,4vw,52px); font-weight: 400;
          color: #3a3834; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 40px;
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

      <nav className="a-nav">
        <Link href="/" className="a-logo">Atelier PEM</Link>
        <div className="a-navlinks">
          <Link href="/works"    className="a-navlink">Works</Link>
          <Link href="/about"    className="a-navlink active">About</Link>
          <Link href="/practice" className="a-navlink">Practice</Link>
          <Link href="/enquiry"  className="a-navlink">Enquiry</Link>
        </div>
      </nav>

      <div className="a-body">

        <section className="a-section">
          <div className="a-section-label">Biographie</div>
          <h1 className="a-name">Pierre<br />Emmanuel<br />Moulin</h1>
          <div className="a-bio">
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

            <div style={{ marginTop: 40 }}>
              {statementUrl && (
                <a href={statementUrl} target="_blank" rel="noreferrer" className="btn-doc">
                  Read Artist Statement (PDF)
                </a>
              )}
              {cvUrl && (
                <a href={cvUrl} target="_blank" rel="noreferrer" className="btn-doc">
                  Download CV (PDF)
                </a>
              )}
            </div>
          </div>
        </section>

        <section className="a-section">
          <div className="a-section-label">Expositions &amp; sélections</div>
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
          <div className="a-section-label">Formation</div>
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
          <div className="a-section-label">Contact</div>
          <div className="a-bio">
            <p>Marseille, France &nbsp;&middot;&nbsp; +33 6 17 69 05 22</p>
            <p><Link href="/enquiry" className="a-ext">Enquiry Form</Link></p>
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
