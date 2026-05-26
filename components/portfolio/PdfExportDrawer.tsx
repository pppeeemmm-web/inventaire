'use client'

// Atelier-side PDF preview drawer. Self-contained: server action loads
// config + works internally — this component just collects user options.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useI18n } from '@/lib/i18n/context'
import { generatePortfolioPdf, getPortfolioPdfWorkCandidates } from '@/app/atelier/(portal)/portfolio/pdf-action'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { yearOf } from '@/lib/data'
import {
  MAX_WORKS,
  PRESET_DEFAULTS,
  type PdfRequestOptions,
  type PdfFormat,
  type PdfProfileMatrix,
  type PdfProfileSettings,
  type PdfPurpose,
  type PdfPreset,
  type PdfWorkCandidate,
  type PdfCollectionCandidate,
  type PdfCollectionStatement,
  type PdfWorkLayout,
  type PdfWorkLayoutMode,
  type PdfWorkPosition,
} from '@/lib/portfolio-pdf-types'
import type { Lang } from '@/lib/i18n/dictionary'

interface Props {
  open:    boolean
  onClose: () => void
  initialCollectionId?: string | null
  initialCollections?: PdfCollectionCandidate[]
  initialWorksByCollection?: Record<string, PdfWorkCandidate[]>
  initialStatementsByCollection?: Record<string, Record<Lang, PdfCollectionStatement>>
  pdfProfiles?: PdfProfileMatrix
  onSaveProfile?: (purpose: PdfPurpose, format: PdfFormat, settings: PdfProfileSettings) => void | Promise<void>
}

type Phase = 'idle' | 'building' | 'done' | 'error'

const FORMATS: { id: PdfFormat; labelKey: 'pdf_format_a4p' | 'pdf_format_a4l' }[] = [
  { id: 'a4p', labelKey: 'pdf_format_a4p' },
  { id: 'a4l', labelKey: 'pdf_format_a4l' },
]

const PRESETS: { id: Exclude<PdfPreset, 'custom'>; labelKey: 'pdf_preset_gallery' | 'pdf_preset_collector' | 'pdf_preset_press'; subKey: 'pdf_preset_gallery_sub' | 'pdf_preset_collector_sub' | 'pdf_preset_press_sub' }[] = [
  { id: 'galerie',        labelKey: 'pdf_preset_gallery',   subKey: 'pdf_preset_gallery_sub' },
  { id: 'collectionneur', labelKey: 'pdf_preset_collector', subKey: 'pdf_preset_collector_sub' },
  { id: 'presse',         labelKey: 'pdf_preset_press',     subKey: 'pdf_preset_press_sub' },
]

function uniqueCollections(collections: PdfCollectionCandidate[]): PdfCollectionCandidate[] {
  const seen = new Set<string>()
  return collections.filter(collection => {
    const key = (collection.title || collection.id).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function mergeInitialWorks(
  collections: PdfCollectionCandidate[],
  worksByCollection: Record<string, PdfWorkCandidate[]>,
): PdfWorkCandidate[] {
  const seen = new Set<number>()
  const collectionIds = collections.length > 0 ? collections.map(collection => collection.id) : Object.keys(worksByCollection)
  return collectionIds.flatMap(id => {
    const works = worksByCollection[id] ?? []
    return works.flatMap(work => {
      if (seen.has(work.OeuvreID)) return []
      seen.add(work.OeuvreID)
      return [work]
    })
  })
}

function sequenceForProfile(
  savedSequence: number[] | undefined,
  works: PdfWorkCandidate[],
): number[] {
  const available = new Set(works.map(work => work.OeuvreID))
  const saved = (savedSequence ?? []).filter(id => available.has(id))
  return saved.length > 0 ? saved : works.map(work => work.OeuvreID)
}

export default function PdfExportDrawer({
  open,
  onClose,
  initialCollectionId = null,
  initialCollections = [],
  initialWorksByCollection = {},
  initialStatementsByCollection = {},
  pdfProfiles = {},
  onSaveProfile,
}: Props) {
  const { t, lang } = useI18n()

  const [preset,          setPreset]          = useState<Exclude<PdfPreset, 'custom'>>('galerie')
  const [format,          setFormat]          = useState<PdfFormat>('a4p')
  const [exportLang,      setExportLang]      = useState<Lang>(lang)
  const [includeCollectionText, setIncludeCollectionText] = useState(false)
  const [includePractice, setIncludePractice] = useState(true)
  const [includeCv,       setIncludeCv]       = useState(true)
  const [includeContact,  setIncludeContact]  = useState(true)
  const [maxWorks,        setMaxWorks]        = useState<number | null>(null)
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null)
  const [collections,     setCollections]     = useState<PdfCollectionCandidate[]>([])
  const [workCandidates,  setWorkCandidates]  = useState<PdfWorkCandidate[]>([])
  const [sequenceIds,     setSequenceIds]     = useState<number[]>([])
  const [workLayouts,     setWorkLayouts]     = useState<Record<number, PdfWorkLayout>>({})
  const [sequenceLoading, setSequenceLoading] = useState(false)
  const [sequenceError,   setSequenceError]   = useState<string | null>(null)
  const [dragIndex,       setDragIndex]       = useState<number | null>(null)

  const [phase,    setPhase]    = useState<Phase>('idle')
  const [progress, setProgress] = useState<number | null>(null) // null = indeterminate (honest)
  const [message,  setMessage]  = useState<string>('')
  const [warning,  setWarning]  = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const phaseTimerRef = useRef<number | null>(null)
  const profileSettings = pdfProfiles[preset]?.[format] ?? null

  // Sync export lang to UI lang when drawer opens
  useEffect(() => { if (open) setExportLang(lang) }, [open, lang])

  useEffect(() => {
    if (!open) return
    const defaults = PRESET_DEFAULTS[preset]
    setCollectionFilter(profileSettings ? profileSettings.collectionFilter : null)
    setIncludeCollectionText(profileSettings?.includeCollectionText ?? false)
    setIncludePractice(profileSettings?.includePractice ?? defaults.includePractice)
    setIncludeCv(profileSettings?.includeCv ?? true)
    setIncludeContact(profileSettings?.includeContact ?? defaults.includeContact)
    setMaxWorks(profileSettings ? profileSettings.maxWorks : defaults.maxWorks)
    setWorkLayouts(profileSettings?.workLayouts ?? {})
  }, [open, initialCollectionId, preset, profileSettings])

  useEffect(() => {
    if (!open) return
    const mergedInitialWorks = mergeInitialWorks(initialCollections, initialWorksByCollection)
    const selectedInitialWorks = collectionFilter
      ? initialWorksByCollection[collectionFilter]
      : mergedInitialWorks
    const initialWorks = selectedInitialWorks && selectedInitialWorks.length > 0
      ? selectedInitialWorks
      : mergedInitialWorks
    if (initialCollections.length > 0 && initialWorks.length > 0) {
      setCollections(uniqueCollections(initialCollections))
      setWorkCandidates(initialWorks)
      setSequenceIds(sequenceForProfile(profileSettings?.workSequence, initialWorks))
      setSequenceLoading(false)
      setSequenceError(null)
      return
    }
    let cancelled = false
    setSequenceLoading(true)
    setSequenceError(null)
    getPortfolioPdfWorkCandidates({ lang, collectionFilter }).then(result => {
      if (cancelled) return
      setSequenceLoading(false)
      if ('error' in result) {
        setSequenceError(result.error)
        return
      }
      setCollections(uniqueCollections(initialCollections.length > 0 ? initialCollections : result.collections))
      setWorkCandidates(result.works)
      setSequenceIds(sequenceForProfile(profileSettings?.workSequence, result.works))
    }).catch(e => {
      if (cancelled) return
      setSequenceLoading(false)
      setSequenceError(e instanceof Error ? e.message : String(e))
    })
    return () => { cancelled = true }
  }, [open, lang, collectionFilter, initialCollections, initialWorksByCollection, profileSettings])

  const applyPreset = useCallback((p: Exclude<PdfPreset, 'custom'>) => {
    setPreset(p)
  }, [])

  const candidateById = useMemo(
    () => new Map(workCandidates.map(w => [w.OeuvreID, w])),
    [workCandidates],
  )
  const selectedWorks = sequenceIds.flatMap(id => {
    const work = candidateById.get(id)
    return work ? [work] : []
  })
  const selectedSet = useMemo(() => new Set(sequenceIds), [sequenceIds])
  const excludedWorks = workCandidates.filter(w => !selectedSet.has(w.OeuvreID))
  const exportCount = Math.min(selectedWorks.length, maxWorks ?? MAX_WORKS)

  const moveSequence = useCallback((from: number, to: number) => {
    setSequenceIds(prev => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev
      const next = prev.slice()
      const [moved] = next.splice(from, 1)
      if (moved == null) return prev
      next.splice(to, 0, moved)
      return next
    })
  }, [])

  const updateWorkLayout = useCallback((id: number, patch: Partial<PdfWorkLayout>) => {
    setWorkLayouts(prev => {
      const current = prev[id] ?? { mode: 'auto', x: 'center', y: 'center' }
      const next = { ...current, ...patch }
      return { ...prev, [id]: next }
    })
  }, [])

  const resetCurrentProfile = useCallback(() => {
    const ids = workCandidates.map(work => work.OeuvreID)
    setSequenceIds(ids)
    setWorkLayouts({})
    setIncludeCollectionText(false)
    setIncludePractice(PRESET_DEFAULTS[preset].includePractice)
    setIncludeCv(true)
    setIncludeContact(PRESET_DEFAULTS[preset].includeContact)
    setMaxWorks(PRESET_DEFAULTS[preset].maxWorks)
  }, [preset, workCandidates])

  const currentProfileSettings = useCallback((): PdfProfileSettings => ({
    collectionFilter,
    workSequence: sequenceIds,
    workLayouts: Object.fromEntries(sequenceIds.map(id => [id, workLayouts[id] ?? { mode: 'auto', x: 'center', y: 'center' }])),
    includeCollectionText,
    includePractice,
    includeCv,
    includeContact,
    maxWorks,
  }), [collectionFilter, sequenceIds, workLayouts, includeCollectionText, includePractice, includeCv, includeContact, maxWorks])

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current != null) window.clearInterval(phaseTimerRef.current)
    }
  }, [])

  async function handleExport() {
    setPhase('building')
    setProgress(null)
    setMessage(t('pdf_progress_preparing'))
    setWarning(null)
    setErrorMsg(null)

    const statementIds = collectionFilter
      ? [collectionFilter]
      : collections.map(collection => collection.id)
    const collectionStatements = statementIds.flatMap((id): PdfCollectionStatement[] => {
      const statement = initialStatementsByCollection[id]?.[exportLang]
      if (!statement) return []
      return [statement]
    })

    const settings = currentProfileSettings()
    const opts: PdfRequestOptions = {
      preset, format, lang: exportLang,
      includeCover: true,
      includeAbout: false,
      includeCollectionText: settings.includeCollectionText,
      includePractice: settings.includePractice,
      includeCv: settings.includeCv,
      includeContact: settings.includeContact,
      maxWorks: settings.maxWorks,
      collectionFilter: settings.collectionFilter,
      workSequence: settings.workSequence,
      workLayouts: settings.workLayouts,
      collectionStatements,
    }

    if (phaseTimerRef.current != null) window.clearInterval(phaseTimerRef.current)
    const steps = [
      t('pdf_progress_loading_images'),
      t('pdf_progress_processing'),
      t('pdf_progress_layout'),
      t('pdf_progress_finalizing'),
    ]
    let i = 0
    phaseTimerRef.current = window.setInterval(() => {
      i = (i + 1) % steps.length
      setMessage(steps[i]!)
    }, 1200)

    try {
      const result = await generatePortfolioPdf(opts)
      if (phaseTimerRef.current != null) window.clearInterval(phaseTimerRef.current)
      phaseTimerRef.current = null

      if ('error' in result) {
        setPhase('error')
        setErrorMsg(result.error)
        setProgress(null)
        return
      }

      setProgress(100)
      setMessage(t('pdf_ready'))
      setPhase('done')

      if (result.warned && result.warningMsg) setWarning(result.warningMsg)

      const bytes = atob(result.base64)
      const arr   = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob  = new Blob([arr], { type: 'application/pdf' })
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement('a')
      a.href      = url
      a.download  = result.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      if (phaseTimerRef.current != null) window.clearInterval(phaseTimerRef.current)
      phaseTimerRef.current = null
      setPhase('error')
      setErrorMsg(e?.message ?? String(e))
      setProgress(null)
    }
  }

  const busy = phase === 'building'
  useEscapeClose(open && !busy, onClose)

  if (!open) return null

  return (
    <>
      <div onClick={() => !busy && onClose()} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 900, backdropFilter: 'blur(2px)',
      }} />

      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 'clamp(320px, 36vw, 480px)',
        background: '#faf9f7', borderLeft: '1px solid rgba(0,0,0,0.08)',
        zIndex: 901, display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      }}>

        <div style={{
          padding: '24px 28px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#1a1816', fontWeight: 600 }}>
              {t('pdf_export_title')}
            </div>
            <div style={{ fontSize: 10, color: '#8a8680', marginTop: 4 }}>
              {t('pdf_export_subtitle')}
            </div>
          </div>
          <button onClick={() => !busy && onClose()} style={{
            background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
            fontSize: 18, color: '#8a8680', padding: 4, opacity: busy ? 0.3 : 1,
          }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          <Section label={t('pdf_section_recipient')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => applyPreset(p.id)} disabled={busy} style={{
                  background: preset === p.id ? '#1a1816' : '#fff',
                  border: `1px solid ${preset === p.id ? '#1a1816' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 4, padding: '10px 14px',
                  cursor: busy ? 'default' : 'pointer',
                  textAlign: 'left', transition: 'all 0.15s',
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: preset === p.id ? '#ffffff' : '#1a1816',
                  }}>{t(p.labelKey)}</div>
                  <div style={{
                    fontSize: 9, marginTop: 3,
                    color: preset === p.id ? '#8a8680' : '#aaa',
                  }}>{t(p.subKey)}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section label={t('pdf_section_format')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)} disabled={busy} style={{
                  background: format === f.id ? '#1a1816' : '#fff',
                  color:      format === f.id ? '#ffffff' : '#1a1816',
                  border: `1px solid ${format === f.id ? '#1a1816' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 4, padding: '8px 10px',
                  fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
                  cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}>{t(f.labelKey)}</button>
              ))}
            </div>
          </Section>

          <Section label={t('pdf_section_language')}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['fr', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setExportLang(l)} disabled={busy} style={{
                  flex: 1,
                  background: exportLang === l ? '#1a1816' : '#fff',
                  color:      exportLang === l ? '#ffffff' : '#1a1816',
                  border: `1px solid ${exportLang === l ? '#1a1816' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 4, padding: '8px 10px',
                  fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                  cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                }}>{l === 'fr' ? t('locale_fr_short') : t('locale_en_short')}</button>
              ))}
            </div>
          </Section>

          <Section label={t('pdf_section_sequence')}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-8px 0 10px' }}>
              <HelpTip label="?" title={t('pdf_sequence_help')} />
            </div>
            {collections.length > 0 && (
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ display: 'block', fontSize: 8, color: '#aaa', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 5 }}>
                  {t('pdf_sequence_collection_label')}
                </span>
                <select
                  value={collectionFilter ?? ''}
                  disabled={busy || sequenceLoading}
                  onChange={e => setCollectionFilter(e.target.value || null)}
                  style={{
                    width: '100%',
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 4,
                    padding: '8px 10px',
                    fontSize: 10,
                    color: '#1a1816',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">{t('pdf_sequence_collection_all')}</option>
                  {collections.map(collection => (
                    <option key={collection.id} value={collection.id}>
                      {collection.title} ({collection.worksCount})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {sequenceLoading ? (
              <div style={{ fontSize: 9, color: '#8a8680' }}>{t('pdf_sequence_loading')}</div>
            ) : sequenceError ? (
              <div style={{ fontSize: 9, color: '#c05050', lineHeight: 1.5 }}>{sequenceError}</div>
            ) : workCandidates.length === 0 ? (
              <div style={{ fontSize: 9, color: '#8a8680' }}>{t('pdf_sequence_empty')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 9, color: '#8a8680' }}>
                  <span>
                    {t('pdf_sequence_selected_fmt')
                      .replace(/\{n\}/g, String(exportCount))}
                  </span>
                  <span>
                    {t('pdf_sequence_excluded_fmt')
                      .replace(/\{n\}/g, String(excludedWorks.length))}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', paddingRight: 2 }}>
                  {selectedWorks.map((work, idx) => (
                    (() => {
                    const workLayout = workLayouts[work.OeuvreID] ?? { mode: 'auto', x: 'center', y: 'center' }
                    return (
                    <div
                      key={work.OeuvreID}
                      draggable={!busy}
                      onDragStart={e => {
                        setDragIndex(idx)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                      onDrop={e => {
                        e.preventDefault()
                        if (dragIndex != null && dragIndex !== idx) moveSequence(dragIndex, idx)
                        setDragIndex(null)
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '44px 1fr auto',
                        gap: 8,
                        alignItems: 'center',
                        padding: 6,
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 4,
                        opacity: dragIndex === idx ? 0.5 : 1,
                      }}
                    >
                      <div style={{ width: 44, height: 44, background: '#eee', overflow: 'hidden' }}>
                        {work.txtImageNameLink && <WorkThumb file={work.txtImageNameLink} alt={work.Titre ?? ''} size={96} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: '#1a1816', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {idx + 1}. {work.Titre ?? `#${work.OeuvreID}`}
                        </div>
                        <div style={{ fontSize: 8, color: '#aaa', marginTop: 2 }}>
                          {yearOf(work.Annee)} {work.Hauteur && work.Largeur ? ` · ${work.Hauteur} × ${work.Largeur} cm` : ''}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                          <select
                            value={workLayout.mode}
                            disabled={busy}
                            onChange={e => updateWorkLayout(work.OeuvreID, { mode: e.target.value as PdfWorkLayoutMode })}
                            title={t('pdf_layout_help')}
                            style={miniSelectStyle}
                          >
                            <option value="auto">{t('pdf_layout_auto')}</option>
                            <option value="bleed">{t('pdf_layout_bleed')}</option>
                            <option value="contain">{t('pdf_layout_contain')}</option>
                          </select>
                          <select
                            value={workLayout.y}
                            disabled={busy || workLayout.mode !== 'bleed'}
                            onChange={e => updateWorkLayout(work.OeuvreID, { y: e.target.value as PdfWorkPosition })}
                            title={t('pdf_layout_position_label')}
                            style={miniSelectStyle}
                          >
                            <option value="start">{t('pdf_layout_pos_start')}</option>
                            <option value="center">{t('pdf_layout_pos_center')}</option>
                            <option value="end">{t('pdf_layout_pos_end')}</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button type="button" disabled={busy || idx === 0} onClick={() => moveSequence(idx, idx - 1)}
                          title={t('pdf_sequence_move_up')} style={tinyButtonStyle(busy || idx === 0)}>↑</button>
                        <button type="button" disabled={busy || idx === selectedWorks.length - 1} onClick={() => moveSequence(idx, idx + 1)}
                          title={t('pdf_sequence_move_down')} style={tinyButtonStyle(busy || idx === selectedWorks.length - 1)}>↓</button>
                        <button type="button" disabled={busy} onClick={() => setSequenceIds(prev => prev.filter(id => id !== work.OeuvreID))}
                          title={t('pdf_sequence_exclude')} style={tinyButtonStyle(busy)}>−</button>
                      </div>
                    </div>
                    )
                    })()
                  ))}
                </div>
                {excludedWorks.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {excludedWorks.map(work => (
                      <button
                        key={work.OeuvreID}
                        type="button"
                        disabled={busy}
                        onClick={() => setSequenceIds(prev => [...prev, work.OeuvreID])}
                        title={t('pdf_sequence_include')}
                        style={{
                          width: 52,
                          height: 52,
                          padding: 0,
                          border: '1px dashed rgba(0,0,0,0.18)',
                          background: '#fff',
                          opacity: busy ? 0.5 : 1,
                          cursor: busy ? 'default' : 'pointer',
                          overflow: 'hidden',
                        }}
                      >
                        {work.txtImageNameLink && <WorkThumb file={work.txtImageNameLink} alt={work.Titre ?? ''} size={96} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section label={t('pdf_section_content')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['statement', includeCollectionText, setIncludeCollectionText, t('pdf_content_collection_statement')] as const,
                ['practice', includePractice, setIncludePractice, t('pdf_content_approach')] as const,
                ['cv',       includeCv,       setIncludeCv,       t('pdf_content_cv')] as const,
                ['contact',  includeContact,  setIncludeContact,  t('pdf_content_contact_thanks')] as const,
              ].map(([key, val, set, label]) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: busy ? 'default' : 'pointer',
                }}>
                  <input type="checkbox" checked={val} onChange={e => !busy && set(e.target.checked)}
                    style={{ accentColor: '#1a1816', width: 14, height: 14, cursor: 'inherit' }} />
                  <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#4a4a4a' }}>{label}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section label={t('pdf_section_max_works')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="number" min={1} max={MAX_WORKS}
                value={maxWorks ?? ''}
                placeholder={t('pdf_max_works_placeholder').replace(/\{max\}/g, String(MAX_WORKS))}
                onChange={e => setMaxWorks(e.target.value ? Math.min(parseInt(e.target.value), MAX_WORKS) : null)}
                disabled={busy}
                style={{
                  width: 80, background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 4, padding: '6px 10px', fontSize: 11,
                  fontFamily: 'inherit', color: '#1a1816', outline: 'none',
                }}
              />
              <span style={{ fontSize: 9, color: '#8a8680' }}>
                {t('pdf_max_works_summary_fmt')
                  .replace(/\{n\}/g, String(maxWorks ?? MAX_WORKS))
                  .replace(/\{max\}/g, String(MAX_WORKS))}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 8, color: '#bbb', lineHeight: 1.6 }}>
              {t('pdf_max_works_help_1')} <strong>{t('tab_portfolio')}</strong>.<br />
              {t('pdf_max_works_help_2')}
            </div>
          </Section>
        </div>

        <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {(busy || phase === 'done') && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: '#8a8680', letterSpacing: 0.5 }}>{message}</span>
                <span style={{ fontSize: 9, color: '#8a8680' }}>{progress == null ? '…' : `${Math.round(progress)}%`}</span>
              </div>
              <div className="pem-progressTrack" style={{ height: 2 }}>
                {progress == null ? (
                  <div className="pem-progressIndeterminate" style={{ background: phase === 'done' ? '#6a9e6a' : '#1a1816' }} />
                ) : (
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: phase === 'done' ? '#6a9e6a' : '#1a1816',
                    width: `${progress}%`,
                    transition: 'width 0.35s ease, background 0.25s',
                  }} />
                )}
              </div>
            </div>
          )}

          {warning && (
            <div style={{ marginBottom: 12, fontSize: 9, color: '#8a6a3a', lineHeight: 1.5 }}>
              ⚠ {warning}
            </div>
          )}

          {errorMsg && (
            <div style={{ marginBottom: 12, fontSize: 9, color: '#c05050', lineHeight: 1.5 }}>
              {t('error_prefix')} {errorMsg}
            </div>
          )}

          {onSaveProfile && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={resetCurrentProfile}
                disabled={busy || workCandidates.length === 0}
                style={profileButtonStyle(busy || workCandidates.length === 0)}
              >
                {t('pdf_profile_reset')}
              </button>
              <button
                type="button"
                onClick={() => onSaveProfile(preset, format, currentProfileSettings())}
                disabled={busy || sequenceIds.length === 0}
                style={profileButtonStyle(busy || sequenceIds.length === 0)}
              >
                {t('pdf_profile_save')}
              </button>
            </div>
          )}

          <button onClick={handleExport} disabled={busy || sequenceIds.length === 0} style={{
            width: '100%', padding: '12px 0',
            background: busy || sequenceIds.length === 0 ? '#e8e6e1' : '#1a1816',
            color:      busy || sequenceIds.length === 0 ? '#8a8680' : '#ffffff',
            border: 'none', borderRadius: 4,
            fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            fontFamily: 'inherit', fontWeight: 600,
            cursor: busy || sequenceIds.length === 0 ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}>
            {busy ? t('generating') : phase === 'done' ? t('pdf_download_again') : t('pdf_generate')}
          </button>

          {phase === 'done' && (
            <div style={{ marginTop: 10, fontSize: 9, color: '#6a9e6a', textAlign: 'center', letterSpacing: 0.5 }}>
              {t('pdf_downloaded_ok')}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function tinyButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    border: '1px solid rgba(0,0,0,0.12)',
    background: disabled ? '#f0eee9' : '#faf9f7',
    color: disabled ? '#c0bdb7' : '#1a1816',
    borderRadius: 3,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 12,
    lineHeight: 1,
  }
}

function profileButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 0',
    background: '#fff',
    color: disabled ? '#aaa' : '#1a1816',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 4,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'inherit',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
  }
}

const miniSelectStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(0,0,0,0.12)',
  background: '#faf9f7',
  color: '#1a1816',
  borderRadius: 3,
  padding: '4px 5px',
  fontSize: 8,
  fontFamily: 'inherit',
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 8, letterSpacing: 3, textTransform: 'uppercase', color: '#aaa', marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function HelpTip({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 999,
        border: '1px solid rgba(0,0,0,0.16)',
        color: '#8a8680',
        fontSize: 10,
        cursor: 'help',
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  )
}
