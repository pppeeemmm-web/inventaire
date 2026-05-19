'use client'

// Public PDF popup: visitors choose purpose, A4 format, and language only.
// Curatorial sequencing/layout/content is resolved from saved Atelier profiles.

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { generatePortfolioPdf } from '@/app/atelier/portfolio/pdf-action'
import { PRESET_DEFAULTS, type PdfFormat, type PdfPreset } from '@/lib/portfolio-pdf-types'
import type { Lang } from '@/lib/i18n/dictionary'

interface Props {
  open:    boolean
  onClose: () => void
}

type Phase = 'idle' | 'building' | 'error'

const PRESET_IDS = ['galerie', 'collectionneur', 'presse'] as const satisfies readonly Exclude<PdfPreset, 'custom'>[]
const FORMAT_IDS = ['a4p', 'a4l'] as const satisfies readonly PdfFormat[]

const PRESET_LABEL_KEYS: Record<(typeof PRESET_IDS)[number], { title: DictKey; sub: DictKey }> = {
  galerie:        { title: 'landing_pdf_preset_galerie_title',        sub: 'landing_pdf_preset_galerie_sub' },
  collectionneur: { title: 'landing_pdf_preset_collectionneur_title', sub: 'landing_pdf_preset_collectionneur_sub' },
  presse:         { title: 'landing_pdf_preset_presse_title',         sub: 'landing_pdf_preset_presse_sub' },
}

export default function LandingPdfPopup({ open, onClose }: Props) {
  const { t, lang } = useI18n()
  const [preset,   setPreset]   = useState<Exclude<PdfPreset, 'custom'>>('galerie')
  const [format,   setFormat]   = useState<PdfFormat>('a4p')
  const [pdfLang,  setPdfLang]  = useState<Lang>(lang)
  const [busy,     setBusy]     = useState(false)
  const [phase,    setPhase]    = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!open) return null

  async function handleDownload() {
    setBusy(true)
    setPhase('building')
    setErrorMsg(null)

    try {
      const d = PRESET_DEFAULTS[preset]
      const result = await generatePortfolioPdf({
        preset,
        format,
        lang:             pdfLang,
        includeCover:     d.includeCover,
        includeAbout:     d.includeAbout,
        includeCollectionText: false,
        includePractice:  d.includePractice,
        includeCv:        true,
        includeContact:   d.includeContact,
        maxWorks:         d.maxWorks,
        collectionFilter: null,
      })

      if ('error' in result) {
        setPhase('error')
        setErrorMsg(result.error)
        setBusy(false)
        return
      }

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

      setBusy(false)
      setPhase('idle')
      onClose()
    } catch (e: unknown) {
      setPhase('error')
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <>
      <div onClick={() => !busy && onClose()} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 9000, backdropFilter: 'blur(3px)',
      }} />

      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(360px, calc(100vw - 32px))',
        background: '#faf9f7',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 6, padding: '28px 28px 24px',
        zIndex: 9001,
        fontFamily: 'var(--font-ui)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <button type="button" onClick={() => !busy && onClose()} aria-label={t('close')} style={{
          position: 'absolute', top: 10, right: 14,
          background: 'none', border: 'none',
          fontSize: 18, color: '#8a8680', padding: 4,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.3 : 1,
        }}>×</button>

        <div style={{
          fontSize: 9, letterSpacing: 3, textTransform: 'uppercase',
          color: '#8a8680', marginBottom: 4,
        }}>
          {t('landing_pdf_download_strip')}
        </div>
        <div style={{
          fontSize: 16, color: '#1a1816', marginBottom: 22,
          fontFamily: 'Instrument Serif, serif', letterSpacing: '-0.01em',
        }}>
          {t('landing_pdf_modal_title')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRESET_IDS.map((id) => {
            const keys = PRESET_LABEL_KEYS[id]
            return (
              <button key={id} type="button" onClick={() => setPreset(id)} disabled={busy} style={{
                background: preset === id ? '#1a1816' : '#fff',
                color:      preset === id ? '#fff'    : '#1a1816',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 4, padding: '12px 14px',
                cursor: busy ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'all .15s',
                fontFamily: 'inherit',
                opacity: busy && preset !== id ? 0.4 : 1,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}>
                  <span>{t(keys.title)}</span>
                </div>
                <div style={{
                  fontSize: 9, marginTop: 4,
                  color: preset === id ? '#bcb8b1' : '#aaa',
                }}>
                  {t(keys.sub)}
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 16 }}>
          {FORMAT_IDS.map(id => (
            <button key={id} type="button" onClick={() => setFormat(id)} disabled={busy} style={choiceStyle(format === id, busy)}>
              {t(id === 'a4p' ? 'pdf_format_a4p' : 'pdf_format_a4l')}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
          {(['fr', 'en'] as Lang[]).map(id => (
            <button key={id} type="button" onClick={() => setPdfLang(id)} disabled={busy} style={choiceStyle(pdfLang === id, busy)}>
              {id === 'fr' ? t('locale_fr_short') : t('locale_en_short')}
            </button>
          ))}
        </div>

        <button type="button" onClick={handleDownload} disabled={busy} style={{
          width: '100%',
          marginTop: 16,
          background: '#1a1816',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '12px 14px',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: 'uppercase',
          fontFamily: 'inherit',
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}>
          {busy ? t('generating') : t('pdf_generate')}
        </button>

        {phase === 'error' && errorMsg && (
          <div style={{
            marginTop: 14, fontSize: 9, color: '#c05050', lineHeight: 1.5,
          }}>
            {t('error_prefix')} {errorMsg}
          </div>
        )}

        <div style={{
          marginTop: 18, fontSize: 8, color: '#bbb',
          letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center',
        }}>
          {format === 'a4p' ? t('pdf_format_a4p') : t('pdf_format_a4l')} · {pdfLang === 'fr' ? t('locale_fr_short') : t('locale_en_short')}
        </div>
      </div>
    </>
  )
}

function choiceStyle(active: boolean, busy: boolean): CSSProperties {
  return {
    background: active ? '#1a1816' : '#fff',
    color: active ? '#ffffff' : '#1a1816',
    border: `1px solid ${active ? '#1a1816' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 4,
    padding: '8px 10px',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    cursor: busy ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }
}
