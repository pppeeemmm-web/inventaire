'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl, imageUrl, yearOf } from '@/lib/data'
import { worksForCollection } from './works-utils'
import type { Work, WorksMode } from './works-utils'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import { publicSiteBaseCss } from '@/lib/public-site-theme'

const GRID_ZOOM_RATIO = 1.5

/** Size full-res lightbox image to ~1.5× grid thumb layout (real pixels, not CSS scale). */
function lightboxDisplaySize(
  naturalW: number,
  naturalH: number,
  thumbW: number,
  thumbH: number,
): { w: number; h: number } {
  const targetW = thumbW * GRID_ZOOM_RATIO
  const targetH = thumbH * GRID_ZOOM_RATIO
  const maxW = typeof window !== 'undefined' ? window.innerWidth * 0.9 : 900
  const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 720
  const scale = Math.min(
    targetW / naturalW,
    targetH / naturalH,
    maxW / naturalW,
    maxH / naturalH,
    1,
  )
  return {
    w: Math.max(1, Math.round(naturalW * scale)),
    h: Math.max(1, Math.round(naturalH * scale)),
  }
}

interface WorksGridProps {
  works: Work[]
  mode: WorksMode
  activeChapterIdx: number
  onChapterChange: (idx: number) => void
  siteTheme: PublicSiteTheme
}

export default function WorksGrid({
  works, mode, activeChapterIdx, onChapterChange, siteTheme,
}: WorksGridProps) {
  const { t, lang } = useI18n()
  const [lightbox, setLightbox] = useState<Work | null>(null)
  const [thumbLayout, setThumbLayout] = useState<Record<number, { w: number; h: number }>>({})
  const [lbDisplay, setLbDisplay] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    setLbDisplay(null)
  }, [lightbox?.OeuvreID])

  const chapter = mode.collections[Math.min(activeChapterIdx, Math.max(0, mode.collections.length - 1))]
  const chapterWorks = useMemo(() => {
    if (!chapter) return works.filter(w => w.txtImageNameLink)
    return worksForCollection(chapter, works)
  }, [chapter, works])

  const chapterTitle = chapter
    ? (lang === 'en' ? (chapter.title_en || chapter.title_fr) : (chapter.title_fr || chapter.title_en))
    : ''
  const chapterIntro = chapter
    ? (lang === 'en' ? (chapter.intro_en || chapter.intro_fr || '') : (chapter.intro_fr || chapter.intro_en || ''))
    : ''
  const chapterDesc = chapter
    ? (lang === 'en' ? (chapter.description_en || chapter.description_fr || '') : (chapter.description_fr || chapter.description_en || ''))
    : ''

  const closeLightbox = useCallback(() => setLightbox(null), [])

  return (
    <>
      <style>{`
        ${publicSiteBaseCss(siteTheme)}
        html, body { overflow: auto !important; height: auto !important; }
        .wg-body {
          min-height: 100vh;
          background: ${siteTheme.backgroundCss};
          padding: clamp(24px, 5vw, 48px) clamp(16px, 4vw, 40px) clamp(60px, 10vw, 120px);
        }

        .wg-header { max-width: 1400px; margin: 0 auto clamp(28px, 4vw, 48px); text-align: center; }
        .wg-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(20px, 3vw, 36px); font-weight: 400;
          color: #3a3834; line-height: 1.2; letter-spacing: -0.01em;
          margin: 0 0 8px;
        }
        .wg-intro {
          font-size: clamp(9px, 1.2vw, 11px); letter-spacing: 2px; text-transform: uppercase;
          color: #9a9690; margin: 0;
        }

        .wg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: clamp(20px, 3vw, 36px);
          max-width: 1400px;
          margin: 0 auto;
          align-items: start;
          justify-items: center;
        }

        .wg-cell {
          cursor: pointer;
          background: transparent;
          border: none;
          padding: 0;
          max-width: 100%;
        }
        .wg-figure {
          margin: 0 auto;
          display: table;
          max-width: 100%;
          border-collapse: collapse;
        }
        .wg-cell-img {
          display: block;
          max-width: 100%;
          width: auto;
          height: auto;
          max-height: min(52vh, 480px);
          object-fit: contain;
          transition: filter 0.2s ease;
        }
        .wg-cell:hover .wg-cell-img {
          filter: drop-shadow(0 10px 20px rgba(0,0,0,0.14))
                  drop-shadow(0 2px 6px rgba(0,0,0,0.08));
        }
        .wg-cell-img.round { border-radius: 50%; }

        .wg-cell-info {
          display: table-caption;
          caption-side: bottom;
          padding: 10px 0 0;
          text-align: center;
          width: 100%;
        }
        .wg-cell-title {
          font-family: 'Instrument Serif', serif;
          font-size: 13px; font-weight: 400;
          color: #3a3834; line-height: 1.35;
          margin: 0 0 3px;
          word-wrap: break-word;
          overflow-wrap: anywhere;
        }
        .wg-cell-year {
          font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
          color: #9a9690; margin: 0;
        }

        .wg-outro {
          max-width: 720px; margin: clamp(40px, 6vw, 72px) auto 0;
          font-size: clamp(11px, 1.4vw, 13px); line-height: 1.8; color: #7a7670;
          text-align: center;
        }

        .wg-pills {
          position: sticky; bottom: 0; z-index: 50;
          display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;
          padding: 12px 16px max(12px, env(safe-area-inset-bottom));
          background: rgba(237,234,228,0.92); backdrop-filter: blur(8px);
          border-top: 1px solid #dedad4;
        }
        .wg-pill {
          font-size: clamp(8px, 1vw, 9px);
          letter-spacing: 2px; text-transform: uppercase;
          color: #7a7570; background: none; border: none;
          border-bottom: 1px solid transparent;
          padding: 8px 4px; min-height: 44px;
          cursor: pointer; font-family: inherit;
          max-width: min(42vw, 220px);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.2s, border-color 0.2s;
        }
        .wg-pill:hover { color: #1a1816; }
        .wg-pill.active { color: #1a1816; border-bottom-color: rgba(26,24,22,0.5); }

        /* Lightbox */
        .wg-lb-overlay {
          position: fixed; inset: 0; z-index: 500;
          background: rgba(20,18,16,0.85);
          display: flex; align-items: center; justify-content: center;
          padding: clamp(16px, 4vw, 40px);
          animation: wgFadeIn 0.25s ease;
        }
        @keyframes wgFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .wg-lb-content {
          position: relative;
          display: flex; flex-direction: column; align-items: center;
          gap: 16px;
        }
        .wg-lb-img {
          display: block;
          width: auto;
          height: auto;
          max-width: 90vw;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 2px;
          image-rendering: auto;
        }
        .wg-lb-img.round { border-radius: 50%; }
        .wg-lb-meta { text-align: center; color: #c8c4be; }
        .wg-lb-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(14px, 2vw, 20px); font-weight: 400;
          color: #edeae4; margin: 0 0 4px;
        }
        .wg-lb-details {
          font-size: 9px; letter-spacing: 2px; text-transform: uppercase;
          color: #9a9690; display: flex; gap: 12px; justify-content: center;
        }

        .wg-lb-close {
          position: fixed; top: 16px; right: 16px; z-index: 510;
          width: 48px; height: 48px; min-width: 44px; min-height: 44px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2);
          border-radius: 50%; font-size: 22px; color: #edeae4;
          cursor: pointer; transition: background 0.15s;
        }
        .wg-lb-close:hover { background: rgba(255,255,255,0.3); }

        .wg-empty {
          text-align: center; padding: 80px 20px;
          font-size: 12px; letter-spacing: 0.08em; color: #9a9690;
        }

        @media (max-width: 599px) {
          .wg-grid { grid-template-columns: 1fr; }
        }
        @media (min-width: 600px) and (max-width: 1023px) {
          .wg-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) and (max-width: 1399px) {
          .wg-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1400px) {
          .wg-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>

      <div className="wg-body pem-grain">
        {chapterTitle && (
          <div className="wg-header">
            <h2 className="wg-title">{chapterTitle}</h2>
            {chapterIntro && <p className="wg-intro">{chapterIntro}</p>}
          </div>
        )}

        {chapterWorks.length === 0 ? (
          <div className="wg-empty" role="status">{t('pub_works_groups_nomatch')}</div>
        ) : (
          <div className="wg-grid" role="list" aria-label={t('pub_works')}>
            {chapterWorks.map((w) => (
              <div
                key={w.OeuvreID}
                className="wg-cell"
                role="listitem"
                onClick={() => setLightbox(w)}
              >
                <figure className="wg-figure">
                  <img
                    src={thumbUrl(w.txtImageNameLink) ?? undefined}
                    alt={w.Titre ?? ''}
                    className={`wg-cell-img${w.isRound ? ' round' : ''}`}
                    loading="lazy"
                    draggable={false}
                    onLoad={(e) => {
                      const el = e.currentTarget
                      if (el.offsetWidth < 1 || el.offsetHeight < 1) return
                      setThumbLayout((prev) => {
                        const next = { w: el.offsetWidth, h: el.offsetHeight }
                        const cur = prev[w.OeuvreID]
                        if (cur?.w === next.w && cur?.h === next.h) return prev
                        return { ...prev, [w.OeuvreID]: next }
                      })
                    }}
                  />
                  <figcaption className="wg-cell-info">
                    <p className="wg-cell-title">{w.Titre ?? t('pub_untitled')}</p>
                    {yearOf(w.Annee) && <p className="wg-cell-year">{yearOf(w.Annee)}</p>}
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        )}

        {chapterDesc && (
          <div className="wg-outro" dangerouslySetInnerHTML={{ __html: chapterDesc.replace(/\n/g, '<br>') }} />
        )}
      </div>

      {mode.collections.length > 1 && (
        <div className="wg-pills">
          {mode.collections.map((c, idx) => {
            const label = lang === 'en' ? (c.title_en || c.title_fr) : (c.title_fr || c.title_en)
            return (
              <button
                key={`pill-${c.id || idx}`}
                type="button"
                className={`wg-pill${idx === activeChapterIdx ? ' active' : ''}`}
                onClick={() => onChapterChange(idx)}
              >
                {label || '—'}
              </button>
            )
          })}
        </div>
      )}

      {lightbox && (
        <div className="wg-lb-overlay" onClick={closeLightbox}>
          <button
            type="button"
            className="wg-lb-close"
            aria-label={t('pub_works_zoom_close_aria')}
            onClick={closeLightbox}
          >×</button>
          <div className="wg-lb-content" onClick={e => e.stopPropagation()}>
            <img
              src={imageUrl(lightbox.txtImageNameLink) ?? undefined}
              alt={lightbox.Titre ?? ''}
              className={`wg-lb-img${lightbox.isRound ? ' round' : ''}`}
              width={lbDisplay?.w}
              height={lbDisplay?.h}
              style={lbDisplay ? { width: lbDisplay.w, height: lbDisplay.h } : undefined}
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth < 1 || el.naturalHeight < 1) return
                const thumb = thumbLayout[lightbox.OeuvreID]
                const size = lightboxDisplaySize(
                  el.naturalWidth,
                  el.naturalHeight,
                  thumb?.w ?? 280,
                  thumb?.h ?? 210,
                )
                setLbDisplay(size)
              }}
            />
            <div className="wg-lb-meta">
              <p className="wg-lb-title">{lightbox.Titre ?? t('pub_untitled')}</p>
              <div className="wg-lb-details">
                {yearOf(lightbox.Annee) && <span>{yearOf(lightbox.Annee)}</span>}
                {lightbox.Hauteur && lightbox.Largeur && (
                  <span>
                    {Number(lightbox.Hauteur).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                    {' × '}
                    {Number(lightbox.Largeur).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR')}
                    {' cm'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
