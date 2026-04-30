import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Works — Pierre Emmanuel Moulin',
  description: 'Selected works by Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

const R2 = 'https://pub-a352e674a992412fa243598ffd6b659c.r2.dev'

function thumb(path: string) {
  const base = path.replace(/\.[^.]+$/, '')
  return `${R2}/thumbs/${base}.avif`
}

// Curated collection IDs — update these when ready to curate properly
const COLLECTIONS: { label: string; ids: number[] }[] = [
  { label: 'Peintures récentes', ids: [2190, 2185, 2180, 2175, 2170, 2165] },
  { label: 'Dessins',            ids: [2100, 2090, 2080, 2070, 2060, 2050] },
  { label: 'Œuvres sur papier', ids: [2000, 1990, 1980, 1970, 1960, 1950] },
]

export default async function WorksPage() {
  const supabase = await createClient()

  const allIds = COLLECTIONS.flatMap((c) => c.ids)
  const { data: works } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, Hauteur, Largeur, txtImageNameLink, Technique')
    .in('OeuvreID', allIds)
    .not('txtImageNameLink', 'is', null)

  const byId: Record<number, any> = {}
  for (const w of works ?? []) byId[w.OeuvreID] = w

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

        .w-body { max-width: 1200px; margin: 0 auto; padding: 72px 40px 120px; }

        .w-hero { margin-bottom: 80px; }
        .w-hero-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; margin-bottom: 16px; }
        .w-hero-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(32px, 5vw, 64px);
          font-weight: 400; color: #3a3834; line-height: 1.1; letter-spacing: -.02em;
        }

        .w-collection { margin-bottom: 80px; }
        .w-col-header {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 24px; padding-bottom: 12px;
          border-bottom: 1px solid #dedad4;
        }
        .w-col-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; }
        .w-col-count { font-size: 9px; color: #c8c4be; }

        .w-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
        @media (max-width: 800px) { .w-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 500px) { .w-grid { grid-template-columns: 1fr; } }

        .w-item { position: relative; aspect-ratio: 1; overflow: hidden; background: #dedad4; }
        .w-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s ease, opacity .3s; opacity: .88; }
        .w-item:hover img { transform: scale(1.04); opacity: 1; }
        .w-caption {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          justify-content: flex-end; padding: 20px 14px 14px;
          background: linear-gradient(transparent 50%, rgba(30,28,26,.55));
          opacity: 0; transition: opacity .25s;
        }
        .w-item:hover .w-caption { opacity: 1; }
        .w-cap-title { font-size: 11px; color: #e8e4de; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .w-cap-dim { font-size: 9px; color: #a09c96; margin-top: 3px; }

        .w-empty { grid-column: 1/-1; padding: 40px 0; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-align: center; text-transform: uppercase; }

        .w-footer { text-align: center; padding: 40px; border-top: 1px solid #dedad4; }
        .w-footer-note { font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
      `}</style>

      <nav className="w-nav">
        <Link href="/" className="w-logo">Atelier PEM</Link>
        <div className="w-navlinks">
          <Link href="/works"    className="w-navlink active">Works</Link>
          <Link href="/about"    className="w-navlink">About</Link>
          <Link href="/practice" className="w-navlink">Practice</Link>
          <a href="mailto:studio@pierreemmanuel.com" className="w-navlink">Enquiry</a>
        </div>
      </nav>

      <div className="w-body">
        <div className="w-hero">
          <div className="w-hero-label">Selected works</div>
          <h1 className="w-hero-title">Collections</h1>
        </div>

        {COLLECTIONS.map((col) => {
          const colWorks = col.ids.map((id) => byId[id]).filter(Boolean)
          return (
            <section key={col.label} className="w-collection">
              <div className="w-col-header">
                <span className="w-col-label">{col.label}</span>
                <span className="w-col-count">{colWorks.length} œuvre{colWorks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="w-grid">
                {colWorks.length === 0 ? (
                  <div className="w-empty">Collection en cours de constitution</div>
                ) : colWorks.map((w) => (
                  <div key={w.OeuvreID} className="w-item">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(w.txtImageNameLink)} alt={w.Titre ?? `Œuvre #${w.OeuvreID}`} />
                    <div className="w-caption">
                      <div className="w-cap-title">{w.Titre ?? 'Sans titre'}</div>
                      <div className="w-cap-dim">
                        {w.Année ? String(w.Année).slice(0,4) : ''}
                        {w.Hauteur && w.Largeur ? ` · ${w.Hauteur}×${w.Largeur} cm` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="w-footer">
        <div className="w-footer-note">© {new Date().getFullYear()} Pierre Emmanuel Moulin</div>
      </footer>
    </>
  )
}
