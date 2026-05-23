'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { workPhysicalBridgeUrl } from '@/lib/atelier/work-physical-bridge-url'
import { toast } from '@/lib/ui/toast'

type Props = {
  oeuvreId: number
  titre?: string | null
}

export function WorkFormPhysicalQr({ oeuvreId, titre }: Props) {
  const { t } = useI18n()
  const url = workPhysicalBridgeUrl(oeuvreId)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const QRCode = await import('qrcode')
        const png = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          errorCorrectionLevel: 'M',
        })
        if (!cancelled) {
          setDataUrl(png)
          setFailed(false)
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [url])

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('wf_qr_copied'))
    } catch {
      toast.error(t('wf_qr_load_failed'))
    }
  }, [t, url])

  const onPrint = useCallback(() => {
    const w = window.open('', '_blank', 'noopener,noreferrer')
    if (!w) return
    const label = titre?.trim() || `#${oeuvreId}`
    const img = dataUrl
      ? `<img src="${dataUrl}" alt="QR" width="200" height="200" style="display:block;margin:0 auto 12px" />`
      : `<p style="font:14px monospace">${url}</p>`
    w.document.write(`<!DOCTYPE html><html><head><title>${label}</title>
<style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px;margin:0}
p.url{font:11px monospace;word-break:break-all;color:#444;margin-top:8px}</style></head>
<body><h1 style="font-size:16px;font-weight:600;margin:0 0 16px">${label}</h1>${img}
<p class="url">${url}</p></body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }, [dataUrl, oeuvreId, titre, url])

  return (
    <div
      data-testid="work-form-physical-qr"
      style={{ marginTop: 32, borderTop: '1px solid var(--bd)', paddingTop: 24 }}
    >
      <div className="t-eyebrow" style={{ marginBottom: 8, fontSize: 11 }}>
        {t('wf_qr_section_title')}
      </div>
      <p className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.45, margin: '0 0 12px', fontSize: 11 }}>
        {t('wf_qr_hint')}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode
          <img src={dataUrl} alt="" width={200} height={200} style={{ display: 'block', borderRadius: 4, background: '#fff' }} />
        ) : failed ? (
          <div className="t-mono-sm" style={{ color: 'var(--rust)', padding: 16 }}>
            {t('wf_qr_load_failed')}
          </div>
        ) : (
          <div style={{ width: 200, height: 200, background: 'var(--bg2)', borderRadius: 4 }} aria-hidden />
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => void onCopy()}
            style={{ minHeight: 44, minWidth: 44 }}
          >
            {t('wf_qr_copy_link')}
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={onPrint}
            disabled={!dataUrl && !failed}
            style={{ minHeight: 44, minWidth: 44 }}
          >
            {t('wf_qr_print_label')}
          </button>
        </div>
        <div className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)', wordBreak: 'break-all', textAlign: 'center' }}>
          {url}
        </div>
      </div>
    </div>
  )
}
