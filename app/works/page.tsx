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

const COLLECTIONS: { label: string; ids: number[] }[] = [
  { label: 'Peintures récentes', ids: [2190, 2185, 2180, 2175, 2170, 2165] },
  { label: 'Dessins',            ids: [2100, 2090, 2080, 2070, 2060, 2050] },
  { label: 'Oeuvres sur papier', ids: [2000, 1990, 1980, 1970, 1960, 1950] },
]

export default async function WorksPage() {
  const supabase = await createClient()

  const allIds = COLLECTIONS.flatMap((c) => c.ids)
  const { data: works } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Annee, Hauteur, Largeur, txtImageNameLink, Technique')
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

        .w-body { max-width: 860px; margin: 0 auto; padding: 72px 40px 120px; }

        .w-collection { margin-bottom: 100px; }
        .w-col-header {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 48px; padding-bottom: 12px;
          border-bottom: 1px solid #dedad4;
        }
        .w-col-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #b0aca6; }
        .w-col-count { font-size: 9px; color: #c8c4be; }

        .w-list { display: flex; flex-direction: column; gap: 64px; }

        .w-item { display: block; }
        .w-item img {
          display: block;
          width: 100%;
          height: auto;
          opacity: .92;
          transition: opacity .4s;
        }
        .w-item:hover img { opacity: 1; }
        .w-meta {
          margin-top: 14px;
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .w-title { font-size: 11px; color: #6b6760; }
        .w-dim { font-size: 9px; color: #b0aca6; letter-spacing: 1px; }

        .w-empty { padding: 40px 0; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }

        .w-footer { text-align: center; padding: 40px; border-top: 1px solid #dedad4; font-size: 9px; color: #c8c4be; letter-spacing: 2px; text-transform: uppercase; }
      `}</style>

      <nav className="w-nav">
        <Link href="/" className="w-logo">Atelier PEM</Link>
        <div className="w-navlinks">
          <Link href="/works"    className="w-navlink active">Works</Link>
          <Link href="/about"    className="w-navlink">About</Link>
          <Link href="/practice" className="w-navlink">Practice</Link>
          <a href="mailto:pppeeemmm@gmail.com" className="w-navlink">Enquiry</a>
        </div>
      </nav>

      <div className="w-body">
        {COLLECTIONS.map((col) => {
          const colWorks = col.ids.map((id) => byId[id]).filter(Boolean)
          return (
            <section key={col.label} className="w-collection">
              <div className="w-col-header">
                <span className="w-col-label">{col.label}</span>
                <span className="w-col-count">{colWorks.length} oeuvre{colWorks.length !== 1 ? 's' : ''}</span>
              </div>
              {colWorks.length === 0 ? (
                <div className="w-empty">Collection en cours de constitution</div>
              ) : (
                <div className="w-list">
                  {colWorks.map((w) => (
                    <div key={w.OeuvreID} className="w-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb(w.txtImageNameLink)}
                        alt={w.Titre ?? `Oeuvre #${w.OeuvreID}`}
                        width={w.Largeur ?? 800}
                        height={w.Hauteur ?? 600}
                      />
                      <div className="w-meta">
                        <span className="w-title">{w.Titre ?? 'Sans titre'}</span>
                        <span className="w-dim">
                          {w.Annee ? String(w.Annee).slice(0,4) : ''}
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
      </div>

      <footer className="w-footer">
        &copy; {new Date().getFullYear()} Pierre Emmanuel Moulin
      </footer>
    </>
  )
}
