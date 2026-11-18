'use client'

// In-app Aide (owner GO 2026-11-18): the team guide (everyone signed in) and, once written, the admin guide
// (admins only). Chapters: `lib/aide/*`. `?ch=<id>` opens a chapter, `?g=admin` the admin guide.
// Desktop: contents on the left, the chapter on the right. Phone: the contents, then one chapter at a time.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { aideChapters, aideGuidesFor } from '@/lib/aide/guides'
import type { AideGuideId } from '@/lib/aide/types'
import { AideMarkdown } from './AideMarkdown'

function syncUrl(guide: AideGuideId, ch: string | null) {
  const qs = new URLSearchParams()
  if (guide !== 'team') qs.set('g', guide)
  if (ch) qs.set('ch', ch)
  const s = qs.toString()
  window.history.replaceState(window.history.state, '', `/atelier/aide${s ? `?${s}` : ''}`)
}

export function Aide({ isAdmin }: { isAdmin: boolean }) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const params = useSearchParams()
  const guides = aideGuidesFor(isAdmin)
  const [guide, setGuide] = useState<AideGuideId>(() => {
    const g = params.get('g')
    return g === 'admin' && guides.includes('admin') ? 'admin' : 'team'
  })
  const chapters = aideChapters(guide, lang)
  const [chId, setChId] = useState<string | null>(() => params.get('ch'))
  const index = chapters.findIndex((c) => c.id === chId)
  // Desktop always shows a chapter (the first by default); the phone shows the contents until one is picked.
  const shown = index >= 0 ? index : narrow ? -1 : 0
  const chapter = shown >= 0 ? chapters[shown] : null
  const bodyRef = useRef<HTMLDivElement>(null)

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    [lang],
  )

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [chapter?.id, guide])

  // A new ?ch= / ?g= while the Aide is already open (the « ? » panel, the phone « Aide pour cet écran »).
  const urlCh = params.get('ch')
  const urlG = params.get('g')
  useEffect(() => {
    if (urlG === 'admin' && guides.includes('admin')) setGuide('admin')
    else if (urlG == null) setGuide('team')
    if (urlCh) setChId(urlCh)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follow the URL only
  }, [urlCh, urlG])

  function open(id: string | null) {
    setChId(id)
    syncUrl(guide, id)
  }

  function pickGuide(g: AideGuideId) {
    setGuide(g)
    setChId(null)
    syncUrl(g, null)
  }

  const guideSwitch =
    guides.length > 1 ? (
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {guides.map((g) => (
          <button
            key={g}
            type="button"
            className={g === guide ? 'btn primary sm' : 'btn ghost sm'}
            style={{ minHeight: narrow ? 44 : undefined }}
            onClick={() => pickGuide(g)}
            aria-pressed={g === guide}
          >
            {t(g === 'admin' ? 'aide_guide_admin' : 'aide_guide_team')}
          </button>
        ))}
      </div>
    ) : null

  // The whole guide as a PDF, built on demand from these chapters (route `aide/guide.pdf`; admin guide: admins only).
  const pdfLink = (
    <a
      href={`/atelier/aide/guide.pdf?g=${guide}&lang=${lang}`}
      download
      className="btn ghost sm"
      data-testid="aide-pdf"
      style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', marginTop: 16, textDecoration: 'none' }}
    >
      {t('aide_pdf_download')}
    </a>
  )

  const contents = (
    <nav aria-label={t('aide_contents')}>
      <div className="t-eyebrow" style={{ marginBottom: 8, color: 'var(--tx3)' }}>{t('aide_contents')}</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {chapters.map((c, i) => {
          const active = i === shown
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                aria-current={active ? 'page' : undefined}
                style={{
                  width: '100%',
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 10px',
                  textAlign: 'left',
                  background: active ? 'var(--bg2)' : 'transparent',
                  border: 'none',
                  borderLeft: `2px solid ${active ? 'var(--ac)' : 'transparent'}`,
                  borderRadius: 0,
                  color: active ? 'var(--tx)' : 'var(--tx2)',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <span className="t-mono-sm" style={{ color: 'var(--tx3)', minWidth: 18 }}>{i + 1}</span>
                <span>{c.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )

  const article = chapter ? (
    <article style={{ maxWidth: 720 }}>
      {narrow ? (
        <button type="button" className="btn ghost sm" style={{ minHeight: 44, marginBottom: 8, paddingLeft: 0 }} onClick={() => open(null)}>
          {t('aide_back')}
        </button>
      ) : null}
      <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
        {shown + 1} / {chapters.length}
      </div>
      <h1 className="serif" style={{ fontSize: narrow ? 26 : 32, fontWeight: 400, color: 'var(--tx)', margin: '4px 0 2px' }}>{chapter.title}</h1>
      <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8 }}>
        {t('aide_verified').replace('{d}', dateFmt.format(new Date(`${chapter.verified}T12:00:00`)))}
      </div>
      <AideMarkdown md={chapter.md} />
      <div className="row between" style={{ gap: 8, marginTop: 28, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
        {shown > 0 ? (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => open(chapters[shown - 1].id)}>
            {t('aide_prev')}
          </button>
        ) : <span />}
        {shown < chapters.length - 1 ? (
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => open(chapters[shown + 1].id)}>
            {t('aide_next')}
          </button>
        ) : null}
      </div>
    </article>
  ) : null

  if (narrow) {
    return (
      <div ref={bodyRef} data-testid="aide" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px max(24px, env(safe-area-inset-bottom))' }}>
        {chapter ? article : (
          <>
            {guideSwitch}
            {contents}
            {pdfLink}
          </>
        )}
      </div>
    )
  }

  return (
    <div data-testid="aide" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <aside style={{ width: 260, flexShrink: 0, padding: '24px 16px', borderRight: '1px solid var(--bd)', overflowY: 'auto' }}>
        {guideSwitch}
        {contents}
        {pdfLink}
      </aside>
      <div ref={bodyRef} style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '28px 40px 60px' }}>
        {article}
      </div>
    </div>
  )
}
