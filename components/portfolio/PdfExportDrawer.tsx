'use client'

import { useState, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { generatePortfolioPdf } from '@/app/atelier/portfolio/pdf-action'
import {
  MAX_WORKS,
  PRESET_DEFAULTS,
  type PdfWork,
  type PdfPortfolioConfig,
  type PdfFormat,
  type PdfPreset,
  type PresetConfig,
} from '@/lib/portfolio-pdf-types'

interface Collection {
  id:             string
  title_fr:       string
  title_en:       string
  is_active:      boolean
}

interface Props {
  works:            PdfWork[]
  config:           PdfPortfolioConfig
  worksCollections: Collection[]
  open:             boolean
  onClose:          () => void
}

type Phase = 'idle' | 'fetching' | 'building' | 'done' | 'error'

const FORMATS: { id: PdfFormat; label: string }[] = [
  { id: 'a4p', label: 'A4 Portrait'  },
  { id: 'a4l', label: 'A4 Paysage'   },
  { id: 'usl', label: 'US Letter'    },
  { id: 'a3l', label: 'A3 Paysage'   },
]

const PRESETS: { id: Exclude<PdfPreset, 'custom'>; label: string; sub: string }[] = [
  { id: 'galerie',        label: 'Galerie',        sub: 'Toutes les œuvres · Approche · Contact' },
  { id: 'collectionneur', label: 'Collectionneur', sub: '8 œuvres max · Contact'                 },
  { id: 'presse',         label: 'Presse',         sub: '3 œuvres · Couverture uniquement'       },
]

export default function PdfExportDrawer({ works, config, worksCollections, open, onClose }: Props) {
  const { lang } = useI18n()

  const [preset,          setPreset]          = useState<Exclude<PdfPreset, 'custom'>>('galerie')
  const [format,          setFormat]          = useState<PdfFormat>('a4p')
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null)
  const [includeCover,    setIncludeCover]    = useState(true)
  const [includeApproach, setIncludeApproach] = useState(true)
  const [includeEnquiry,  setIncludeEnquiry]  = useState(true)
  const [maxWorks,        setMaxWorks]        = useState<number | null>(null)

  const [phase,   setPhase]   = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)          // 0–100
  const [message,  setMessage]  = useState('')
  const [warning,  setWarning]  = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Apply preset defaults
  const applyPreset = useCallback((p: Exclude<PdfPreset, 'custom'>) => {
    setPreset(p)
    const d = PRESET_DEFAULTS[p]
    setIncludeCover(d.includeCover)
    setIncludeApproach(d.includeApproach)
    setIncludeEnquiry(d.includeEnquiry)
    setMaxWorks(d.maxWorks)
  }, [])

  // Filter works by collection theme if selected
  const filteredWorks = useMemo(() => {
    if (!collectionFilter) return works
    const col = worksCollections.find(c => c.id === collectionFilter)
    if (!col?.theme) return works
    const target = col.theme.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    return works.filter(w =>
      w.themes.some(th => {
        const n = th.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
        return n.includes(target) || target.includes(n)
      })
    )
  }, [works, collectionFilter, worksCollections])

  const cap         = maxWorks ?? MAX_WORKS
  const willWarn    = filteredWorks.length > cap
  const exportCount = Math.min(filteredWorks.length, cap)

  async function handleExport() {
    setPhase('fetching')
    setProgress(5)
    setMessage('Préparation des images…')
    setWarning(null)
    setErrorMsg(null)

    const presetCfg: PresetConfig = {
      preset:          preset,
      format,
      lang,
      includeCover,
      includeApproach,
      includeEnquiry,
      maxWorks,
      collectionFilter,
    }

    // Simulate progress during server action (no real streaming from server actions)
    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p < 40) return p + 3
        if (p < 70) return p + 1.5
        if (p < 88) return p + 0.5
        return p
      })
      setMessage(prev => {
        if (progress < 30) return 'Chargement des images…'
        if (progress < 60) return 'Traitement qualité…'
        if (progress < 80) return 'Composition des pages…'
        return 'Finalisation…'
      })
    }, 400)

    setPhase('building')

    try {
      const result = await generatePortfolioPdf(filteredWorks, config, presetCfg)
      clearInterval(progressInterval)

      if ('error' in result) {
        setPhase('error')
        setErrorMsg(result.error)
        setProgress(0)
        return
      }

      setProgress(100)
      setMessage('PDF prêt')
      setPhase('done')

      if (result.warned && result.warningMsg) {
        setWarning(result.warningMsg)
      }

      // Trigger download
      const bytes  = atob(result.base64)
      const arr    = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob   = new Blob([arr], { type: 'application/pdf' })
      const url    = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href       = url
      a.download   = result.filename
      a.click()
      URL.revokeObjectURL(url)

    } catch (e: any) {
      clearInterval(progressInterval)
      setPhase('error')
      setErrorMsg(e?.message ?? String(e))
      setProgress(0)
    }
  }

  if (!open) return null

  const busy = phase === 'fetching' || phase === 'building'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => !busy && onClose()}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 900, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 'clamp(320px, 36vw, 480px)',
        background: '#faf9f7',
        borderLeft: '1px solid rgba(0,0,0,0.08)',
        zIndex: 901,
        display: 'flex', flexDirection: 'column',
        fontFamily: 'ui-monospace, monospace',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      }}>

        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#1a1816', fontWeight: 600 }}>
              Export PDF
            </div>
            <div style={{ fontSize: 10, color: '#8a8680', marginTop: 4 }}>
              {config.artist_name}
            </div>
          </div>
          <button onClick={() => !busy && onClose()} style={{
            background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
            fontSize: 18, color: '#8a8680', padding: 4, opacity: busy ? 0.3 : 1,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          {/* Presets */}
          <Section label="Destinataire">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => applyPreset(p.id)}
                  disabled={busy}
                  style={{
                    background: preset === p.id ? '#1a1816' : '#fff',
                    border: `1px solid ${preset === p.id ? '#1a1816' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: 4, padding: '10px 14px',
                    cursor: busy ? 'default' : 'pointer',
                    textAlign: 'left', transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: preset === p.id ? '#ffffff' : '#1a1816' }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 9, color: preset === p.id ? '#8a8680' : '#aaa', marginTop: 3 }}>
                    {p.sub}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Format */}
          <Section label="Format">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)}
                  disabled={busy}
                  style={{
                    background: format === f.id ? '#1a1816' : '#fff',
                    color: format === f.id ? '#ffffff' : '#1a1816',
                    border: `1px solid ${format === f.id ? '#1a1816' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: 4, padding: '8px 10px',
                    fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
                    cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Collection filter */}
          {worksCollections.length > 0 && (
            <Section label="Collection">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => setCollectionFilter(null)} disabled={busy}
                  style={filterBtnStyle(collectionFilter === null, busy)}>
                  Toutes
                </button>
                {worksCollections.filter(c => c.is_active).map(c => (
                  <button key={c.id} onClick={() => setCollectionFilter(c.id)} disabled={busy}
                    style={filterBtnStyle(collectionFilter === c.id, busy)}>
                    {lang === 'fr' ? c.title_fr : c.title_en}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Overrides */}
          <Section label="Contenu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['includeCover',    includeCover,    setIncludeCover,    'Couverture']    as const,
                ['includeApproach', includeApproach, setIncludeApproach, 'Page approche'] as const,
                ['includeEnquiry',  includeEnquiry,  setIncludeEnquiry,  'Page contact']  as const,
              ].map(([key, val, set, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: busy ? 'default' : 'pointer' }}>
                  <input type="checkbox" checked={val} onChange={e => !busy && set(e.target.checked)}
                    style={{ accentColor: '#1a1816', width: 14, height: 14, cursor: 'inherit' }} />
                  <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#4a4a4a' }}>{label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Work count */}
          <Section label="Œuvres">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number" min={1} max={MAX_WORKS}
                value={maxWorks ?? ''}
                placeholder={`Max ${MAX_WORKS}`}
                onChange={e => setMaxWorks(e.target.value ? Math.min(parseInt(e.target.value), MAX_WORKS) : null)}
                disabled={busy}
                style={{
                  width: 80, background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 4, padding: '6px 10px', fontSize: 11,
                  fontFamily: 'inherit', color: '#1a1816', outline: 'none',
                }}
              />
              <span style={{ fontSize: 9, color: '#8a8680' }}>
                {exportCount} œuvre{exportCount > 1 ? 's' : ''} incluse{exportCount > 1 ? 's' : ''}
              </span>
            </div>
            {willWarn && (
              <div style={{ marginTop: 8, fontSize: 9, color: '#8a6a3a', lineHeight: 1.5 }}>
                ⚠ {filteredWorks.length} œuvres dans la sélection — les {cap} premières seront exportées.
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 8, color: '#bbb', lineHeight: 1.6 }}>
              Images AVIF 2100px → JPEG 92 % · Résolution suffisante pour impression A4 standard.
              Impression offset : prévoir fichiers natifs 300 dpi.
            </div>
          </Section>

        </div>

        {/* Progress + footer */}
        <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>

          {/* Progress bar */}
          {(busy || phase === 'done') && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: '#8a8680', letterSpacing: 0.5 }}>{message}</span>
                <span style={{ fontSize: 9, color: '#8a8680' }}>{Math.round(progress)}%</span>
              </div>
              <div style={{ height: 2, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: phase === 'done' ? '#6a9e6a' : '#1a1816',
                  width: `${progress}%`,
                  transition: 'width 0.4s ease, background 0.3s',
                }} />
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
              Erreur : {errorMsg}
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={busy}
            style={{
              width: '100%', padding: '12px 0',
              background: busy ? '#e8e6e1' : '#1a1816',
              color: busy ? '#8a8680' : '#ffffff',
              border: 'none', borderRadius: 4,
              fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
              fontFamily: 'inherit', fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {busy ? 'Génération en cours…' : phase === 'done' ? '↓ Télécharger à nouveau' : '↓ Générer le PDF'}
          </button>

          {phase === 'done' && (
            <div style={{ marginTop: 10, fontSize: 9, color: '#6a9e6a', textAlign: 'center', letterSpacing: 0.5 }}>
              PDF téléchargé avec succès
            </div>
          )}
        </div>
      </div>
    </>
  )
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

function filterBtnStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    background: active ? '#1a1816' : '#fff',
    color: active ? '#ffffff' : '#4a4a4a',
    border: `1px solid ${active ? '#1a1816' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 4, padding: '7px 12px',
    fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'ui-monospace, monospace',
    textAlign: 'left', transition: 'all 0.15s',
  }
}
