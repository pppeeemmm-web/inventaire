'use client'

// PortfolioClient — paginated card portfolio, bilingual (FR/EN).
// Config uses dual _fr/_en fields throughout.
// Nav bar is the FIRST element on the page (before the artist header).
// Sections: Approche / Oeuvres (one card per work) / Enquiry
// PDF: dedicated drawer using server-side pdfkit.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { imageUrl, yearOf } from '@/lib/data'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { WorkThumb } from '../atelier/WorkThumb'
import Image from 'next/image'
import type { Lang, DictKey } from '@/lib/i18n/dictionary'
import PdfExportDrawer from './PdfExportDrawer'

/** Strip rich/HTML from atelier fields for public card text */
function stripRich(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

interface Work {
  OeuvreID:         number
  Titre:            string | null
  Annee:            string | null
  Hauteur:          string | null
  Largeur:          string | null
  Profondeur:       string | null
  UniteDimension:   number | null
  txtImageNameLink: string | null
  themes:           string[]
  techniqueName:    string | null
  statutId:         number | null
}

interface CollectionItem {
  id:             string
  title_fr:       string
  title_en:       string
  description_fr: string
  description_en: string
  theme:          string | null
  sort_order:     number
  is_active:      boolean
  manual_work_order?: number[]
}

interface PortfolioConfig {
  general: {
    artist_name:      string
    contact_email:    string
    instagram:        string
    phone?:           string
    media_tagline_fr: string
    media_tagline_en: string
    about_intro?:     string
  }
  about?: {
    intro_fr:         string
    intro_en:         string
    statement_doc_id: string | null
    cv_doc_id:        string | null
  }
  sections:          CollectionItem[]
  works_collections: CollectionItem[]
  statement_doc_id?: string | null
  cv_doc_id?:        string | null
}

interface Props {
  works:        Work[]
  config:       PortfolioConfig
  statementUrl?: string | null
  cvUrl?:        string | null
}

function dims(w: Work): string {
  const p = [w.Hauteur, w.Largeur, w.Profondeur].filter(Boolean)
  return p.length ? p.join(' x ') + ' cm' : ''
}

const UNAVAILABLE = [1, 4, 5, 9, 10]
const isAvail = (w: Work) => w.statutId == null || !UNAVAILABLE.includes(w.statutId)

function pick(fr: string, en: string, lang: Lang): string {
  return lang === 'fr' ? (fr || en) : (en || fr)
}

function colTitle(c: CollectionItem, lang: Lang): string {
  return pick(c.title_fr, c.title_en, lang)
}

function colDesc(c: CollectionItem, lang: Lang): string {
  return pick(c.description_fr, c.description_en, lang)
}

function Img({ src, alt, style, imgStyle, fileName }: {
  src?: string; alt: string; fileName?: string
  style?: React.CSSProperties; imgStyle?: React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {fileName ? (
        <WorkThumb file={fileName} size={800} alt={alt} style={imgStyle} />
      ) : src ? (
        <Image 
          src={src} 
          alt={alt} 
          fill
          unoptimized={true}
          draggable={false}
          onContextMenu={e => e.preventDefault()} 
          onDragStart={e => e.preventDefault()}
          style={{ display: 'block', objectFit: 'cover', userSelect: 'none', ...imgStyle }}
        />
      ) : null}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'default', userSelect: 'none' }}
        onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()} />
    </div>
  )
}

type PageKind = 'cover' | 'approach' | 'work' | 'enquiry' | 'section_intro'
interface Page {
  kind:     PageKind
  work?:    Work
  index?:   number
  total?:   number
  section?: CollectionItem
}

type TFn = (key: DictKey) => string

export default function PortfolioClient({ works, config, statementUrl, cvUrl }: Props) {
  const { lang, setLang, t } = useI18n()
  const [orientation,   setOrientation]   = useState<'portrait' | 'landscape'>('portrait')
  const [pageIdx,       setPageIdx]       = useState(0)
  const [showPdfDrawer, setShowPdfDrawer] = useState(false)

  // Cap display at 40 works for performance — DB already orders by Année desc
  const DISPLAY_CAP = 40
  const featured = useMemo(() =>
    works.filter(w => Boolean(w.txtImageNameLink)).slice(0, DISPLAY_CAP),
    [works])

  const pages: Page[] = useMemo(() => {
    const activePortfolioSections = config.sections
      ?.filter(s => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order) || []

    const activeCollections = config.works_collections
      ?.filter(s => s.is_active)
      .sort((a, b) => a.sort_order - b.sort_order) || []

    function worksForSectionTheme(s: CollectionItem) {
      return works.filter(w => {
        if (s.theme) {
          const sMatch = normalizeTheme(s.theme)
          if (!w.themes.some(th => {
            const wMatch = normalizeTheme(th)
            return wMatch.includes(sMatch) || sMatch.includes(wMatch)
          })) return false
        }
        return Boolean(w.txtImageNameLink)
      })
    }

    if (activePortfolioSections.length > 0) {
      const dynamicPages: Page[] = [{ kind: 'approach' }]
      activePortfolioSections.forEach(s => {
        dynamicPages.push({ kind: 'section_intro', section: s })
        let sectionWorks = worksForSectionTheme(s)
        const orderIds = s.manual_work_order ?? []
        if (orderIds.length > 0) {
          const rank = new Map(orderIds.map((id, i) => [id, i]))
          sectionWorks = sectionWorks.slice().sort((a, b) => {
            const ai = rank.has(a.OeuvreID) ? rank.get(a.OeuvreID)! : Number.POSITIVE_INFINITY
            const bi = rank.has(b.OeuvreID) ? rank.get(b.OeuvreID)! : Number.POSITIVE_INFINITY
            return ai - bi
          })
        }
        const cappedWorks = sectionWorks.slice(0, DISPLAY_CAP)
        cappedWorks.forEach((w, idx) => {
          dynamicPages.push({ kind: 'work', work: w, index: idx + 1, total: cappedWorks.length })
        })
      })
      dynamicPages.push({ kind: 'enquiry' })
      return dynamicPages
    }

    if (activeCollections.length === 0) {
      return [
        { kind: 'approach' },
        ...featured.map((w, i) => ({ kind: 'work' as PageKind, work: w, index: i + 1, total: featured.length })),
        { kind: 'enquiry' },
      ]
    }

    const dynamicPages: Page[] = [{ kind: 'approach' }]
    let totalWorkPages = 0
    activeCollections.forEach(s => {
      let sectionWorks = works.filter(w => {
        if (s.theme) {
          const sMatch = normalizeTheme(s.theme)
          if (!w.themes.some(th => {
            const wMatch = normalizeTheme(th)
            return wMatch.includes(sMatch) || sMatch.includes(wMatch)
          })) return false
        }
        return Boolean(w.txtImageNameLink)
      })
      const orderIds = s.manual_work_order ?? []
      if (orderIds.length > 0) {
        const rank = new Map(orderIds.map((id, i) => [id, i]))
        sectionWorks = sectionWorks.slice().sort((a, b) => {
          const ai = rank.has(a.OeuvreID) ? rank.get(a.OeuvreID)! : Number.POSITIVE_INFINITY
          const bi = rank.has(b.OeuvreID) ? rank.get(b.OeuvreID)! : Number.POSITIVE_INFINITY
          return ai - bi
        })
      }
      if (sectionWorks.length === 0) return // skip empty collections entirely
      const cappedWorks = sectionWorks.slice(0, DISPLAY_CAP)
      dynamicPages.push({ kind: 'section_intro', section: s })
      cappedWorks.forEach((w, idx) => {
        dynamicPages.push({ kind: 'work', work: w, index: idx + 1, total: cappedWorks.length })
      })
      totalWorkPages += cappedWorks.length
    })
    dynamicPages.push({ kind: 'enquiry' })

    // If all collections matched zero works, fall back to flat mode
    if (totalWorkPages === 0) {
      return [
        { kind: 'approach' },
        ...featured.map((w, i) => ({ kind: 'work' as PageKind, work: w, index: i + 1, total: featured.length })),
        { kind: 'enquiry' },
      ]
    }

    return dynamicPages
  }, [featured, works, config.works_collections, config.sections])

  useEffect(() => {
    setPageIdx(i => Math.min(i, pages.length - 1))
  }, [pages.length])

  const cur  = pages[pageIdx] ?? pages[0]
  const prev = useCallback(() => setPageIdx(i => Math.max(0, i - 1)), [])
  const next = useCallback(() => setPageIdx(i => Math.min(pages.length - 1, i + 1)), [pages.length])

  const touchStartX = useRef<number | null>(null)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }, [])
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current == null) return
    const x = e.changedTouches[0]?.clientX
    if (x == null) return
    const dx = x - touchStartX.current
    const threshold = 56
    if (dx > threshold) prev()
    else if (dx < -threshold) next()
    touchStartX.current = null
  }, [prev, next])

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
  const edgeLight = cur.kind === 'approach' || cur.kind === 'enquiry' || cur.kind === 'section_intro'

  // Build pdfConfig from the current config shape
  const pdfConfig = {
    artist_name:      config.general.artist_name,
    contact_email:    config.general.contact_email,
    instagram:        config.general.instagram ?? '',
    phone:            config.general.phone ?? '',
    media_tagline_fr: config.general.media_tagline_fr,
    media_tagline_en: config.general.media_tagline_en,
    intro_fr:         config.about?.intro_fr ?? config.general.about_intro ?? '',
    intro_en:         config.about?.intro_en ?? '',
  }

  return (
    <>
      <style>{`
        html, body { height: 100%; overflow: hidden; }
        :root {
          --pf-bg: #edeae4; --pf-tx: #1a1a1a; --pf-tx2: #4a4a4a;
          --pf-tx3: #8a8a8a; --pf-ac: #c8a86e;
          --pf-bd: rgba(0,0,0,0.1); --pf-bd2: rgba(0,0,0,0.05);
        }
        @media print { body { display: none; } }
        .pf-serif { font-family: 'Instrument Serif', serif; }
        .pf-mono  { font-family: ui-monospace, monospace; }
        .hub-link:hover { opacity: 1 !important; color: #1a1a1a !important; }
        @keyframes pfPageTurn {
          from { opacity: 0.72; }
          to { opacity: 1; }
        }
        .pf-card-inner {
          animation: pfPageTurn 0.22s ease-out;
        }
        .pf-page-turn {
          transition: background 0.2s ease;
        }
        .pf-page-turn span { transition: opacity 0.2s ease; }
        .pf-page-turn--prev:hover {
          background: linear-gradient(to right, rgba(0,0,0,0.07), transparent 85%) !important;
        }
        .pf-page-turn--prev:hover span { opacity: 0.5 !important; }
        .pf-page-turn--next:hover {
          background: linear-gradient(to left, rgba(0,0,0,0.07), transparent 85%) !important;
        }
        .pf-page-turn--next:hover span { opacity: 0.5 !important; }
        .pf-page-turn--prev.pf-page-turn--on-dark:hover {
          background: linear-gradient(to right, rgba(255,255,255,0.09), transparent 88%) !important;
        }
        .pf-page-turn--next.pf-page-turn--on-dark:hover {
          background: linear-gradient(to left, rgba(255,255,255,0.09), transparent 88%) !important;
        }
      `}</style>

      <header className="pf-screen" style={{
        height: NAV_H, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 40px)',
        borderBottom: '1px solid var(--pf-bd)', background: 'var(--pf-bg)',
        position: 'relative', zIndex: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 22 }}>
          <Link href="/hub" style={{ textDecoration: 'none', color: 'var(--pf-tx)', fontSize: 8, opacity: 0.1, cursor: 'default' }}>.</Link>
          {config.general.artist_name ? (
            <div className="pf-serif" style={{ fontSize: 'clamp(14px, 2vw, 18px)', letterSpacing: '-0.01em', color: 'var(--pf-tx)', whiteSpace: 'nowrap' }}>
              {config.general.artist_name}
            </div>
          ) : null}
        </div>

        <nav style={{ display: 'flex', gap: 0 }}>
          {([
            ['approach', t('pub_approach_tab')] as const,
            ['works',    t('pub_works_tab')]    as const,
          ]).map(([s, label]) => {
            const targetIdx = s === 'approach' ? 0 : 1
            const isActive  = s === 'approach'
              ? pageIdx === 0
              : pageIdx > 0 && pageIdx < pages.length - 1
            return (
              <button key={s} onClick={() => setPageIdx(targetIdx)} style={{
                padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
                background: 'none', border: 'none',
                borderBottom: isActive ? '1px solid var(--pf-tx)' : '1px solid transparent',
                color: isActive ? 'var(--pf-tx)' : 'var(--pf-tx3)',
                cursor: 'pointer', fontSize: 'clamp(8px, 1.2vw, 9px)',
                letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'inherit',
                fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap',
              }}>{label}</button>
            )
          })}
          <button onClick={() => setPageIdx(pages.length - 1)} style={{
            padding: 'clamp(8px, 2vw, 14px) clamp(10px, 2vw, 24px)',
            background: 'none', border: 'none',
            borderBottom: pageIdx === pages.length - 1 ? '1px solid var(--pf-tx)' : '1px solid transparent',
            color: pageIdx === pages.length - 1 ? 'var(--pf-tx)' : 'var(--pf-tx3)',
            cursor: 'pointer', fontSize: 'clamp(8px, 1.2vw, 9px)',
            letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'inherit',
            fontWeight: pageIdx === pages.length - 1 ? 600 : 400, whiteSpace: 'nowrap',
          }}>{t('pub_enquiry')}</button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="pf-mono" style={{
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--pf-tx3)', background: 'none',
            border: '1px solid var(--pf-bd)', padding: '3px 8px',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
          }} aria-label="Switch language">
            {lang === 'fr' ? 'EN' : 'FR'}
          </button>
          <button onClick={() => setOrientation('portrait')} className="pf-mono" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: isPortrait ? 'var(--pf-tx)' : 'var(--pf-tx3)', fontSize: 14 }} title="Portrait">&#9647;</button>
          <button onClick={() => setOrientation('landscape')} className="pf-mono" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: !isPortrait ? 'var(--pf-tx)' : 'var(--pf-tx3)', fontSize: 14 }} title="Paysage">&#9645;</button>
          <div style={{ width: 1, height: 16, background: 'var(--pf-bd)', margin: '0 4px' }} />
          <button onClick={() => setShowPdfDrawer(true)} className="pf-mono" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 9, color: 'var(--pf-tx2)' }} title="Exporter PDF">PDF</button>
        </div>
      </header>

      <div className="pf-screen" style={{
        height: `calc(100dvh - ${NAV_H}px)`,
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 40px)', paddingBottom: '80px',
        background: 'var(--pf-bg)', overflow: 'hidden', position: 'relative',
      }}>
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            flex: '1 1 auto', minHeight: 0,
            aspectRatio: isPortrait ? '3/4' : '3/2',
            maxWidth: isPortrait ? '640px' : '1100px',
            width: '100%', maxHeight: '100%',
            background: '#fff', border: '1px solid var(--pf-bd)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.05)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
            touchAction: 'pan-y',
          }}
        >
          <div
            key={pageIdx}
            className="pf-card-inner"
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
          >
            <CardContent page={cur} isPortrait={isPortrait} config={config} lang={lang} t={t} />
          </div>
          {pageIdx > 0 && (
            <button
              type="button"
              className={`pf-page-turn pf-page-turn--prev${edgeLight ? '' : ' pf-page-turn--on-dark'}`}
              aria-label={lang === 'fr' ? 'Page précédente' : 'Previous page'}
              onClick={e => { e.stopPropagation(); prev() }}
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 'clamp(40px, 12vw, 96px)', zIndex: 45,
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                paddingLeft: 'clamp(6px, 1.5vw, 14px)',
              }}
            >
              <span style={{
                fontSize: 'clamp(18px, 4vw, 28px)',
                color: edgeLight ? 'var(--pf-tx)' : '#fff',
                opacity: edgeLight ? 0.14 : 0.35,
                textShadow: edgeLight ? 'none' : '0 2px 12px rgba(0,0,0,0.75)',
                lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
              }} aria-hidden>&#8249;</span>
            </button>
          )}
          {pageIdx < pages.length - 1 && (
            <button
              type="button"
              className={`pf-page-turn pf-page-turn--next${edgeLight ? '' : ' pf-page-turn--on-dark'}`}
              aria-label={lang === 'fr' ? 'Page suivante' : 'Next page'}
              onClick={e => { e.stopPropagation(); next() }}
              style={{
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: 'clamp(40px, 12vw, 96px)', zIndex: 45,
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 'clamp(6px, 1.5vw, 14px)',
              }}
            >
              <span style={{
                fontSize: 'clamp(18px, 4vw, 28px)',
                color: edgeLight ? 'var(--pf-tx)' : '#fff',
                opacity: edgeLight ? 0.14 : 0.35,
                textShadow: edgeLight ? 'none' : '0 2px 12px rgba(0,0,0,0.75)',
                lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
              }} aria-hidden>&#8250;</span>
            </button>
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 16, zIndex: 100
        }}>
          <button onClick={prev} disabled={pageIdx === 0} style={{
            background: 'var(--pf-bg)', border: '1px solid var(--pf-bd)', color: 'var(--pf-tx)',
            padding: '6px 14px', cursor: pageIdx === 0 ? 'default' : 'pointer',
            fontSize: 12, fontFamily: 'inherit', opacity: pageIdx === 0 ? 0.2 : 0.8,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>&#8592;</button>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {pages.length <= 20
              ? pages.map((p, i) => (
                <button key={i} onClick={() => setPageIdx(i)} style={{
                  width: p.kind === 'work' && i === pageIdx ? 16 : 5,
                  height: 5, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                  background: i === pageIdx ? 'var(--pf-ac)' : 'var(--pf-bd2)',
                  transition: 'width 0.2s, background 0.2s',
                }} />
              ))
              : <span className="pf-mono" style={{ fontSize: 8, color: 'var(--pf-tx3)', letterSpacing: 1 }}>
                  {pageIdx + 1} / {pages.length}
                </span>
            }
          </div>

          <button onClick={next} disabled={pageIdx === pages.length - 1} style={{
            background: 'var(--pf-bg)', border: '1px solid var(--pf-bd)', color: 'var(--pf-tx)',
            padding: '6px 14px', cursor: pageIdx === pages.length - 1 ? 'default' : 'pointer',
            fontSize: 12, fontFamily: 'inherit', opacity: pageIdx === pages.length - 1 ? 0.2 : 0.8,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}>&#8594;</button>
        </div>

        <Link href="/hub" style={{
          position: 'fixed', bottom: 32, right: 40,
          fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
          color: '#8a8680', textDecoration: 'none', opacity: 0.7,
          transition: 'all 0.3s', fontWeight: 600, zIndex: 1000
        }} className="hub-link">Hub</Link>
      </div>

      <PdfExportDrawer
        open={showPdfDrawer}
        onClose={() => setShowPdfDrawer(false)}
        works={works.filter(w => Boolean(w.txtImageNameLink)).map(w => ({
          OeuvreID:         w.OeuvreID,
          Titre:            w.Titre,
          Annee:            w.Annee,
          Hauteur:          w.Hauteur,
          Largeur:          w.Largeur,
          Profondeur:       w.Profondeur,
          txtImageNameLink: w.txtImageNameLink,
          techniqueName:    w.techniqueName,
          themes:           w.themes,
          statutId:         w.statutId,
        }))}
        worksCollections={config.works_collections}
        config={pdfConfig}
      />

    </>
  )
}

function CardContent({ page, isPortrait, config, lang, t }: {
  page: Page; isPortrait: boolean; config: PortfolioConfig; lang: Lang; t: TFn
}) {
  if (page.kind === 'section_intro' && page.section) {
    const s       = page.section
    const title   = stripRich(colTitle(s, lang))
    const descRaw = colDesc(s, lang)
    const desc    = descRaw ? stripRich(descRaw) : ''
    return (
      <div style={{
        position: 'absolute', inset: 0, background: 'var(--pf-bg)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}>
        <div style={{
          maxHeight: '20%',
          width: '100%',
          background: 'rgba(255,255,255,0.8)',
          color: 'var(--pf-tx)',
          padding: 'clamp(14px, 4vw, 28px)',
          boxSizing: 'border-box',
          overflow: 'auto',
          flexShrink: 0,
        }}>
          {title ? (
            <div className="pf-serif" style={{
              fontSize: 'clamp(16px, 2.8vw, 26px)',
              lineHeight: 1.2, marginBottom: desc ? 10 : 0, fontWeight: 600,
            }}>
              {title}
            </div>
          ) : null}
          {desc ? (
            <div className="pf-serif" style={{
              fontSize: 'clamp(11px, 1.5vw, 14px)', lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
            }}>
              {desc}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  if (page.kind === 'approach') {
    const introRaw = config.about
      ? pick(config.about.intro_fr, config.about.intro_en, lang)
      : (config.general.about_intro || '')
    const intro    = introRaw ? stripRich(introRaw) : ''
    const tagline  = pick(config.general.media_tagline_fr || '', config.general.media_tagline_en || '', lang)

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(20px,6%,64px) clamp(20px,7%,48px)', justifyContent: 'flex-start', overflowY: 'auto' }}>
        {(config.general.artist_name || tagline) ? (
          <div style={{ marginBottom: 'clamp(16px,5%,80px)' }}>
            {config.general.artist_name ? (
              <div className="pf-serif" style={{ fontSize: 'clamp(18px, 4vw, 40px)', letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--pf-tx)', marginBottom: 12 }}>
                {config.general.artist_name}
              </div>
            ) : null}
            {tagline ? (
              <div className="pf-mono" style={{ color: 'var(--pf-ac)', letterSpacing: 2, fontSize: 'clamp(7px, 1vw, 10px)', fontWeight: 600, textTransform: 'uppercase' }}>
                {tagline}
              </div>
            ) : null}
          </div>
        ) : null}
        {intro ? (
          <div className="pf-serif" style={{ fontSize: 'clamp(12px, 2vw, 22px)', lineHeight: 1.55, color: 'var(--pf-tx)', fontStyle: 'italic', maxWidth: '38ch' }}>
            {intro}
          </div>
        ) : null}
      </div>
    )
  }

  if (page.kind === 'work' && page.work) {
    const w   = page.work
    const src = imageUrl(w.txtImageNameLink)
    const yr  = yearOf(w.Annee)
    const dm  = dims(w)

    const metaLine = [yr, w.techniqueName, dm].filter(Boolean).join('  ·  ')

    return (
      <div style={{ position: 'absolute', inset: 0, background: '#1a1816', overflow: 'hidden' }}>
        {w.txtImageNameLink && (
          <WorkThumb
            file={w.txtImageNameLink} alt={w.Titre ?? ''}
            size={1200}
            style={{ objectPosition: 'center center' }}
          />
        )}

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          maxHeight: '20%',
          background: 'rgba(255,255,255,0.8)',
          color: 'var(--pf-tx)',
          padding: 'clamp(12px, 3vw, 22px)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6,
        }}>
          {w.Titre ? (
            <div className="pf-serif" style={{
              fontSize: 'clamp(14px, 2.4vw, 22px)',
              lineHeight: 1.25,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
              fontWeight: 600,
            }}>
              {w.Titre}
            </div>
          ) : null}
          {metaLine ? (
            <div className="pf-mono" style={{
              fontSize: 10, color: 'var(--pf-tx2)',
              letterSpacing: 0.4, lineHeight: 1.45,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {metaLine}
            </div>
          ) : null}
        </div>

        {page.total && page.total > 1 ? (
          <div className="pf-mono" style={{
            position: 'absolute', top: 14, right: 16,
            fontSize: 8, color: 'rgba(255,255,255,0.85)', letterSpacing: 1,
            background: 'rgba(0,0,0,0.35)', padding: '4px 8px', borderRadius: 4,
          }}>
            {page.index} / {page.total}
          </div>
        ) : null}
      </div>
    )
  }

  if (page.kind === 'enquiry') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(20px,6%,64px) clamp(20px,7%,48px)', justifyContent: 'flex-start', overflowY: 'auto' }}>
        <div className="pf-mono" style={{ marginBottom: 'clamp(16px,4%,40px)', letterSpacing: 3, textTransform: 'uppercase', fontSize: 10, color: 'var(--pf-ac)', fontWeight: 600 }}>
          {t('pub_enquiry')}
        </div>
        <InquiryForm contactEmail={config.general.contact_email} lang={lang} t={t} />
        {config.general.artist_name ? (
          <div className="pf-mono" style={{ marginTop: 'auto', fontSize: 8, opacity: 0.35, letterSpacing: 0.5 }}>
            © {new Date().getFullYear()} {config.general.artist_name}
          </div>
        ) : null}
      </div>
    )
  }

  return null
}


function InquiryForm({ contactEmail, lang, t }: { contactEmail?: string; lang: Lang; t: TFn }) {
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [form,    setForm]    = useState({ name: '', email: '', message: '' })
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
        {t('pub_thank_you')}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 450 }}>
      <div>
        <label className="pf-mono" style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pf-tx3)', marginBottom: 4, display: 'block' }}>{t('pub_full_name')}</label>
        <input placeholder={lang === 'fr' ? 'Jean Dupont' : 'Jane Smith'} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--pf-bd)', padding: '10px 0', fontSize: 14, color: 'var(--pf-tx)', outline: 'none' }} />
      </div>
      <div>
        <label className="pf-mono" style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pf-tx3)', marginBottom: 4, display: 'block' }}>{t('pub_email')}</label>
        <input type="email" placeholder={lang === 'fr' ? 'jean@exemple.com' : 'jane@example.com'} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--pf-bd)', padding: '10px 0', fontSize: 14, color: 'var(--pf-tx)', outline: 'none' }} />
      </div>
      <div>
        <label className="pf-mono" style={{ fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--pf-tx3)', marginBottom: 4, display: 'block' }}>{t('pub_message')}</label>
        <textarea placeholder={t('pub_your_enquiry')} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} required rows={4}
          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--pf-bd)', padding: '10px 0', fontSize: 14, color: 'var(--pf-tx)', outline: 'none', resize: 'none', lineHeight: 1.6 }} />
      </div>
      <button type="submit" disabled={loading} className="pf-mono" style={{
        marginTop: 8, padding: '10px 24px', width: 'fit-content',
        background: 'none', border: '1px solid var(--pf-ac)', color: 'var(--pf-ac)',
        fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer'
      }}>
        {loading ? t('pub_sending') : t('pub_send')}
      </button>
    </form>
  )
}
