'use client'

import { useState, type ChangeEvent, type CSSProperties, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { usePathname, useRouter } from 'next/navigation'
import { requestColourFilter } from '@/lib/atelier/colour-filter-handoff'
import { COLOUR_FAMILIES, type ColourFamily } from '@/lib/colour-families'
import { imageUrl } from '@/lib/data'
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
  retouchImageFileRef: MutableRefObject<HTMLInputElement | null>
  onRetouchImageFileChange: (e: ChangeEvent<HTMLInputElement>) => void
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
  imageCacheKeys: Record<number, string>
  /** Persist a new order (ids in SeqNo order — the last one is the cover, `tblImage` trigger). */
  drawerReorder: (ids: number[]) => void
  isAdmin: boolean
  drawerDeleteImage: (imageId: number) => void | Promise<void>
  drawerStartRetouch: (imageId: number) => void
}

const picIcon: CSSProperties = {
  width: 32,
  height: 32,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(8,8,9,.72)',
  border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 3,
  color: 'var(--tx)',
  fontSize: 14,
  cursor: 'pointer',
  textDecoration: 'none',
  padding: 0,
}

export function WorkDrawerImageArea(p: WorkDrawerImageAreaProps) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
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
    retouchImageFileRef,
    onRetouchImageFileChange,
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
    imageCacheKeys,
    drawerReorder,
    isAdmin,
    drawerDeleteImage,
    drawerStartRetouch,
  } = p
  const activeImage = activeImgIdx >= 0 ? drawerSorted[activeImgIdx] : null
  const activePalette = Array.isArray(activeImage?.palette)
    ? (activeImage.palette as { hex?: unknown; share?: unknown; family?: unknown; accent?: unknown }[]).filter(
        (s): s is { hex: string; share: number; family?: string; accent?: boolean } =>
          typeof s.hex === 'string' && typeof s.share === 'number',
      )
    : []
  const paletteTotal = activePalette.reduce((sum, s) => sum + s.share, 0) || 1
  const activeDownloadUrl = activeImgPath ? imageUrl(activeImgPath) : null
  // The cover is the LAST image by SeqNo (`tblImage` trigger); the strip shows it first (Pem R3:
  // « la 1re = couverture »), so the displayed order is SeqNo reversed and saved back reversed.
  const display = drawerSorted.map((_, i) => drawerSorted.length - 1 - i)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const thumb = narrow ? 48 : 52
  /** Icons on the picture: 44 px taps on the phone. */
  const pi: CSSProperties = narrow ? { ...picIcon, width: 44, height: 44, fontSize: 18 } : picIcon
  const grip = narrow ? 24 : 16
  function endDrag() {
    const from = dragFrom
    const to = dragOver
    setDragFrom(null)
    setDragOver(null)
    if (from == null || to == null || from === to) return
    const ids = display.map((si) => drawerSorted[si]!.ImageID)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved!)
    drawerReorder(ids.reverse())
  }

  return (
    <>
      <input
        ref={drawerImageFileRef}
        type="file"
        accept="image/*"
        multiple={narrow}
        capture={undefined}
        style={{ display: 'none' }}
        onChange={onDrawerImageFileChange}
        tabIndex={-1}
      />
      <input
        ref={retouchImageFileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onRetouchImageFileChange}
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
        title={activeImgPath ? t('wc_pic_zoom_hint') : undefined}
        style={{ position: 'relative', width: '100%', overflow: 'hidden', background: activeImgPath ? 'var(--bg0)' : 'transparent', cursor: imgZoom > 1 ? 'grab' : 'zoom-in', userSelect: 'none' }}
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
                    objectPosition: 'center',
                    display: 'block',
                    opacity: showFullPreviewLayer && fullPreviewReady ? 0 : 1,
                    transition: 'opacity 120ms ease-out',
                  }}
                />
                {showFullPreviewLayer && fullPreviewSrc ? (
                  <img
                    key={`drawer-full-${activeImgPath}`}
                    className={fullPreviewReady ? 'work-drawer-full-reveal' : undefined}
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
                      right: 0,
                      bottom: 0,
                      width: 'auto',
                      height: 'auto',
                      maxWidth: '100%',
                      maxHeight: '100%',
                      margin: 'auto',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      opacity: fullPreviewReady ? 1 : 0,
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
        {activeImage && activeDownloadUrl ? (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, zIndex: 2 }}
          >
            <a
              href={activeDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="work-drawer-download-image"
              title={t('wc_pic_download')}
              aria-label={t('wc_pic_download')}
              style={pi}
            >
              ↓
            </a>
            <button
              type="button"
              data-testid="work-drawer-retouch-image"
              disabled={drawerImageBusy}
              title={t('wc_pic_retouch')}
              aria-label={t('wc_pic_retouch')}
              onClick={() => drawerStartRetouch(activeImage.ImageID)}
              style={pi}
            >
              {drawerImageBusy ? '…' : '⟳'}
            </button>
            {isAdmin ? (
              <button
                type="button"
                data-testid="work-drawer-delete-image"
                title={t('wc_pic_delete')}
                aria-label={t('wc_pic_delete')}
                onClick={() => void drawerDeleteImage(activeImage.ImageID)}
                style={{ ...pi, color: 'var(--rust)' }}
              >
                🗑
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {activePalette.length > 0 && (
        <div data-testid="work-drawer-palette" title={t('wf_palette_title')} style={{ display: 'flex', gap: 3, marginTop: 8, minWidth: 0 }}>
          {/* Widths normalised so the row is always full; the label gives the real share of the image. */}
          {activePalette.map((s) => {
            const fam = typeof s.family === 'string' && (COLOUR_FAMILIES as readonly string[]).includes(s.family)
              ? (s.family as ColourFamily)
              : null
            const name = fam ? t(`colour_family_${fam}` as Parameters<typeof t>[0]) : s.hex.toUpperCase()
            const share = s.accent ? t('wf_palette_accent') : `${Math.round(s.share * 100)} %`
            const inner = (
              <>
                <span aria-hidden="true" style={{ display: 'block', height: 14, background: s.hex, border: '1px solid var(--bd)' }} />
                <span style={{ display: 'block', fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('wc_swatch_fmt').replace('{hex}', s.hex.toUpperCase()).replace('{share}', share)}
                </span>
              </>
            )
            const cell: CSSProperties = { flex: `${Math.max(s.share / paletteTotal, 0.08)} 1 0`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }
            return fam ? (
              <button
                key={`${s.family ?? ''}${s.hex}`}
                type="button"
                data-testid={`work-drawer-palette-filter-${fam}`}
                title={`${name} — ${t('wf_palette_swatch_filter_fmt').replace('{c}', name)}`}
                onClick={() => {
                  requestColourFilter(fam)
                  if (pathname !== '/atelier/inventory') router.push('/atelier/inventory')
                }}
                style={{ ...cell, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              >
                {inner}
              </button>
            ) : (
              <span key={`${s.family ?? ''}${s.hex}`} title={name} style={cell}>{inner}</span>
            )
          })}
        </div>
      )}

      {workImages.length >= 1 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {display.map((sortedIdx, di) => {
              const img = drawerSorted[sortedIdx]!
              const isCover = di === 0
              const over = dragFrom != null && dragOver === di && dragFrom !== di
              return (
                <div
                  key={img.ImageID}
                  data-strip-idx={di}
                  style={{
                    position: 'relative',
                    width: thumb,
                    height: thumb,
                    flexShrink: 0,
                    boxShadow: over ? '-4px 0 0 var(--ac)' : undefined,
                    transform: dragFrom === di ? 'translateY(-4px) rotate(-3deg)' : undefined,
                    opacity: dragFrom === di ? 0.85 : 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { setActiveImgIdx(sortedIdx); setImgZoom(1); setImgPan({ x: 0, y: 0 }) }}
                    style={{ width: thumb, height: thumb, padding: 0, border: `2px solid ${sortedIdx === activeImgIdx ? 'var(--ac)' : 'var(--bd)'}`, overflow: 'hidden', cursor: 'pointer', background: 'var(--bg0)' }}
                    title={`${t('wf_images_strip_alt').replace('{n}', String(di + 1))}${isCover ? ` · ${t('wc_strip_cover')}` : ''}`}
                  >
                    {img.txtImageNameLink && (
                      <WorkThumb
                        file={img.txtImageNameLink}
                        alt={t('wf_images_strip_alt').replace('{n}', String(di + 1))}
                        size={64}
                        displaySize={`${thumb - 4}px`}
                        cacheKey={imageCacheKeys[img.ImageID]}
                      />
                    )}
                  </button>
                  {display.length > 1 ? (
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={t('wc_strip_grip_aria')}
                      title={t('wc_strip_grip_aria')}
                      data-testid="work-drawer-strip-grip"
                      onPointerDown={(e) => {
                        e.preventDefault()
                        e.currentTarget.setPointerCapture(e.pointerId)
                        setDragFrom(di)
                        setDragOver(di)
                      }}
                      onPointerMove={(e) => {
                        if (dragFrom == null) return
                        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-strip-idx]')
                        if (el) setDragOver(Number(el.getAttribute('data-strip-idx')))
                      }}
                      onPointerUp={endDrag}
                      onPointerCancel={() => { setDragFrom(null); setDragOver(null) }}
                      style={{
                        position: 'absolute',
                        left: 2,
                        top: 2,
                        width: grip,
                        height: grip,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 11,
                        lineHeight: 1,
                        color: 'var(--tx)',
                        background: 'rgba(8,8,9,.72)',
                        borderRadius: 2,
                        cursor: dragFrom != null ? 'grabbing' : 'grab',
                        touchAction: 'none',
                      }}
                    >
                      ⠿
                    </span>
                  ) : null}
                </div>
              )
            })}
            <button
              type="button"
              data-testid="work-drawer-add-another-photo"
              disabled={drawerImageBusy}
              onClick={() => drawerImageFileRef.current?.click()}
              aria-label={t('wf_images_add_aria')}
              title={t('wf_images_add_aria')}
              className="btn ghost sm"
              style={{ width: thumb, height: thumb, minWidth: thumb, padding: 0, border: '1px dashed var(--bd3)', fontSize: 18 }}
            >
              {drawerImageBusy ? '…' : '+'}
            </button>
          </div>
          {display.length > 1 ? (
            <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>{t('wc_strip_hint')}</div>
          ) : null}
        </div>
      )}
    </>
  )
}
