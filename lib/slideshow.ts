/**
 * Slideshow from the selection (TODO R5, plan docs/PLAN_SLIDESHOW.md, Pem 2026-11-14/15).
 * Settings shape shared by the player, the remembered settings (this device) and saved slideshows
 * (`slideshow.settings`). Browser-safe.
 */

export const SLIDESHOW_BACKGROUNDS = ['black', 'grey', 'white'] as const
export type SlideshowBackground = (typeof SLIDESHOW_BACKGROUNDS)[number]

export const SLIDESHOW_TRANSITIONS = ['cut', 'fade', 'slide'] as const
export type SlideshowTransition = (typeof SLIDESHOW_TRANSITIONS)[number]

/** Caption details Pem can pick, in display order. */
export const CAPTION_FIELDS = ['title', 'year', 'technique', 'support', 'dimensions', 'number'] as const
export type CaptionField = (typeof CAPTION_FIELDS)[number]

export type SlideshowSettings = {
  background: SlideshowBackground
  /** Seconds each slide stays while playing (2–30). */
  seconds: number
  transition: SlideshowTransition
  loop: boolean
  /** Shuffled once when the slideshow starts (← still goes back to the previous work). */
  random: boolean
  caption: {
    on: boolean
    lang: 'fr' | 'en'
    fields: CaptionField[]
    /** Where the caption sits, 0–100 % of the screen (dragged by Pem; the box stays inside the screen). */
    x: number
    y: number
    /** 'with' = fades in with the picture; 'after' = a short moment after it. */
    fade: 'with' | 'after'
    shadow: boolean
  }
}

export const SLIDESHOW_SECONDS_MIN = 2
export const SLIDESHOW_SECONDS_MAX = 30
/** Reordering by thumbnails is meant for short slideshows (Pem: "not beyond 20"). */
export const SLIDESHOW_REORDER_MAX = 20

export const DEFAULT_SLIDESHOW_SETTINGS: SlideshowSettings = {
  background: 'black',
  seconds: 6,
  transition: 'fade',
  loop: true,
  random: false,
  caption: { on: false, lang: 'fr', fields: ['title', 'year'], x: 4, y: 94, fade: 'with', shadow: true },
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Any stored value (this device, or a saved slideshow) → valid settings; unknown parts fall back to the defaults. */
export function normalizeSlideshowSettings(raw: unknown): SlideshowSettings {
  const d = DEFAULT_SLIDESHOW_SETTINGS
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const c = o.caption && typeof o.caption === 'object' ? (o.caption as Record<string, unknown>) : {}
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const fields = Array.isArray(c.fields)
    ? CAPTION_FIELDS.filter((f) => (c.fields as unknown[]).includes(f))
    : d.caption.fields
  return {
    background: SLIDESHOW_BACKGROUNDS.includes(o.background as SlideshowBackground) ? (o.background as SlideshowBackground) : d.background,
    seconds: clamp(Math.round(num(o.seconds, d.seconds)), SLIDESHOW_SECONDS_MIN, SLIDESHOW_SECONDS_MAX),
    transition: SLIDESHOW_TRANSITIONS.includes(o.transition as SlideshowTransition) ? (o.transition as SlideshowTransition) : d.transition,
    loop: typeof o.loop === 'boolean' ? o.loop : d.loop,
    random: typeof o.random === 'boolean' ? o.random : d.random,
    caption: {
      on: typeof c.on === 'boolean' ? c.on : d.caption.on,
      lang: c.lang === 'en' ? 'en' : c.lang === 'fr' ? 'fr' : d.caption.lang,
      fields,
      x: clamp(num(c.x, d.caption.x), 0, 100),
      y: clamp(num(c.y, d.caption.y), 0, 100),
      fade: c.fade === 'after' ? 'after' : 'with',
      shadow: typeof c.shadow === 'boolean' ? c.shadow : d.caption.shadow,
    },
  }
}

/** Remembered on this device for a slideshow that is not saved. */
export const SLIDESHOW_SETTINGS_KEY = 'pem_slideshow_settings'

export function readRememberedSlideshowSettings(): SlideshowSettings {
  try {
    const raw = window.localStorage.getItem(SLIDESHOW_SETTINGS_KEY)
    return normalizeSlideshowSettings(raw ? JSON.parse(raw) : null)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- private window / blocked storage: the defaults are fine
  } catch {
    return DEFAULT_SLIDESHOW_SETTINGS
  }
}

export function rememberSlideshowSettings(s: SlideshowSettings): void {
  try {
    window.localStorage.setItem(SLIDESHOW_SETTINGS_KEY, JSON.stringify(s))
    // eslint-disable-next-line pem-i18n/no-silent-catch -- not remembered on this device: harmless
  } catch {
  }
}

/** Fisher–Yates on a copy. */
export function shuffled<T>(items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** One slide: what the player needs about a work (built from the loaded catalogue). */
export type SlideWork = {
  id: number
  /** Cover file (`Oeuvres.txtImageNameLink`); null → the slide shows « no image ». */
  file: string | null
  title: string | null
  year: number | null
  technique: string | null
  support: string | null
  height: number | null
  width: number | null
  depth: number | null
}

/** The caption text for one work, in the chosen language. */
export function captionText(w: SlideWork, fields: readonly CaptionField[], lang: 'fr' | 'en', untitled: string): string {
  const fmt = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })
  const dims = [w.height, w.width, w.depth].filter((n): n is number => typeof n === 'number' && n > 0)
  const parts: string[] = []
  for (const f of fields) {
    if (f === 'title') parts.push(w.title?.trim() || untitled)
    else if (f === 'year' && w.year) parts.push(String(w.year))
    else if (f === 'technique' && w.technique) parts.push(w.technique)
    else if (f === 'support' && w.support) parts.push(w.support)
    else if (f === 'dimensions' && dims.length >= 2) parts.push(`${dims.map(fmt).join(' × ')} cm`)
    else if (f === 'number') parts.push(`#${w.id}`)
  }
  return parts.join(' · ')
}
