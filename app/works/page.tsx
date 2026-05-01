import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { thumbUrl, yearOf } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Works — Pierre Emmanuel Moulin',
  description: 'Selected works by Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

export default async function WorksPage() {
  const supabase = await createClient()

  // 1. Fetch Config
  let config: any = { works_collections: [] }
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
        config = {
          works_collections: parsed.works_collections || (Array.isArray(parsed) ? parsed : [])
        }
      } catch (e) {}
    }
  }

  const collections = config.works_collections.filter((c: any) => c.is_active)

  // 2. Fetch Works for all active collections
  const themes = collections.map((c: any) => c.theme).filter(Boolean)
  
  const { data: rawWorks } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink, theme')
    .eq('is_public', true)
    .in('theme', themes)
    .order('Année', { ascending: false }) as any

  const works = rawWorks || []

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #6b6760; }
        body { overflow-y: auto; overflow-x: hidden; }

        .w-nav {
          position: sticky; top: 0; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 40px;
          background: rgba(237,234,228,.92); backdrop-filter: blur(8px);
          border-bottom: 1px solid #dedad4;
        }
        .w-logo { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; text-decoration: none; }
        .w-navlinks { display: flex; gap: 32px; }
        .w-navlink { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #b0aca6; text-decoration: none; transition: color .15s; }
        .w-navlink:hover, .w-navlink.active { color: #6b6760; }

        .w-body { max-width: 860px; margin: 0 auto; padding: 72px 40px 120px; }

        .w-collection { margin-bottom: 120px; }
        .w-col-header {
          margin-bottom: 56px; padding-bottom: 16px;
          border-bottom: 1px solid #dedad4;
        }
        .w-col-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; display: block; margin-bottom: 12px; }
        .w-col-title { font-family: 'Instrument Serif', serif; font-size: 32px; color: #3a3834; margin-bottom: 16px; font-weight: 400; }
        .w-col-desc { font-size: 12px; line-height: 1.8; color: #7a7670; max-width: 60ch; }

        .w-list { display: flex; flex-direction: column; gap: 80px; }

        .w-item { display: block; }
        .w-item img {
          display: block; width: 100%; height: auto;
          opacity: .95; transition: opacity .4s;
          mix-blend-mode: multiply;
        }
        .w-item:hover img { opacity: 1; }
        
        .w-meta {
          margin-top: 18px;
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .w-title { font-family: 'Instrument Serif', serif; font-size: 18px; color: #3a3834; }
        .w-dim { font-size: 9px; color: #b0aca6; letter-spacing: 1px; text-transform: uppercase; }

        .w-empty { padding: 40px 0; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
        .w-footer { text-align: center; padding: 40px; border-top: 1px solid #dedad4; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
        
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');
      `}</style>

      <nav className="w-nav">
        <Link href="/" className="w-logo">Atelier PEM</Link>
        <div className="w-navlinks">
          <Link href="/works"    className="w-navlink active">Works</Link>
          <Link href="/about"    className="w-navlink">About</Link>
          <Link href="/practice" className="w-navlink">Practice</Link>
          <Link href="/enquiry"  className="w-navlink">Enquiry</Link>
        </div>
      </nav>

      <div className="w-body">
        {collections.map((col: any) => {
          const colWorks = works.filter((w: any) => w.theme === col.theme)
          return (
            <section key={col.id} className="w-collection">
              <div className="w-col-header">
                <span className="w-col-label">{col.theme || 'Collection'}</span>
                <h2 className="w-col-title">{col.title}</h2>
                {col.description && <p className="w-col-desc">{col.description}</p>}
              </div>
              
              {colWorks.length === 0 ? (
                <div className="w-empty">Collection en cours de constitution</div>
              ) : (
                <div className="w-list">
                  {colWorks.map((w: any) => (
                    <div key={w.OeuvreID} className="w-item">
                      <img
                        src={thumbUrl(w.txtImageNameLink, 1200)}
                        alt={w.Titre ?? `Oeuvre #${w.OeuvreID}`}
                      />
                      <div className="w-meta">
                        <span className="w-title">{w.Titre ?? 'Sans titre'}</span>
                        <span className="w-dim">
                          {yearOf(w.Année)}
                          {w.Hauteur && w.Largeur ? ` · ${w.Hauteur} x ${w.Largeur} cm` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
        
        {collections.length === 0 && (
          <div className="w-empty" style={{ textAlign: 'center', padding: '100px 0' }}>
            Aucune collection configurée dans le hub.
          </div>
        )}
      </div>

      <footer className="w-footer">
        &copy; {new Date().getFullYear()} Pierre Emmanuel Moulin
      </footer>
    </>
  )
}
