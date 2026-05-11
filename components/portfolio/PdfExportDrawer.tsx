'use client'

// Atelier-side PDF preview drawer. Self-contained: server action loads
// config + works internally — this component just collects user options.

import { useState, useCallback, useEffect, useRef } from 'react'
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

const FORMATS: { id: PdfFormat; labelKey: 'pdf_format_a4p' | 'pdf_format_a4l' | 'pdf_format_usl' | 'pdf_format_a3l' }[] = [
  { id: 'a4p', labelKey: 'pdf_format_a4p' },
  { id: 'a4l', labelKey: 'pdf_format_a4l' },
  { id: 'usl', labelKey: 'pdf_format_usl' },
  { id: 'a3l', labelKey: 'pdf_format_a3l' },
]

const PRESETS: { id: Exclude<PdfPreset, 'custom'>; labelKey: 'pdf_preset_gallery' | 'pdf_preset_collector' | 'pdf_preset_press'; subKey: 'pdf_preset_gallery_sub' | 'pdf_preset_collector_sub' | 'pdf_preset_press_sub' }[] = [
  { id: 'galerie',        labelKey: 'pdf_preset_gallery',   subKey: 'pdf_preset_gallery_sub' },
  { id: 'collectionneur', labelKey: 'pdf_preset_collector', subKey: 'pdf_preset_collector_sub' },
  { id: 'presse',         labelKey: 'pdf_preset_press',     subKey: 'pdf_preset_press_sub' },
]

export default function PdfExportDrawer({ open, onClose }: Props) {
  const { t, lang } = useI18n()

  const [preset,          setPreset]          = useState<Exclude<PdfPreset, 'custom'>>('galerie')
  const [format,          setFormat]          = useState<PdfFormat>('a4p')
  const [exportLang,      setExportLang]      = useState<Lang>(lang)
  const [includeCover,    setIncludeCover]    = useState(true)
  const [includeAbout,    setIncludeAbout]    = useState(true)
  const [includePractice, setIncludePractice] = useState(true)
  const [includeContact,  setIncludeContact]  = useState(true)
  const [maxWorks,        setMaxWorks]        = useState<number | null>(null)

  const [phase,    setPhase]    = useState<Phase>('idle')
  const [progress, setProgress] = useState<number | null>(null) // null = indeterminate (honest)
  const [message,  setMessage]  = useState<string>('')
  const [warning,  setWarning]  = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const phaseTimerRef = useRef<number | null>(null)

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

    const opts: PdfRequestOptions = {
      preset, format, lang: exportLang,
      includeCover, includeAbout, includePractice, includeContact,
      maxWorks, collectionFilter: null,
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

          <Section label={t('pdf_section_content')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['cover',    includeCover,    setIncludeCover,    t('pdf_content_cover')] as const,
                ['about',    includeAbout,    setIncludeAbout,    t('pdf_content_about')] as const,
                ['practice', includePractice, setIncludePractice, t('pdf_content_practice')] as const,
                ['contact',  includeContact,  setIncludeContact,  t('pdf_content_contact')] as const,
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
