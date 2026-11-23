'use client'

// Desk Journal: paste or drop an image onto a day (design docs/design/2026-11-23/JournalDesk.md §4 A, §5).
// Paste (Ctrl+V outside a text field) lands on the day on screen — the day whose divider is pinned at the top;
// a drop lands on the day under the pointer. Same door as the phone (`addInspirationPhoto`), with the day sent
// explicitly; the one-time id is made from the image's bytes, so the same image twice is one photo (the door
// answers `already`). No network → the phone's capture queue keeps it on this PC and sends it later.

import { useCallback, useEffect, useState, type DragEvent, type RefObject } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { addInspirationPhoto } from '@/app/atelier/capture/inspiration-actions'
import { enqueueCapture, isNetworkFailure } from '@/lib/mobile/capture-queue'

const MAX_BYTES = 12 * 1024 * 1024
const MAX_EDGE = 2100
const OK_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const DAY_SECTION = 'section[id^="js-day-"]'

const isHeic = (f: File) => /^image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)

/** A UUID made from the image's SHA-256: the same bytes always give the same one-time id. */
async function idFromBytes(blob: Blob): Promise<string> {
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('')
  const v = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${v}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** Above the door's 12 MB (a big screenshot): scaled to 2100 px JPEG first — the door stores 2100 px anyway. */
async function fitForDoor(file: File): Promise<Blob | null> {
  if (file.size <= MAX_BYTES) return file
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height)
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9))
    return out && out.size <= MAX_BYTES ? out : null
    // eslint-disable-next-line pem-i18n/no-silent-catch -- shown by the caller as « too large »
  } catch {
    return null
  }
}

export type PutResult = { ok: true; id: string; day: string; already: boolean } | { queued: true } | { error: string }

/**
 * One image onto one day through the door; the same for a paste, a drop and the PC tray. No network → kept on
 * this PC (the capture queue) and sent later. `id` = the one-time id (from the image's bytes).
 */
export async function putImageOnDay(blob: Blob, name: string, day: string, id: string, meta?: Record<string, unknown> | null): Promise<PutResult> {
  const fd = new FormData()
  fd.set('photo', blob, name)
  fd.set('day', day)
  fd.set('client_id', id)
  // The photo's own data (time taken, phone, place…), read before the image is re-encoded (journal_step_b2.sql).
  const metaJson = meta ? JSON.stringify(meta) : null
  if (metaJson) fd.set('meta', metaJson)
  try {
    const res = await addInspirationPhoto(fd)
    return 'error' in res ? { error: res.error } : { ok: true, id: res.id, day: res.day, already: !!res.already }
    // eslint-disable-next-line pem-i18n/no-silent-catch -- network → kept on this PC (the caller says so); otherwise returned
  } catch (err) {
    if (isNetworkFailure(err)) {
      await enqueueCapture({ id, kind: 'photo', fields: metaJson ? { day, meta: metaJson } : { day }, blob, blobName: name, createdAt: Date.now() })
      return { queued: true }
    }
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/** The door's refusal in words (`je_err_fmt` for the rest). */
export function doorErrorText(code: string, t: (k: 'jd_err_heic' | 'jd_err_type' | 'jd_err_too_large' | 'jd_err_day' | 'je_err_fmt') => string): string {
  if (code === 'heic') return t('jd_err_heic')
  if (code === 'day') return t('jd_err_day')
  if (code === 'invalid_format') return t('jd_err_type')
  if (code === 'too_large') return t('jd_err_too_large')
  return t('je_err_fmt').replace('{msg}', code)
}

function dayOf(el: Element | null): string | null {
  const id = el?.closest(DAY_SECTION)?.id ?? ''
  return /^js-day-\d{4}-\d{2}-\d{2}$/.test(id) ? id.slice(7) : null
}

export function useDeskImageCapture({
  enabled,
  scrollRef,
  onSaved,
}: {
  /** Admin, Jours view, stream loaded. */
  enabled: boolean
  scrollRef: RefObject<HTMLElement | null>
  /** The photo is on `day` (read that day again; open its text box when new). */
  onSaved: (day: string, id: string, isNew: boolean) => void
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [dropDay, setDropDay] = useState<string | null>(null)
  const label = useCallback(
    (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }),
    [locale],
  )

  const send = useCallback(
    async (file: File, day: string) => {
      if (isHeic(file)) return void toast.error(t('jd_err_heic'))
      if (!OK_TYPES.has(file.type)) return void toast.error(t('jd_err_type'))
      const blob = await fitForDoor(file)
      if (!blob) return void toast.error(t('jd_err_too_large'))
      const id = await idFromBytes(file)
      const name = blob === file ? file.name || 'image' : 'image.jpg'
      toast.info(t('jd_sending').replace('{day}', label(day)))
      const res = await putImageOnDay(blob, name, day, id)
      if ('queued' in res) return void toast.info(t('jd_queued'))
      if ('error' in res) return void toast.error(doorErrorText(res.error, t))
      if (res.already) toast.info(t('jd_already').replace('{day}', label(res.day)))
      else toast.success(t('jd_saved_on').replace('{day}', label(res.day)))
      onSaved(res.day, res.id, !res.already)
    },
    [t, label, onSaved],
  )

  // Paste: anywhere but a text field, onto the day on screen.
  useEffect(() => {
    if (!enabled) return
    const onPaste = (e: ClipboardEvent) => {
      const a = document.activeElement as HTMLElement | null
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/') || isHeic(f))
      if (!file) return
      const root = scrollRef.current
      if (!root) return
      e.preventDefault()
      const top = root.getBoundingClientRect().top + 48
      const onScreen = [...root.querySelectorAll(DAY_SECTION)].find((s) => s.getBoundingClientRect().bottom > top)
      const day = dayOf(onScreen ?? null)
      if (day) void send(file, day)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [enabled, scrollRef, send])

  // A file, or a link dragged from another site (refused with a hint instead of the browser opening it);
  // into a text field a link drops as text, as usual.
  const isFileDrag = (e: DragEvent) => {
    const el = e.target as HTMLElement | null
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName)) && ![...e.dataTransfer.types].includes('Files')) return false
    return [...e.dataTransfer.types].some((x) => x === 'Files' || x === 'text/uri-list')
  }
  const handlers = enabled
    ? {
        onDragOver: (e: DragEvent) => {
          if (!isFileDrag(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          const d = dayOf(e.target as Element)
          if (d !== dropDay) setDropDay(d)
        },
        onDragLeave: (e: DragEvent) => {
          if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) setDropDay(null)
        },
        onDrop: (e: DragEvent) => {
          const d = dayOf(e.target as Element)
          setDropDay(null)
          if (!isFileDrag(e)) return
          e.preventDefault()
          if (!d) return
          const file = e.dataTransfer.files[0]
          if (!file) return void toast.error(t('jd_err_link'))
          void send(file, d)
        },
      }
    : {}

  return { dropDay, dropLabel: dropDay ? t('jd_drop_on').replace('{day}', label(dropDay)) : null, handlers }
}
