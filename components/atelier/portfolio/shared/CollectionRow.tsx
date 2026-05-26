'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { CollectionItem, ThemeWork } from '@/lib/portfolio-config-types'
import { RichEditor, htmlToPlain } from '@/components/atelier/RichEditor'
import { FileImportButton } from './FileImportButton'
import { FlamePreview } from './FlamePreview'
import { WorksReorder } from './WorksReorder'
import { moveBtnStyle } from './moveBtnStyle'
import { EditorFadeShell } from './EditorFadeShell'

const FADE_MASK =
  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)'

function collectionPlainText(item: CollectionItem, lang: 'fr' | 'en'): string {
  const intro = lang === 'fr' ? item.intro_fr : item.intro_en
  const desc = lang === 'fr' ? item.description_fr : item.description_en
  return [htmlToPlain(intro), htmlToPlain(desc)].filter(Boolean).join(' ')
}

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
  const { t } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [rowExpanded, setRowExpanded] = useState(false)
  const hasTextContent = !!(
    htmlToPlain(item.intro_fr) || htmlToPlain(item.intro_en)
    || htmlToPlain(item.description_fr) || htmlToPlain(item.description_en)
  )
  const [textExpanded, setTextExpanded] = useState(false)

  const titleLine = useMemo(() => {
    const parts = [item.title_fr?.trim(), item.title_en?.trim()].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : '—'
  }, [item.title_fr, item.title_en])

  const plainFr = useMemo(() => collectionPlainText(item, 'fr'), [item])
  const plainEn = useMemo(() => collectionPlainText(item, 'en'), [item])

  const pubCount = privateWorks?.filter(w => w.isPublic).length ?? 0
  const privCount = privateWorks?.filter(w => !w.isPublic).length ?? 0
  const hasWorks = (privateWorks?.length ?? 0) > 0

  const textFadePreview = hasTextContent ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 10px', fontSize: 10, lineHeight: 1.55, color: 'var(--tx2)' }}>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{plainFr || '—'}</p>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{plainEn || '—'}</p>
    </div>
  ) : null

  const themeRow = (
    <div className="row gap-md" style={{ alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}>
        <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{'THÈME / GROUPE ASSIGNÉ'}</label>
        <div onClick={onAssign} style={{
          height: 36, border: `1px ${item.theme ? 'solid' : 'dashed'} ${isTarget ? 'var(--ac)' : 'var(--bd)'}`,
          borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer',
          background: item.theme ? 'var(--bg0)' : undefined,
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
  )

  const expandedBody = (
    <div className="col gap-md">
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

      {themeRow}

      <button
        type="button"
        onClick={() => setTextExpanded(!textExpanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx3)', fontSize: 9, letterSpacing: 1,
          fontFamily: 'inherit', minHeight: 44,
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
      <div className="row gap-md" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span title={t('portfolio_collection_drag_reorder')} style={{
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
          <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0}
            title="Monter"
            style={moveBtnStyle(index === 0)}>↑</button>
          <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === total - 1}
            title="Descendre"
            style={moveBtnStyle(index === total - 1)}>↓</button>
        </div>
        <button type="button" className="t-mono-sm" style={{ color: 'var(--rust)', cursor: 'pointer', border: 'none', background: 'none', fontSize: 11, minHeight: 44 }} onClick={onDelete}>
          Supprimer
        </button>
      </div>

      {!rowExpanded && (
        <div className="col gap-sm">
          <p className="t-mono-sm" style={{
            margin: 0, fontSize: 11, color: 'var(--tx2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {titleLine}
          </p>
          {themeRow}
          {hasTextContent && textFadePreview ? (
            <div style={{
              position: 'relative', maxHeight: 72, overflow: 'hidden',
              borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bg0)',
            }}>
              <div style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}>
                {textFadePreview}
              </div>
            </div>
          ) : null}
          {hasWorks && (
            <p className="t-mono-xs" style={{ margin: 0, fontSize: 9, color: 'var(--tx3)', letterSpacing: 1 }}>
              {pubCount} {t('portfolio_collection_n_public')}
              {privCount > 0 ? ` · ${privCount} ${t('portfolio_collection_n_private')}` : ''}
            </p>
          )}
        </div>
      )}

      {hasWorks && (
        <WorksReorder
          privateWorks={privateWorks!}
          orderIds={item.manual_work_order ?? []}
          onReorder={ids => onUpdate({ manual_work_order: ids })}
          onMakePublic={onMakePublic}
        />
      )}

      <EditorFadeShell
        expanded={rowExpanded}
        onToggle={() => setRowExpanded(v => !v)}
        expandLabelKey="portfolio_collection_expand"
        collapseLabelKey="portfolio_collection_collapse"
      >
        {expandedBody}
      </EditorFadeShell>
    </div>
  )
}
