'use client'

/**
 * Slideshow export (step 2, docs/archive/PLAN_SLIDESHOW.md, Pem 2026-11-15): GIF (one frame per slide, a pause
 * time, no transitions; 256 colours accepted) or the same frames as full-colour JPEG / PNG in a ZIP.
 * Frame sizes 1:1, 4:5, 9:16, 16:9 or custom (+ web = half size), scaled by a size slider down to FRAME_MIN
 * (40 px, Pem 2026-11-16); picture contained or filling the frame; with « contained », optionally in a round frame.
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

/** Size slider: logarithmic, so the small GIF end (40–200 px) is as easy to hit as the large one. */
const SIZE_STEPS = 1000
const toStep = (v: number, min: number, max: number) => Math.round(((Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))) * SIZE_STEPS)
const fromStep = (p: number, min: number, max: number) => Math.round(Math.exp(Math.log(min) + (p / SIZE_STEPS) * (Math.log(max) - Math.log(min))))

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
  /** Long side chosen with the slider for a preset frame; null = the preset's own size. */
  const [longSide, setLongSide] = useState<number | null>(null)
  const [web, setWeb] = useState(false)
  const [fit, setFit] = useState<FrameFit>('contain')
  const [round, setRound] = useState(false)
  const [pause, setPause] = useState(settings.seconds)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const shape =
    preset === 'custom'
      ? { w: Number(custom.w), h: Number(custom.h) }
      : FRAME_PRESETS[preset]
  const shapeLong = Math.max(shape.w, shape.h)
  const scale = preset !== 'custom' && longSide != null && shapeLong > 0 ? longSide / shapeLong : 1
  const base = { w: Math.round(shape.w * scale), h: Math.round(shape.h * scale) }
  const width = Math.round(web ? base.w / 2 : base.w)
  const height = Math.round(web ? base.h / 2 : base.h)
  const valid = Number.isFinite(width) && Number.isFinite(height) && width >= FRAME_MIN && height >= FRAME_MIN && width <= FRAME_MAX && height <= FRAME_MAX
  // Slider bounds on the long side, keeping the frame's ratio: the short side never drops under FRAME_MIN (after « web »).
  const shapeOk = shape.w > 0 && shape.h > 0
  const sizeMin = shapeOk ? Math.ceil((FRAME_MIN * shapeLong) / Math.min(shape.w, shape.h)) * (web ? 2 : 1) : FRAME_MIN
  const sizeOk = shapeOk && sizeMin < FRAME_MAX
  const sizeNow = Math.min(FRAME_MAX, Math.max(sizeMin, Math.max(base.w, base.h)))
  const onSize = (step: number) => {
    const next = fromStep(step, sizeMin, FRAME_MAX)
    if (preset === 'custom') {
      const k = next / shapeLong
      setCustom({ w: String(Math.max(FRAME_MIN, Math.round(shape.w * k))), h: String(Math.max(FRAME_MIN, Math.round(shape.h * k))) })
    } else setLongSide(next)
  }
  const roundOn = round && fit === 'contain'

  const label: React.CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 6 }
  const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 }
  const choice = (on: boolean): React.CSSProperties => ({ minHeight: 40, background: on ? 'var(--ac)' : undefined, color: on ? 'var(--bg0)' : undefined })

  const run = async () => {
    if (!valid || works.length === 0) return
    cancelRef.current = false
    setMessage(null)
    setProgress({ done: 0, total: works.length })
    const untitled = settings.caption.lang === 'en' ? t('ss_untitled_en') : t('ss_untitled_fr')
    const opts = { width, height, fit, pause, storySafe: preset === 'story', round: roundOn }
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
      downloadBlob(blob, `pem-slideshow-${stamp}-${width}x${height}${roundOn ? '-round' : ''}-${works.length}.${kind === 'gif' ? 'gif' : 'zip'}`)
      // A 40 px GIF is a few KB: under 1 MB say KB, not « 0 MB ».
      setMessage(
        blob.size < 1_048_576
          ? t('ss_ex_done_kb_fmt').replace('{kb}', String(Math.max(1, Math.round(blob.size / 1024))))
          : t('ss_ex_done_fmt').replace('{mb}', (blob.size / 1_048_576).toLocaleString(undefined, { maximumFractionDigits: 1 })),
      )
    } catch (e) {
      const msg = `${t('ss_error_prefix')} ${e instanceof Error ? e.message : String(e)}`
      setMessage(msg)
      surfaceError(msg, e, { source: 'slideshow.export', metadata: { kind, width, height, round: roundOn, frames: works.length } })
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
            <button key={p} type="button" className="btn ghost sm" style={choice(preset === p)} aria-pressed={preset === p} onClick={() => { setPreset(p); setLongSide(null) }} data-testid={`slideshow-export-frame-${p}`}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{t('ss_ex_size')}</span>
          <input
            type="range"
            min={0}
            max={SIZE_STEPS}
            value={sizeOk ? toStep(sizeNow, sizeMin, FRAME_MAX) : 0}
            disabled={!sizeOk}
            onChange={(e) => onSize(Number(e.target.value))}
            aria-label={t('ss_ex_size')}
            style={{ flex: 1, minWidth: 0, minHeight: 32 }}
            data-testid="slideshow-export-size"
          />
        </div>
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
        <label
          title={fit === 'contain' ? t('ss_ex_round_hint') : t('ss_ex_round_needs_contain')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, marginTop: 4, opacity: fit === 'contain' ? 1 : 0.45 }}
        >
          <input type="checkbox" checked={roundOn} disabled={fit !== 'contain'} onChange={(e) => setRound(e.target.checked)} data-testid="slideshow-export-round" />
          {t('ss_ex_round')}
        </label>
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
