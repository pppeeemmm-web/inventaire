'use client'

// Landing-page mini PDF popup — 3 preset buttons → instant download.
// No options UI. For atelier tuning use PdfExportDrawer instead.

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { generatePortfolioPdf } from '@/app/atelier/portfolio/pdf-action'
import { PRESET_DEFAULTS, type PdfPreset } from '@/lib/portfolio-pdf-types'

interface Props {
  open:    boolean
  onClose: () => void
}

type Phase = 'idle' | 'building' | 'error'

const PRESET_IDS = ['galerie', 'collectionneur', 'presse'] as const satisfies readonly Exclude<PdfPreset, 'custom'>[]

const PRESET_LABEL_KEYS: Record<(typeof PRESET_IDS)[number], { title: DictKey; sub: DictKey }> = {
  galerie:        { title: 'landing_pdf_preset_galerie_title',        sub: 'landing_pdf_preset_galerie_sub' },
  collectionneur: { title: 'landing_pdf_preset_collectionneur_title', sub: 'landing_pdf_preset_collectionneur_sub' },
  presse:         { title: 'landing_pdf_preset_presse_title',         sub: 'landing_pdf_preset_presse_sub' },
}

export default function LandingPdfPopup({ open, onClose }: Props) {
  const { t, lang } = useI18n()
  const [busyId,   setBusyId]   = useState<PdfPreset | null>(null)
  const [phase,    setPhase]    = useState<Phase>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!open) return null

  async function handlePick(presetId: Exclude<PdfPreset, 'custom'>) {
    setBusyId(presetId)
    setPhase('building')
    setErrorMsg(null)

    try {
      const d = PRESET_DEFAULTS[presetId]
      const result = await generatePortfolioPdf({
        preset:           presetId,
        format:           'a4p',
        lang,
        includeCover:     d.includeCover,
        includeAbout:     d.includeAbout,
        includePractice:  d.includePractice,
        includeContact:   d.includeContact,
        maxWorks:         d.maxWorks,
        collectionFilter: null,
      })

      if ('error' in result) {
        setPhase('error')
        setErrorMsg(result.error)
        setBusyId(null)
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

      setBusyId(null)
      setPhase('idle')
      onClose()
    } catch (e: unknown) {
      setPhase('error')
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setBusyId(null)
    }
  }

  const busy = busyId !== null

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
              <button key={id} type="button" onClick={() => handlePick(id)} disabled={busy} style={{
                background: busyId === id ? '#1a1816' : '#fff',
                color:      busyId === id ? '#fff'    : '#1a1816',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: 4, padding: '12px 14px',
                cursor: busy ? 'default' : 'pointer',
                textAlign: 'left',
                transition: 'all .15s',
                fontFamily: 'inherit',
                opacity: busy && busyId !== id ? 0.4 : 1,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}>
                  <span>{t(keys.title)}</span>
                  <span style={{ opacity: 0.5, fontSize: 10 }}>
                    {busyId === id ? '…' : '↓'}
                  </span>
                </div>
                <div style={{
                  fontSize: 9, marginTop: 4,
                  color: busyId === id ? '#bcb8b1' : '#aaa',
                }}>
                  {t(keys.sub)}
                </div>
              </button>
            )
          })}
        </div>

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
          A4 · {lang === 'fr' ? t('locale_fr_short') : t('locale_en_short')}
        </div>
      </div>
    </>
  )
}
