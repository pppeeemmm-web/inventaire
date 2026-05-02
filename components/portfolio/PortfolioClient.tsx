'use client'

// PortfolioClient — paginated card portfolio.
// Nav bar is the FIRST element on the page (before the artist header).
// Sections: Approche · Œuvres (one card per work) · Enquiry
// PDF: @media print outputs A4 pages.

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { thumbUrl, yearOf } from '@/lib/data'
import { createClient } from '@/lib/supabase/client'

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

interface Work {
  OeuvreID:         number
  Titre:            string | null
  Année:            string | null
  Hauteur:          string | null
  Largeur:          string | null
  Profondeur:       string | null
  UniteDimension:   number | null
  txtImageNameLink: string | null
  themes:           string[]
  techniqueName:    string | null
  statutId:         number | null
}

interface Section {
  id:          string
  title:       string
  description: string
  theme:       string | null
  sort_order:  number
  is_active:   boolean
}

interface PortfolioConfig {
  general: {
    artist_name:   string
    about_intro:   string
    contact_email: string
    instagram:     string
  }
  sections:          Section[]
  works_collections: Section[]
  statement_doc_id:  string | null
  cv_doc_id:         string | null
}

interface Props { 
  works: Work[] 
  config: PortfolioConfig
  statementUrl?: string | null
  cvUrl?: string | null
}

function dims(w: Work): string {
  const p = [w.Hauteur, w.Largeur, w.Profondeur].filter(Boolean)
  return p.length ? p.join(' × ') + ' cm' : ''
}

const UNAVAILABLE = [1, 4, 5, 9, 10]
const isAvail = (w: Work) => w.statutId == null || !UNAVAILABLE.includes(w.statutId)

// ── Protected image ────────────────────────────────────────────────────
function Img({ src, alt, style, imgStyle }: {
  src: string; alt: string
  style?: React.CSSProperties; imgStyle?: React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      <img src={src} alt={alt} draggable={false}
        onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', ...imgStyle }}
      />
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'default', userSelect: 'none' }}
        onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()} />
    </div>
  )
}

// ── Page types ─────────────────────────────────────────────────────────
type PageKind = 'cover' | 'approach' | 'work' | 'enquiry' | 'section_intro'
interface Page { 
  kind: PageKind; 
  work?: Work; 
  index?: number; 
  total?: number;
  section?: Section;
}

// ── Main ───────────────────────────────────────────────────────────────
export default function PortfolioClient({ works, config, statementUrl, cvUrl }: Props) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [showPrivate,  setShowPrivate]  = useState(false)
  const [activeTheme,  setActiveTheme]  = useState<string | null>(null)
  const [pageIdx,      setPageIdx]      = useState(0)

  const themes = useMemo(() => {
    const all = works.flatMap(w => w.themes)
    return [...new Set(all)].sort()
  }, [works])

  const featured = useMemo(() =>
    works.filter(w => {
      if (activeTheme) {
        const tMatch = normalizeTheme(activeTheme)
        if (!w.themes.some(th => normalizeTheme(th).includes(tMatch))) return false
      }
      return Boolean(w.txtImageNameLink)
    }), [works, showPrivate, activeTheme])

  const pages: Page[] = useMemo(() => {
    const activeCollections = config.works_collections?.filter(s => s.is_active).sort((a,b) => a.sort_order - b.sort_order) || []
    
    if (activeCollections.length === 0) {
      // Default behavior
      return [
        { kind: 'approach' },
        ...featured.map((w, i) => ({ kind: 'work' as PageKind, work: w, index: i + 1, total: featured.length })),
        { kind: 'enquiry' },
      ]
    }

    // Dynamic collections
    const dynamicPages: Page[] = [{ kind: 'approach' }]
    
    activeCollections.forEach(s => {
      // Intro page for the section
      dynamicPages.push({ kind: 'section_intro', section: s })
      
      // Works for this collection
      const sectionWorks = works.filter(w => {
        if (s.theme) {
          const sMatch = normalizeTheme(s.theme)
          if (!w.themes.some(th => normalizeTheme(th).includes(sMatch))) return false
        }
        return Boolean(w.txtImageNameLink)
      })
      
      sectionWorks.forEach((w, idx) => {
        dynamicPages.push({ kind: 'work', work: w, index: idx + 1, total: sectionWorks.length })
      })
    })
    
    dynamicPages.push({ kind: 'enquiry' })
    return dynamicPages
  }, [featured, works, showPrivate, config.works_collections])

  useEffect(() => {
    setPageIdx(i => Math.min(i, pages.length - 1))
  }, [pages.length])

  const cur = pages[pageIdx] ?? pages[0]
  const prev = useCallback(() => setPageIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setPageIdx(i => Math.min(pages.length - 1, i + 1)), [pages.length])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prev()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [next, prev])

  const isPortrait = orientation === 'portrait'
  const NAV_H = 48

  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        :root {
          --pf-bg: #edeae4;
          --pf-tx: #1a1a1a;
          --pf-tx2: #4a4a4a;
          --pf-tx3: #8a8a8a;
          --pf-ac: #c8a86e;
          --pf-bd: rgba(0,0,0,0.1);
          --pf-bd2: rgba(0,0,0,0.05);
        }
        @media print {
          .pf-screen { display: none !important; }
          .pf-print  { display: block !important; }
          .pf-page   {
            page-break-after: always; break-after: page;
            width: ${isPortrait ? '210mm' : '297mm'} !important;
            height: ${isPortrait ? '297mm' : '210mm'} !important;
            padding: 20mm !important; box-sizing: border-box !important;
            background: white !important; color: black !important;
            position: relative;
          }
          .pf-page:last-child { page-break-after: auto; break-after: auto; }
          @page { size: A4 ${orientation}; margin: 0; }
        }
        .pf-print { display: none; }
        .pf-serif { font-family: 'Instrument Serif', serif; }
        .pf-mono { font-family: ui-monospace, monospace; }
      `}</style>

      {/* Header */}
      <header className="pf-screen" style={{ 
        height: NAV_H, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 40px)',
        borderBottom: '1px solid var(--pf-bd)', background: 'var(--pf-bg)',
        position: 'relative', zIndex: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/hub" style={{ textDecoration: 'none', color: 'var(--pf-tx)', fontSize: 8, opacity: 0.1, cursor: 'default' }}>·</Link>
          <div className="pf-serif" style={{ fontSize: 'clamp(14px, 2vw, 18px)', letterSpacing: '-0.01em', color: 'var(--pf-tx)', whiteSpace: 'nowrap' }}>
            {config.general.artist_name || 'Artiste'}
          </div>
        </div>

        <nav style={{ display: 'flex', gap: 0 }}>
          {([['approach', 'Approche'], ['works', 'Œuvres']] as const).map(([s, label]) => {
            const targetIdx = s === 'approach' ? 0 : 1
            const isActive  = s === 'approach' ? pageIdx === 0 : pageIdx > 0 && pageIdx < pages.length - 1
            return (
              <button key={s}
                onClick={() => setPageIdx(targetIdx)}
                style={{
                  padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
                  background: 'none', border: 'none',
                  borderBottom: isActive ? '1px solid var(--pf-tx)' : '1px solid transparent',
                  color: isActive ? 'var(--pf-tx)' : 'var(--pf-tx3)',
                  cursor: 'pointer', fontSize: 'clamp(8px, 1.2vw, 9px)',
                  letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'inherit',
                  fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap',
                }}
              >{label}</button>
            )
          })}
          <button
            onClick={() => setPageIdx(pages.length - 1)}
            style={{
              padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
              background: 'none', border: 'none',
              borderBottom: pageIdx === pages.length - 1 ? '1px solid var(--pf-tx)' : '1px solid transparent',
              color: pageIdx === pages.length - 1 ? 'var(--pf-tx)' : 'var(--pf-tx3)',
              cursor: 'pointer', fontSize: 'clamp(8px, 1.2vw, 9px)',
              letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'inherit',
              fontWeight: pageIdx === pages.length - 1 ? 600 : 400, whiteSpace: 'nowrap',
            }}
          >Enquiry</button>
        </nav>

        <div style={{ width: 120, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setOrientation('portrait')} className="pf-mono" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: isPortrait ? 'var(--pf-tx)' : 'var(--pf-tx3)', fontSize: 14 }} title="Portrait">▯</button>
          <button onClick={() => setOrientation('landscape')} className="pf-mono" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: !isPortrait ? 'var(--pf-tx)' : 'var(--pf-tx3)', fontSize: 14 }} title="Paysage">▭</button>
          <div style={{ width: 1, height: 16, background: 'var(--pf-bd)', margin: '0 4px' }} />
          <button onClick={() => window.print()} className="pf-mono" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 9, color: 'var(--pf-tx2)' }} title="Print">PDF</button>
        </div>
      </header>

      {/* ── Main viewer (fixed height — no scroll) ── */}
      <div className="pf-screen" style={{
        height: `calc(100dvh - ${NAV_H}px)`,
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 40px)',
        paddingBottom: '80px', // Reserve space for absolute nav
        background: 'var(--pf-bg)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Card — responsive proportions for screens, not strict A4 */}
        <div style={{
          flex: '1 1 auto',
          minHeight: 0,
          aspectRatio: isPortrait ? '3/4' : '3/2',
          maxWidth: isPortrait ? '640px' : '1100px',
          width: '100%',
          maxHeight: '100%',
          background: '#fff', border: '1px solid var(--pf-bd)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            <CardContent page={cur} isPortrait={isPortrait} config={config} />
          </div>
        </div>

        {/* Navigation bottom — absolute positioned so it never gets pushed off screen */}
        <div style={{ 
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 16, zIndex: 100 
        }}>
          <button onClick={prev} disabled={pageIdx === 0}
            style={{
              background: 'var(--pf-bg)', border: '1px solid var(--pf-bd)', color: 'var(--pf-tx)',
              padding: '6px 14px', cursor: pageIdx === 0 ? 'default' : 'pointer',
              fontSize: 12, fontFamily: 'inherit', opacity: pageIdx === 0 ? 0.2 : 0.8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}
          >←</button>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {pages.map((p, i) => (
              <button key={i} onClick={() => setPageIdx(i)} style={{
                width: p.kind === 'work' && i === pageIdx ? 16 : 5,
                height: 5, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                background: i === pageIdx ? 'var(--pf-ac)' : 'var(--pf-bd2)',
                transition: 'width 0.2s, background 0.2s',
              }} />
            ))}
          </div>

          <button onClick={next} disabled={pageIdx === pages.length - 1}
            style={{
              background: 'var(--pf-bg)', border: '1px solid var(--pf-bd)', color: 'var(--pf-tx)',
              padding: '6px 14px', cursor: pageIdx === pages.length - 1 ? 'default' : 'pointer',
              fontSize: 12, fontFamily: 'inherit', opacity: pageIdx === pages.length - 1 ? 0.2 : 0.8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}
          >→</button>
        </div>

        <Link href="/hub" style={{ 
          position: 'fixed', bottom: 32, right: 40, 
          fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', 
          color: '#8a8680', textDecoration: 'none', opacity: 0.7,
          transition: 'all 0.3s',
          fontWeight: 600,
          zIndex: 1000
        }} className="hub-link">[ Hub ]</Link>
      </div>

      {/* ── Print version ── */}
      <div className="pf-print">
        {pages.map((p, i) => (
          <div key={i} className="pf-page">
            <PrintPage page={p} config={config} />
            <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 7, color: '#bbb', letterSpacing: 1 }}>
              Pierre Emmanuel Moulin · {i + 1}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Card page content ──────────────────────────────────────────────────

function CardContent({ page, isPortrait, config }: { page: Page; isPortrait: boolean; config: PortfolioConfig }) {
  if (page.kind === 'section_intro' && page.section) {
    const s = page.section
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(24px,5%,48px)', justifyContent: 'center' }}>
        <div className="t-label" style={{ marginBottom: 16, letterSpacing: 3 }}>{s.title}</div>
        <div className="serif" style={{ fontSize: 'clamp(15px, 2.5vw, 22px)', lineHeight: 1.6, color: 'var(--tx)', fontStyle: 'italic', maxWidth: '35ch' }}>
          {s.description}
        </div>
      </div>
    )
  }

  if (page.kind === 'approach') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(20px,6%,64px) clamp(20px,7%,48px)', justifyContent: 'flex-start', overflowY: 'auto' }}>
        <div style={{ marginBottom: 'clamp(16px,5%,80px)' }}>
          <div className="pf-serif" style={{ fontSize: 'clamp(18px, 4vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--pf-tx)', marginBottom: 12 }}>
            {config.general.artist_name || 'Artiste'}
          </div>
          <div className="pf-mono" style={{ color: 'var(--pf-ac)', letterSpacing: 2, fontSize: 'clamp(7px, 1vw, 10px)', fontWeight: 600, textTransform: 'uppercase' }}>
            Peinture · Dessin · Sculpture · Photographie
          </div>
        </div>
        <div className="pf-serif" style={{ fontSize: 'clamp(12px, 2vw, 22px)', lineHeight: 1.55, color: 'var(--pf-tx)', fontStyle: 'italic', maxWidth: '38ch' }}>
          {config.general.about_intro || "La peinture comme résistance au visible. Chaque œuvre est une tentative d'approcher ce qui se dérobe — la lumière sur une surface, la densité d'un silence, la matière du temps."}
        </div>
        <div className="pf-mono" style={{ marginTop: 'auto', color: 'var(--pf-tx3)', fontSize: 8, opacity: 0.5, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Studio · {new Date().getFullYear()}
        </div>
      </div>
    )
  }

  if (page.kind === 'work' && page.work) {
    const w   = page.work
    const src = thumbUrl(w.txtImageNameLink, 1200)
    // Detect if image is likely portrait based on metadata or just provide a way to handle it.
    // Since we don't have metadata here easily, we'll use a row layout for landscape cards 
    // but with a style that allows "full bleeder" if the image is tall.
    
    return (
      <div style={{ 
        flex: 1, display: 'flex', 
        flexDirection: isPortrait ? 'column' : 'row', 
        height: '100%',
        background: '#fff'
      }}>
        {/* Image Container */}
        <div style={{ 
          flex: isPortrait ? '0 0 80%' : '1 1 65%', 
          background: '#fff', 
          overflow: 'hidden', 
          position: 'relative',
          display: 'flex',
          alignItems: isPortrait ? 'flex-start' : 'center',
          justifyContent: 'center',
          padding: '24px 24px 0', // Equalized top/left/right margins
          borderRight: isPortrait ? 'none' : '1px solid var(--pf-bd)'
        }}>
          {src
            ? <Img src={src} alt={w.Titre ?? ''} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain', objectPosition: isPortrait ? 'center top' : 'center' }} />
            : <div style={{ width: '100%', height: '100%', background: '#fff' }} />
          }
          {!isAvail(w) && (
            <div className="pf-mono" style={{ position: 'absolute', top: 24, left: 24, fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pf-tx3)', background: 'rgba(255,255,255,0.9)', padding: '4px 10px', border: '1px solid var(--pf-bd)', zIndex: 10 }}>
              Non disponible
            </div>
          )}
        </div>

        {/* Info Container */}
        <div style={{
          flex: isPortrait ? '1 1 auto' : '0 0 300px',
          padding: isPortrait ? '16px 24px 24px' : '40px 32px',
          display: 'flex', flexDirection: 'column', 
          justifyContent: isPortrait ? 'flex-start' : 'center',
          overflowY: 'auto'
        }}>
          {w.Titre && <div className="pf-serif" style={{ fontSize: 'clamp(16px, 2.5vw, 22px)', lineHeight: 1.2, color: 'var(--pf-tx)', marginBottom: 12 }}>{w.Titre}</div>}
          <div className="pf-mono" style={{ lineHeight: 2.2, color: 'var(--pf-tx2)', fontSize: 9, letterSpacing: 0.5 }}>
            {yearOf(w.Année) && <div style={{ color: 'var(--pf-tx3)' }}>{yearOf(w.Année)}</div>}
            {w.techniqueName && <div>{w.techniqueName}</div>}
            {dims(w) && <div>{dims(w)}</div>}
          </div>
          {w.themes.length > 0 && (
            <div className="pf-mono" style={{ 
              marginTop: 'auto', paddingTop: 20, fontSize: 8, 
              letterSpacing: 1.5, textTransform: 'uppercase', 
              color: 'var(--pf-ac)', fontWeight: 600 
            }}>
              {w.themes.join(' · ')}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (page.kind === 'enquiry') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(20px,6%,64px) clamp(20px,7%,48px)', justifyContent: 'flex-start', overflowY: 'auto' }}>
        <div className="pf-mono" style={{ marginBottom: 'clamp(16px,4%,40px)', letterSpacing: 3, textTransform: 'uppercase', fontSize: 10, color: 'var(--pf-ac)', fontWeight: 600 }}>Enquiry</div>
        <InquiryForm contactEmail={config.general.contact_email} />
        <div className="pf-mono" style={{ marginTop: 'auto', fontSize: 8, opacity: 0.3, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          © {new Date().getFullYear()} Pierre Emmanuel Moulin · Studio
        </div>
      </div>
    )
  }

  return null
}

// ── Print page ─────────────────────────────────────────────────────────

function PrintPage({ page, config }: { page: Page; config: PortfolioConfig }) {
  if (page.kind === 'section_intro' && page.section) {
    const s = page.section
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#888', marginBottom: 24 }}>{s.title}</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, lineHeight: 1.6, color: '#222', fontStyle: 'italic', maxWidth: 480 }}>
          {s.description}
        </div>
      </div>
    )
  }
  if (page.kind === 'approach') {
    return (
      <>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, letterSpacing: '-0.02em', marginBottom: 40, color: '#111' }}>
          Pierre Emmanuel Moulin
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.9, fontStyle: 'italic', color: '#444', maxWidth: 520 }}>
          La peinture comme résistance au visible. Chaque œuvre est une tentative
          d'approcher ce qui se dérobe — la lumière sur une surface, la densité d'un silence,
          la matière du temps.
        </div>
      </>
    )
  }
  if (page.kind === 'work' && page.work) {
    const w = page.work
    const src = thumbUrl(w.txtImageNameLink, 1200)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={w.Titre ?? ''} style={{ maxWidth: '100%', maxHeight: '75%', objectFit: 'contain', marginBottom: 20 }} />
        )}
        {w.Titre && <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, marginBottom: 4, color: '#111' }}>{w.Titre}</div>}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#888', lineHeight: 1.8 }}>
          {[yearOf(w.Année) ?? w.Année, w.techniqueName, dims(w)].filter(Boolean).join(' · ')}
        </div>
      </div>
    )
  }
  if (page.kind === 'enquiry') {
    return (
      <>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#888', marginBottom: 32 }}>Contact</div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#444', lineHeight: 2.2 }}>
          {config.general.contact_email || 'studio@exemple.com'}<br />
          {config.general.instagram ? `Instagram : ${config.general.instagram}` : ''}
        </div>
      </>
    )
  }
}

function InquiryForm({ contactEmail }: { contactEmail?: string }) {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const sb = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setLoading(true)
    const { error } = await (sb.from('inquiry') as any).insert([form])
    setLoading(false)
    if (!error) setSent(true)
  }

  if (sent) {
    return (
      <div className="pf-serif" style={{ fontSize: 18, color: 'var(--pf-tx)', fontStyle: 'italic' }}>
        Merci. Votre message a été transmis au studio.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 450 }}>
      <div>
        <label className="pf-mono" style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pf-tx3)', marginBottom: 4, display: 'block' }}>Nom complet</label>
        <input 
          placeholder="Jean Dupont"
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          required
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--pf-bd)', padding: '10px 0', fontSize: 14, color: 'var(--pf-tx)', outline: 'none' }}
        />
      </div>
      <div>
        <label className="pf-mono" style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pf-tx3)', marginBottom: 4, display: 'block' }}>Email</label>
        <input 
          type="email" placeholder="jean@exemple.com"
          value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
          required
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--pf-bd)', padding: '10px 0', fontSize: 14, color: 'var(--pf-tx)', outline: 'none' }}
        />
      </div>
      <div>
        <label className="pf-mono" style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pf-tx3)', marginBottom: 4, display: 'block' }}>Message</label>
        <textarea 
          placeholder="Votre demande..."
          value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
          required rows={4}
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--pf-bd)', padding: '10px 0', fontSize: 14, color: 'var(--pf-tx)', outline: 'none', resize: 'none', lineHeight: 1.6 }}
        />
      </div>
      <button 
        type="submit" disabled={loading}
        className="pf-mono"
        style={{ 
          marginTop: 8, padding: '10px 24px', width: 'fit-content',
          background: 'none', border: '1px solid var(--ac)', color: 'var(--ac)',
          fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer'
        }}
      >
        {loading ? 'Envoi...' : 'Envoyer'}
      </button>
    </form>
  )
}
