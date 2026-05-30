'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { CollectionItem, ThemeWork } from '@/lib/portfolio-config-types'
import {
  collectionDisplayHeading,
  collectionTextEnabled,
} from '@/lib/collection-display'
import { RichEditor, htmlToPlain } from '@/components/atelier/RichEditor'
import { FileImportButton } from './FileImportButton'
import { FlamePreview } from './FlamePreview'
import { WorksReorder } from './WorksReorder'
import { moveBtnStyle } from './moveBtnStyle'
import { EditorFadeShell } from './EditorFadeShell'

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
  const { t, lang } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [editExpanded, setEditExpanded] = useState(false)

  const hasTextContent = !!(
    htmlToPlain(item.intro_fr) || htmlToPlain(item.intro_en)
    || htmlToPlain(item.description_fr) || htmlToPlain(item.description_en)
  )
  const showTextOnSite = collectionTextEnabled(item)
  const headingSource = item.heading_source ?? 'title'

  const headingPreview = useMemo(
    () => collectionDisplayHeading(item, lang) || '—',
    [item, lang],
  )

  const pubCount = privateWorks?.filter(w => w.isPublic).length ?? 0
  const privCount = privateWorks?.filter(w => !w.isPublic).length ?? 0
  const hasWorks = (privateWorks?.length ?? 0) > 0

  const headingBody = (
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
      <fieldset
        className="col gap-xs"
        style={{ border: '1px solid var(--bd)', borderRadius: 4, margin: 0, padding: '10px 12px' }}
      >
        <legend className="t-label" style={{ fontSize: 9, padding: '0 4px' }}>{t('portfolio_collection_heading_source_label')}</legend>
        <label className="row gap-xs pointer" style={{ minHeight: 44, alignItems: 'center' }}>
          <input
            type="radio"
            name={`heading-source-${item.id}`}
            checked={headingSource === 'title'}
            onChange={() => onUpdate({ heading_source: 'title' })}
          />
          <span className="t-mono-sm" style={{ fontSize: 10 }}>{t('portfolio_collection_heading_source_title')}</span>
        </label>
        <label className="row gap-xs pointer" style={{ minHeight: 44, alignItems: 'center' }}>
          <input
            type="radio"
            name={`heading-source-${item.id}`}
            checked={headingSource === 'theme'}
            onChange={() => onUpdate({ heading_source: 'theme' })}
            disabled={!item.theme?.trim()}
          />
          <span className="t-mono-sm" style={{ fontSize: 10, opacity: item.theme?.trim() ? 1 : 0.45 }}>
            {t('portfolio_collection_heading_source_theme')}
            {item.theme?.trim() ? ` (${item.theme.trim()})` : ''}
          </span>
        </label>
      </fieldset>
    </div>
  )

  const textBody = (
    <div className="col gap-md">
      <div className="t-label" style={{ fontSize: 9, opacity: 0.75 }}>{'INTRO (optionnel)'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid var(--bd)', borderRadius: 4, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="t-label" style={{ fontSize: 9 }}>INTRO FR</span>
            <FileImportButton onText={v => onUpdate({ intro_fr: v })} lang="fr" />
          </div>
          <RichEditor value={item.intro_fr} onChange={v => onUpdate({ intro_fr: v })} minHeight={100} />
        </div>
        <div style={{ border: '1px solid var(--bd)', borderRadius: 4, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="t-label" style={{ fontSize: 9 }}>INTRO EN</span>
            <FileImportButton onText={v => onUpdate({ intro_en: v })} lang="en" />
          </div>
          <RichEditor value={item.intro_en} onChange={v => onUpdate({ intro_en: v })} minHeight={100} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid var(--bd)', borderRadius: 4, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="t-label" style={{ fontSize: 9 }}>TEXTE FR</span>
            <FileImportButton onText={v => onUpdate({ description_fr: v })} lang="fr" />
          </div>
          <RichEditor value={item.description_fr} onChange={v => onUpdate({ description_fr: v })} minHeight={120} />
        </div>
        <div style={{ border: '1px solid var(--bd)', borderRadius: 4, padding: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="t-label" style={{ fontSize: 9 }}>TEXTE EN</span>
            <FileImportButton onText={v => onUpdate({ description_en: v })} lang="en" />
          </div>
          <RichEditor value={item.description_en} onChange={v => onUpdate({ description_en: v })} minHeight={120} />
        </div>
      </div>

      {(htmlToPlain(item.description_fr) || htmlToPlain(item.description_en)) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ border: '1px solid var(--bd)', borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>{'APERÇU FR'}</div>
            <FlamePreview html={item.description_fr} />
          </div>
          <div style={{ border: '1px solid var(--bd)', borderRadius: 4, padding: 10 }}>
            <div style={{ fontSize: 8, letterSpacing: 2, color: 'var(--tx3)', marginBottom: 4 }}>{'APERÇU EN'}</div>
            <FlamePreview html={item.description_en} />
          </div>
        </div>
      )}
    </div>
  )

  const divider = <div style={{ borderTop: '1px solid var(--bd)', margin: '2px 0' }} />

  // ── At-a-glance header strip ────────────────────────────────────────────
  const chipBase: CSSProperties = {
    fontFamily: 'inherit', cursor: 'pointer', borderRadius: 3,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 9, letterSpacing: 1, padding: '4px 8px', minHeight: 28,
  }

  return (
    <div
      className="panel pad-sm col gap-xs"
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
        border: isTarget ? '1px solid var(--ac)' : '1px solid var(--bd)',
        background: isTarget ? 'rgba(200,168,110,0.03)' : undefined,
        opacity: dragging ? 0.5 : 1,
      }}
    >
      <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {/* drag + position */}
        <span title={t('portfolio_collection_drag_reorder')} style={{
          cursor: 'grab', color: 'var(--tx3)', fontSize: 14, lineHeight: 1,
          padding: '2px 4px', userSelect: 'none',
        }}>⋮⋮</span>
        {sequenceLabel && (
          <span className="t-mono-xs" style={{
            fontSize: 9, letterSpacing: 1.5, color: 'var(--ac)', fontWeight: 700,
            padding: '3px 7px', borderRadius: 3, border: '1px solid var(--ac)', whiteSpace: 'nowrap',
          }}>{sequenceLabel}</span>
        )}
        <span className="t-mono-xs" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 1, whiteSpace: 'nowrap' }}>
          {index + 1} / {total}
        </span>

        {/* heading preview — the row's identity */}
        <span className="t-mono-sm" title={headingPreview} style={{
          flex: 1, minWidth: 80, fontSize: 11, color: 'var(--tx)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {headingPreview}
        </span>

        {/* theme chip — click to assign */}
        <button type="button" onClick={onAssign} title={item.theme || undefined} style={{
          ...chipBase,
          maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          border: `1px ${item.theme ? 'solid' : 'dashed'} ${isTarget ? 'var(--ac)' : 'var(--bd)'}`,
          background: item.theme ? 'var(--bg1)' : 'transparent',
          color: item.theme ? 'var(--ac)' : 'var(--tx3)',
          textTransform: 'uppercase',
        }}>
          {item.theme || (isTarget ? 'PRÊT POUR THÈME' : 'THÈME')}
        </button>

        {/* text-on-site visibility — checkable + togglable at a glance */}
        <button
          type="button"
          onClick={() => onUpdate({ show_text: !showTextOnSite })}
          title={t('portfolio_collection_show_text')}
          aria-pressed={showTextOnSite}
          style={{
            ...moveBtnStyle(false),
            fontSize: 13,
            color: showTextOnSite ? 'var(--ac)' : 'var(--tx3)',
            opacity: hasTextContent || showTextOnSite ? 1 : 0.45,
          }}
        >{showTextOnSite ? '◼' : '◻'}</button>

        {/* work counts */}
        {hasWorks && (
          <span className="t-mono-xs" title={t('portfolio_collection_work_sequence')} style={{
            fontSize: 9, color: 'var(--tx3)', letterSpacing: 0.5, whiteSpace: 'nowrap',
          }}>
            {pubCount}{t('portfolio_collection_n_public').charAt(0)}{privCount > 0 ? ` · ${privCount}${t('portfolio_collection_n_private').charAt(0)}` : ''}
          </span>
        )}

        {/* reorder */}
        <button type="button" onClick={() => onMove(index, index - 1)} disabled={index === 0}
          title="Monter" style={moveBtnStyle(index === 0)}>↑</button>
        <button type="button" onClick={() => onMove(index, index + 1)} disabled={index === total - 1}
          title="Descendre" style={moveBtnStyle(index === total - 1)}>↓</button>

        {/* delete */}
        <button type="button" onClick={onDelete} title="Supprimer" style={{
          ...moveBtnStyle(false), color: 'var(--rust)', fontSize: 13,
        }}>×</button>
      </div>

      {/* single collapse — all editing behind one disclosure to keep rows short */}
      <EditorFadeShell
        expanded={editExpanded}
        onToggle={() => setEditExpanded(v => !v)}
        headerNote={!showTextOnSite && hasTextContent ? t('portfolio_collection_text_hidden') : undefined}
      >
        <div className="col gap-md">
          {headingBody}
          {divider}
          {textBody}
          {hasWorks && (
            <>
              {divider}
              <div className="t-label" style={{ fontSize: 9, letterSpacing: 1 }}>
                {t('portfolio_collection_work_sequence')}
              </div>
              <WorksReorder
                privateWorks={privateWorks!}
                orderIds={item.manual_work_order ?? []}
                onReorder={ids => onUpdate({ manual_work_order: ids })}
                onMakePublic={onMakePublic}
              />
            </>
          )}
        </div>
      </EditorFadeShell>
    </div>
  )
}
