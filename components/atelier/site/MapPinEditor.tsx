'use client'

import {
  useEffect, useMemo, useRef, useState, useTransition,
  type MouseEvent, type PointerEvent,
} from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl } from '@/lib/data'
import { Slider } from '@/components/atelier/portfolio/shared/Slider'
import {
  listForestPins,
  upsertForestPin,
  deleteForestPin,
  updateForestPinSize,
  updateForestPinRotation,
  updateForestPinZ,
} from '@/app/atelier/(portal)/portfolio/forest-pins-actions'
import type { ForestPin } from '@/components/public/works-utils'
import type { CollectionItem } from '@/lib/portfolio-config-types'

interface PinWork {
  OeuvreID: number
  Titre: string | null
  txtImageNameLink?: string | null
}

interface Props {
  works: PinWork[]
  panoramaKey: string | undefined
  /** Default work width (% of scene width) for newly placed pins. */
  pinSize?: number
  collections?: CollectionItem[]
}

const clampPct = (v: number) => Math.max(0, Math.min(100, v))

export function MapPinEditor({ works, panoramaKey, pinSize = 16, collections = [] }: Props) {
  const { t, lang } = useI18n()
  const [pins, setPins] = useState<ForestPin[]>([])
  const [armedId, setArmedId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const canvasRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number | null; moved: boolean }>({ id: null, moved: false })
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const hasCollections = collections.length > 0
  const [worksSource, setWorksSource] = useState<'collection' | 'all'>(
    hasCollections ? 'collection' : 'all',
  )
  const [collectionId, setCollectionId] = useState<string>(collections[0]?.id ?? '')

  useEffect(() => {
    startTransition(async () => setPins(await listForestPins()))
  }, [])

  // Flush any pending debounced saves on unmount.
  useEffect(() => {
    const timers = saveTimers.current
    return () => { Object.values(timers).forEach(clearTimeout) }
  }, [])

  const displayedWorks = useMemo<PinWork[]>(() => {
    if (worksSource === 'all' || !hasCollections) return works
    const col = collections.find(c => c.id === collectionId)
    const order = col?.manual_work_order
    if (!order?.length) return works
    const byId = new Map(works.map(w => [w.OeuvreID, w]))
    return order.flatMap(id => { const w = byId.get(id); return w ? [w] : [] })
  }, [works, worksSource, collectionId, collections, hasCollections])

  const pinMap = useMemo(() => new Map(pins.map(p => [p.work_id, p])), [pins])

  function setLocal(workId: number, patch: Partial<ForestPin>) {
    setPins(prev => prev.map(p => p.work_id === workId ? { ...p, ...patch } : p))
  }

  function debouncedSave(key: string, fn: () => Promise<void>, ms = 250) {
    clearTimeout(saveTimers.current[key])
    saveTimers.current[key] = setTimeout(() => { startTransition(() => { void fn() }) }, ms)
  }

  function nextZ(front: boolean): number {
    if (pins.length === 0) return 0
    const zs = pins.map(p => p.z)
    return front ? Math.max(...zs) + 1 : Math.min(...zs) - 1
  }

  // ── Placement ──────────────────────────────────────────────────────────
  function handleCanvasClick(e: MouseEvent<HTMLDivElement>) {
    if (armedId === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = clampPct(((e.clientX - rect.left) / rect.width) * 100)
    const y = clampPct(((e.clientY - rect.top) / rect.height) * 100)
    const id = armedId
    setLocal(id, { work_id: id, x, y } as ForestPin)
    const z = nextZ(true)
    startTransition(async () => {
      await upsertForestPin(id, x, y, { size: pinSize, z, rotation: 0 })
      setPins(await listForestPins())
    })
    setArmedId(null)
    setSelectedId(id)
  }

  // ── Drag to move a placed pin ──────────────────────────────────────────
  function onPinPointerDown(e: PointerEvent<HTMLButtonElement>, workId: number) {
    e.stopPropagation()
    setArmedId(null)
    setSelectedId(workId)
    drag.current = { id: workId, moved: false }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  function onCanvasPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (drag.current.id === null || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = clampPct(((e.clientX - rect.left) / rect.width) * 100)
    const y = clampPct(((e.clientY - rect.top) / rect.height) * 100)
    drag.current.moved = true
    setLocal(drag.current.id, { x, y })
  }

  function onCanvasPointerUp() {
    const { id, moved } = drag.current
    drag.current = { id: null, moved: false }
    if (id === null || !moved) return
    const p = pins.find(pp => pp.work_id === id)
    if (p) startTransition(async () => { await upsertForestPin(id, p.x, p.y) })
  }

  // ── Per-pin edits ──────────────────────────────────────────────────────
  function handleSize(workId: number, size: number) {
    setLocal(workId, { size })
    debouncedSave(`size-${workId}`, () => updateForestPinSize(workId, size))
  }
  function handleRotation(workId: number, rotation: number) {
    setLocal(workId, { rotation })
    debouncedSave(`rot-${workId}`, () => updateForestPinRotation(workId, rotation))
  }
  function handleZ(workId: number, front: boolean) {
    const z = nextZ(front)
    setLocal(workId, { z })
    startTransition(async () => { await updateForestPinZ(workId, z) })
  }
  function handleDelete(workId: number) {
    setPins(prev => prev.filter(p => p.work_id !== workId))
    if (selectedId === workId) setSelectedId(null)
    startTransition(async () => { await deleteForestPin(workId) })
  }

  const panoramaUrl = imageUrl(panoramaKey)

  const pillBase: React.CSSProperties = {
    fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
    padding: '3px 8px', border: '1px solid var(--bd)', borderRadius: 2,
    cursor: 'pointer', background: 'none', color: 'var(--tx2)', fontFamily: 'inherit',
  }
  const pillActive: React.CSSProperties = { ...pillBase, background: 'var(--ac)', color: '#fff', borderColor: 'var(--ac)' }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)', marginBottom: 8 }}>
        {t('site_works_map_pin_section')}
      </div>

      {/* WYSIWYG canvas — drag a placed work to move it */}
      <div
        ref={canvasRef}
        style={{
          position: 'relative', width: '100%', paddingBottom: '56.25%',
          background: panoramaUrl ? '#0a0c0f' : 'repeating-linear-gradient(45deg, var(--bg1) 0, var(--bg1) 8px, var(--bg2) 8px, var(--bg2) 16px)',
          border: '1px solid var(--bd)',
          cursor: armedId !== null ? 'crosshair' : 'default',
          marginBottom: 10, overflow: 'hidden', borderRadius: 2,
          perspective: '1400px',
          opacity: isPending ? 0.85 : 1,
        }}
        onClick={handleCanvasClick}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        role="img"
        aria-label="Map scene — click to place the armed work, drag a work to move it"
      >
        {panoramaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={panoramaUrl} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        )}

        {[...pins].sort((a, b) => a.z - b.z).map(pin => {
          const work = works.find(w => w.OeuvreID === pin.work_id)
          const thumb = thumbUrl(work?.txtImageNameLink)
          const isSel = selectedId === pin.work_id
          return (
            <button
              key={pin.work_id}
              type="button"
              title={work?.Titre ?? String(pin.work_id)}
              aria-label={work?.Titre ?? String(pin.work_id)}
              onPointerDown={e => onPinPointerDown(e, pin.work_id)}
              style={{
                position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`,
                width: `${pin.size}%`, height: 'auto',
                transform: `translate(-50%, -50%) rotateY(${pin.rotation}deg)`,
                transformStyle: 'preserve-3d',
                padding: 0, background: 'none', cursor: 'grab',
                border: isSel ? '2px solid var(--ac)' : '1px solid rgba(255,255,255,0.35)',
                boxShadow: isSel ? '0 0 0 1px var(--ac), 0 6px 20px rgba(0,0,0,0.6)' : '0 4px 14px rgba(0,0,0,0.5)',
                zIndex: Math.round(pin.z) + 10,
                lineHeight: 0, touchAction: 'none',
              }}
            >
              {thumb
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={thumb} alt="" draggable={false} style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }} />
                : <span style={{ display: 'block', width: '100%', aspectRatio: '1', background: 'rgba(255,180,40,0.9)' }} />}
            </button>
          )
        })}

        {armedId !== null && (
          <div style={{
            position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
            fontSize: 7, letterSpacing: 1, textTransform: 'uppercase',
            color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: 2,
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {t('site_works_map_pin_arm_hint').split('.')[0]}
          </div>
        )}
      </div>

      {/* Collection filter */}
      {hasCollections && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
          <button type="button" style={worksSource === 'collection' ? pillActive : pillBase} onClick={() => setWorksSource('collection')}>
            {lang === 'fr' ? 'Collections' : 'Collections'}
          </button>
          <button type="button" style={worksSource === 'all' ? pillActive : pillBase} onClick={() => setWorksSource('all')}>
            {lang === 'fr' ? 'Toutes' : 'All'}
          </button>
          {worksSource === 'collection' && (
            <select
              value={collectionId}
              onChange={e => setCollectionId(e.target.value)}
              style={{ flex: 1, fontFamily: 'inherit', fontSize: 8, padding: '3px 6px', background: 'var(--bg2)', color: 'var(--tx)', border: '1px solid var(--bd2)', borderRadius: 2 }}
            >
              {collections.map(c => (
                <option key={c.id} value={c.id}>{lang === 'fr' ? c.title_fr : c.title_en}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Works list — arm to place, select to edit */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 420, overflowY: 'auto' }}>
        {displayedWorks.map(work => {
          const pin = pinMap.get(work.OeuvreID)
          const isArmed = armedId === work.OeuvreID
          const isSel = selectedId === work.OeuvreID
          const placed = Boolean(pin)
          return (
            <div
              key={work.OeuvreID}
              style={{
                borderRadius: 2,
                border: '1px solid ' + (isSel ? 'var(--ac)' : isArmed ? 'var(--ac)' : placed ? 'var(--bd2)' : 'var(--bd)'),
                background: isArmed ? 'var(--ac)' : 'var(--bg1)',
                overflow: 'hidden',
              }}
            >
              {/* Top row */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 5px', cursor: 'pointer' }}
                onClick={() => {
                  if (placed) { setSelectedId(isSel ? null : work.OeuvreID); setArmedId(null) }
                  else setArmedId(isArmed ? null : work.OeuvreID)
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    background: isArmed ? '#fff' : isSel ? 'var(--ac)' : placed ? 'rgba(255,180,40,0.85)' : 'var(--bg2)',
                    border: '1px solid ' + (isArmed || isSel ? '#fff' : 'var(--bd)'),
                  }}
                />
                {work.txtImageNameLink && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl(work.txtImageNameLink) ?? ''} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, fontSize: 9, color: isArmed ? '#fff' : 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {work.Titre ?? `#${work.OeuvreID}`}
                </span>
                {pin && (
                  <span style={{ fontSize: 7, opacity: 0.45, flexShrink: 0, color: isArmed ? '#fff' : 'var(--tx2)' }}>
                    {pin.x.toFixed(0)},{pin.y.toFixed(0)}
                  </span>
                )}
                {pin && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDelete(work.OeuvreID) }}
                    aria-label={t('site_works_map_pin_delete')}
                    style={{ width: 16, height: 16, borderRadius: 2, border: 'none', background: 'rgba(255,80,80,0.15)', color: '#f88', cursor: 'pointer', fontSize: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                )}
              </div>

              {/* Controls — only for the selected placed pin */}
              {pin && isSel && (
                <div style={{ padding: '4px 8px 6px', borderTop: '1px solid var(--bd)' }}>
                  <Slider
                    label={lang === 'fr' ? 'Taille' : 'Size'}
                    min={2} max={90} step={1}
                    value={Math.round(pin.size)}
                    onChange={v => handleSize(work.OeuvreID, v)}
                    unit="%"
                    labelWidth={64}
                  />
                  <Slider
                    label={lang === 'fr' ? 'Rotation' : 'Rotation'}
                    min={-180} max={180} step={1}
                    value={Math.round(pin.rotation)}
                    onChange={v => handleRotation(work.OeuvreID, v)}
                    unit="°"
                    defaultValue={0}
                    onReset={() => handleRotation(work.OeuvreID, 0)}
                    labelWidth={64}
                  />
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    <button type="button" style={pillBase} onClick={() => handleZ(work.OeuvreID, true)}>
                      {lang === 'fr' ? 'Avant' : 'Front'}
                    </button>
                    <button type="button" style={pillBase} onClick={() => handleZ(work.OeuvreID, false)}>
                      {lang === 'fr' ? 'Arrière' : 'Back'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {displayedWorks.length === 0 && (
          <p style={{ fontSize: 8, opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('map_pin_no_works')}
          </p>
        )}
      </div>
    </div>
  )
}
