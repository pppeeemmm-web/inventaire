'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { parseWorkIdFromScanText } from '@/lib/mobile/parse-work-id-from-scan'
import { FieldHubBackLink } from '@/components/shared/FieldHubBackLink'
import { useMediaQuery } from '@/lib/useMediaQuery'

export default function AtelierScanPage() {
  const { t } = useI18n()
  const router = useRouter()
  const narrow = useMediaQuery('(max-width: 767px)')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const [manualId, setManualId] = useState('')
  const [hint, setHint] = useState('')
  const [scanning, setScanning] = useState(false)

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
  }, [])

  const goToWork = useCallback(
    (id: number) => {
      stopCamera()
      router.push(`/atelier?work=${id}`)
    },
    [router, stopCamera],
  )

  useEffect(() => () => stopCamera(), [stopCamera])

  async function startBarcodeLoop() {
    type BDType = new (opts: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue?: string }[]> }
    const BD = (typeof window !== 'undefined'
      ? (window as unknown as { BarcodeDetector?: BDType }).BarcodeDetector
      : undefined) as BDType | undefined
    if (!BD) {
      setHint(t('scan_no_barcode'))
      return
    }
    const detector = new BD({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] })
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const video = videoRef.current
      if (!video) return

      const tick = async () => {
        if (!streamRef.current) return
        if (!video.videoWidth) {
          rafRef.current = requestAnimationFrame(() => void tick())
          return
        }
        try {
          const codes = await detector.detect(video)
          const raw = codes[0]?.rawValue?.trim()
          if (raw) {
            const id = parseWorkIdFromScanText(raw)
            if (id !== null) {
              goToWork(id)
              return
            }
            setHint(t('scan_not_found'))
          }
        } catch {
          /* ignore frame errors */
        }
        rafRef.current = requestAnimationFrame(() => void tick())
      }
      void tick()
    } catch {
      setHint(t('scan_no_barcode'))
      setScanning(false)
    }
  }

  function onManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = parseWorkIdFromScanText(manualId)
    if (id === null) {
      setHint(t('scan_not_found'))
      return
    }
    goToWork(id)
  }

  return (
    <div
      data-testid="atelier-scan-root"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg0)',
        padding: narrow
          ? 'max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))'
          : 32,
        gap: 20,
        maxWidth: 560,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      <div className="row between" style={{ alignItems: 'center', gap: 12 }}>
        <button type="button" className="btn ghost sm" onClick={() => router.back()}>
          ← {t('back')}
        </button>
        <div className="t-eyebrow" style={{ color: 'var(--ac)' }}>
          {t('scan_page_title')}
        </div>
      </div>

      <p className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.5, margin: 0 }}>
        {t('scan_page_hint')}
      </p>

      <div style={{ border: '1px solid var(--bd)', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', display: 'block', maxHeight: 'min(50dvh, 360px)' }} />
      </div>

      <div className="row gap-sm" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" onClick={() => void startBarcodeLoop()} disabled={scanning}>
          {scanning ? '…' : t('scan_start_camera')}
        </button>
        <button type="button" className="btn ghost sm" onClick={stopCamera}>
          {t('cancel')}
        </button>
      </div>

      {hint ? (
        <div className="t-mono-sm" style={{ color: 'var(--rust)' }}>
          {hint}
        </div>
      ) : null}

      <form onSubmit={onManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        <label className="t-label" style={{ fontSize: 11 }}>
          {t('scan_manual_id_placeholder')}
        </label>
        <input
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          inputMode="numeric"
          placeholder="2190"
          style={{
            padding: '12px 14px',
            border: '1px solid var(--bd)',
            borderRadius: 4,
            background: 'var(--bg1)',
            color: 'var(--tx)',
            fontSize: 16,
          }}
        />
        <button type="submit" className="btn primary">
          {t('scan_go')}
        </button>
      </form>

      <FieldHubBackLink />
    </div>
  )
}
