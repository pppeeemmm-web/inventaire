'use client'

import type { MutableRefObject } from 'react'
import type { ConstellationMapRow } from '@/app/atelier/(portal)/constellation/actions'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb } from '../WorkThumb'
import { type GroupBy, type NodeMap, type Snapshot } from './constellation-shared'

export type ConstellationSidePanelProps = {
  t: (key: DictKey) => string
  locale: string
  panelNode: Oeuvre | null
  groupBy: GroupBy
  selectedThemeId: number | null
  selectedGroupId: string | null
  selection: Set<number>
  setSelection: (s: Set<number>) => void
  selRef: MutableRefObject<Set<number>>
  tM: Record<number, string>
  removeFromCustom: (id: number) => void
  customIds: Set<number>
  posRef: MutableRefObject<NodeMap>
  pickerQ: string
  setPickerQ: (q: string) => void
  filteredForPicker: Oeuvre[]
  addAllFiltered: () => void
  addToCustom: (id: number) => void
  constellationOeuvres: Oeuvre[]
  themes: { id: number; name: string }[]
  groups: { id: string; name: string }[]
  oeuvres: Oeuvre[]
  oeuvresById: Map<number, Oeuvre>
  groupName: string
  setGroupName: (name: string) => void
  savedName: string | null
  saving: boolean
  handleSaveGroup: () => void
  handleSaveAllAsGroup: () => void
  snapshots: Snapshot[]
  handleLoadSnapshot: (id: string) => void
  handleDeleteSnapshot: (id: string) => void
  cloudMaps: ConstellationMapRow[]
  cloudBusy: boolean
  handleLoadCloudMap: (id: string) => void | Promise<void>
  handleDeleteCloudMap: (id: string) => void | Promise<void>
}

export function ConstellationSidePanel(props: ConstellationSidePanelProps) {
  const {
    t, locale, panelNode, groupBy, selectedThemeId, selectedGroupId,
    selection, setSelection, selRef, tM, removeFromCustom,
    customIds, posRef, pickerQ, setPickerQ, filteredForPicker, addAllFiltered, addToCustom,
    constellationOeuvres, themes, groups, oeuvres, oeuvresById,
    groupName, setGroupName, savedName, saving, handleSaveGroup, handleSaveAllAsGroup,
    snapshots, handleLoadSnapshot, handleDeleteSnapshot,
    cloudMaps, cloudBusy, handleLoadCloudMap, handleDeleteCloudMap,
  } = props

  return (
    <div style={{ width: 240, borderLeft: '1px solid var(--bd)', background: 'var(--bg1)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>

              {/* Node inspector */}
              {panelNode ? (
                <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
                  <div className="t-eyebrow" style={{ marginBottom: 10 }}>{t('const_workEyebrow')}</div>
                  <div style={{ background: 'var(--bg0)', height: 135, marginBottom: 10, overflow: 'hidden', position: 'relative' }}>
                    {panelNode.txtImageNameLink
                      ? <WorkThumb file={panelNode.txtImageNameLink} size={384} style={{ objectFit: 'contain' }} alt="" />
                      : <div style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />
                    }
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--tx)', fontFamily: "'Instrument Serif', serif", lineHeight: 1.2, marginBottom: 4 }}>
                    {panelNode.Titre || '—'}
                  </div>
                  <div className="t-mono-sm">{panelNode.Année?.slice(0, 4) ?? '—'} · {(panelNode.Technique != null && tM[panelNode.Technique]) || '—'}</div>
                  <button
                    className={`btn ghost sm ${selection.has(panelNode.OeuvreID) ? 'primary' : ''}`}
                    style={{ marginTop: 10, width: '100%', justifyContent: 'center', borderColor: selection.has(panelNode.OeuvreID) ? 'var(--ac)' : undefined, color: selection.has(panelNode.OeuvreID) ? 'var(--ac)' : undefined }}
                    onClick={() => {
                      const next = new Set(selRef.current)
                      next.has(panelNode.OeuvreID) ? next.delete(panelNode.OeuvreID) : next.add(panelNode.OeuvreID)
                      setSelection(next)
                    }}
                  >
                    {selection.has(panelNode.OeuvreID) ? t('const_selected') : t('const_selectPlus')}
                  </button>

                  {groupBy === 'custom' && (
                    <button
                      className="btn ghost sm"
                      style={{ marginTop: 6, width: '100%', justifyContent: 'center', color: 'var(--rust)', borderColor: 'var(--rust)' }}
                      onClick={() => removeFromCustom(panelNode.OeuvreID)}
                    >
                      {t('const_removeFromCanvas')}
                    </button>
                  )}
                </div>
              ) : groupBy === 'custom' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
                    <div className="t-eyebrow" style={{ marginBottom: 4 }}>{t('const_emptyConstellationTitle')}</div>
                    <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
                      {customIds.size} {customIds.size === 1 ? t('const_work_unit') : t('const_work_unit_plural')} · {posRef.current.size} {t('const_nodes')}
                    </div>
                  </div>

                  {/* Picker search */}
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
                    <input
                      value={pickerQ}
                      onChange={e => setPickerQ(e.target.value)}
                      placeholder={t('const_pickerPlaceholder')}
                      style={{ width: '100%', padding: '5px 8px', fontSize: 10, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' }}
                    />
                    {filteredForPicker.length > 0 && (
                      <button
                        className="btn ghost sm"
                        onClick={addAllFiltered}
                        style={{ marginTop: 6, width: '100%', justifyContent: 'center', fontSize: 9 }}
                      >
                        {t('const_addAll')} ({Math.min(filteredForPicker.length, 120)})
                      </button>
                    )}
                  </div>

                  {/* Available works list */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
                    {filteredForPicker.length === 0 && (
                      <div className="t-mono-sm" style={{ padding: '10px 14px', color: 'var(--tx3)' }}>
                        {pickerQ ? t('const_pickerNoResults') : t('const_pickerAllInConstellation')}
                      </div>
                    )}
                    {filteredForPicker.slice(0, 200).map(o => (
                      <div
                        key={o.OeuvreID}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', cursor: 'pointer' }}
                        onClick={() => addToCustom(o.OeuvreID)}
                        title={t('const_addToCanvasTitle')}
                      >
                        {o.txtImageNameLink
                          ? <div style={{ width: 24, height: 24, position: 'relative', flexShrink: 0, borderRadius: '50%', overflow: 'hidden' }}>
                              <WorkThumb file={o.txtImageNameLink} size={48} alt="" />
                            </div>
                          : <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg2)', flexShrink: 0 }} />
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 9, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.Titre || `#${o.OeuvreID}`}
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--tx3)' }}>
                            {o.Année?.slice(0, 4) ?? '—'} · {tM[o.Technique ?? 0] ?? '—'}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--ac)', flexShrink: 0 }}>+</span>
                      </div>
                    ))}
                    {filteredForPicker.length > 200 && (
                      <div className="t-mono-sm" style={{ padding: '4px 14px', color: 'var(--tx3)' }}>
                        +{filteredForPicker.length - 200} {t('const_refineSearch')}
                      </div>
                    )}

                    {/* Works already in canvas */}
                    {customIds.size > 0 && (
                      <>
                        <div style={{ margin: '8px 10px 4px', borderTop: '1px solid var(--bd)', paddingTop: 8 }}>
                          <span className="t-label" style={{ color: 'var(--tx3)', fontSize: 8 }}>{t('const_inConstellation')}</span>
                        </div>
                        {[...customIds].map(id => {
                          const o = oeuvresById.get(id)
                          if (!o) return null
                          return (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 10px' }}>
                              <div style={{ flex: 1, fontSize: 9, color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {o.Titre || `#${id}`}
                              </div>
                              <button
                                onClick={() => removeFromCustom(id)}
                                style={{ fontSize: 9, color: 'var(--tx3)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                                title={t('const_removeTitle')}
                              >✕</button>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
                  <div className="t-eyebrow" style={{ marginBottom: 6 }}>{t('constellation')}</div>
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
                    {groupBy === 'theme'
                      ? selectedThemeId !== null
                        ? `${constellationOeuvres.length} ${constellationOeuvres.length === 1 ? t('const_work_unit') : t('const_work_unit_plural')} · ${themes.find(th => th.id === selectedThemeId)?.name ?? ''}`
                        : `${constellationOeuvres.length} ${constellationOeuvres.length === 1 ? t('const_summaryThemedOne') : t('const_summaryThemedMany')}`
                      : groupBy === 'workgroup'
                        ? `${constellationOeuvres.length} ${constellationOeuvres.length === 1 ? t('const_work_unit') : t('const_work_unit_plural')}${selectedGroupId !== null ? ` · ${groups.find(g => g.id === selectedGroupId)?.name ?? ''}` : ''}`
                        : `${oeuvres.length} ${t('const_work_unit_plural')}`}
                  </div>
                </div>
              )}

              {/* Selection + save */}
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                {selection.size > 0 ? (
                  <>
                    <div className="t-eyebrow" style={{ marginBottom: 10 }}>{t('const_selectionLabel')} · {selection.size}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                      {[...selection].slice(0, 15).map(id => {
                        const o = oeuvresById.get(id)
                        return o ? (
                          <div key={id}
                            title={`${o.Titre ?? '—'} ${t('const_clickRemoveThumbTitle')}`}
                            onClick={() => { const n = new Set(selRef.current); n.delete(id); setSelection(n) }}
                            style={{ width: 44, height: 33, background: 'var(--bg0)', border: '1px solid var(--bd)', overflow: 'hidden', cursor: 'pointer', flexShrink: 0 }}
                          >
                            {o.txtImageNameLink && (
                              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <WorkThumb file={o.txtImageNameLink} size={96} alt="" />
                              </div>
                            )}
                          </div>
                        ) : null
                      })}
                      {selection.size > 15 && <div className="t-mono-sm" style={{ color: 'var(--tx3)', alignSelf: 'center' }}>+{selection.size - 15}</div>}
                    </div>

                    {savedName ? (
                      <div className="t-mono-sm" style={{ color: 'var(--sage)', marginBottom: 8 }}>✓ {savedName}</div>
                    ) : (
                      <div className="row gap-sm" style={{ marginBottom: 8 }}>
                        <input
                          value={groupName}
                          onChange={e => setGroupName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveGroup()}
                          placeholder={t('const_groupNamePlaceholderEllipsis')}
                          style={{ flex: 1, minWidth: 0, padding: '4px 8px', background: 'var(--bg0)', border: '1px solid var(--bd)', fontSize: 10, color: 'var(--tx)' }}
                        />
                        <button className="btn sm" onClick={handleSaveGroup} disabled={saving}>
                          {saving ? '…' : '+'}
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn ghost sm" style={{ flex: 1 }} onClick={() => setSelection(new Set())}>{t('clearSel')}</button>
                      {groupBy === 'custom' && posRef.current.size > 0 && (
                        <button className="btn ghost sm" style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={handleSaveAllAsGroup}>{t('const_saveAllShort')}</button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 1.7 }}>
                    {t('const_shiftMarqueeHint')}
                  </div>
                )}

                {/* Saved constellation maps */}
                {snapshots.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('const_savedMapsTitle')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {snapshots.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            className="btn ghost sm"
                            onClick={() => handleLoadSnapshot(s.id)}
                            style={{ flex: 1, justifyContent: 'flex-start', fontSize: 9, textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                            title={`${s.name} · ${s.groupBy} · ${new Date(s.savedAt).toLocaleDateString(locale)}`}
                          >
                            {s.name}
                          </button>
                          <button
                            className="btn ghost sm"
                            onClick={() => handleDeleteSnapshot(s.id)}
                            style={{ fontSize: 9, padding: '2px 5px', color: 'var(--tx3)', flexShrink: 0 }}
                            title={t('const_deleteMapTitle')}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {cloudMaps.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div className="t-eyebrow" style={{ marginBottom: 8 }}>{t('const_cloudMapsSidebarTitle')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {cloudMaps.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="btn ghost sm"
                            disabled={cloudBusy}
                            onClick={() => void handleLoadCloudMap(m.id)}
                            style={{ flex: 1, justifyContent: 'flex-start', fontSize: 9, textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                            title={new Date(m.updated_at).toLocaleString(locale)}
                          >
                            {m.title}
                          </button>
                          <button
                            type="button"
                            className="btn ghost sm"
                            disabled={cloudBusy}
                            onClick={() => void handleDeleteCloudMap(m.id)}
                            style={{ fontSize: 9, padding: '2px 5px', color: 'var(--tx3)', flexShrink: 0 }}
                            title={t('const_deleteMapTitle')}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
  )
}
