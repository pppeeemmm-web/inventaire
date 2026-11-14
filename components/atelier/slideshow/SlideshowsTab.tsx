'use client'

/**
 * « Diaporamas » (Catalogue menu, TODO R5): the team's saved slideshows — play, rename, delete.
 * A new one starts from « Diaporama » in the selection bar (Inventory).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { thumbUrl } from '@/lib/data'
import type { Oeuvre } from '@/lib/types/database'
import { toast } from '@/lib/ui/toast'
import { SlideshowPlayer } from './SlideshowPlayer'
import { slideWorksFromOeuvres } from './slide-works'
import {
  deleteSlideshow,
  listSlideshows,
  renameSlideshow,
  saveSlideshow,
  type SavedSlideshow,
} from '@/app/atelier/slideshow/actions'

export function SlideshowsTab({
  oeuvres,
  tM,
  sM,
}: {
  oeuvres: Oeuvre[]
  tM: Record<number, string>
  sM: Record<number, string>
}) {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<SavedSlideshow[] | null>(null)
  const [playing, setPlaying] = useState<SavedSlideshow | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const loaded = new Set(oeuvres.map((o) => o.OeuvreID))
  const coverOf = new Map(oeuvres.map((o) => [o.OeuvreID, o.txtImageNameLink ?? null]))

  const refresh = useCallback(() => {
    void listSlideshows().then((r) => {
      if ('error' in r) toast.error(`${t('ss_error_prefix')} ${r.error}`)
      else setItems(r)
    })
  }, [t])
  useEffect(() => {
    refresh()
  }, [refresh])

  const remove = async (s: SavedSlideshow) => {
    if (!window.confirm(t('ss_list_delete_confirm'))) return
    const r = await deleteSlideshow(s.id)
    if ('error' in r) toast.error(`${t('ss_error_prefix')} ${r.error}`)
    else refresh()
  }

  const rename = async () => {
    if (!renaming?.name.trim()) return
    const r = await renameSlideshow(renaming.id, renaming.name)
    if ('error' in r) toast.error(`${t('ss_error_prefix')} ${r.error}`)
    else {
      setRenaming(null)
      refresh()
    }
  }

  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  // Built once per opened slideshow, not on every render.
  const playingWorks = useMemo(
    () => (playing ? slideWorksFromOeuvres(playing.workIds, oeuvres, tM, sM) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt when another slideshow opens
    [playing],
  )

  return (
    <div data-testid="slideshows-tab" style={{ flex: 1, overflow: 'auto', padding: 'max(16px, 2vw)' }}>
      <div className="t-eyebrow" style={{ marginBottom: 12 }}>{t('ss_list_heading')}</div>
      {items && items.length === 0 ? (
        <p className="t-mono-sm" style={{ color: 'var(--tx2)', maxWidth: 560, lineHeight: 1.5 }}>{t('ss_list_empty')}</p>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 760 }}>
        {(items ?? []).map((s) => {
          const missing = s.workIds.filter((id) => !loaded.has(id)).length
          const first = s.workIds.map((id) => coverOf.get(id)).find(Boolean) ?? null
          const thumb = thumbUrl(first)
          const isRenaming = renaming?.id === s.id
          return (
            <div
              key={s.id}
              data-testid={`slideshow-row-${s.id}`}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--bd)', borderRadius: 6 }}
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--bd)' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 4, border: '1px solid var(--bd)' }} />
              )}
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                {isRenaming ? (
                  <input
                    className="input"
                    autoFocus
                    value={renaming.name}
                    maxLength={120}
                    aria-label={t('ss_save_name')}
                    onChange={(e) => setRenaming({ id: s.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void rename()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    style={{ minHeight: 44, width: '100%' }}
                  />
                ) : (
                  <div className="serif" style={{ fontSize: 17 }}>{s.name}</div>
                )}
                <div className="t-mono-sm" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
                  {t('ss_list_count_fmt').replace('{n}', String(s.workIds.length))} ·{' '}
                  {new Date(s.updatedAt).toLocaleDateString(locale, { dateStyle: 'medium' })}
                  {missing > 0 ? ` · ${t('ss_list_missing_fmt').replace('{n}', String(missing))}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {isRenaming ? (
                  <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => void rename()}>{t('ss_save')}</button>
                ) : (
                  <>
                    <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => setPlaying(s)} data-testid={`slideshow-play-${s.id}`} disabled={s.workIds.length === missing}>
                      {t('ss_list_play')}
                    </button>
                    <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setRenaming({ id: s.id, name: s.name })}>{t('ss_list_rename')}</button>
                    <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => void remove(s)}>{t('ss_list_delete')}</button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {playing ? (
        <SlideshowPlayer
          works={playingWorks}
          initialSettings={playing.settings}
          saved={{ id: playing.id, name: playing.name }}
          onSave={saveSlideshow}
          onClose={() => {
            setPlaying(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}
