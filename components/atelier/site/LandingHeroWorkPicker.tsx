'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import type { Oeuvre } from '@/lib/types/database'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl } from '@/lib/data'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import {
  listWorkDrawerImages,
  type WorkDrawerImageRow,
} from '@/app/atelier/works/actions'
import { searchWorksForSession } from '@/app/atelier/session/actions'
import type { LandingConfig } from '@/lib/portfolio-config-types'

const MODAL_PANEL_STYLE: CSSProperties = {
  width: 'min(480px, 100%)',
  maxHeight: 'min(80vh, 640px)',
  height: 'min(80vh, 640px)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg1)',
  border: '1px solid var(--bd)',
  borderRadius: 6,
  padding: 20,
  overflow: 'hidden',
  minHeight: 0,
}

const SCROLL_REGION_STYLE: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
}

export type LandingHeroWorkLite = Pick<Oeuvre, 'OeuvreID' | 'Titre' | 'txtImageNameLink'>

type Props = {
  oeuvres: LandingHeroWorkLite[]
  landing: LandingConfig
  onApply: (patch: Partial<LandingConfig>) => void
}

export function landingHeroPreviewSrc(landing: LandingConfig): string {
  const fromKey = imageUrl(landing.hero_image_key)
  if (fromKey) return fromKey
  return landing.hero_image_url.trim()
}

export function LandingHeroWorkPicker({ oeuvres, landing, onApply }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'work' | 'image'>('work')
  const [search, setSearch] = useState('')
  const [pickedOeuvreId, setPickedOeuvreId] = useState<number | null>(null)
  const [images, setImages] = useState<WorkDrawerImageRow[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [serverWorks, setServerWorks] = useState<LandingHeroWorkLite[] | null>(null)

  const linkedWork = useMemo(() => {
    const id = landing.hero_oeuvre_id
    if (!id) return null
    return oeuvres.find(o => o.OeuvreID === id) ?? null
  }, [landing.hero_oeuvre_id, oeuvres])

  const q = search.trim()

  useEffect(() => {
    if (q.length < 2) {
      setServerWorks(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchWorksForSession(q).then(rows => {
        if (cancelled) return
        setServerWorks(
          rows.map(r => ({
            OeuvreID: r.OeuvreID,
            Titre: r.Titre,
            txtImageNameLink: r.txtImageNameLink,
          })),
        )
      })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [q])

  const filteredWorks = useMemo(() => {
    if (q.length >= 2) {
      return serverWorks ?? []
    }
    return [...oeuvres].sort((a, b) =>
      (a.Titre ?? '').localeCompare(b.Titre ?? '', 'fr', { sensitivity: 'base' }),
    )
  }, [oeuvres, q.length, serverWorks])

  const close = useCallback(() => {
    setOpen(false)
    setStep('work')
    setSearch('')
    setPickedOeuvreId(null)
    setImages([])
    setLoadingImages(false)
    setServerWorks(null)
  }, [])

  useEscapeClose(open, close)

  const openPicker = useCallback(() => {
    setOpen(true)
    setStep('work')
    setSearch('')
    setPickedOeuvreId(landing.hero_oeuvre_id)
    if (landing.hero_oeuvre_id) {
      setLoadingImages(true)
      void listWorkDrawerImages(landing.hero_oeuvre_id).then(rows => {
        setImages(rows.filter(r => r.txtImageNameLink))
        setLoadingImages(false)
        if (rows.some(r => r.txtImageNameLink)) setStep('image')
      })
    }
  }, [landing.hero_oeuvre_id])

  const pickWork = useCallback((oeuvreId: number) => {
    setPickedOeuvreId(oeuvreId)
    setLoadingImages(true)
    void listWorkDrawerImages(oeuvreId).then(rows => {
      const withFile = rows.filter(r => r.txtImageNameLink)
      setImages(withFile)
      setLoadingImages(false)
      setStep('image')
    })
  }, [])

  const pickImage = useCallback((row: WorkDrawerImageRow) => {
    const key = (row.txtImageNameLink ?? '').trim()
    const url = imageUrl(key) ?? ''
    onApply({
      hero_oeuvre_id: pickedOeuvreId,
      hero_image_id: row.ImageID,
      hero_image_key: key,
      hero_image_url: url,
    })
    close()
  }, [close, onApply, pickedOeuvreId])

  const clearLink = useCallback(() => {
    onApply({
      hero_oeuvre_id: null,
      hero_image_id: null,
      hero_image_key: '',
    })
  }, [onApply])

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        {linkedWork ? (
          <div
            className="row gap-sm"
            style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}
          >
            <span className="t-mono-xs" style={{ opacity: 0.7 }}>
              {t('site_hero_linked_prefix')}:{' '}
              <span style={{ color: 'var(--tx1)' }}>{linkedWork.Titre ?? `#${linkedWork.OeuvreID}`}</span>
            </span>
            <button type="button" className="btn sm ghost" onClick={openPicker}>
              {t('site_hero_change_link_btn')}
            </button>
            <button type="button" className="btn sm ghost" onClick={clearLink}>
              {t('site_hero_clear_link_btn')}
            </button>
          </div>
        ) : null}
        <button type="button" className="btn sm" onClick={openPicker} data-testid="landing-hero-link-work">
          {t('site_hero_link_work_btn')}
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal
          aria-labelledby="landing-hero-picker-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
          }}
          onClick={close}
        >
          <div
            className="col gap-md"
            style={MODAL_PANEL_STYLE}
            onClick={e => e.stopPropagation()}
          >
            <div className="row gap-sm" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 id="landing-hero-picker-title" className="t-label" style={{ margin: 0, fontSize: 10 }}>
                {step === 'work' ? t('site_hero_link_work_title') : t('site_hero_pick_image_title')}
              </h3>
              <button type="button" className="btn sm ghost" onClick={close} aria-label={t('cancel')}>
                {t('cancel')}
              </button>
            </div>

            {step === 'work' ? (
              <div className="col gap-md" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <input
                  className="input full"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('site_hero_pick_work_search_placeholder')}
                  autoFocus
                  data-testid="landing-hero-work-search"
                  style={{ flexShrink: 0 }}
                />
                <div className="col gap-xs" style={SCROLL_REGION_STYLE}>
                  {q.length >= 2 && serverWorks === null ? (
                    <p className="t-mono-xs" style={{ opacity: 0.55 }}>{t('site_hero_pick_image_loading')}</p>
                  ) : filteredWorks.length === 0 ? (
                    <p className="t-mono-xs" style={{ opacity: 0.55 }}>{t('site_hero_pick_work_empty')}</p>
                  ) : (
                    filteredWorks.map(o => (
                      <button
                        key={o.OeuvreID}
                        type="button"
                        className="btn ghost"
                        onClick={() => pickWork(o.OeuvreID)}
                        style={{
                          justifyContent: 'flex-start',
                          gap: 10,
                          minHeight: 44,
                          textAlign: 'left',
                        }}
                        data-testid={`landing-hero-work-${o.OeuvreID}`}
                      >
                        {o.txtImageNameLink ? (
                          <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 2, overflow: 'hidden' }}>
                            <WorkThumb file={o.txtImageNameLink} size={80} alt="" />
                          </span>
                        ) : (
                          <span
                            style={{
                              width: 40,
                              height: 40,
                              flexShrink: 0,
                              border: '1px dashed var(--bd)',
                              borderRadius: 2,
                            }}
                          />
                        )}
                        <span style={{ fontSize: 11 }}>{o.Titre ?? `#${o.OeuvreID}`}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="col gap-md" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <button
                  type="button"
                  className="btn sm ghost"
                  style={{ alignSelf: 'flex-start', flexShrink: 0 }}
                  onClick={() => {
                    setStep('work')
                    setImages([])
                  }}
                >
                  ← {t('site_hero_back_to_works_btn')}
                </button>
                {loadingImages ? (
                  <p className="t-mono-xs" style={{ opacity: 0.55 }}>{t('site_hero_pick_image_loading')}</p>
                ) : images.length === 0 ? (
                  <p className="t-mono-xs" style={{ opacity: 0.55 }}>{t('site_hero_pick_image_empty')}</p>
                ) : (
                  <div
                    style={{
                      ...SCROLL_REGION_STYLE,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                      gap: 10,
                      alignContent: 'start',
                    }}
                  >
                    {images.map(row => {
                      const file = row.txtImageNameLink ?? ''
                      const selected = landing.hero_image_id === row.ImageID
                      return (
                        <button
                          key={row.ImageID}
                          type="button"
                          onClick={() => pickImage(row)}
                          style={{
                            padding: 0,
                            border: selected ? '2px solid var(--ac)' : '1px solid var(--bd)',
                            borderRadius: 4,
                            overflow: 'hidden',
                            background: 'var(--bg0)',
                            cursor: 'pointer',
                            minHeight: 44,
                          }}
                          data-testid={`landing-hero-image-${row.ImageID}`}
                        >
                          <WorkThumb file={file} size={176} alt="" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
