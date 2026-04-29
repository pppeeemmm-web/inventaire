// Public artist landing page — no auth required.
// Shows a featured grid of works and links to the full portfolio.
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pierre Emmanuel Moulin — Peintre',
  description: 'Peinture, dessin, sculpture, photographie. Atelier à Paris.',
  robots: { index: true, follow: true },
}

const SB  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const BKT = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'paintings'

function thumbUrl(path: string, size = 828): string {
  const full = `${SB}/storage/v1/object/public/${BKT}/${encodeURIComponent(path)}`
  return `/_next/image?url=${encodeURIComponent(full)}&w=${size}&q=70`
}

export default async function LandingPage() {
  const supabase = await createClient()

  const { data: featured } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, txtImageNameLink')
    .eq('Exposable', true)
    .not('txtImageNameLink', 'is', null)
    .not('txtImageNameLink', 'eq', '')
    .order('OeuvreID', { ascending: false })
    .limit(6) as any

  const works = (featured ?? []) as {
    OeuvreID: number
    Titre: string | null
    Année: string | null
    txtImageNameLink: string
  }[]

  const year = new Date().getFullYear()

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; color: #ccc; font-family: 'JetBrains Mono', monospace; overflow-x: hidden; overflow-y: auto; height: auto !important; }

        .lw { min-height: 100dvh; display: flex; flex-direction: column; }

        /* Nav */
        .l-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px clamp(20px,5vw,60px);
          border-bottom: 1px solid #1a1a1a;
          position: sticky; top: 0; z-index: 10;
          background: rgba(10,10,10,0.93); backdrop-filter: blur(8px);
        }
        .l-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
        .l-mark {
          width: 28px; height: 28px; border: 1px solid #c8a86e;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Instrument Serif', serif; color: #c8a86e; font-size: 14px;
        }
        .l-name { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #666; }
        .l-links { display: flex; gap: 0; }
        .l-link {
          padding: 6px 18px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #555; text-decoration: none; border: 1px solid transparent;
          transition: color .15s, border-color .15s; font-family: inherit;
        }
        .l-link:hover { color: #c8a86e; border-color: #c8a86e; }
        .l-link.ac { color: #c8a86e; border-color: #2a2a2a; }
        .l-link.ac:hover { border-color: #c8a86e; }

        /* Hero */
        .l-hero {
          padding: clamp(60px,10vw,120px) clamp(20px,5vw,60px) clamp(40px,6vw,80px);
          display: grid; grid-template-columns: 1fr 1fr; gap: 40px;
          align-items: end; border-bottom: 1px solid #1a1a1a;
        }
        @media (max-width: 640px) { .l-hero { grid-template-columns: 1fr; } }
        .l-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(36px,7vw,80px);
          line-height: 1.05; letter-spacing: -.02em; color: #e8e8e8; font-weight: 400;
        }
        .l-title em { color: #c8a86e; font-style: italic; }
        .l-medium { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #3a3a3a; margin-bottom: 20px; }
        .l-statement { font-size: clamp(12px,1.5vw,14px); line-height: 1.9; color: #555; max-width: 40ch; }

        /* Grid */
        .l-section { padding: clamp(40px,6vw,72px) clamp(20px,5vw,60px); }
        .l-slabel { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #2e2e2e; margin-bottom: 24px; }
        .l-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 2px; }
        @media (max-width: 900px) { .l-grid { grid-template-columns: repeat(2,1fr); } }
        @media (max-width: 540px) { .l-grid { grid-template-columns: 1fr; } }
        .l-work { position: relative; aspect-ratio: 1; overflow: hidden; background: #111; }
        .l-work img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          transition: transform .4s ease, opacity .3s; opacity: .82;
          user-select: none; pointer-events: none;
        }
        .l-work:hover img { transform: scale(1.03); opacity: 1; }
        .l-cap {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 24px 14px 12px;
          background: linear-gradient(transparent, rgba(0,0,0,.72));
          opacity: 0; transition: opacity .25s;
        }
        .l-work:hover .l-cap { opacity: 1; }
        .l-cap-title { font-size: 11px; color: #e0e0e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .l-cap-year { font-size: 9px; color: #888; margin-top: 2px; }

        /* CTA */
        .l-cta { display: flex; justify-content: center; padding: 48px clamp(20px,5vw,60px) 72px; }
        .l-cta a {
          padding: 14px 40px; border: 1px solid #252525; color: #666; text-decoration: none;
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase; font-family: inherit;
          transition: border-color .2s, color .2s;
        }
        .l-cta a:hover { border-color: #c8a86e; color: #c8a86e; }

        /* Footer */
        .l-footer {
          margin-top: auto; padding: 20px clamp(20px,5vw,60px);
          border-top: 1px solid #151515;
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
        }
        .l-copy { font-size: 9px; color: #2e2e2e; letter-spacing: 1px; }
        .l-contact { font-size: 9px; color: #3a3a3a; letter-spacing: 1px; text-decoration: none; transition: color .15s; }
        .l-contact:hover { color: #c8a86e; }
      `}</style>

      <div className="lw">

        <nav className="l-nav">
          <a href="/" className="l-logo">
            <div className="l-mark">P</div>
            <span className="l-name">Pierre Emmanuel Moulin</span>
          </a>
          <div className="l-links">
            <a href="mailto:studio@pierreemmanuel.com" className="l-link">Contact</a>
            <Link href="/portfolio" className="l-link ac">Portfolio →</Link>
          </div>
        </nav>

        <section className="l-hero">
          <h1 className="l-title">
            Pierre<br />
            Emmanuel<br />
            <em>Moulin</em>
          </h1>
          <div>
            <div className="l-medium">Peinture · Dessin · Sculpture · Photographie</div>
            <p className="l-statement">
              La peinture comme résistance au visible.
              Chaque œuvre est une tentative d&apos;approcher
              ce qui se dérobe — la lumière sur une surface,
              la densité d&apos;un silence, la matière du temps.
            </p>
          </div>
        </section>

        {works.length > 0 && (
          <section className="l-section">
            <div className="l-slabel">Œuvres récentes</div>
            <div className="l-grid">
              {works.map((w) => (
                <div key={w.OeuvreID} className="l-work">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(w.txtImageNameLink)}
                    alt={w.Titre ?? `Œuvre #${w.OeuvreID}`}
                    draggable={false}
                  />
                  <div className="l-cap">
                    <div className="l-cap-title">{w.Titre ?? 'Sans titre'}</div>
                    {w.Année && <div className="l-cap-year">{String(w.Année).slice(0, 4)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="l-cta">
          <Link href="/portfolio">Voir le portfolio complet</Link>
        </div>

        <footer className="l-footer">
          <span className="l-copy">© {year} Pierre Emmanuel Moulin · Tous droits réservés</span>
          <a href="mailto:studio@pierreemmanuel.com" className="l-contact">studio@pierreemmanuel.com</a>
        </footer>

      </div>
    </>
  )
}
