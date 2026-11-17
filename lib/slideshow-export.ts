/**
 * Slideshow export, step 2 (docs/archive/PLAN_SLIDESHOW.md, Pem 2026-11-15): an animated GIF (one frame per
 * slide held for a pause time, no transitions) and a ZIP of the same frames as full-colour JPEG / PNG.
 * Everything runs in the browser (no server job). Browser-only.
 */

import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import { imageUrl } from '@/lib/data'
import { captionText, type SlideWork, type SlideshowSettings } from '@/lib/slideshow'

export const FRAME_PRESETS = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
} as const
export type FramePreset = keyof typeof FRAME_PRESETS | 'custom'
export type FrameFit = 'contain' | 'fill'
/** Smallest side Pem uses: 40 × 40 / 50 × 60 GIFs (owner 2026-11-16; 20 × 20 is too small). */
export const FRAME_MIN = 40
export const FRAME_MAX = 4000

export type ExportOptions = {
  width: number
  height: number
  fit: FrameFit
  /** Seconds each frame stays in the GIF. */
  pause: number
  /** 9:16 frames: keep the caption out of Instagram's own top and bottom bands. */
  storySafe: boolean
  /** Picture shown in a circle (covering it), background colour around. Only with fit `contain`. */
  round?: boolean
}

const BG_FILL: Record<SlideshowSettings['background'], { bg: string; fg: string; shadow: string }> = {
  black: { bg: '#000000', fg: '#f4f1ea', shadow: 'rgba(0,0,0,0.85)' },
  grey: { bg: '#6f6f6c', fg: '#f7f5f0', shadow: 'rgba(0,0,0,0.7)' },
  white: { bg: '#ffffff', fg: '#1a1a1a', shadow: 'rgba(255,255,255,0.95)' },
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** One slide drawn into the frame: background, picture (contain = whole, fill = covers, edges cut, round = in a circle), caption. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  work: SlideWork,
  settings: SlideshowSettings,
  opts: ExportOptions,
  untitled: string,
): void {
  const { width: W, height: H } = opts
  const look = BG_FILL[settings.background]
  ctx.save()
  ctx.fillStyle = look.bg
  ctx.fillRect(0, 0, W, H)
  if (img && img.naturalWidth > 0) {
    const iw = img.naturalWidth
    const ih = img.naturalHeight
    if (opts.round && opts.fit === 'contain') {
      // Round frame: a circle as large as the frame allows, the picture covers it, background outside.
      const margin = Math.round(Math.min(W, H) * 0.04)
      const r = Math.min(W, H) / 2 - margin
      const s = Math.max((2 * r) / iw, (2 * r) / ih)
      const dw = iw * s
      const dh = ih * s
      ctx.save()
      ctx.beginPath()
      ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
      ctx.restore()
    } else if (opts.fit === 'fill') {
      const s = Math.max(W / iw, H / ih)
      const dw = iw * s
      const dh = ih * s
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
    } else {
      const margin = Math.round(Math.min(W, H) * 0.04)
      const s = Math.min((W - 2 * margin) / iw, (H - 2 * margin) / ih)
      const dw = iw * s
      const dh = ih * s
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
    }
  }

  const size = captionFontPx(W, H)
  const text = settings.caption.on && size > 0 ? captionText(work, settings.caption.fields, settings.caption.lang, untitled) : ''
  if (text) {
    ctx.font = `${size}px Georgia, 'Times New Roman', serif`
    ctx.textBaseline = 'top'
    const pad = Math.round(size * 0.6)
    const maxW = W * 0.9
    const lineH = Math.round(size * 1.3)
    // B14: never more than a third of the frame's height — extra lines end in « … ».
    const maxLines = Math.max(1, Math.floor((H / 3 - 2 * pad) / lineH))
    const lines = clampLines(ctx, wrap(ctx, text, maxW - 2 * pad), maxLines, maxW - 2 * pad)
    const boxW = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 2 * pad)
    const boxH = lines.length * lineH + 2 * pad
    // Same rule as the player: the caption's anchor follows its x / y %, the box stays inside the frame.
    const x = settings.caption.x / 100
    let y = settings.caption.y / 100
    if (opts.storySafe) y = Math.min(0.8, Math.max(0.14, y))
    const left = x * W - x * boxW
    const top = y * H - y * boxH
    ctx.fillStyle = look.fg
    if (settings.caption.shadow) {
      ctx.shadowColor = look.shadow
      ctx.shadowBlur = Math.round(size * 0.5)
      ctx.shadowOffsetY = Math.max(1, Math.round(size * 0.06))
    }
    lines.forEach((l, i) => ctx.fillText(l, left + pad, top + pad + i * lineH))
  }
  ctx.restore()
}

/**
 * Caption font size for a frame (B14, Pem 2026-11-16: small GIFs were unusable with the caption on — a 14 px
 * floor wrapped the text over the whole picture). 2.8 % of the short side, at least 14 px on big frames, but
 * never more than 8 % of the short side; 0 = frame too small to read any caption (short side under
 * CAPTION_MIN_FRAME), so it is left out.
 */
const CAPTION_MIN_PX = 7
export const CAPTION_MIN_FRAME = Math.ceil(CAPTION_MIN_PX / 0.08)
export function captionFontPx(W: number, H: number): number {
  const short = Math.min(W, H)
  const px = Math.min(Math.max(14, short * 0.028), short * 0.08)
  return px >= CAPTION_MIN_PX ? Math.round(px) : 0
}

/** Keep at most `max` lines; the last kept one ends in « … » when text was cut, and no line is wider than maxW. */
function clampLines(ctx: CanvasRenderingContext2D, lines: string[], max: number, maxW: number): string[] {
  const kept = lines.slice(0, max)
  const cut = lines.length > max
  return kept.map((l, i) => {
    const last = cut && i === kept.length - 1
    if (!last && ctx.measureText(l).width <= maxW) return l
    let t = last ? `${l}…` : l
    while (t.length > 1 && ctx.measureText(t).width > maxW) t = `${t.slice(0, -2).trimEnd()}…`
    return t
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export type ExportProgress = (done: number, total: number) => void

async function renderEach(
  works: SlideWork[],
  settings: SlideshowSettings,
  opts: ExportOptions,
  untitled: string,
  onFrame: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, work: SlideWork, i: number) => Promise<void>,
  progress: ExportProgress,
  cancelled: () => boolean,
): Promise<void> {
  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas')
  for (let i = 0; i < works.length; i += 1) {
    if (cancelled()) return
    const w = works[i]
    const url = imageUrl(w.file)
    const img = url ? await loadImage(url) : null
    drawFrame(ctx, img, w, settings, opts, untitled)
    await onFrame(ctx, canvas, w, i)
    progress(i + 1, works.length)
    // Let the page breathe between frames (progress, cancel).
    await new Promise((r) => setTimeout(r, 0))
  }
}

/** Animated GIF: one frame per slide, `pause` seconds each; loops when the slideshow loops. */
export async function exportGif(
  works: SlideWork[],
  settings: SlideshowSettings,
  opts: ExportOptions,
  untitled: string,
  progress: ExportProgress,
  cancelled: () => boolean,
): Promise<Blob | null> {
  const gif = GIFEncoder()
  const delay = Math.round(opts.pause * 1000)
  await renderEach(
    works,
    settings,
    opts,
    untitled,
    async (ctx, _canvas, _w, i) => {
      const { data } = ctx.getImageData(0, 0, opts.width, opts.height)
      const palette = quantize(data, 256)
      const index = applyPalette(data, palette)
      gif.writeFrame(index, opts.width, opts.height, { palette, delay, ...(i === 0 ? { repeat: settings.loop ? 0 : -1 } : {}) })
    },
    progress,
    cancelled,
  )
  if (cancelled()) return null
  gif.finish()
  return new Blob([gif.bytes() as BlobPart], { type: 'image/gif' })
}

/** The same frames, full colour, numbered, in a ZIP (+ `sequence.txt`: order, seconds, size) — for a video later. */
export async function exportFramesZip(
  works: SlideWork[],
  settings: SlideshowSettings,
  opts: ExportOptions,
  format: 'jpeg' | 'png',
  untitled: string,
  progress: ExportProgress,
  cancelled: () => boolean,
): Promise<Blob | null> {
  const files: { name: string; data: Uint8Array }[] = []
  const ext = format === 'png' ? 'png' : 'jpg'
  const pad = String(works.length).length < 3 ? 3 : String(works.length).length
  const seq: string[] = [`frame size: ${opts.width} x ${opts.height}${opts.round && opts.fit === 'contain' ? ' (round)' : ''}`, `seconds per frame: ${opts.pause}`, '']
  await renderEach(
    works,
    settings,
    opts,
    untitled,
    async (_ctx, canvas, w, i) => {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, format === 'png' ? 'image/png' : 'image/jpeg', 0.92))
      if (!blob) throw new Error('frame')
      const name = `${String(i + 1).padStart(pad, '0')}_${w.id}.${ext}`
      files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) })
      seq.push(`${name}\t#${w.id}\t${w.title ?? ''}`)
    },
    progress,
    cancelled,
  )
  if (cancelled()) return null
  files.push({ name: 'sequence.txt', data: new TextEncoder().encode(seq.join('\n') + '\n') })
  return storeZip(files)
}

// ── Minimal ZIP writer (store, no compression: JPEG / PNG are already compressed) ──────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function storeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(8, 0, true) // store
    local.setUint32(14, crc, true)
    local.setUint32(18, f.data.length, true)
    local.setUint32(22, f.data.length, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, f.data)

    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint16(8, 0x0800, true)
    cen.setUint16(10, 0, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, f.data.length, true)
    cen.setUint32(24, f.data.length, true)
    cen.setUint16(28, name.length, true)
    cen.setUint32(42, offset, true)
    central.push(new Uint8Array(cen.buffer), name)
    offset += 30 + name.length + f.data.length
  }
  const centralSize = central.reduce((s, p) => s + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[], { type: 'application/zip' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
