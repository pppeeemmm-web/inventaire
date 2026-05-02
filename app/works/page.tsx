import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { thumbUrl, yearOf } from '@/lib/data'

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export const metadata: Metadata = {
  title: 'Works — Pierre Emmanuel Moulin',
  description: 'Selected works by Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

export default async function WorksPage() {
  const supabase = await createClient()

  // 1. Fetch Config
  let config: any = { works_collections: [] }
  const { data: configDoc } = await (supabase
    .from('document') as any)
    .select('storage_path')
    .eq('name', 'portfolio_sections.json')
    .maybeSingle()

  if (configDoc?.storage_path) {
    const { data: fileData } = await supabase.storage.from('vault').download(configDoc.storage_path)
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

  // 2. Fetch all themes (small table) to allow fuzzy matching in JS
  const { data: themeRecords } = await (supabase
    .from('tblTheme') as any)
    .select('ThemeID, Nom')
  
  // 3. Fetch all OeuvreThemes for public works
  // (We could filter by OeuvreID, but since we only process public works, filtering the map is fine)
  const { data: oeuvreThemes } = await (supabase
    .from('OeuvreTheme') as any)
    .select('OeuvreID, ThemeID')
  
  const oeuvreIds = [...new Set((oeuvreThemes || []).map(ot => ot.OeuvreID))]

  // 4. Fetch Works
  const { data: rawWorks } = await (supabase
    .from('Oeuvres') as any)
    .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink')
    .eq('is_public', true)
    .in('OeuvreID', oeuvreIds)
    .order('Année', { ascending: false }) as any

  const works = rawWorks || []

  // Create a map of OeuvreID -> ThemeNames
  const oeuvreThemeMap = new Map<number, string[]>()
  if (themeRecords && oeuvreThemes) {
    const idToName = Object.fromEntries(themeRecords.map(r => [r.ThemeID, r.Nom]))
    oeuvreThemes.forEach(ot => {
      if (!oeuvreThemeMap.has(ot.OeuvreID)) oeuvreThemeMap.set(ot.OeuvreID, [])
      const name = idToName[ot.ThemeID]
      if (name) oeuvreThemeMap.get(ot.OeuvreID)!.push(name)
    })
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: auto; }
        html, body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #6b6760; }
        body { overflow-y: auto; overflow-x: hidden; min-height: 100vh; }

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
          <Link href="/portfolio" className="w-navlink">Portfolio</Link>
          <Link href="/enquiry"  className="w-navlink">Enquiry</Link>
        </div>
      </nav>

      <div className="w-body">
        {collections.map((col: any) => {
          const colWorks = works.filter((w: any) => {
            const wThemes = oeuvreThemeMap.get(w.OeuvreID) ?? []
            if (!Boolean(w.txtImageNameLink)) return false
            if (!col.theme) return true // no theme = show all
            
            const colMatch = normalizeTheme(col.theme)
            return wThemes.some(th => normalizeTheme(th).includes(colMatch))
          })
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
                        src={thumbUrl(w.txtImageNameLink, 1200) ?? undefined}
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
