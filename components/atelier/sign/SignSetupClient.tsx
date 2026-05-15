'use client'

import Link from 'next/link'
import { useRef, useState, useTransition, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { saveContactSignature } from '@/app/atelier/sign/actions'

export function SignSetupClient() {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [contactId, setContactId] = useState('')
  const [busy, startBusy] = useTransition()

  const inputStyle: CSSProperties = {
    minHeight: 44,
    fontSize: 16,
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    border: '1px solid var(--bd)',
    borderRadius: 6,
    background: 'var(--bg0)',
    color: 'var(--tx)',
  }

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current
    if (!c) return null
    const r = c.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const clear = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
  }

  const save = () => {
    const id = parseInt(contactId, 10)
    if (!Number.isFinite(id) || id <= 0) {
      toast.error(t('error_prefix'))
      return
    }
    const c = canvasRef.current
    if (!c) return
    const data = c.toDataURL('image/png')
    startBusy(async () => {
      const res = await saveContactSignature(id, data)
      if ('error' in res) toast.error(res.error)
      else toast.success(t('sign_setup_ok'))
    })
  }

  return (
    <main
      data-testid="sign-setup-root"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(80px, calc(24px + env(safe-area-inset-bottom)))',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <h1 className="serif" style={{ fontSize: 22 }}>{t('sign_setup_title')}</h1>
      <p className="t-mono-sm" style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.5, marginBottom: 16 }}>
        {t('sign_setup_intro')}
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 12 }}>
        <span>{t('sign_setup_contact_label')}</span>
        <input
          type="number"
          inputMode="numeric"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          style={inputStyle}
        />
      </label>

      <canvas
        ref={(el) => {
          canvasRef.current = el
          if (el && el.width === 300) {
            const ctx = el.getContext('2d')
            if (ctx) {
              ctx.fillStyle = '#fff'
              ctx.fillRect(0, 0, el.width, el.height)
            }
          }
        }}
        width={320}
        height={140}
        aria-label={t('sign_setup_title')}
        style={{
          width: '100%',
          maxWidth: 320,
          height: 140,
          border: '1px solid var(--bd)',
          borderRadius: 6,
          touchAction: 'none',
          background: '#fff',
        }}
        onPointerDown={(e) => {
          drawing.current = true
          const p = pos(e)
          const ctx = canvasRef.current?.getContext('2d')
          if (!p || !ctx) return
          ctx.strokeStyle = '#111'
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const p = pos(e)
          const ctx = canvasRef.current?.getContext('2d')
          if (!p || !ctx) return
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
        }}
        onPointerUp={() => { drawing.current = false }}
        onPointerLeave={() => { drawing.current = false }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" className="btn ghost" style={{ minHeight: 44, flex: 1 }} onClick={clear}>
          {t('sign_setup_clear')}
        </button>
        <button type="button" className="btn primary" style={{ minHeight: 44, flex: 1 }} disabled={busy} onClick={save}>
          {t('sign_setup_save')}
        </button>
      </div>

      <Link href="/hub" className="btn ghost" style={{ minHeight: 44, marginTop: 12, display: 'block', textAlign: 'center' }}>
        {t('field_stub_cta_hub')}
      </Link>
    </main>
  )
}
