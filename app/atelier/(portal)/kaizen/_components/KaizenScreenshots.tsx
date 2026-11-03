'use client'

// Screenshots on a Kaizen entry (owner 2026-11-03): thumbnails open the full image; the author
// or an admin can add (file picker or drop) and remove. Images are shrunk in the browser before
// upload (Vercel's 4.5 MB action limit), then normalised to AVIF on the server.

import { useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { imageUrl, thumbUrl } from '@/lib/data'
import { downscaleImageFileForMobileIfNeeded } from '@/lib/mobile/image-upload-client'
import type { KaizenItem } from '@/lib/kaizen'
import { addKaizenScreenshot, removeKaizenScreenshot } from '@/app/atelier/(portal)/kaizen/actions'

const MAX_SHOTS = 6

export function KaizenScreenshots({
  item,
  canEdit,
  onItem,
}: {
  item: KaizenItem
  canEdit: boolean
  onItem: (next: KaizenItem) => void
}) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const shots = item.screenshots ?? []
  if (!shots.length && !canEdit) return null

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setBusy(true)
    try {
      let cur = item
      for (const f of list.slice(0, Math.max(0, MAX_SHOTS - shots.length))) {
        const fd = new FormData()
        fd.set('file', await downscaleImageFileForMobileIfNeeded(f, true, 2100))
        const res = await addKaizenScreenshot(cur.id, fd)
        if ('error' in res) {
          toast.error(res.error === 'too_many' ? t('kaizen_shots_too_many') : `${t('error_prefix')} ${res.error}`)
          break
        }
        cur = res.item
        onItem(res.item)
      }
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function remove(key: string) {
    if (!confirm(t('kaizen_shot_remove_confirm'))) return
    setBusy(true)
    try {
      const res = await removeKaizenScreenshot(item.id, key)
      if ('error' in res) {
        toast.error(`${t('error_prefix')} ${res.error}`)
        return
      }
      onItem(res.item)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      data-testid={`kaizen-shots-${item.id}`}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}
      onDragOver={canEdit ? (e) => e.preventDefault() : undefined}
      onDrop={
        canEdit
          ? (e) => {
              e.preventDefault()
              if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
            }
          : undefined
      }
    >
      {shots.map((key) => (
        <div key={key} style={{ position: 'relative' }}>
          <a href={imageUrl(key) ?? undefined} target="_blank" rel="noopener noreferrer" title={t('kaizen_shot_open')}>
            {/* eslint-disable-next-line @next/next/no-img-element -- R2 AVIF thumb */}
            <img
              src={thumbUrl(key) ?? undefined}
              alt=""
              width={72}
              height={72}
              style={{ objectFit: 'cover', display: 'block', border: '1px solid var(--bd)' }}
            />
          </a>
          {canEdit ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove(key)}
              aria-label={t('kaizen_shot_remove')}
              title={t('kaizen_shot_remove')}
              style={{
                position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%',
                border: '1px solid var(--bd)', background: 'var(--bg1)', color: 'var(--tx2)', fontSize: 11,
                cursor: 'pointer', lineHeight: 1,
              }}
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
      {canEdit && shots.length < MAX_SHOTS ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files)
            }}
          />
          <button
            type="button"
            className="btn ghost sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            data-testid={`kaizen-shot-add-${item.id}`}
            title={t('kaizen_shot_add_title')}
            style={{ minHeight: 44 }}
          >
            {busy ? t('kaizen_shot_uploading') : t('kaizen_shot_add')}
          </button>
        </>
      ) : null}
    </div>
  )
}
