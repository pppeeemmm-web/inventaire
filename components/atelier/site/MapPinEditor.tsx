'use client'

import { useEffect, useMemo, useState, useTransition, type MouseEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl } from '@/lib/data'
import {
  listForestPins,
  upsertForestPin,
  deleteForestPin,
  updateForestPinZ,
  updateForestPinSize,
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
  pinSize?: number
  collections?: CollectionItem[]
}

export function MapPinEditor({ works, panoramaKey, pinSize = 48, collections = [] }: Props) {
  const { t, lang } = useI18n()
  const [pins, setPins] = useState<ForestPin[]>([])
  const [armedId, setArmedId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasCollections = collections.length > 0
  const [worksSource, setWorksSource] = useState<'collection' | 'all'>(
    hasCollections ? 'collection' : 'all',
  )
  const [collectionId, setCollectionId] = useState<string>(collections[0]?.id ?? '')

  useEffect(() => {
    startTransition(async () => {
      const loaded = await listForestPins()
      setPins(loaded)
    })
  }, [])

  const displayedWorks = useMemo<PinWork[]>(() => {
    if (worksSource === 'all' || !hasCollections) return works
    const col = collections.find(c => c.id === collectionId)
    if (!col) return works
    const order = col.manual_work_order
    if (!order?.length) return works
    const byId = new Map(works.map(w => [w.OeuvreID, w]))
    return order.flatMap(id => { const w = byId.get(id); return w ? [w] : [] })
  }, [works, worksSource, collectionId, collections, hasCollections])

  function handlePanoramaClick(e: MouseEvent<HTMLDivElement>) {
    if (armedId === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100 * 10) / 10
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100 * 10) / 10
    const existing = pins.find(p => p.work_id === armedId)
    startTransition(async () => {
      await upsertForestPin(armedId, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)), existing?.z ?? 0)
      setPins(await listForestPins())
      setArmedId(null)
    })
  }

  function handleDeletePin(workId: number) {
    startTransition(async () => {
      await deleteForestPin(workId)
      setPins(prev => prev.filter(p => p.work_id !== workId))
    })
  }

  function handleSetZ(workId: number, z: number) {
    setPins(prev => prev.map(p => p.work_id === workId ? { ...p, z } : p))
    startTransition(async () => {
      await updateForestPinZ(workId, z)
    })
  }

  function handleSetSize(workId: number, size: number | null) {
    setPins(prev => prev.map(p => p.work_id === workId ? { ...p, size } : p))
    startTransition(async () => {
      await updateForestPinSize(workId, size)
    })
  }

  const panoramaUrl = imageUrl(panoramaKey)
  const pinMap = new Map(pins.map(p => [p.work_id, p]))

  const pillBase: React.CSSProperties = {
    fontSize: 8, letterSpacing: 1, textTransform: 'uppercase',
    padding: '3px 8px', border: '1px solid var(--bd)', borderRadius: 2,
    cursor: 'pointer', background: 'none', color: 'var(--tx2)', fontFamily: 'inherit',
  }
  const pillActive: React.CSSProperties = {
    ...pillBase, background: 'var(--ac)', color: '#fff', borderColor: 'var(--ac)',
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)', marginBottom: 8 }}>
        {t('site_works_map_pin_section')}
      </div>

      {/* Panorama canvas */}
      <div
        style={{
          position: 'relative', width: '100%', paddingBottom: '56.25%',
          background: panoramaUrl ? undefined : 'repeating-linear-gradient(45deg, var(--bg1) 0, var(--bg1) 8px, var(--bg2) 8px, var(--bg2) 16px)',
          border: '1px solid var(--bd)',
          cursor: armedId !== null ? 'crosshair' : 'default',
          marginBottom: 10, overflow: 'hidden', borderRadius: 2,
          opacity: isPending ? 0.7 : 1,
        }}
        onClick={handlePanoramaClick}
        role="img"
        aria-label="Forest panorama — click to place pin"
      >
        {panoramaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={panoramaUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        )}

        {/* Pins — size from per-pin z: z=0 full size, z=100 small */}
        {pins.map(pin => {
          const work = works.find(w => w.OeuvreID === pin.work_id)
          const thumb = thumbUrl(work?.txtImageNameLink)
          const isArmed = armedId === pin.work_id
          const depthScale = 1 - (pin.z / 100) * 0.75
          const sz = Math.round((pin.size ?? pinSize) * depthScale)
          return (
            <div
              key={pin.work_id}
              title={work?.Titre ?? String(pin.work_id)}
              style={{
                position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`,
                transform: `translate(-50%, -50%) scale(${isArmed ? 1.3 : 1})`,
                width: sz, height: sz, borderRadius: 2,
                backgroundImage: thumb ? `url(${thumb})` : 'none',
                backgroundSize: 'cover',
                backgroundColor: thumb ? 'transparent' : (isArmed ? 'var(--ac)' : 'rgba(255,180,40,0.9)'),
                border: `${Math.max(1, Math.round(depthScale * 2))}px solid rgba(255,255,255,0.6)`,
                boxShadow: `0 ${Math.round(depthScale * 3)}px ${Math.round(depthScale * 8)}px rgba(0,0,0,0.55)`,
                zIndex: Math.round(100 - pin.z), pointerEvents: 'none',
                transition: 'transform .15s',
              }}
            />
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

      {/* Works list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 420, overflowY: 'auto' }}>
        {displayedWorks.map(work => {
          const existing = pinMap.get(work.OeuvreID)
          const isArmed = armedId === work.OeuvreID
          return (
            <div key={work.OeuvreID} style={{ borderRadius: 2, border: '1px solid ' + (isArmed ? 'var(--ac)' : 'var(--bd)'), background: isArmed ? 'var(--ac)' : 'var(--bg1)', overflow: 'hidden' }}>

              {/* Top row: arm + thumb + title + coords + delete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer' }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setArmedId(isArmed ? null : work.OeuvreID) }}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    background: isArmed ? '#fff' : (existing ? 'rgba(255,180,40,0.8)' : 'var(--bg2)'),
                    border: '1px solid ' + (isArmed ? '#fff' : 'var(--bd)'),
                  }}
                  title={isArmed ? 'Cancel' : (existing ? `${existing.x.toFixed(0)},${existing.y.toFixed(0)}` : 'Place pin')}
                />
                {work.txtImageNameLink && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl(work.txtImageNameLink) ?? ''} alt="" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, fontSize: 9, color: isArmed ? '#fff' : 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {work.Titre ?? `#${work.OeuvreID}`}
                </span>
                {existing && (
                  <span style={{ fontSize: 7, opacity: 0.5, flexShrink: 0 }}>
                    {existing.x.toFixed(0)},{existing.y.toFixed(0)}
                  </span>
                )}
                {existing && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDeletePin(work.OeuvreID) }}
                    aria-label={t('site_works_map_pin_delete')}
                    style={{ width: 18, height: 18, borderRadius: 2, border: 'none', background: 'rgba(255,80,80,0.15)', color: '#f88', cursor: 'pointer', fontSize: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >×</button>
                )}
              </div>

              {/* Z + size — single compact row when placed */}
              {existing && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 6px 5px 34px' }}>
                  <span style={{ fontSize: 7, color: 'var(--tx2)', flexShrink: 0 }}>Z</span>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={existing.z}
                    onChange={e => handleSetZ(work.OeuvreID, Number(e.target.value))}
                    style={{ width: 80, flexShrink: 0, accentColor: 'var(--ac)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 7, color: 'var(--tx2)', width: 16, flexShrink: 0 }}>{existing.z}</span>
                  <span style={{ fontSize: 7, color: 'var(--tx2)', flexShrink: 0, marginLeft: 4 }}>{lang === 'fr' ? 'T' : 'S'}</span>
                  <input
                    type="range" min={8} max={200} step={4}
                    value={existing.size ?? pinSize}
                    onChange={e => handleSetSize(work.OeuvreID, Number(e.target.value))}
                    style={{ width: 80, flexShrink: 0, accentColor: 'var(--ac)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 7, color: 'var(--tx2)', width: 24, flexShrink: 0 }}>{existing.size ?? pinSize}</span>
                  {existing.size !== null && (
                    <button
                      type="button"
                      onClick={() => handleSetSize(work.OeuvreID, null)}
                      title={lang === 'fr' ? 'Réinitialiser taille' : 'Reset size'}
                      style={{ border: 'none', background: 'none', color: 'var(--tx2)', cursor: 'pointer', fontSize: 9, padding: 0, lineHeight: 1, flexShrink: 0 }}
                    >↺</button>
                  )}
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
