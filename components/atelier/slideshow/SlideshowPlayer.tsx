'use client'

/**
 * Full-screen slideshow of a selection (TODO R5, docs/archive/PLAN_SLIDESHOW.md step 1, Pem 2026-11-14/15).
 * The whole picture, never cropped, on black / grey / white; ← → / Space / Esc / F on a computer,
 * swipe + tap on a phone; cut / fade / slide; loop; random order (shuffled once); an optional caption
 * dragged anywhere. Opens over the current page (portal) so closing returns exactly where Pem was.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl } from '@/lib/data'
import { SlideshowExport } from './SlideshowExport'
import {
  CAPTION_FIELDS,
  SLIDESHOW_BACKGROUNDS,
  SLIDESHOW_REORDER_MAX,
  SLIDESHOW_SECONDS_MAX,
  SLIDESHOW_SECONDS_MIN,
  SLIDESHOW_TRANSITIONS,
  captionText,
  shuffled,
  type CaptionField,
  type SlideWork,
  type SlideshowSettings,
} from '@/lib/slideshow'

const BG: Record<SlideshowSettings['background'], { bg: string; fg: string; shadow: string }> = {
  black: { bg: '#000', fg: '#f4f1ea', shadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)' },
  grey: { bg: '#6f6f6c', fg: '#f7f5f0', shadow: '0 1px 3px rgba(0,0,0,0.75), 0 0 10px rgba(0,0,0,0.45)' },
  white: { bg: '#fff', fg: '#1a1a1a', shadow: '0 1px 3px rgba(255,255,255,0.95), 0 0 12px rgba(255,255,255,0.8)' },
}

const TRANSITION_MS = 600
const CONTROLS_HIDE_MS = 2500

export type SlideshowSaveResult = { ok: true; id: string; name: string } | { error: string }

export function SlideshowPlayer({
  works,
  initialSettings,
  saved = null,
  onClose,
  onSettingsChange,
  onSave,
}: {
  works: SlideWork[]
  initialSettings: SlideshowSettings
  /** Set when playing a saved slideshow (its name shows in the save field). */
  saved?: { id: string; name: string } | null
  onClose: () => void
  /** Called on every settings change (remembered on this device for unsaved slideshows). */
  onSettingsChange?: (s: SlideshowSettings) => void
  /** Absent → no « Enregistrer » (e.g. before the table exists). */
  onSave?: (input: { id: string | null; name: string; workIds: number[]; settings: SlideshowSettings }) => Promise<SlideshowSaveResult>
}) {
  const { t } = useI18n()
  const [settings, setSettings] = useState<SlideshowSettings>(initialSettings)
  // The order Pem chose (selection order, or reordered); `order` is what plays (shuffled when random).
  const [baseOrder, setBaseOrder] = useState<number[]>(() => works.map((w) => w.id))
  const [order, setOrder] = useState<number[]>(() => (initialSettings.random ? shuffled(works.map((w) => w.id)) : works.map((w) => w.id)))
  const [idx, setIdx] = useState(0)
  const [prev, setPrev] = useState<{ id: number; dir: 1 | -1 } | null>(null)
  const [playing, setPlaying] = useState(true)
  const [controls, setControls] = useState(true)
  const [panel, setPanel] = useState(false)
  const [saveName, setSaveName] = useState(saved?.name ?? '')
  const [savedRef, setSavedRef] = useState(saved)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null)
  const dragCaption = useRef(false)

  const byId = useMemo(() => new Map(works.map((w) => [w.id, w])), [works])
  const n = order.length
  const current = byId.get(order[idx])
  const look = BG[settings.background]

  const update = useCallback(
    (patch: Partial<SlideshowSettings> | ((s: SlideshowSettings) => SlideshowSettings)) => {
      setSettings((s) => {
        const next = typeof patch === 'function' ? patch(s) : { ...s, ...patch }
        onSettingsChange?.(next)
        return next
      })
    },
    [onSettingsChange],
  )
  const updateCaption = (patch: Partial<SlideshowSettings['caption']>) => update((s) => ({ ...s, caption: { ...s.caption, ...patch } }))

  const go = useCallback(
    (step: 1 | -1) => {
      if (n === 0) return
      const nextIdx = idx + step
      if (nextIdx < 0 || nextIdx >= n) {
        if (!settings.loop) {
          if (nextIdx >= n) setPlaying(false)
          return
        }
      }
      setPrev({ id: order[idx], dir: step })
      setIdx(((nextIdx % n) + n) % n)
    },
    [idx, n, order, settings.loop],
  )

  // Autoplay: the timer restarts on every slide.
  useEffect(() => {
    if (!playing || panel || n < 2) return
    const timer = window.setTimeout(() => go(1), settings.seconds * 1000)
    return () => window.clearTimeout(timer)
  }, [playing, panel, n, idx, settings.seconds, go])

  // The outgoing picture stays under the incoming one for the transition, then goes.
  useEffect(() => {
    if (!prev) return
    const timer = window.setTimeout(() => setPrev(null), TRANSITION_MS + 50)
    return () => window.clearTimeout(timer)
  }, [prev])

  // The next two pictures load ahead.
  useEffect(() => {
    for (const k of [1, 2]) {
      const w = byId.get(order[(idx + k) % Math.max(n, 1)])
      const src = imageUrl(w?.file)
      if (src) {
        const img = new Image()
        img.src = src
      }
    }
  }, [idx, n, order, byId])

  // Controls hide after a moment of stillness while playing; any move or tap shows them.
  const poke = useCallback(() => {
    setControls(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControls(false), CONTROLS_HIDE_MS)
  }, [])
  useEffect(() => {
    poke()
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [poke])

  // Page under the slideshow does not scroll.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined)
  }, [])

  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = typeof target?.closest === 'function' ? target.closest('input, textarea, select') : null
      if (typing) return
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ') {
        e.preventDefault()
        setPlaying((p) => !p)
      } else if (e.key === 'Escape') {
        if (panel) setPanel(false)
        else close()
      } else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      else return
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, close, panel, poke, toggleFullscreen])

  const setRandom = (on: boolean) => {
    const at = order[idx]
    const next = on ? shuffled(baseOrder) : baseOrder
    // Keep the work on screen where it is.
    const nextIdx = Math.max(0, next.indexOf(at))
    setOrder(next)
    setIdx(nextIdx)
    setPrev(null)
    update({ random: on })
  }

  const move = (id: number, step: 1 | -1) => {
    const i = baseOrder.indexOf(id)
    const j = i + step
    if (i < 0 || j < 0 || j >= baseOrder.length) return
    const next = [...baseOrder]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBaseOrder(next)
    if (!settings.random) {
      const at = order[idx]
      setOrder(next)
      setIdx(Math.max(0, next.indexOf(at)))
    }
  }

  const save = async () => {
    if (!onSave || !saveName.trim()) return
    setSaving(true)
    try {
      const res = await onSave({ id: savedRef?.id ?? null, name: saveName.trim(), workIds: baseOrder, settings })
      if ('error' in res) setNotice(`${t('ss_error_prefix')} ${res.error}`)
      else {
        setSavedRef({ id: res.id, name: res.name })
        setNotice(t('ss_saved_as_fmt').replace('{name}', res.name))
      }
    } finally {
      setSaving(false)
    }
  }

  // Caption: dragged anywhere while the settings are open; stored as % of the screen.
  const onCaptionPointerDown = (e: React.PointerEvent) => {
    if (!panel) return
    e.stopPropagation()
    dragCaption.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onCaptionPointerMove = (e: React.PointerEvent) => {
    if (!dragCaption.current) return
    const r = rootRef.current?.getBoundingClientRect()
    if (!r) return
    updateCaption({
      x: Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100))),
      y: Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))),
    })
  }
  const onCaptionPointerUp = () => {
    dragCaption.current = false
  }

  // Swipe (phone) and tap (show / hide the controls) on the picture.
  const onStageDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }
  }
  const onStageUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1)
      poke()
    } else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - s.t < 400) {
      if (controls) setControls(false)
      else poke()
    }
  }

  const untitled = settings.caption.lang === 'en' ? t('ss_untitled_en') : t('ss_untitled_fr')
  const caption = current && settings.caption.on ? captionText(current, settings.caption.fields, settings.caption.lang, untitled) : ''
  const prevWork = prev ? byId.get(prev.id) : null
  const anim = (dir: 1 | -1) =>
    settings.transition === 'fade'
      ? `pem-ss-fade ${TRANSITION_MS}ms ease both`
      : settings.transition === 'slide'
        ? `${dir === 1 ? 'pem-ss-from-right' : 'pem-ss-from-left'} ${TRANSITION_MS}ms cubic-bezier(.2,.7,.2,1) both`
        : 'none'

  const slide = (w: SlideWork | undefined, key: string, animation: string) => (
    <div
      key={key}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(24px, 4vmin)',
        animation,
      }}
    >
      {w?.file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl(w.file) ?? ''}
          alt={w.title ?? ''}
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
            backgroundImage: thumbUrl(w.file) ? `url(${thumbUrl(w.file)})` : undefined,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        <span className="t-mono-sm" style={{ color: look.fg, opacity: 0.6 }}>
          {t('ss_no_image')}
        </span>
      )}
    </div>
  )

  const btn: React.CSSProperties = {
    minWidth: 44,
    minHeight: 44,
    border: 'none',
    background: 'transparent',
    color: '#f4f1ea',
    fontSize: 18,
    cursor: 'pointer',
    borderRadius: 8,
  }

  const view = (
    <div
      ref={rootRef}
      data-testid="slideshow-player"
      role="dialog"
      aria-modal="true"
      aria-label={t('ss_open')}
      onPointerMove={(e) => {
        if (e.pointerType === 'mouse') poke()
        onCaptionPointerMove(e)
      }}
      onPointerUp={onCaptionPointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: look.bg,
        overflow: 'hidden',
        touchAction: 'none',
        cursor: controls || panel ? 'default' : 'none',
      }}
    >
      <style>{`
        @keyframes pem-ss-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pem-ss-from-right { from { transform: translateX(100%) } to { transform: none } }
        @keyframes pem-ss-from-left { from { transform: translateX(-100%) } to { transform: none } }
        @keyframes pem-ss-caption { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      {/* Stage: outgoing picture under the incoming one during the transition. */}
      <div style={{ position: 'absolute', inset: 0 }} onPointerDown={onStageDown} onPointerUp={onStageUp}>
        {prevWork && settings.transition !== 'cut' ? slide(prevWork, `prev-${prev?.id}`, 'none') : null}
        {slide(current, `cur-${order[idx]}-${idx}`, prev ? anim(prev.dir) : 'none')}
      </div>

      {caption ? (
        <div
          key={`cap-${order[idx]}-${idx}`}
          data-testid="slideshow-caption"
          onPointerDown={onCaptionPointerDown}
          style={{
            position: 'absolute',
            left: `${settings.caption.x}%`,
            top: `${settings.caption.y}%`,
            transform: `translate(-${settings.caption.x}%, -${settings.caption.y}%)`,
            maxWidth: 'min(90vw, 720px)',
            padding: '6px 10px',
            color: look.fg,
            textShadow: settings.caption.shadow ? look.shadow : 'none',
            fontSize: 'clamp(13px, 1.6vw, 18px)',
            lineHeight: 1.35,
            animation: `pem-ss-caption 500ms ease ${settings.caption.fade === 'after' ? 900 : 0}ms both`,
            outline: panel ? `1px dashed ${look.fg}` : 'none',
            cursor: panel ? 'move' : 'default',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {caption}
        </div>
      ) : null}

      {/* Controls */}
      <div
        data-testid="slideshow-controls"
        style={{
          position: 'absolute',
          // Centred with auto margins (not left 50% + translate, which halves the width it may take and wraps on a phone).
          left: 12,
          right: 12,
          margin: '0 auto',
          width: 'fit-content',
          bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: 4,
          borderRadius: 12,
          background: 'rgba(20,20,20,0.72)',
          opacity: controls || panel ? 1 : 0,
          pointerEvents: controls || panel ? 'auto' : 'none',
          transition: 'opacity 250ms ease',
          maxWidth: 'calc(100vw - 24px)',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <button type="button" style={btn} aria-label={t('ss_prev')} title={t('ss_prev')} onClick={() => { go(-1); poke() }} data-testid="slideshow-prev">‹</button>
        <button type="button" style={btn} aria-label={playing ? t('ss_pause') : t('ss_play')} title={playing ? t('ss_pause') : t('ss_play')} onClick={() => { setPlaying((p) => !p); poke() }} data-testid="slideshow-play">
          {playing ? '❚❚' : '▶'}
        </button>
        <button type="button" style={btn} aria-label={t('ss_next')} title={t('ss_next')} onClick={() => { go(1); poke() }} data-testid="slideshow-next">›</button>
        <span className="t-mono-sm" style={{ color: '#f4f1ea', fontSize: 12, padding: '0 8px', minWidth: 56, textAlign: 'center' }} data-testid="slideshow-counter">
          {t('ss_counter_fmt').replace('{i}', String(n === 0 ? 0 : idx + 1)).replace('{n}', String(n))}
        </span>
        <button type="button" style={{ ...btn, fontSize: 16 }} aria-label={t('ss_settings')} title={t('ss_settings')} aria-pressed={panel} onClick={() => setPanel((p) => !p)} data-testid="slideshow-settings-toggle">⚙</button>
        {canFullscreen ? (
          <button type="button" style={{ ...btn, fontSize: 16 }} aria-label={t('ss_fullscreen')} title={t('ss_fullscreen')} onClick={toggleFullscreen}>⛶</button>
        ) : null}
        <button type="button" style={btn} aria-label={t('ss_close')} title={t('ss_close')} onClick={close} data-testid="slideshow-close">✕</button>
      </div>

      {panel ? (
        <SettingsPanel
          settings={settings}
          update={update}
          updateCaption={updateCaption}
          setRandom={setRandom}
          baseOrder={baseOrder}
          byId={byId}
          move={move}
          canSave={!!onSave}
          saveName={saveName}
          setSaveName={setSaveName}
          saving={saving}
          onSave={() => void save()}
          notice={notice}
          playWorks={order.map((id) => byId.get(id)).filter((w): w is SlideWork => !!w)}
        />
      ) : null}
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(view, document.body) : null
}

function SettingsPanel({
  settings,
  update,
  updateCaption,
  setRandom,
  baseOrder,
  byId,
  move,
  canSave,
  saveName,
  setSaveName,
  saving,
  onSave,
  notice,
  playWorks,
}: {
  settings: SlideshowSettings
  update: (patch: Partial<SlideshowSettings>) => void
  updateCaption: (patch: Partial<SlideshowSettings['caption']>) => void
  setRandom: (on: boolean) => void
  baseOrder: number[]
  byId: Map<number, SlideWork>
  move: (id: number, step: 1 | -1) => void
  canSave: boolean
  saveName: string
  setSaveName: (v: string) => void
  saving: boolean
  onSave: () => void
  notice: string | null
  /** The works in playing order (shuffled when random) — what the export renders. */
  playWorks: SlideWork[]
}) {
  const { t } = useI18n()
  const label: React.CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: 6 }
  const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 }
  const choice = (on: boolean): React.CSSProperties => ({
    minHeight: 40,
    background: on ? 'var(--ac)' : undefined,
    color: on ? 'var(--bg0)' : undefined,
  })
  const capKey: Record<CaptionField, 'ss_cap_title' | 'ss_cap_year' | 'ss_cap_technique' | 'ss_cap_support' | 'ss_cap_dimensions' | 'ss_cap_number'> = {
    title: 'ss_cap_title',
    year: 'ss_cap_year',
    technique: 'ss_cap_technique',
    support: 'ss_cap_support',
    dimensions: 'ss_cap_dimensions',
    number: 'ss_cap_number',
  }
  const toggleField = (f: CaptionField) => {
    const has = settings.caption.fields.includes(f)
    updateCaption({ fields: CAPTION_FIELDS.filter((x) => (x === f ? !has : settings.caption.fields.includes(x))) })
  }

  return (
    <div
      data-testid="slideshow-settings"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'max(12px, env(safe-area-inset-top, 0px))',
        right: 12,
        bottom: 'calc(max(12px, env(safe-area-inset-bottom, 0px)) + 64px)',
        width: 'min(340px, calc(100vw - 24px))',
        overflowY: 'auto',
        background: 'var(--bg1)',
        color: 'var(--tx1)',
        border: '1px solid var(--bd)',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}
    >
      <div>
        <div style={label}>{t('ss_set_background')}</div>
        <div style={row}>
          {SLIDESHOW_BACKGROUNDS.map((b) => (
            <button key={b} type="button" className="btn ghost sm" style={choice(settings.background === b)} aria-pressed={settings.background === b} onClick={() => update({ background: b })}>
              {t(b === 'black' ? 'ss_bg_black' : b === 'grey' ? 'ss_bg_grey' : 'ss_bg_white')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={label}>{t('ss_set_seconds')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="range"
            min={SLIDESHOW_SECONDS_MIN}
            max={SLIDESHOW_SECONDS_MAX}
            value={settings.seconds}
            onChange={(e) => update({ seconds: Number(e.target.value) })}
            style={{ flex: 1 }}
            data-testid="slideshow-seconds"
          />
          <span className="t-mono-sm" style={{ minWidth: 32, textAlign: 'right' }}>{settings.seconds} s</span>
        </div>
      </div>

      <div>
        <div style={label}>{t('ss_set_transition')}</div>
        <div style={row}>
          {SLIDESHOW_TRANSITIONS.map((tr) => (
            <button key={tr} type="button" className="btn ghost sm" style={choice(settings.transition === tr)} aria-pressed={settings.transition === tr} onClick={() => update({ transition: tr })}>
              {t(tr === 'cut' ? 'ss_tr_cut' : tr === 'fade' ? 'ss_tr_fade' : 'ss_tr_slide')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
          <input type="checkbox" checked={settings.loop} onChange={(e) => update({ loop: e.target.checked })} />
          {t('ss_set_loop')}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
          <input type="checkbox" checked={settings.random} onChange={(e) => setRandom(e.target.checked)} data-testid="slideshow-random" />
          {t('ss_set_random')}
        </label>
      </div>

      <div>
        <div style={label}>{t('ss_set_caption')}</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
          <input type="checkbox" checked={settings.caption.on} onChange={(e) => updateCaption({ on: e.target.checked })} data-testid="slideshow-caption-on" />
          {t('ss_set_caption_on')}
        </label>
        {settings.caption.on ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
            <div style={row}>
              {CAPTION_FIELDS.map((f) => (
                <button key={f} type="button" className="btn ghost sm" style={choice(settings.caption.fields.includes(f))} aria-pressed={settings.caption.fields.includes(f)} onClick={() => toggleField(f)}>
                  {t(capKey[f])}
                </button>
              ))}
            </div>
            <div>
              <div style={label}>{t('ss_set_caption_lang')}</div>
              <div style={row}>
                {(['fr', 'en'] as const).map((l) => (
                  <button key={l} type="button" className="btn ghost sm" style={choice(settings.caption.lang === l)} aria-pressed={settings.caption.lang === l} onClick={() => updateCaption({ lang: l })}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={label}>{t('ss_set_caption_fade')}</div>
              <div style={row}>
                {(['with', 'after'] as const).map((f) => (
                  <button key={f} type="button" className="btn ghost sm" style={choice(settings.caption.fade === f)} aria-pressed={settings.caption.fade === f} onClick={() => updateCaption({ fade: f })}>
                    {t(f === 'with' ? 'ss_fade_with' : 'ss_fade_after')}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
              <input type="checkbox" checked={settings.caption.shadow} onChange={(e) => updateCaption({ shadow: e.target.checked })} />
              {t('ss_set_caption_shadow')}
            </label>
            <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('ss_caption_drag_hint')}</span>
          </div>
        ) : null}
      </div>

      <div>
        <div style={label}>{t('ss_set_order')}</div>
        {baseOrder.length <= SLIDESHOW_REORDER_MAX ? (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }} data-testid="slideshow-order">
            {baseOrder.map((id, i) => {
              const w = byId.get(id)
              const thumb = thumbUrl(w?.file)
              return (
                <div key={id} style={{ flex: '0 0 auto', width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={w?.title ?? ''} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
                  ) : (
                    <div style={{ width: 56, height: 56, borderRadius: 4, border: '1px solid var(--bd)' }} />
                  )}
                  <div style={{ display: 'flex' }}>
                    <button type="button" className="btn ghost sm" style={{ minWidth: 28, minHeight: 32, padding: 0 }} disabled={i === 0} aria-label={t('ss_move_left')} title={t('ss_move_left')} onClick={() => move(id, -1)}>‹</button>
                    <button type="button" className="btn ghost sm" style={{ minWidth: 28, minHeight: 32, padding: 0 }} disabled={i === baseOrder.length - 1} aria-label={t('ss_move_right')} title={t('ss_move_right')} onClick={() => move(id, 1)}>›</button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)' }}>{t('ss_order_long')}</span>
        )}
      </div>

      <SlideshowExport works={playWorks} settings={settings} />

      {canSave ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
          <input
            className="input"
            value={saveName}
            maxLength={120}
            placeholder={t('ss_save_name')}
            aria-label={t('ss_save_name')}
            onChange={(e) => setSaveName(e.target.value)}
            style={{ minHeight: 44 }}
            data-testid="slideshow-save-name"
          />
          <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={saving || !saveName.trim()} onClick={onSave} data-testid="slideshow-save">
            {t('ss_save')}
          </button>
          {notice ? <span className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx2)' }}>{notice}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
