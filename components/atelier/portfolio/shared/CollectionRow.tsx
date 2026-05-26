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

const SECTION_PANEL: CSSProperties = {
  border: '1px solid var(--bd)',
  borderRadius: 6,
  padding: '12px 14px',
  background: 'var(--bg0)',
}

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
  const { t, lang } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [headingExpanded, setHeadingExpanded] = useState(false)
  const [textExpanded, setTextExpanded] = useState(false)

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

  const plainFr = useMemo(() => collectionPlainText(item, 'fr'), [item])
  const plainEn = useMemo(() => collectionPlainText(item, 'en'), [item])

  const pubCount = privateWorks?.filter(w => w.isPublic).length ?? 0
  const privCount = privateWorks?.filter(w => !w.isPublic).length ?? 0
  const hasWorks = (privateWorks?.length ?? 0) > 0

  const headingHeaderNote = t('portfolio_collection_heading_preview').replace(
    '{label}',
    headingPreview,
  )

  const textPreview = hasTextContent ? (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 10px', fontSize: 10, lineHeight: 1.55, color: 'var(--tx2)' }}>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{plainFr || '—'}</p>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{plainEn || '—'}</p>
    </div>
  ) : undefined

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
      <label
        className="row gap-xs pointer center"
        style={{ minHeight: 44, border: '1px solid var(--bd)', borderRadius: 4, padding: '8px 12px' }}
      >
        <input
          type="checkbox"
          checked={showTextOnSite}
          onChange={e => onUpdate({ show_text: e.target.checked ? true : false })}
        />
        <span className="t-mono-sm" style={{ fontSize: 10 }}>{t('portfolio_collection_show_text')}</span>
      </label>

      {showTextOnSite && (
        <>
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
        </>
      )}
    </div>
  )

  const shellsCollapsed = !headingExpanded && !textExpanded

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
        border: isTarget ? '1px solid var(--ac)' : '1px solid var(--bd)',
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

      {shellsCollapsed && (
        <div
          className="col gap-sm"
          style={{ ...SECTION_PANEL, borderStyle: 'dashed' }}
        >
          <p className="t-mono-sm" style={{
            margin: 0, fontSize: 11, color: 'var(--tx2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {headingPreview}
          </p>
          <p className="t-mono-xs" style={{ margin: 0, fontSize: 9, color: 'var(--tx3)', letterSpacing: 1 }}>
            {headingSource === 'theme'
              ? t('portfolio_collection_heading_source_theme')
              : t('portfolio_collection_heading_source_title')}
            {!showTextOnSite && hasTextContent ? ` · ${t('portfolio_collection_text_hidden')}` : ''}
          </p>
          {hasWorks && (
            <p className="t-mono-xs" style={{ margin: 0, fontSize: 9, color: 'var(--tx3)', letterSpacing: 1 }}>
              {pubCount} {t('portfolio_collection_n_public')}
              {privCount > 0 ? ` · ${privCount} ${t('portfolio_collection_n_private')}` : ''}
            </p>
          )}
        </div>
      )}

      <div style={SECTION_PANEL}>
        <div className="t-label" style={{ fontSize: 9, letterSpacing: 1, marginBottom: 8 }}>
          {t('portfolio_collection_section_theme')}
        </div>
        <label className="t-label" style={{ display: 'block', marginBottom: 4, fontSize: 9 }}>{'THÈME / GROUPE ASSIGNÉ'}</label>
        <div onClick={onAssign} style={{
          height: 36, border: `1px ${item.theme ? 'solid' : 'dashed'} ${isTarget ? 'var(--ac)' : 'var(--bd)'}`,
          borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', cursor: 'pointer',
          background: item.theme ? 'var(--bg1)' : undefined,
        }}>
          <span className="t-mono-sm" style={{ fontSize: 11, color: item.theme ? 'var(--ac)' : 'var(--tx3)' }}>
            {item.theme || (isTarget ? 'PRÊT POUR THÈME' : 'CLIQUER POUR CHOISIR')}
          </span>
        </div>
      </div>

      <EditorFadeShell
        expanded={headingExpanded}
        onToggle={() => setHeadingExpanded(v => !v)}
        expandLabelKey="portfolio_collection_edit_heading"
        collapseLabelKey="portfolio_collection_collapse_heading"
        headerNote={headingHeaderNote}
      >
        {headingBody}
      </EditorFadeShell>

      <EditorFadeShell
        expanded={textExpanded}
        onToggle={() => setTextExpanded(v => !v)}
        expandLabelKey="portfolio_collection_edit_text"
        collapseLabelKey="portfolio_collection_collapse_text"
        preview={!textExpanded && showTextOnSite ? textPreview : undefined}
        headerNote={!showTextOnSite && hasTextContent ? t('portfolio_collection_text_hidden') : undefined}
      >
        {textBody}
      </EditorFadeShell>

      {hasWorks && (
        <div style={SECTION_PANEL}>
          <div className="t-label" style={{ fontSize: 9, letterSpacing: 1, marginBottom: 8 }}>
            {t('portfolio_collection_work_sequence')}
          </div>
          <WorksReorder
            privateWorks={privateWorks!}
            orderIds={item.manual_work_order ?? []}
            onReorder={ids => onUpdate({ manual_work_order: ids })}
            onMakePublic={onMakePublic}
          />
        </div>
      )}
    </div>
  )
}
