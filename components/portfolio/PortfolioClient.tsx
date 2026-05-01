'use client'

// PortfolioClient — paginated card portfolio.
// Nav bar is the FIRST element on the page (before the artist header).
// Sections: Approche · Œuvres (one card per work) · Enquiry
// PDF: @media print outputs A4 pages.

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { thumbUrl, yearOf } from '@/lib/data'
import { createClient } from '@/lib/supabase/client'

interface Work {
  OeuvreID:         number
  Titre:            string | null
  Année:            string | null
  Hauteur:          string | null
  Largeur:          string | null
  Profondeur:       string | null
  UniteDimension:   number | null
  txtImageNameLink: string | null
  theme:            string | null
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

interface Props { 
  works: Work[] 
  sections: Section[]
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
export default function PortfolioClient({ works, sections, statementUrl, cvUrl }: Props) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [showPrivate,  setShowPrivate]  = useState(false)
  const [activeTheme,  setActiveTheme]  = useState<string | null>(null)
  const [pageIdx,      setPageIdx]      = useState(0)

  const themes = useMemo(() =>
    [...new Set(works.map(w => w.theme).filter((t): t is string => Boolean(t)))].sort(), [works])

  const featured = useMemo(() =>
    works.filter(w => {
      if (!showPrivate && !isAvail(w)) return false
      if (activeTheme && w.theme !== activeTheme) return false
      return Boolean(w.txtImageNameLink)
    }), [works, showPrivate, activeTheme])

  const pages: Page[] = useMemo(() => {
    const activeSections = sections.filter(s => s.is_active).sort((a,b) => a.sort_order - b.sort_order)
    
    if (activeSections.length === 0) {
      // Default behavior
      return [
        { kind: 'approach' },
        ...featured.map((w, i) => ({ kind: 'work' as PageKind, work: w, index: i + 1, total: featured.length })),
        { kind: 'enquiry' },
      ]
    }

    // Dynamic sections
    const dynamicPages: Page[] = [{ kind: 'approach' }]
    
    activeSections.forEach(s => {
      // Intro page for the section
      dynamicPages.push({ kind: 'section_intro', section: s })
      
      // Works for this section
      const sectionWorks = works.filter(w => {
        if (!showPrivate && !isAvail(w)) return false
        if (s.theme && w.theme !== s.theme) return false
        return Boolean(w.txtImageNameLink)
      })
      
      sectionWorks.forEach((w, idx) => {
        dynamicPages.push({ kind: 'work', work: w, index: idx + 1, total: sectionWorks.length })
      })
    })
    
    dynamicPages.push({ kind: 'enquiry' })
    return dynamicPages
  }, [featured, works, showPrivate, sections])

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
        @media print {
          .pf-screen { display: none !important; }
          .pf-print  { display: block !important; }
          .pf-page   {
            page-break-after: always; break-after: page;
            width: 210mm !important; height: 297mm !important;
            padding: 20mm !important; box-sizing: border-box !important;
            background: white !important; color: black !important;
            position: relative;
          }
          .pf-page:last-child { page-break-after: auto; break-after: auto; }
          @page { size: A4 portrait; margin: 0; }
        }
        .pf-print { display: none; }
      `}</style>

      {/* ── NAV BAR — first element, always visible at top ── */}
      <nav className="pf-screen" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: NAV_H,
        padding: '0 clamp(16px, 4vw, 40px)',
        borderBottom: '1px solid var(--bd)',
        background: 'var(--bg1)',
        position: 'sticky', top: 0, zIndex: 200,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/hub" style={{ textDecoration: 'none', color: 'var(--bg0)', fontSize: 8, opacity: 0.1, cursor: 'default' }}>·</Link>
          <div className="serif" style={{ fontSize: 'clamp(12px, 2vw, 16px)', letterSpacing: '-0.02em', color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
            Pierre Emmanuel Moulin
          </div>
        </div>

        {/* Section links */}
        <div style={{ display: 'flex', gap: 0 }}>
          {([['approach', 'Approche'], ['works', 'Œuvres']] as const).map(([s, label]) => {
            const targetIdx = s === 'approach' ? 0 : 1
            const isActive  = s === 'approach' ? pageIdx === 0 : pageIdx > 0 && pageIdx < pages.length - 1
            return (
              <button key={s}
                onClick={() => setPageIdx(targetIdx)}
                style={{
                  padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
                  background: 'none', border: 'none',
                  borderBottom: isActive ? '2px solid var(--ac)' : '2px solid transparent',
                  color: isActive ? 'var(--ac)' : 'var(--tx3)',
                  cursor: 'pointer', fontSize: 'clamp(8px, 1.2vw, 10px)',
                  letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'inherit',
                  fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap',
                }}
              >{label}</button>
            )
          })}
          
          {statementUrl && (
             <a href={statementUrl} target="_blank" rel="noreferrer" style={{
                padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
                color: 'var(--tx3)', textDecoration: 'none',
                fontSize: 'clamp(8px, 1.2vw, 10px)', letterSpacing: 2, textTransform: 'uppercase',
             }}>Statement</a>
          )}
          {cvUrl && (
             <a href={cvUrl} target="_blank" rel="noreferrer" style={{
                padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
                color: 'var(--tx3)', textDecoration: 'none',
                fontSize: 'clamp(8px, 1.2vw, 10px)', letterSpacing: 2, textTransform: 'uppercase',
             }}>CV</a>
          )}

          <button
            onClick={() => setPageIdx(pages.length - 1)}
            style={{
              padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
              background: 'none', border: 'none',
              borderBottom: pageIdx === pages.length - 1 ? '2px solid var(--ac)' : '2px solid transparent',
              color: pageIdx === pages.length - 1 ? 'var(--ac)' : 'var(--tx3)',
              cursor: 'pointer', fontSize: 'clamp(8px, 1.2vw, 10px)',
              letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'inherit',
              fontWeight: pageIdx === pages.length - 1 ? 600 : 400, whiteSpace: 'nowrap',
            }}
          >Enquiry</button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Orientation */}
          <div style={{ display: 'flex', border: '1px solid var(--bd)' }}>
            {(['portrait', 'landscape'] as const).map((o, i) => (
              <button key={o} onClick={() => setOrientation(o)} title={o === 'portrait' ? 'Portrait' : 'Paysage'}
                style={{
                  padding: '4px 8px', background: 'none', border: 'none',
                  color: orientation === o ? 'var(--ac)' : 'var(--tx3)',
                  cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                  borderRight: i === 0 ? '1px solid var(--bd)' : 'none',
                }}
              >{o === 'portrait' ? '▯' : '▭'}</button>
            ))}
          </div>
          {/* Show unavailable */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={showPrivate} onChange={e => setShowPrivate(e.target.checked)}
              style={{ accentColor: 'var(--ac)' }} />
            <span className="t-mono-sm" style={{ fontSize: 9, letterSpacing: 1, color: 'var(--tx3)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Indisponibles
            </span>
          </label>
          {/* PDF */}
          <button onClick={() => window.print()}
            style={{
              background: 'none', border: '1px solid var(--bd)', color: 'var(--tx3)',
              padding: '5px 12px', cursor: 'pointer', fontSize: 9,
              letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'inherit',
            }}
          >PDF</button>
        </div>
      </nav>

      {/* ── Theme filter bar (only on works pages) ── */}
      {cur.kind === 'work' && themes.length > 0 && (
        <div className="pf-screen" style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
          padding: '10px clamp(16px, 4vw, 40px)',
          borderBottom: '1px solid var(--bd)', background: 'var(--bg0)',
          position: 'sticky', top: NAV_H, zIndex: 100,
        }}>
          {[null, ...themes].map((t) => (
            <button key={t ?? '__all'} onClick={() => { setActiveTheme(t); if (t !== activeTheme) setPageIdx(1) }}
              style={{
                padding: '3px 12px', fontSize: 9, letterSpacing: 1, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'uppercase',
                background: activeTheme === t ? 'var(--ac)' : 'transparent',
                border: `1px solid ${activeTheme === t ? 'var(--ac)' : 'var(--bd2)'}`,
                color: activeTheme === t ? '#000' : 'var(--tx3)',
              }}
            >{t ?? 'Tous'}</button>
          ))}
        </div>
      )}

      {/* ── Card viewer ── */}
      <div className="pf-screen" style={{
        minHeight: `calc(100vh - ${NAV_H}px)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(16px, 4vw, 32px) clamp(12px, 3vw, 24px) 80px',
        background: 'var(--bg0)',
      }}>
        {/* Card */}
        <div style={{
          width: '100%',
          maxWidth: isPortrait ? 'min(640px, 90vw)' : 'min(900px, 95vw)',
          aspectRatio: isPortrait ? '210/297' : '297/210',
          background: 'var(--bg1)', border: '1px solid var(--bd)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <CardContent page={cur} isPortrait={isPortrait} />
        </div>

        {/* Navigation row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
          <button onClick={prev} disabled={pageIdx === 0}
            style={{
              background: 'none', border: '1px solid var(--bd)', color: 'var(--tx)',
              padding: '8px 16px', cursor: pageIdx === 0 ? 'default' : 'pointer',
              fontSize: 12, fontFamily: 'inherit', opacity: pageIdx === 0 ? 0.2 : 1,
            }}
          >←</button>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {pages.map((p, i) => (
              <button key={i} onClick={() => setPageIdx(i)} style={{
                width: p.kind === 'work' && i === pageIdx ? 16 : 5,
                height: 5, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                background: i === pageIdx ? 'var(--ac)' : 'var(--bd2)',
                transition: 'width 0.2s, background 0.2s',
              }} />
            ))}
          </div>

          <button onClick={next} disabled={pageIdx === pages.length - 1}
            style={{
              background: 'none', border: '1px solid var(--bd)', color: 'var(--tx)',
              padding: '8px 16px', cursor: pageIdx === pages.length - 1 ? 'default' : 'pointer',
              fontSize: 12, fontFamily: 'inherit', opacity: pageIdx === pages.length - 1 ? 0.2 : 1,
            }}
          >→</button>
        </div>

        <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 8, fontSize: 9, letterSpacing: 1 }}>
          {pageIdx + 1} / {pages.length}
          {cur.kind === 'work' && cur.total && (
            <span style={{ opacity: 0.5 }}> · Œuvre {cur.index} / {cur.total}</span>
          )}
        </div>
      </div>

      {/* ── Print version ── */}
      <div className="pf-print">
        {pages.map((p, i) => (
          <div key={i} className="pf-page">
            <PrintPage page={p} />
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

function CardContent({ page, isPortrait }: { page: Page; isPortrait: boolean }) {
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(24px,5%,48px)', justifyContent: 'space-between' }}>
        <div>
          <div className="serif s-display" style={{ fontSize: 'clamp(18px, 3.5vw, 32px)', letterSpacing: '-0.025em', lineHeight: 1.1, color: 'var(--tx)', marginBottom: 16 }}>
            Pierre Emmanuel Moulin
          </div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)', letterSpacing: 2, fontSize: 'clamp(8px, 1.2vw, 10px)' }}>
            Peinture · Dessin · Sculpture · Photographie
          </div>
        </div>
        <div className="serif" style={{ fontSize: 'clamp(13px, 2.2vw, 18px)', lineHeight: 1.75, color: 'var(--tx2)', fontStyle: 'italic' }}>
          La peinture comme résistance au visible. Chaque œuvre est une tentative
          d&apos;approcher ce qui se dérobe — la lumière sur une surface, la densité d&apos;un silence,
          la matière du temps.
        </div>
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 9, opacity: 0.5, letterSpacing: 1 }}>
          Pas de réseaux sociaux, par choix.
        </div>
      </div>
    )
  }

  if (page.kind === 'work' && page.work) {
    const w   = page.work
    const src = thumbUrl(w.txtImageNameLink, 1200)
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: isPortrait ? 'column' : 'row' }}>
        <div style={{ flex: isPortrait ? '1 1 68%' : '1 1 62%', background: 'var(--bg0)', overflow: 'hidden', position: 'relative' }}>
          {src
            ? <Img src={src} alt={w.Titre ?? ''} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain' }} />
            : <div style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />
          }
          {!isAvail(w) && (
            <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', background: 'rgba(0,0,0,0.7)', padding: '2px 7px', border: '1px solid var(--bd)' }}>
              Non disponible
            </div>
          )}
        </div>
        <div style={{
          flex: isPortrait ? '0 0 auto' : '0 0 200px',
          padding: 'clamp(14px, 3%, 24px)',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          borderTop: isPortrait ? '1px solid var(--bd)' : 'none',
          borderLeft: isPortrait ? 'none' : '1px solid var(--bd)',
        }}>
          {w.Titre && <div className="serif" style={{ fontSize: 'clamp(13px, 2vw, 17px)', lineHeight: 1.3, color: 'var(--tx)', marginBottom: 10 }}>{w.Titre}</div>}
          <div className="t-mono-sm" style={{ lineHeight: 2, color: 'var(--tx3)', fontSize: 10 }}>
            {yearOf(w.Année) && <div>{yearOf(w.Année)}</div>}
            {w.techniqueName && <div>{w.techniqueName}</div>}
            {dims(w) && <div>{dims(w)}</div>}
          </div>
          {w.theme && <div className="t-label" style={{ marginTop: 12, fontSize: 8 }}>{w.theme}</div>}
          <div className="t-mono-sm" style={{ marginTop: 14, fontSize: 8, opacity: 0.35 }}>{page.index} / {page.total}</div>
        </div>
      </div>
    )
  }

  if (page.kind === 'enquiry') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(24px,5%,48px)', justifyContent: 'center' }}>
        <div className="t-label" style={{ marginBottom: 24, letterSpacing: 3 }}>Enquiry</div>
        <InquiryForm />
        <div className="t-mono-sm" style={{ marginTop: 32, fontSize: 8, opacity: 0.4 }}>
          © {new Date().getFullYear()} Pierre Emmanuel Moulin · Studio
        </div>
      </div>
    )
  }

  return null
}

// ── Print page ─────────────────────────────────────────────────────────

function PrintPage({ page }: { page: Page }) {
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
          studio@pierreemmanuel.com<br />
          pem-hub.vercel.app/portfolio
        </div>
      </>
    )
    return null
  }
}

function InquiryForm() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const sb = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) return
    setLoading(true)
    const { error } = await sb.from('inquiry').insert([form])
    setLoading(false)
    if (!error) setSent(true)
  }

  if (sent) {
    return (
      <div className="serif" style={{ fontSize: 16, color: 'var(--ac)', fontStyle: 'italic' }}>
        Merci. Votre message a été transmis au studio.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400 }}>
      <div>
        <input 
          placeholder="Nom"
          value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          required
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--bd2)', padding: '8px 0', fontSize: 13, color: 'var(--tx)', outline: 'none' }}
        />
      </div>
      <div>
        <input 
          type="email" placeholder="Email"
          value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
          required
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--bd2)', padding: '8px 0', fontSize: 13, color: 'var(--tx)', outline: 'none' }}
        />
      </div>
      <div>
        <textarea 
          placeholder="Message"
          value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
          required rows={4}
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--bd2)', padding: '8px 0', fontSize: 13, color: 'var(--tx)', outline: 'none', resize: 'none' }}
        />
      </div>
      <button 
        type="submit" disabled={loading}
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
