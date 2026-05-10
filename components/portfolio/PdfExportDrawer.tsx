'use client'

// Atelier-side PDF preview drawer. Self-contained: server action loads
// config + works internally — this component just collects user options.

import { useState, useCallback, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { generatePortfolioPdf } from '@/app/atelier/portfolio/pdf-action'
import {
  MAX_WORKS,
  PRESET_DEFAULTS,
  type PdfRequestOptions,
  type PdfFormat,
  type PdfPreset,
} from '@/lib/portfolio-pdf-types'
import type { Lang } from '@/lib/i18n/dictionary'

interface Props {
  open:    boolean
  onClose: () => void
}

type Phase = 'idle' | 'building' | 'done' | 'error'

const FORMATS: { id: PdfFormat; label: string }[] = [
  { id: 'a4p', label: 'A4 Portrait' },
  { id: 'a4l', label: 'A4 Paysage'  },
  { id: 'usl', label: 'US Letter'   },
  { id: 'a3l', label: 'A3 Paysage'  },
]

const PRESETS: { id: Exclude<PdfPreset, 'custom'>; label: string; sub: string }[] = [
  { id: 'galerie',        label: 'Galerie',        sub: 'Toutes les œuvres · À propos · Démarche · Contact' },
  { id: 'collectionneur', label: 'Collectionneur', sub: '8 œuvres max · À propos · Contact'                 },
  { id: 'presse',         label: 'Presse',         sub: '3 œuvres · Contact uniquement'                     },
]

export default function PdfExportDrawer({ open, onClose }: Props) {
  const { lang } = useI18n()

  const [preset,          setPreset]          = useState<Exclude<PdfPreset, 'custom'>>('galerie')
  const [format,          setFormat]          = useState<PdfFormat>('a4p')
  const [exportLang,      setExportLang]      = useState<Lang>(lang)
  const [includeCover,    setIncludeCover]    = useState(true)
  const [includeAbout,    setIncludeAbout]    = useState(true)
  const [includePractice, setIncludePractice] = useState(true)
  const [includeContact,  setIncludeContact]  = useState(true)
  const [maxWorks,        setMaxWorks]        = useState<number | null>(null)

  const [phase,    setPhase]    = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [message,  setMessage]  = useState('')
  const [warning,  setWarning]  = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Sync export lang to UI lang when drawer opens
  useEffect(() => { if (open) setExportLang(lang) }, [open, lang])

  const applyPreset = useCallback((p: Exclude<PdfPreset, 'custom'>) => {
    setPreset(p)
    const d = PRESET_DEFAULTS[p]
    setIncludeCover(d.includeCover)
    setIncludeAbout(d.includeAbout)
    setIncludePractice(d.includePractice)
    setIncludeContact(d.includeContact)
    setMaxWorks(d.maxWorks)
  }, [])

  async function handleExport() {
    setPhase('building')
    setProgress(5)
    setMessage('Préparation des images…')
    setWarning(null)
    setErrorMsg(null)

    const opts: PdfRequestOptions = {
      preset, format, lang: exportLang,
      includeCover, includeAbout, includePractice, includeContact,
      maxWorks, collectionFilter: null,
    }

    const tick = setInterval(() => {
      setProgress(p => {
        if (p < 40) return p + 3
        if (p < 70) return p + 1.5
        if (p < 88) return p + 0.5
        return p
      })
      setMessage(prev =>
        progress < 30 ? 'Chargement des images…'
        : progress < 60 ? 'Traitement qualité…'
        : progress < 80 ? 'Composition des pages…'
        : 'Finalisation…')
    }, 400)

    try {
      const result = await generatePortfolioPdf(opts)
      clearInterval(tick)

      if ('error' in result) {
        setPhase('error')
        setErrorMsg(result.error)
        setProgress(0)
        return
      }

      setProgress(100)
      setMessage('PDF prêt')
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
      clearInterval(tick)
      setPhase('error')
      setErrorMsg(e?.message ?? String(e))
      setProgress(0)
    }
  }

  if (!open) return null

  const busy = phase === 'building'

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
        fontFamily: 'ui-monospace, monospace',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      }}>

        <div style={{
          padding: '24px 28px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#1a1816', fontWeight: 600 }}>
              Export PDF
            </div>
            <div style={{ fontSize: 10, color: '#8a8680', marginTop: 4 }}>
              Aperçu du portfolio (configuration atelier)
            </div>
          </div>
          <button onClick={() => !busy && onClose()} style={{
            background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
            fontSize: 18, color: '#8a8680', padding: 4, opacity: busy ? 0.3 : 1,
          }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

          <Section label="Destinataire">
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
                  }}>{p.label}</div>
                  <div style={{
                    fontSize: 9, marginTop: 3,
                    color: preset === p.id ? '#8a8680' : '#aaa',
                  }}>{p.sub}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section label="Format">
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
                }}>{f.label}</button>
              ))}
            </div>
          </Section>

          <Section label="Langue">
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
                }}>{l === 'fr' ? 'Français' : 'English'}</button>
              ))}
            </div>
          </Section>

          <Section label="Contenu">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['cover',    includeCover,    setIncludeCover,    'Couverture'] as const,
                ['about',    includeAbout,    setIncludeAbout,    'Page « À propos »'] as const,
                ['practice', includePractice, setIncludePractice, 'Page « Démarche »'] as const,
                ['contact',  includeContact,  setIncludeContact,  'Page contact'] as const,
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

          <Section label="Œuvres (max)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="number" min={1} max={MAX_WORKS}
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
                {maxWorks ?? `≤ ${MAX_WORKS}`} œuvres
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 8, color: '#bbb', lineHeight: 1.6 }}>
              Sections et ordre des œuvres : configurés depuis l’onglet <strong>Portfolio</strong>.
              Images JPEG 92 % · 2100 px · Imprimable A4 standard.
            </div>
          </Section>
        </div>

        <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
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

          <button onClick={handleExport} disabled={busy} style={{
            width: '100%', padding: '12px 0',
            background: busy ? '#e8e6e1' : '#1a1816',
            color:      busy ? '#8a8680' : '#ffffff',
            border: 'none', borderRadius: 4,
            fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            fontFamily: 'inherit', fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            transition: 'all 0.2s',
          }}>
            {busy ? 'Génération…' : phase === 'done' ? '↓ Télécharger à nouveau' : '↓ Générer le PDF'}
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
