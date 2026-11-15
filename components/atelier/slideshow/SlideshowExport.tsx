'use client'

/**
 * Slideshow export (step 2, docs/archive/PLAN_SLIDESHOW.md, Pem 2026-11-15): GIF (one frame per slide, a pause
 * time, no transitions; 256 colours accepted) or the same frames as full-colour JPEG / PNG in a ZIP.
 * Frame sizes 1:1, 4:5, 9:16, 16:9 or custom (+ web = half size); picture contained or filling the frame.
 */

import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { surfaceError } from '@/lib/error-reporter/client'
import {
  FRAME_MAX,
  FRAME_MIN,
  FRAME_PRESETS,
  downloadBlob,
  exportFramesZip,
  exportGif,
  type FrameFit,
  type FramePreset,
} from '@/lib/slideshow-export'
import { SLIDESHOW_SECONDS_MAX, type SlideWork, type SlideshowSettings } from '@/lib/slideshow'

const PRESET_KEYS = {
  square: 'ss_ex_square',
  portrait: 'ss_ex_portrait',
  story: 'ss_ex_story',
  landscape: 'ss_ex_landscape',
  custom: 'ss_ex_custom',
} as const

export function SlideshowExport({ works, settings }: { works: SlideWork[]; settings: SlideshowSettings }) {
  const { t } = useI18n()
  const [kind, setKind] = useState<'gif' | 'zip'>('gif')
  const [imgFormat, setImgFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [preset, setPreset] = useState<FramePreset>('square')
  const [custom, setCustom] = useState({ w: '1600', h: '1200' })
  const [web, setWeb] = useState(false)
  const [fit, setFit] = useState<FrameFit>('contain')
  const [pause, setPause] = useState(settings.seconds)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const base =
    preset === 'custom'
      ? { w: Number(custom.w), h: Number(custom.h) }
      : FRAME_PRESETS[preset]
  const valid = Number.isFinite(base.w) && Number.isFinite(base.h) && base.w >= FRAME_MIN && base.h >= FRAME_MIN && base.w <= FRAME_MAX && base.h <= FRAME_MAX
  const width = Math.round(web ? base.w / 2 : base.w)
  const height = Math.round(web ? base.h / 2 : base.h)

  const label: React.CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 6 }
  const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 }
  const choice = (on: boolean): React.CSSProperties => ({ minHeight: 40, background: on ? 'var(--ac)' : undefined, color: on ? 'var(--bg0)' : undefined })

  const run = async () => {
    if (!valid || works.length === 0) return
    cancelRef.current = false
    setMessage(null)
    setProgress({ done: 0, total: works.length })
    const untitled = settings.caption.lang === 'en' ? t('ss_untitled_en') : t('ss_untitled_fr')
    const opts = { width, height, fit, pause, storySafe: preset === 'story' }
    const onProgress = (done: number, total: number) => setProgress({ done, total })
    const cancelled = () => cancelRef.current
    try {
      const blob =
        kind === 'gif'
          ? await exportGif(works, settings, opts, untitled, onProgress, cancelled)
          : await exportFramesZip(works, settings, opts, imgFormat, untitled, onProgress, cancelled)
      if (!blob) {
        setMessage(t('ss_ex_cancelled'))
        return
      }
      // Local calendar day (sv-SE formats as YYYY-MM-DD), not UTC.
      const stamp = new Date().toLocaleDateString('sv-SE')
      downloadBlob(blob, `pem-slideshow-${stamp}-${width}x${height}-${works.length}.${kind === 'gif' ? 'gif' : 'zip'}`)
      setMessage(t('ss_ex_done_fmt').replace('{mb}', (blob.size / 1_048_576).toLocaleString(undefined, { maximumFractionDigits: 1 })))
    } catch (e) {
      const msg = `${t('ss_error_prefix')} ${e instanceof Error ? e.message : String(e)}`
      setMessage(msg)
      surfaceError(msg, e, { source: 'slideshow.export', metadata: { kind, width, height, frames: works.length } })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div data-testid="slideshow-export" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
      <div style={label}>{t('ss_ex_heading')}</div>

      <div style={row}>
        {(['gif', 'zip'] as const).map((k) => (
          <button key={k} type="button" className="btn ghost sm" style={choice(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`slideshow-export-kind-${k}`}>
            {t(k === 'gif' ? 'ss_ex_gif' : 'ss_ex_zip')}
          </button>
        ))}
      </div>
      {kind === 'zip' ? (
        <div style={row}>
          {(['jpeg', 'png'] as const).map((f) => (
            <button key={f} type="button" className="btn ghost sm" style={choice(imgFormat === f)} aria-pressed={imgFormat === f} onClick={() => setImgFormat(f)}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      ) : (
        <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('ss_ex_gif_hint')}</span>
      )}

      <div>
        <div style={label}>{t('ss_ex_frame')}</div>
        <div style={row}>
          {(Object.keys(PRESET_KEYS) as FramePreset[]).map((p) => (
            <button key={p} type="button" className="btn ghost sm" style={choice(preset === p)} aria-pressed={preset === p} onClick={() => setPreset(p)} data-testid={`slideshow-export-frame-${p}`}>
              {t(PRESET_KEYS[p])}
            </button>
          ))}
        </div>
        {preset === 'custom' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <input className="input" inputMode="numeric" value={custom.w} onChange={(e) => setCustom({ ...custom, w: e.target.value.replace(/\D/g, '') })} aria-label={t('ss_ex_width')} style={{ width: 80, minHeight: 40 }} />
            <span className="t-mono-sm">×</span>
            <input className="input" inputMode="numeric" value={custom.h} onChange={(e) => setCustom({ ...custom, h: e.target.value.replace(/\D/g, '') })} aria-label={t('ss_ex_height')} style={{ width: 80, minHeight: 40 }} />
            <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>px</span>
          </div>
        ) : null}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, marginTop: 4 }}>
          <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
          {t('ss_ex_web')}
        </label>
        <span className="t-mono-sm" style={{ fontSize: 11, color: valid ? 'var(--tx3)' : 'var(--rust)' }}>
          {valid ? `${width} × ${height} px` : t('ss_ex_size_bad').replace('{min}', String(FRAME_MIN)).replace('{max}', String(FRAME_MAX))}
        </span>
      </div>

      <div>
        <div style={label}>{t('ss_ex_fit')}</div>
        <div style={row}>
          {(['contain', 'fill'] as const).map((f) => (
            <button key={f} type="button" className="btn ghost sm" style={choice(fit === f)} aria-pressed={fit === f} onClick={() => setFit(f)}>
              {t(f === 'contain' ? 'ss_ex_contain' : 'ss_ex_fill')}
            </button>
          ))}
        </div>
      </div>

      {kind === 'gif' ? (
        <div>
          <div style={label}>{t('ss_ex_pause')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={1} max={SLIDESHOW_SECONDS_MAX} value={pause} onChange={(e) => setPause(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="t-mono-sm" style={{ minWidth: 32, textAlign: 'right' }}>{pause} s</span>
          </div>
        </div>
      ) : null}

      {progress ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-mono-sm" data-testid="slideshow-export-progress">
            {t('ss_ex_progress_fmt').replace('{i}', String(progress.done)).replace('{n}', String(progress.total))}
          </span>
          <button type="button" className="btn ghost sm" style={{ minHeight: 40 }} onClick={() => { cancelRef.current = true }}>
            {t('ss_ex_cancel')}
          </button>
        </div>
      ) : (
        <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={!valid || works.length === 0} onClick={() => void run()} data-testid="slideshow-export-run">
          {t(kind === 'gif' ? 'ss_ex_make_gif' : 'ss_ex_make_zip')}
        </button>
      )}
      {message ? <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }} data-testid="slideshow-export-message">{message}</span> : null}
    </div>
  )
}
