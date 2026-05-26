'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { sanitizePortfolioRichHtml } from '@/lib/portfolio-html-sanitize'
import type { PublicSiteTheme } from '@/lib/public-site-theme'
import { richTextToPlain } from './works-utils'

const TEASER_CHARS = 220
const COLLAPSE_PLAIN_MIN = 160

type WorksSectionTextCardProps = {
  html: string
  title?: string
  /** `grid` = works grid card; `carousel` = 3D text slide; `prose` = practice/about body */
  variant?: 'grid' | 'carousel' | 'prose'
  siteTheme?: PublicSiteTheme
}

export function WorksSectionTextCard({
  html,
  title,
  variant = 'grid',
  siteTheme,
}: WorksSectionTextCardProps) {
  const { t } = useI18n()
  const plain = useMemo(() => richTextToPlain(html), [html])
  const safeHtml = useMemo(() => {
    const s = sanitizePortfolioRichHtml(html)
    return s.replace(/\n/g, '<br>')
  }, [html])
  const needsCollapse = plain.length > COLLAPSE_PLAIN_MIN
  const [expanded, setExpanded] = useState(!needsCollapse)

  if (!plain) return null

  const teaser = plain.length > TEASER_CHARS
    ? `${plain.slice(0, TEASER_CHARS).trim()}…`
    : plain

  const rootClass =
    variant === 'carousel' ? 'wstc wstc-carousel'
      : variant === 'prose' ? 'wstc wstc-prose'
        : 'wstc wstc-grid'
  const muted = siteTheme?.bodyMutedText ?? '#5a5652'
  const chrome = siteTheme?.chromeBorder ?? 'rgba(0,0,0,0.08)'
  const body = siteTheme?.bodyText ?? '#1a1816'
  const ariaKey = variant === 'prose' ? 'pub_practice_statement_aria' : 'pub_works_text_card_aria'
  const hintKey = variant === 'prose' ? 'pub_practice_text_preview_hint' : 'pub_works_text_preview_hint'

  return (
    <>
      <style>{`
        .wstc-grid {
          width: 100%;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 4px;
          background: rgba(255,255,255,0.38);
          padding: clamp(16px, 3vw, 28px);
          text-align: left;
        }
        .wstc-carousel {
          width: 100%;
          text-align: center;
        }
        .wstc-title {
          font-family: 'Instrument Serif', serif;
          font-size: clamp(14px, 2vw, 22px);
          color: #1a1816;
          font-weight: 400;
          letter-spacing: -0.01em;
          line-height: 1.2;
          margin: 0 0 12px 0;
        }
        .wstc-carousel .wstc-title { text-align: center; }
        .wstc-prose {
          width: 100%;
          max-width: 64ch;
          text-align: left;
        }
        .wstc-prose .wstc-title {
          font-size: clamp(12px, 1.6vw, 13px);
          font-family: inherit;
          color: ${muted};
          margin-bottom: 16px;
        }
        .wstc-prose .wstc-teaser,
        .wstc-prose .wstc-body {
          font-size: clamp(12px, 1.6vw, 13px);
          line-height: 2.1;
          color: ${muted};
        }
        .wstc-prose .wstc-body p + p { margin-top: 1.6em; }
        .wstc-prose .wstc-hint { color: ${muted}; opacity: 0.65; }
        .wstc-prose .wstc-toggle {
          color: ${muted};
          border-bottom-color: ${chrome};
        }
        .wstc-prose .wstc-toggle:hover { color: ${body}; }
        .wstc-teaser {
          font-size: clamp(10px, 1.2vw, 13px);
          line-height: 1.7;
          color: #5a5652;
          margin: 0 0 12px 0;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 5;
          overflow: hidden;
        }
        .wstc-body {
          font-size: clamp(10px, 1.2vw, 13px);
          line-height: 1.75;
          color: #5a5652;
          margin: 0;
          text-align: left;
          max-height: min(62vh, 480px);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .wstc-carousel .wstc-body { text-align: left; }
        .wstc-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          margin-top: 4px;
          padding: 8px 4px;
          font-size: 9px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #7a7570;
          background: none;
          border: none;
          border-bottom: 1px solid rgba(26,24,22,0.25);
          cursor: pointer;
          font-family: inherit;
        }
        .wstc-toggle:hover { color: #1a1816; }
        .wstc-hint {
          font-size: 8px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #9a9690;
          margin: 0 0 8px 0;
        }
      `}</style>
      <article className={rootClass} aria-label={t(ariaKey)}>
        {title && <h3 className="wstc-title">{title}</h3>}
        {!expanded && needsCollapse ? (
          <>
            <p className="wstc-hint">{t(hintKey)}</p>
            <p className="wstc-teaser">{teaser}</p>
            <button
              type="button"
              className="wstc-toggle"
              onClick={() => setExpanded(true)}
            >
              {t('pub_works_text_expand')}
            </button>
          </>
        ) : (
          <>
            <div
              className="wstc-body"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
            {needsCollapse && (
              <button
                type="button"
                className="wstc-toggle"
                onClick={() => setExpanded(false)}
              >
                {t('pub_works_text_collapse')}
              </button>
            )}
          </>
        )}
      </article>
    </>
  )
}
