'use client'

import type { MutableRefObject } from 'react'
import type { ConstellationMapRow } from '@/app/atelier/(portal)/constellation/actions'
import type { DictKey } from '@/lib/i18n/dictionary'
import {
  LINK_LABEL_KEYS,
  LINK_VIS,
  type GroupBy,
  type LinkType,
  type NodeMap,
  type Snapshot,
  type Edge,
  groupWorkSize,
  themeWorkSize,
} from './constellation-shared'

export type ConstellationToolbarProps = {
  t: (key: DictKey) => string
  groupBy: GroupBy
  setGroupBy: (g: GroupBy) => void
  groupByRef: MutableRefObject<GroupBy>
  linkType: LinkType
  setLinkType: (lt: LinkType) => void
  selectedThemeId: number | null
  setSelectedThemeId: (id: number | null) => void
  effectiveThemeWork: Map<number, Set<number>>
  themesInDropdown: { id: number; name: string }[]
  themeWorkCount?: Record<number, number>
  selectedGroupId: string | null
  setSelectedGroupId: (id: string | null) => void
  effectiveGroupWork: Map<string, Set<number>>
  groupsInDropdown: { id: string; name: string }[]
  groupWorkCount?: Record<string, number>
  posRef: MutableRefObject<NodeMap>
  setCustomIds: (ids: Set<number>) => void
  setPickerQ: (q: string) => void
  snapshots: Snapshot[]
  snapName: string
  setSnapName: (name: string) => void
  snapSaved: boolean
  handleSaveSnapshot: () => void
  handleLoadSnapshot: (id: string) => void
  cloudMaps: ConstellationMapRow[]
  cloudBusy: boolean
  cloudSaved: boolean
  frozenEdges: Edge[] | null
  handleLoadCloudMap: (id: string) => void | Promise<void>
  handleSaveCloudMap: () => void | Promise<void>
  exitFrozenLiveGraph: () => void
  handleResetLayout: () => void
  handleFitView: () => void
  handleExportPng: () => void
  handleExportTiledA4: () => void
  backgroundImage?: string
  backgroundOpacity?: number
  onBackgroundOpacity?: (opacity: number) => void
  loading: boolean
}

export function ConstellationToolbar(props: ConstellationToolbarProps) {
  const {
    t, groupBy, setGroupBy, groupByRef, linkType, setLinkType,
    selectedThemeId, setSelectedThemeId, effectiveThemeWork, themesInDropdown, themeWorkCount,
    selectedGroupId, setSelectedGroupId, effectiveGroupWork, groupsInDropdown, groupWorkCount,
    posRef, setCustomIds, setPickerQ,
    snapshots, snapName, setSnapName, snapSaved, handleSaveSnapshot, handleLoadSnapshot,
    cloudMaps, cloudBusy, cloudSaved, frozenEdges, handleLoadCloudMap, handleSaveCloudMap, exitFrozenLiveGraph,
    handleResetLayout, handleFitView, handleExportPng, handleExportTiledA4,
    backgroundImage, backgroundOpacity, onBackgroundOpacity, loading,
  } = props

  return (
          <div style={{ flexShrink: 0, minHeight: 40, borderBottom: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 10, overflowX: 'auto', overflowY: 'hidden' }}>
            <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{t('viewMode')}</div>
            {(['year', 'theme', 'workgroup', 'none'] as GroupBy[]).map(g => (
              <button key={g} className="btn ghost sm"
                aria-pressed={groupBy === g}
                style={{ borderColor: groupBy === g ? 'var(--ac)' : undefined, color: groupBy === g ? 'var(--ac)' : undefined, whiteSpace: 'nowrap' }}
                onClick={() => { groupByRef.current = g; setGroupBy(g) }}
              >
                {g === 'year' ? t('year') : g === 'theme' ? t('theme') : g === 'workgroup' ? t('const_viewGroup') : t('const_viewGlobal')}
              </button>
            ))}
            {groupBy === 'theme' && (
              <select
                value={selectedThemeId ?? ''}
                onChange={e => setSelectedThemeId(e.target.value ? Number(e.target.value) : null)}
                style={{ fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--ac)', color: 'var(--tx)', padding: '2px 8px', cursor: 'pointer', maxWidth: 140 }}
              >
                <option value="">{t('const_allThemes')} ({[...effectiveThemeWork.values()].reduce((a, s) => { s.forEach(id => a.add(id)); return a }, new Set()).size})</option>
                {themesInDropdown.map(th => (
                  <option key={th.id} value={th.id}>
                    {th.name} ({themeWorkSize(effectiveThemeWork, th.id, themeWorkCount)})
                  </option>
                ))}
              </select>
            )}
            {groupBy === 'workgroup' && (
              <select
                value={selectedGroupId ?? ''}
                onChange={e => setSelectedGroupId(e.target.value || null)}
                style={{ fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--ac)', color: 'var(--tx)', padding: '2px 8px', cursor: 'pointer', maxWidth: 140 }}
              >
                <option value="">{t('const_allGroups')} ({[...effectiveGroupWork.values()].reduce((a, s) => { s.forEach(id => a.add(id)); return a }, new Set()).size})</option>
                {groupsInDropdown.map(gr => (
                  <option key={gr.id} value={gr.id}>
                    {gr.name} ({groupWorkSize(effectiveGroupWork, gr.id, groupWorkCount)})
                  </option>
                ))}
              </select>
            )}
            {/* Blank canvas mode */}
            <button className="btn ghost sm"
              aria-pressed={groupBy === 'custom'}
              style={{ borderColor: groupBy === 'custom' ? 'var(--ac)' : undefined, color: groupBy === 'custom' ? 'var(--ac)' : undefined, whiteSpace: 'nowrap' }}
              onClick={() => {
                posRef.current = new Map()
                setCustomIds(new Set())
                setPickerQ('')
                groupByRef.current = 'custom'
                setGroupBy('custom')
              }}
            >
              {t('const_blankCanvas')}
            </button>

            <div className="vline" style={{ height: 16 }} />

            <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{t('const_link')}</div>
            {(Object.keys(LINK_VIS) as LinkType[]).map(lt => {
              const vis = LINK_VIS[lt]
              return (
                <button key={lt} className="btn ghost sm"
                  aria-pressed={linkType === lt}
                  style={{ borderColor: linkType === lt ? vis.color : undefined, color: linkType === lt ? vis.color : undefined, whiteSpace: 'nowrap' }}
                  onClick={() => setLinkType(lt)}
                >
                  {t(LINK_LABEL_KEYS[lt])}
                </button>
              )
            })}

            <div className="vline" style={{ height: 16 }} />

            {/* Snapshots */}
            <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{t('const_maps')}</div>
            {snapshots.length > 0 && (
              <select
                defaultValue=""
                onChange={e => { if (e.target.value) { handleLoadSnapshot(e.target.value); e.target.value = '' } }}
                style={{ fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '2px 6px', maxWidth: 110, cursor: 'pointer' }}
              >
                <option value="">{t('const_mapLoad')}</option>
                {snapshots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <input
              value={snapName}
              onChange={e => setSnapName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveSnapshot()}
              placeholder={t('const_mapNamePlaceholder')}
              style={{ width: 80, fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '2px 6px' }}
            />
            <button className="btn ghost sm" onClick={handleSaveSnapshot} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
              {snapSaved ? t('const_savedOk') : t('const_saveShort')}
            </button>

            <div className="vline" style={{ height: 16 }} />
            <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{t('const_cloudToolbar')}</div>
            {cloudMaps.length > 0 && (
              <select
                defaultValue=""
                onChange={e => {
                  const id = e.target.value
                  if (id) {
                    void handleLoadCloudMap(id)
                    e.target.value = ''
                  }
                }}
                disabled={cloudBusy}
                data-testid="constellation-cloud-load"
                style={{ fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '2px 6px', maxWidth: 100, cursor: 'pointer' }}
              >
                <option value="">{t('const_cloudLoad')}</option>
                {cloudMaps.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="btn ghost sm"
              disabled={cloudBusy || posRef.current.size === 0}
              onClick={() => void handleSaveCloudMap()}
              data-testid="constellation-cloud-save"
              style={{ whiteSpace: 'nowrap', fontSize: 9 }}
            >
              {cloudBusy ? t('const_cloudSaving') : cloudSaved ? t('const_cloudSavedOk') : t('const_cloudSave')}
            </button>
            {frozenEdges !== null && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => exitFrozenLiveGraph()}
                data-testid="constellation-cloud-live-graph"
                style={{ whiteSpace: 'nowrap', fontSize: 9, borderColor: 'var(--ac)', color: 'var(--ac)' }}
              >
                {t('const_cloudUseLiveDb')}
              </button>
            )}

            <div className="vline" style={{ height: 16 }} />
            <button className="btn ghost sm" onClick={handleResetLayout} title={t('const_resetLayoutTitle')} aria-label={t('const_resetLayoutTitle')} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
              {t('const_resetLayoutBtn')}
            </button>
            <button className="btn ghost sm" onClick={handleFitView} title={t('const_fitViewTitle')} aria-label={t('const_fitViewTitle')} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
              {t('const_fitViewBtn')}
            </button>
            <button className="btn ghost sm" onClick={handleExportPng} aria-label={t('const_exportPng')} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
              {t('const_exportPng')}
            </button>
            <button className="btn ghost sm" onClick={handleExportTiledA4} aria-label={t('const_exportA4')} style={{ whiteSpace: 'nowrap', fontSize: 9 }}>
              {t('const_exportA4')}
            </button>

            {backgroundImage && (
              <>
                <div className="vline" style={{ height: 16 }} />
                <div className="t-label" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{t('const_floorplan')}</div>
                <input 
                  type="range" min="0.1" max="1" step="0.05" 
                  value={backgroundOpacity} 
                  onChange={e => onBackgroundOpacity?.(Number(e.target.value))}
                  style={{ width: 60, height: 4, cursor: 'pointer', appearance: 'none', background: 'var(--bg2)', borderRadius: 2 }}
                />
              </>
            )}

            {loading && <div className="pulse t-mono-sm" style={{ color: 'var(--tx3)', marginLeft: 'auto', whiteSpace: 'nowrap', alignSelf: 'center' }}>{t('const_loadingEllipsis')}</div>}
          </div>
  )
}
