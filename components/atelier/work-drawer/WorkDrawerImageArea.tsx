'use client'

import type { ChangeEvent, Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb } from '../WorkThumb'
import type { WorkImageRow } from './drawer-content-props'

export type WorkDrawerImageAreaProps = {
  o: Oeuvre
  narrow: boolean
  imgContainerRef: MutableRefObject<HTMLDivElement | null>
  imgZoom: number
  imgPan: { x: number; y: number }
  setImgPan: Dispatch<SetStateAction<{ x: number; y: number }>>
  setImgZoom: Dispatch<SetStateAction<number>>
  isDragging: MutableRefObject<boolean>
  dragStart: MutableRefObject<{ x: number; y: number; px: number; py: number }>
  latestMouseRef: MutableRefObject<{ x: number; y: number }>
  panRafId: MutableRefObject<number | null>
  activeImgPath: string | null | undefined
  thumbPreviewSrc: string
  fullPreviewSrc: string
  showFullPreviewLayer: boolean
  fullPreviewReady: boolean
  setFullPreviewReady: Dispatch<SetStateAction<boolean>>
  setNaturalSize: Dispatch<SetStateAction<{ w: number; h: number } | null>>
  previewMaxHeight: string
  drawerImageFileRef: MutableRefObject<HTMLInputElement | null>
  onDrawerImageFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  drawerImageBusy: boolean
  drawerUploadPct: number
  drawerUploadName: string
  drawerUploadIndex: number
  drawerUploadTotal: number
  drawerUploadCancelRef: MutableRefObject<boolean>
  workImages: WorkImageRow[]
  drawerSorted: WorkImageRow[]
  activeImgIdx: number
  setActiveImgIdx: Dispatch<SetStateAction<number>>
  drawerNudge: (sortedIndex: number, dir: -1 | 1) => void
  drawerMakeCover: (sortedIndex: number) => void
  drawerDeleteImage: (imageId: number) => void | Promise<void>
}

export function WorkDrawerImageArea(p: WorkDrawerImageAreaProps) {
  const { t } = useI18n()
  const {
    o,
    narrow,
    imgContainerRef,
    imgZoom,
    imgPan,
    setImgPan,
    setImgZoom,
    isDragging,
    dragStart,
    latestMouseRef,
    panRafId,
    activeImgPath,
    thumbPreviewSrc,
    fullPreviewSrc,
    showFullPreviewLayer,
    fullPreviewReady,
    setFullPreviewReady,
    setNaturalSize,
    previewMaxHeight,
    drawerImageFileRef,
    onDrawerImageFileChange,
    drawerImageBusy,
    drawerUploadPct,
    drawerUploadName,
    drawerUploadIndex,
    drawerUploadTotal,
    drawerUploadCancelRef,
    workImages,
    drawerSorted,
    activeImgIdx,
    setActiveImgIdx,
    drawerNudge,
    drawerMakeCover,
    drawerDeleteImage,
  } = p

  return (
    <>
      <input
        ref={drawerImageFileRef}
        type="file"
        accept="image/*"
        multiple={narrow}
        capture={narrow ? 'environment' : undefined}
        style={{ display: 'none' }}
        onChange={onDrawerImageFileChange}
        tabIndex={-1}
      />
      {drawerImageBusy && (drawerUploadPct > 0 || drawerUploadName) && (
        <div className="t-mono-sm" style={{ color: 'var(--tx2)', marginBottom: 8 }} role="status">
          <div>{t('wf_images_upload_status').replace('{name}', drawerUploadName)}</div>
          <div style={{ marginTop: 4, height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(drawerUploadPct * 100)}%`, height: '100%', background: 'var(--ac)' }} />
          </div>
          {drawerUploadTotal > 1 && (
            <div style={{ marginTop: 4, color: 'var(--tx3)' }}>
              {drawerUploadIndex}/{drawerUploadTotal}
            </div>
          )}
        </div>
      )}
      {drawerImageBusy && drawerUploadTotal > 1 && (
        <button type="button" className="btn ghost sm" style={{ marginBottom: 8 }} onClick={() => { drawerUploadCancelRef.current = true }}>
          {t('wf_images_upload_cancel')}
        </button>
      )}
      <div
        ref={imgContainerRef}
        style={{ width: '100%', overflow: 'hidden', background: 'transparent', cursor: imgZoom > 1 ? 'grab' : 'default', userSelect: 'none', marginBottom: 16 }}
        onMouseDown={(e) => {
          if (imgZoom > 1) {
            isDragging.current = true
            dragStart.current = { x: e.clientX, y: e.clientY, px: imgPan.x, py: imgPan.y }
          }
        }}
        onMouseMove={(e) => {
          if (!isDragging.current) return
          latestMouseRef.current = { x: e.clientX, y: e.clientY }
          if (panRafId.current != null) return
          panRafId.current = requestAnimationFrame(() => {
            panRafId.current = null
            const { x, y } = latestMouseRef.current
            setImgPan({
              x: dragStart.current.px + (x - dragStart.current.x),
              y: dragStart.current.py + (y - dragStart.current.y),
            })
          })
        }}
        onMouseUp={() => { isDragging.current = false }}
        onMouseLeave={() => { isDragging.current = false }}
      >
        {activeImgPath
          ? (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${imgZoom})`,
                  transformOrigin: 'center center',
                  transition: 'none',
                  willChange: imgZoom > 1 ? 'transform' : 'auto',
                }}
              >
                <img
                  key={`drawer-thumb-${activeImgPath}`}
                  draggable={false}
                  src={thumbPreviewSrc}
                  alt={o.Titre ?? ''}
                  onLoad={(e) => {
                    const el = e.currentTarget
                    if (el.naturalWidth > 0) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
                  }}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: previewMaxHeight,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                {showFullPreviewLayer && fullPreviewSrc ? (
                  <img
                    key={`drawer-full-${activeImgPath}`}
                    draggable={false}
                    src={fullPreviewSrc}
                    alt=""
                    aria-hidden
                    decoding="async"
                    onLoad={(e) => {
                      const el = e.currentTarget
                      if (el.naturalWidth > 0) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
                      setFullPreviewReady(true)
                    }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      opacity: fullPreviewReady ? 1 : 0,
                      transition: 'opacity 0.22s ease-out',
                      pointerEvents: 'none',
                    }}
                  />
                ) : null}
              </div>
            )
          : (
              <div
                className="ph"
                style={{
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: 'var(--tx3)',
                  border: '1px dashed var(--bd)',
                  borderRadius: 4,
                  padding: 16,
                }}
              >
                <span style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.45 }}>{t('workDrawer_add_photo')}</span>
                <button
                  type="button"
                  data-testid="work-drawer-add-photo"
                  disabled={drawerImageBusy}
                  onClick={() => drawerImageFileRef.current?.click()}
                  aria-label={t('workDrawer_add_photo_aria')}
                  className="btn ghost sm"
                >
                  {drawerImageBusy ? '…' : '+'}
                </button>
              </div>
            )}
      </div>

      {workImages.length >= 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {drawerSorted.map((img, idx) => (
            <div key={img.ImageID} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => { setActiveImgIdx(idx); setImgZoom(1); setImgPan({ x: 0, y: 0 }) }}
                style={{ width: 44, height: 44, padding: 0, border: `2px solid ${idx === activeImgIdx ? 'var(--ac)' : 'var(--bd)'}`, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg0)', flexShrink: 0 }}
                title={
                  `${t('wf_images_strip_alt').replace('{n}', String(idx + 1))}${
                    idx === drawerSorted.length - 1 ? t('wf_images_strip_cover_suffix') : ''
                  }`
                }
              >
                {img.txtImageNameLink && (
                  <WorkThumb
                    file={img.txtImageNameLink}
                    alt={t('wf_images_strip_alt').replace('{n}', String(idx + 1))}
                    size={64}
                    displaySize="44px"
                  />
                )}
              </button>
              {drawerSorted.length > 1 && (
                <div className="row" style={{ gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => drawerNudge(idx, -1)}
                    aria-label={t('wf_images_order_before_aria')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22 }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={idx === drawerSorted.length - 1}
                    onClick={() => drawerNudge(idx, 1)}
                    aria-label={t('wf_images_order_after_aria')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22 }}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    disabled={idx === drawerSorted.length - 1}
                    onClick={() => drawerMakeCover(idx)}
                    aria-label={t('wf_images_order_cover_aria')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22 }}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    onClick={() => void drawerDeleteImage(img.ImageID)}
                    aria-label={t('confirm_delete_image')}
                    className="btn ghost sm"
                    style={{ padding: '0 4px', fontSize: 11, minHeight: 22, color: 'var(--rust)' }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              data-testid="work-drawer-add-another-photo"
              disabled={drawerImageBusy}
              onClick={() => drawerImageFileRef.current?.click()}
              aria-label={t('wf_images_add_aria')}
              className="btn ghost sm"
              style={{ width: 44, height: 44, padding: 0, border: '1px dashed var(--bd)', fontSize: 18 }}
            >
              {drawerImageBusy ? '…' : '+'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
