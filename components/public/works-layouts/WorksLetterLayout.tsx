'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf } from '@/lib/data'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import type { Work, WorksMode } from '@/components/public/works-utils'
import { richTextToPlain } from '@/components/public/works-utils'

interface Props {
  works: Work[]
  mode: WorksMode
  siteTheme: PublicSiteTheme
  hiddenNavRoutes?: string[]
  navOrder?: string[]
}

/**
 * Letter / zine — paginated reader. One work per page, large image on top,
 * caption + year below. Arrow keys / on-screen buttons turn the page.
 * Slower, more contemplative than the carousel.
 */
export default function WorksLetterLayout({ works, mode, siteTheme, hiddenNavRoutes, navOrder }: Props) {
  const { t, lang } = useI18n()
  const visible = useMemo(() => works.filter(w => w.txtImageNameLink), [works])
  const [page, setPage] = useState(0)
  const max = Math.max(0, visible.length - 1)

  const go = useCallback((delta: number) => {
    setPage(p => Math.max(0, Math.min(p + delta, max)))
  }, [max])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(1); e.preventDefault() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const current = visible[page]
  const outro = lang === 'en' ? (mode.outro_en || mode.outro_fr || '') : (mode.outro_fr || mode.outro_en || '')
  const outroPlain = outro ? richTextToPlain(outro) : ''

  return (
    <>
      <style>{`
        .w-letter-wrap {
          min-height: 100vh;
          background: ${siteTheme.backgroundCss};
          padding: clamp(80px, 10vh, 120px) clamp(16px, 4vw, 64px) 80px;
        }
        .w-letter-page {
          max-width: 760px; margin: 0 auto;
          display: flex; flex-direction: column; align-items: center;
          gap: 24px;
        }
        .w-letter-img {
          max-width: 100%; max-height: 64vh;
          display: block; object-fit: contain;
          filter: drop-shadow(0 18px 28px rgba(15,15,20,0.32))
                  drop-shadow(0 6px 10px rgba(15,15,20,0.20));
        }
        .w-letter-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(22px, 3vw, 32px);
          color: ${siteTheme.bodyText};
          margin: 0; text-align: center; letter-spacing: 0.01em;
        }
        .w-letter-meta {
          font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText}; opacity: 0.75;
        }
        .w-letter-outro {
          margin-top: 32px; max-width: 560px;
          font-family: 'Instrument Serif', serif;
          font-size: 14px; color: ${siteTheme.bodyMutedText};
          line-height: 1.7; text-align: center;
        }
        .w-letter-nav {
          margin-top: 40px;
          display: flex; align-items: center; gap: 24px;
          font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase;
          color: ${siteTheme.bodyMutedText};
        }
        .w-letter-arrow {
          background: none; border: 1px solid ${siteTheme.bodyMutedText};
          color: ${siteTheme.bodyText};
          width: 44px; height: 44px; border-radius: 50%;
          font-size: 16px; cursor: pointer; transition: opacity 0.15s;
        }
        .w-letter-arrow[disabled] { opacity: 0.3; cursor: default; }
      `}</style>
      <main className="w-letter-wrap" aria-label={t('pub_works')}>
        {current && (
          <article className="w-letter-page" key={current.OeuvreID}>
            <img
              src={imageUrl(current.txtImageNameLink) ?? ''}
              alt={current.Titre ?? ''}
              className="w-letter-img"
              draggable={false}
            />
            <h2 className="w-letter-title">{current.Titre ?? t('pub_untitled')}</h2>
            <div className="w-letter-meta">
              {[yearOf(current.Annee), current.Hauteur && current.Largeur ? `${current.Hauteur} × ${current.Largeur} cm` : null]
                .filter(Boolean).join(' · ')}
            </div>
            <div className="w-letter-nav">
              <button type="button" className="w-letter-arrow" onClick={() => go(-1)} disabled={page === 0} aria-label="←">←</button>
              <span>{page + 1} / {visible.length}</span>
              <button type="button" className="w-letter-arrow" onClick={() => go(1)} disabled={page === max} aria-label="→">→</button>
            </div>
            {page === max && outroPlain && (
              <div className="w-letter-outro">{outroPlain}</div>
            )}
          </article>
        )}
      </main>
    </>
  )
}
