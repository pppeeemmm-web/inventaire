'use client'

import { useEffect, useState, useTransition, type MouseEvent } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl } from '@/lib/data'
import {
  listForestPins,
  upsertForestPin,
  deleteForestPin,
} from '@/app/atelier/(portal)/portfolio/forest-pins-actions'
import type { ForestPin } from '@/components/public/works-utils'

interface PinWork {
  OeuvreID: number
  Titre: string | null
  txtImageNameLink?: string | null
}

interface Props {
  works: PinWork[]
  panoramaKey: string | undefined
}

export function MapPinEditor({ works, panoramaKey }: Props) {
  const { t } = useI18n()
  const [pins, setPins] = useState<ForestPin[]>([])
  const [armedId, setArmedId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  // Load pins on mount
  useEffect(() => {
    startTransition(async () => {
      const loaded = await listForestPins()
      setPins(loaded)
    })
  }, [])

  function handlePanoramaClick(e: MouseEvent<HTMLDivElement>) {
    if (armedId === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100 * 10) / 10
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100 * 10) / 10
    const pinX = Math.max(0, Math.min(100, x))
    const pinY = Math.max(0, Math.min(100, y))
    startTransition(async () => {
      await upsertForestPin(armedId, pinX, pinY)
      const updated = await listForestPins()
      setPins(updated)
      setArmedId(null)
    })
  }

  function handleDeletePin(workId: number) {
    startTransition(async () => {
      await deleteForestPin(workId)
      setPins(prev => prev.filter(p => p.work_id !== workId))
    })
  }

  const panoramaUrl = imageUrl(panoramaKey)
  const pinMap = new Map(pins.map(p => [p.work_id, p]))

  const inputStyle: React.CSSProperties = {
    width: '100%', fontFamily: 'inherit', fontSize: 9,
    padding: '5px 8px', background: 'var(--bg2)', color: 'var(--tx)',
    border: '1px solid var(--bd2)', borderRadius: 0, marginBottom: 2,
  }

  return (
    <div style={{ marginTop: 12 }}>
      {/* Section header */}
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--tx2)', marginBottom: 8 }}>
        {t('site_works_map_pin_section')}
      </div>

      {/* Panorama preview with pins */}
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
          <img
            src={panoramaUrl}
            alt=""
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', pointerEvents: 'none',
            }}
          />
        )}
        {/* Render existing pins as dots */}
        {pins.map(pin => {
          const work = works.find(w => w.OeuvreID === pin.work_id)
          const thumb = thumbUrl(work?.txtImageNameLink)
          const isArmed = armedId === pin.work_id
          return (
            <div
              key={pin.work_id}
              title={work?.Titre ?? String(pin.work_id)}
              style={{
                position: 'absolute',
                left: `${pin.x}%`, top: `${pin.y}%`,
                transform: 'translate(-50%, -50%)',
                width: isArmed ? 20 : 14, height: isArmed ? 20 : 14,
                borderRadius: '50%',
                background: isArmed ? 'var(--ac)' : 'rgba(255,180,40,0.9)',
                border: '2px solid #fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                zIndex: 5, pointerEvents: 'none',
                backgroundImage: thumb ? `url(${thumb})` : undefined,
                backgroundSize: 'cover',
              }}
            />
          )
        })}
        {/* Arm hint */}
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

      {/* Works list — arm one to place pin */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
        {works.map(work => {
          const existing = pinMap.get(work.OeuvreID)
          const isArmed = armedId === work.OeuvreID
          return (
            <div key={work.OeuvreID} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 6px', borderRadius: 2,
              background: isArmed ? 'var(--ac)' : 'var(--bg1)',
              border: '1px solid ' + (isArmed ? 'var(--ac)' : 'var(--bd)'),
              cursor: 'pointer',
            }}>
              {/* Arm / active indicator */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setArmedId(isArmed ? null : work.OeuvreID) }}
                style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: isArmed ? '#fff' : (existing ? 'rgba(255,180,40,0.8)' : 'var(--bg2)'),
                  border: '1px solid ' + (isArmed ? '#fff' : 'var(--bd)'),
                  cursor: 'pointer',
                }}
                aria-label={isArmed ? 'Cancel placement' : 'Place pin'}
                title={isArmed ? 'Cancel' : (existing ? `Pin at (${existing.x}, ${existing.y})` : 'Place pin')}
              />
              {/* Thumb */}
              {work.txtImageNameLink && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl(work.txtImageNameLink) ?? ''}
                  alt=""
                  style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }}
                />
              )}
              {/* Title */}
              <span style={{
                flex: 1, fontSize: 9, color: isArmed ? '#fff' : 'var(--tx)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {work.Titre ?? `#${work.OeuvreID}`}
              </span>
              {/* Coords */}
              {existing && (
                <span style={{ fontSize: 7, opacity: 0.55, letterSpacing: 0.5, flexShrink: 0 }}>
                  {existing.x.toFixed(0)},{existing.y.toFixed(0)}%
                </span>
              )}
              {/* Delete pin */}
              {existing && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); handleDeletePin(work.OeuvreID) }}
                  aria-label={t('site_works_map_pin_delete')}
                  style={{
                    width: 18, height: 18, borderRadius: 2, border: 'none',
                    background: 'rgba(255,80,80,0.15)', color: '#f88', cursor: 'pointer',
                    fontSize: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
        {works.length === 0 && (
          <p style={{ fontSize: 8, opacity: 0.5, letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('map_pin_no_works')}
          </p>
        )}
      </div>
      <input type="text" readOnly style={{ ...inputStyle, display: 'none' }} />
    </div>
  )
}
