'use client'

import { useState } from 'react'
import type { CollectionItem, ThemeWork } from '@/lib/portfolio-config-types'
import { RichEditor, htmlToPlain } from '@/components/atelier/RichEditor'
import { FileImportButton } from './FileImportButton'
import { FlamePreview } from './FlamePreview'
import { WorksReorder } from './WorksReorder'
import { moveBtnStyle } from './moveBtnStyle'

export function CollectionRow({ item, index, total, sequenceLabel, onMove, isTarget, onAssign, onUpdate, onDelete, themeStats, privateWorks, onMakePublic }: {
  item: CollectionItem
  index: number
  total: number
  sequenceLabel?: string
  onMove: (from: number, to: number) => void
  isTarget: boolean
  onAssign: () => void
  onUpdate: (p: Partial<CollectionItem>) => void
  onDelete: () => void
  themeStats?: Record<string, { total: number; pub: number }>
  privateWorks?: ThemeWork[]
  onMakePublic?: (id: number) => void
}) {
  const [dragging, setDragging] = useState(false)
  const hasTextContent = !!(htmlToPlain(item.intro_fr) || htmlToPlain(item.intro_en) || htmlToPlain(item.description_fr) || htmlToPlain(item.description_en))
  const [textExpanded, setTextExpanded] = useState(hasTextContent)
  return (
    <div
      className="panel pad-md col gap-md"
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/x-collection-from', String(index))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => {
        e.preventDefault()
        const raw = e.dataTransfer.getData('text/x-collection-from')
        const from = Number(raw)
        if (Number.isFinite(from) && from !== index) onMove(from, index)
        setDragging(false)
      }}
      style={{
        border: isTarget ? '1px solid var(--ac)' : undefined,
        background: isTarget ? 'rgba(200,168,110,0.03)' : undefined,
        opacity: dragging ? 0.5 : 1,
      }}
    >
      {/* Reorder header */}
      <div className="row gap-md" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span title="Glisser pour réordonner" style={{
            cursor: 'grab', color: 'var(--tx3)', fontSize: 14, lineHeight: 1,
            padding: '2px 6px', borderRadius: 3, userSelect: 'none',
          }}>⋮⋮</span>
          {sequenceLabel && (
            <span className="t-mono-xs" style={{
              fontSize: 9, letterSpacing: 2, color: 'var(--ac)', fontWeight: 700,
              padding: '3px 8px', borderRadius: 3, border: '1px solid var(--ac)',
            }}>{sequenceLabel}</span>
          )}
          <span className="t-mono-xs" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 1 }}>
            {index + 1} / {total}
          </span>
          <button onClick={() => onMove(index, index - 1)} disabled={index === 0}
            title="Monter"
            style={moveBtnStyle(index === 0)}>↑</button>
          <button onClick={() => onMove(index, index + 1)} disabled={index === total - 1}
            title="Descendre"
            style={moveBtnStyle(index === total - 1)}>↓</button>
        </div>
        <button className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', fontSize: 11 }} onClick={onDelete}>
          Supprimer
        </button>
      </div>

      {/* Titles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TITRE FR</label>
          <input className="input full" value={item.title_fr} onChange={e => onUpdate({ title_fr: e.target.value })} />
        </div>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>TITRE EN</label>
          <input className="input full" value={item.title_en} onChange={e => onUpdate({ title_en: e.target.value })} />
        </div>
      </div>

      {/* Theme + active toggle */}
      <div className="row gap-md" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{'THÈME / GROUPE ASSIGNÉ'}</label>
          <div onClick={onAssign} style={{
            height: 36, border: `1px ${item.theme ? 'solid' : 'dashed'} ${isTarget ? 'var(--ac)' : 'var(--bd)'}`,
            borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer',
            background: item.theme ? 'var(--bg0)' : undefined
          }}>
            <span className="t-mono-sm" style={{ fontSize: 11, color: item.theme ? 'var(--ac)' : 'var(--tx3)' }}>
              {item.theme || (isTarget ? 'PRÊT POUR THÈME' : 'CLIQUER POUR CHOISIR')}
            </span>
          </div>
        </div>
        <label className="row gap-xs pointer center" style={{ paddingBottom: 6 }}>
          <input type="checkbox" checked={item.is_active} onChange={e => onUpdate({ is_active: e.target.checked })} />
          <span className="t-mono-xs" style={{ fontSize: 9 }}>ACTIF</span>
        </label>
      </div>

      {/* Works thumbnail strip */}
      {privateWorks && privateWorks.length > 0 && (
        <WorksReorder
          privateWorks={privateWorks}
          orderIds={item.manual_work_order ?? []}
          onReorder={ids => onUpdate({ manual_work_order: ids })}
          onMakePublic={onMakePublic}
        />
      )}

      {/* Text fields — collapsed by default when empty */}
      <button
        type="button"
        onClick={() => setTextExpanded(!textExpanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx3)', fontSize: 9, letterSpacing: 1,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 10, transition: 'transform .15s', transform: textExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>{'▸'}</span>
        {textExpanded ? 'MASQUER TEXTES' : hasTextContent ? 'TEXTES (remplis)' : 'AJOUTER INTRO / TEXTE'}
      </button>

      {textExpanded && (
        <>
          {sequenceLabel && (
            <>
              <div className="t-label" style={{ fontSize: 9, opacity: 0.75 }}>{'INTRO (optionnel)'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="t-label" style={{ fontSize: 9 }}>INTRO FR</span>
                    <FileImportButton onText={v => onUpdate({ intro_fr: v })} lang="fr" />
                  </div>
                  <RichEditor value={item.intro_fr} onChange={v => onUpdate({ intro_fr: v })} minHeight={100} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="t-label" style={{ fontSize: 9 }}>INTRO EN</span>
                    <FileImportButton onText={v => onUpdate({ intro_en: v })} lang="en" />
                  </div>
                  <RichEditor value={item.intro_en} onChange={v => onUpdate({ intro_en: v })} minHeight={100} />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="t-label" style={{ fontSize: 9 }}>TEXTE FR</span>
                <FileImportButton onText={v => onUpdate({ description_fr: v })} lang="fr" />
              </div>
              <RichEditor value={item.description_fr} onChange={v => onUpdate({ description_fr: v })} minHeight={120} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="t-label" style={{ fontSize: 9 }}>TEXTE EN</span>
                <FileImportButton onText={v => onUpdate({ description_en: v })} lang="en" />
              </div>
              <RichEditor value={item.description_en} onChange={v => onUpdate({ description_en: v })} minHeight={120} />
            </div>
          </div>

          {(htmlToPlain(item.description_fr) || htmlToPlain(item.description_en)) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>{'APERÇU FR'}</div>
                <FlamePreview html={item.description_fr} />
              </div>
              <div>
                <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>{'APERÇU EN'}</div>
                <FlamePreview html={item.description_en} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
