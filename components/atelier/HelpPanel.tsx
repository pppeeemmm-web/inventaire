'use client'

// « ? » help panel (Pem GO 2026-11-18): opens over the current screen (you keep your place) on the Aide chapter
// for that screen (`lib/aide/screen-map.ts`), with a search across every chapter, the full Aide and the PDF.
// Loaded only when opened (next/dynamic in TeamPortalClient): the chapters' text never weighs on first paint.

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useI18n } from '@/lib/i18n/context'
import { aideChapters } from '@/lib/aide/guides'
import { aidePlainText } from '@/lib/aide/markdown'
import { aideChapterForPath } from '@/lib/aide/screen-map'
import type { AideGuideId } from '@/lib/aide/types'
import { AideMarkdown } from '@/app/atelier/(portal)/aide/_components/AideMarkdown'

type Pick = { guide: AideGuideId; ch: string }

/** Lower case, accents off: « Œuvre » finds « oeuvre ». */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').toLowerCase()
}

/** `onNavigate`: the Atelier's guarded navigation (unsaved-changes dialog) — every link in the panel goes through it. */
export function HelpPanel({
  pathname,
  isAdmin,
  onClose,
  onNavigate,
}: {
  pathname: string
  isAdmin: boolean
  onClose: () => void
  onNavigate: (href: string) => void
}) {
  const { t, lang } = useI18n()
  const forScreen = useMemo(() => aideChapterForPath(pathname, isAdmin), [pathname, isAdmin])
  const [pick, setPick] = useState<Pick>(forScreen)
  const [query, setQuery] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)

  const all = useMemo(() => {
    const guides: AideGuideId[] = isAdmin ? ['team', 'admin'] : ['team']
    return guides.flatMap((g) => aideChapters(g, lang).map((c) => ({ guide: g, chapter: c, text: fold(`${c.title} ${aidePlainText(c.md)}`) })))
  }, [isAdmin, lang])

  const current = all.find((x) => x.guide === pick.guide && x.chapter.id === pick.ch) ?? all[0]
  const q = fold(query.trim())
  const hits = q ? all.filter((x) => x.text.includes(q)) : []

  // Escape through the shared stack: the topmost overlay closes first (a modal under the panel stays open).
  useEscapeClose(true, onClose)

  /** Leave the panel for another screen: close it, then navigate through the unsaved-changes guard. */
  const go = (href: string) => {
    onClose()
    onNavigate(href)
  }

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [pick])

  const choose = (p: Pick) => {
    setPick(p)
    setQuery('')
  }

  const guideLabel = (g: AideGuideId) => t(g === 'admin' ? 'aide_guide_admin' : 'aide_guide_team')
  const fullHref = `/atelier/aide?${current.guide === 'admin' ? 'g=admin&' : ''}ch=${current.chapter.id}`

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.25)' }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('aide_help_title')}
        data-testid="help-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)',
          background: 'var(--bg0)', borderLeft: '1px solid var(--bd)', display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.12)',
        }}
      >
        <div className="row" style={{ alignItems: 'center', gap: 8, padding: '14px 16px 10px', borderBottom: '1px solid var(--bd)' }}>
          <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0, flex: 1, color: 'var(--tx)' }}>{t('aide_help_title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('aide_help_close')} data-testid="help-panel-close" className="btn ghost sm" style={{ minWidth: 44, minHeight: 44 }}>
            ✕
          </button>
        </div>
        <div style={{ padding: '10px 16px' }}>
          <input
            className="input"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('aide_help_search')}
            aria-label={t('aide_help_search')}
            data-testid="help-panel-search"
            style={{ width: '100%' }}
          />
        </div>

        <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 20px 20px' }}>
          {q ? (
            hits.length ? (
              <ul data-testid="help-panel-hits" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {hits.map((h) => (
                  <li key={`${h.guide}-${h.chapter.id}`}>
                    <button
                      type="button"
                      onClick={() => choose({ guide: h.guide, ch: h.chapter.id })}
                      style={{ width: '100%', minHeight: 44, textAlign: 'left', background: 'none', border: 0, borderBottom: '1px solid var(--bd)', padding: '8px 0', cursor: 'pointer', color: 'var(--tx)', fontSize: 14 }}
                    >
                      {h.chapter.title}
                      {h.guide === 'admin' ? <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--tx3)' }}>{guideLabel('admin')}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--tx3)' }}>{t('aide_help_no_match').replace('{q}', query.trim())}</p>
            )
          ) : (
            <>
              {current.guide === forScreen.guide && current.chapter.id === forScreen.ch ? (
                <div className="t-eyebrow" style={{ color: 'var(--ac)', marginTop: 6 }}>{t('aide_help_for_screen')}</div>
              ) : null}
              <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, color: 'var(--tx)', margin: '4px 0 2px' }}>{current.chapter.title}</h3>
              {current.guide === 'admin' ? <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{guideLabel('admin')}</div> : null}
              <AideMarkdown md={current.chapter.md} onNavigate={go} />
              <div className="t-eyebrow" style={{ color: 'var(--tx3)', margin: '28px 0 6px' }}>{t('aide_help_all')}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {all.map((x) => (
                  <li key={`${x.guide}-${x.chapter.id}`}>
                    <button
                      type="button"
                      className={x === current ? 'btn primary sm' : 'btn ghost sm'}
                      onClick={() => choose({ guide: x.guide, ch: x.chapter.id })}
                      style={{ minHeight: 36 }}
                    >
                      {x.chapter.title}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', padding: '10px 16px max(12px, env(safe-area-inset-bottom))', borderTop: '1px solid var(--bd)' }}>
          <a
            href={fullHref}
            onClick={(e: MouseEvent<HTMLAnchorElement>) => {
              e.preventDefault()
              go(fullHref)
            }}
            className="btn ghost sm"
            data-testid="help-panel-full"
            style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            {t('aide_help_open_full')}
          </a>
          <a href={`/atelier/aide/guide.pdf?g=${current.guide}&lang=${lang}`} download className="btn ghost sm" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            {t('aide_pdf_download')}
          </a>
        </div>
      </aside>
    </div>
  )
}
