'use client'

import { useState, useMemo, useEffect, type MouseEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { Oeuvre } from '@/lib/types/database'

interface Theme  { id: number; name: string }
interface Group  { id: string; name: string }

interface Props {
  initialThemes: Theme[]
  initialGroups: Group[]
  themeWorkCount: Record<number, number>
  groupWorkCount:  Record<string, number>
  themePrivateWorks?: Record<number, number[]>
  groupPrivateWorks?: Record<string, number[]>
  themeToGroups?:      Record<number, string[]>
  groupToThemes?:      Record<string, number[]>
  oeuvres:             Oeuvre[]
  /** When set and greater than `oeuvres.length`, show partial-catalogue note. */
  oeuvresCatalogueTotal?: number
  onOpen:              (o: Oeuvre) => void
  tM:                  Record<number, string>
}

export function Themes({ 
  initialThemes, initialGroups, themeWorkCount, groupWorkCount,
  themePrivateWorks = {}, groupPrivateWorks = {},
  themeToGroups = {}, groupToThemes = {},
  oeuvres, oeuvresCatalogueTotal, onOpen, tM
}: Props) {
  const sb = createClient()
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')

  const [themes,     setThemes]     = useState<Theme[]>(initialThemes)
  const [groups,     setGroups]     = useState<Group[]>(initialGroups)
  const [newTheme,   setNewTheme]   = useState('')
  const [newGroup,   setNewGroup]   = useState('')
  const [editTheme,  setEditTheme]  = useState<number | null>(null)
  const [editGroup,  setEditGroup]  = useState<string | null>(null)
  const [editVal,    setEditVal]    = useState('')
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState<string | null>(null)
  const [localThemePrivateWorks, setLocalThemePrivateWorks] = useState(themePrivateWorks)
  const [localThemeWorkCount, setLocalThemeWorkCount] = useState(themeWorkCount)
  const [localGroupPrivateWorks, setLocalGroupPrivateWorks] = useState(groupPrivateWorks)
  const [localGroupWorkCount, setLocalGroupWorkCount] = useState(groupWorkCount)

  // Interaction State
  const [hoverTheme, setHoverTheme] = useState<number | null>(null)
  const [hoverGroup, setHoverGroup] = useState<string | null>(null)

  const oeuvreById = useMemo(() => new Map(oeuvres.map((o) => [o.OeuvreID, o])), [oeuvres])

  const initialThemesSig = useMemo(
    () => initialThemes.map((t) => `${t.id}\u0001${t.name}`).join('\u0002'),
    [initialThemes],
  )
  const initialGroupsSig = useMemo(
    () => initialGroups.map((g) => `${g.id}\u0001${g.name}`).join('\u0002'),
    [initialGroups],
  )

  useEffect(() => {
    setThemes((prev) => mergeThemeLists(prev, initialThemes))
  }, [initialThemesSig, initialThemes])

  useEffect(() => {
    setGroups((prev) => mergeGroupLists(prev, initialGroups))
  }, [initialGroupsSig, initialGroups])

  useEffect(() => {
    setLocalThemePrivateWorks(themePrivateWorks)
  }, [themePrivateWorks])

  useEffect(() => {
    setLocalThemeWorkCount(themeWorkCount)
  }, [themeWorkCount])

  useEffect(() => {
    setLocalGroupPrivateWorks(groupPrivateWorks)
  }, [groupPrivateWorks])

  useEffect(() => {
    setLocalGroupWorkCount(groupWorkCount)
  }, [groupWorkCount])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 2500) }

  async function unlinkWorkFromTheme(oeuvreId: number, themeId: number) {
    const themeName = themes.find((x) => x.id === themeId)?.name ?? ''
    const msg = t('themes_unlink_work_confirm_fmt').replace('{theme}', themeName)
    if (!confirm(msg)) return
    setBusy(true)
    const { error } = await sb
      .from('oeuvre_theme')
      .delete()
      .eq('oeuvre_id', oeuvreId)
      .eq('theme_id', themeId)
    if (!error) {
      setLocalThemePrivateWorks((prev) => {
        const next = { ...prev }
        const arr = (next[themeId] ?? []).filter((id) => id !== oeuvreId)
        if (arr.length) next[themeId] = arr
        else delete next[themeId]
        return next
      })
      setLocalThemeWorkCount((prev) => {
        const next = { ...prev }
        const n = (next[themeId] ?? 0) - 1
        if (n <= 0) delete next[themeId]
        else next[themeId] = n
        return next
      })
      flash(t('batchSuccess'))
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function unlinkWorkFromGroup(oeuvreId: number, groupId: string) {
    const groupName = groups.find((x) => x.id === groupId)?.name ?? ''
    const msg = t('themes_unlink_work_from_group_confirm_fmt').replace('{group}', groupName)
    if (!confirm(msg)) return
    setBusy(true)
    const { error } = await sb
      .from('working_group_work')
      .delete()
      .eq('oeuvre_id', oeuvreId)
      .eq('group_id', groupId)
    if (!error) {
      setLocalGroupPrivateWorks((prev) => {
        const next = { ...prev }
        const arr = (next[groupId] ?? []).filter((id) => id !== oeuvreId)
        if (arr.length) next[groupId] = arr
        else delete next[groupId]
        return next
      })
      setLocalGroupWorkCount((prev) => {
        const next = { ...prev }
        const n = (next[groupId] ?? 0) - 1
        if (n <= 0) delete next[groupId]
        else next[groupId] = n
        return next
      })
      flash(t('batchSuccess'))
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  // ── THEMES ──
  async function addTheme() {
    const name = newTheme.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await sb.from('theme').insert({ name }).select('id, name').single()
    if (!error && data) { 
      setThemes(t_ => [...t_, data].sort((a,b) => a.name.localeCompare(b.name)))
      setNewTheme('')
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function saveTheme(id: number) {
    const name = editVal.trim()
    if (!name) return
    setBusy(true)
    const { error } = await sb.from('theme').update({ name }).eq('id', id)
    if (!error) { 
      setThemes(t_ => t_.map(x => x.id === id ? { ...x, name } : x))
      setEditTheme(null)
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function promptRenameTheme(id: number, currentName: string) {
    const nm = window.prompt(t('themes_prompt_rename_theme'), currentName)
    if (nm === null) return
    const trimmed = nm.trim()
    if (!trimmed || trimmed === currentName) return
    if (!confirm(t('themes_rename_confirm_fmt').replace('{from}', currentName).replace('{to}', trimmed))) return
    setBusy(true)
    const { error } = await sb.from('theme').update({ name: trimmed }).eq('id', id)
    if (!error) {
      setThemes((t_) => t_.map((x) => (x.id === id ? { ...x, name: trimmed } : x)))
      flash(t('batchSuccess'))
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function runDeleteTheme(id: number) {
    setBusy(true)
    await sb.from('oeuvre_theme').delete().eq('theme_id', id)
    const { error } = await sb.from('theme').delete().eq('id', id)
    if (!error) {
      setThemes((t_) => t_.filter((x) => x.id !== id))
      setEditTheme((cur) => (cur === id ? null : cur))
      setHoverTheme((cur) => (cur === id ? null : cur))
      flash(t('batchSuccess'))
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function deleteTheme(id: number) {
    if (!confirm(t('delete') + '?')) return
    await runDeleteTheme(id)
  }

  async function confirmDeleteTheme(id: number, name: string, workCount: number) {
    const msg =
      workCount > 2
        ? t('themes_delete_catalog_many_fmt').replace('{name}', name).replace('{count}', String(workCount))
        : t('themes_delete_named_confirm_fmt').replace('{name}', name)
    if (!confirm(msg)) return
    await runDeleteTheme(id)
  }

  function onThemeRowContextMenu(t_: Theme, e: MouseEvent) {
    e.preventDefault()
    if (editTheme === t_.id) return
    if (e.ctrlKey || e.metaKey) {
      void confirmDeleteTheme(t_.id, t_.name, localThemeWorkCount[t_.id] ?? 0)
    } else {
      void promptRenameTheme(t_.id, t_.name)
    }
  }

  // ── GROUPS ──
  async function addGroup() {
    const name = newGroup.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await sb.from('working_group').insert({ name }).select('id, name').single()
    if (!error && data) { 
      setGroups(g_ => [...g_, data].sort((a,b) => a.name.localeCompare(b.name)))
      setNewGroup('')
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function saveGroup(id: string) {
    const name = editVal.trim()
    if (!name) return
    setBusy(true)
    const { error } = await sb.from('working_group').update({ name }).eq('id', id)
    if (!error) { 
      setGroups(g_ => g_.map(x => x.id === id ? { ...x, name } : x))
      setEditGroup(null)
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function promptRenameGroup(id: string, currentName: string) {
    const nm = window.prompt(t('themes_prompt_rename_group'), currentName)
    if (nm === null) return
    const trimmed = nm.trim()
    if (!trimmed || trimmed === currentName) return
    if (!confirm(t('themes_rename_confirm_fmt').replace('{from}', currentName).replace('{to}', trimmed))) return
    setBusy(true)
    const { error } = await sb.from('working_group').update({ name: trimmed }).eq('id', id)
    if (!error) {
      setGroups((g_) => g_.map((x) => (x.id === id ? { ...x, name: trimmed } : x)))
      flash(t('batchSuccess'))
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function runDeleteGroup(id: string) {
    setBusy(true)
    await sb.from('working_group_work').delete().eq('group_id', id)
    const { error } = await sb.from('working_group').delete().eq('id', id)
    if (!error) {
      setGroups((g_) => g_.filter((x) => x.id !== id))
      setEditGroup((cur) => (cur === id ? null : cur))
      setHoverGroup((cur) => (cur === id ? null : cur))
      flash(t('batchSuccess'))
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function deleteGroup(id: string) {
    if (!confirm(t('delete') + '?')) return
    await runDeleteGroup(id)
  }

  async function confirmDeleteGroup(id: string, name: string, workCount: number) {
    const msg =
      workCount > 2
        ? t('themes_delete_group_many_fmt').replace('{name}', name).replace('{count}', String(workCount))
        : t('themes_delete_named_confirm_fmt').replace('{name}', name)
    if (!confirm(msg)) return
    await runDeleteGroup(id)
  }

  function onGroupRowContextMenu(g_: Group, e: MouseEvent) {
    e.preventDefault()
    if (editGroup === g_.id) return
    if (e.ctrlKey || e.metaKey) {
      void confirmDeleteGroup(g_.id, g_.name, localGroupWorkCount[g_.id] ?? 0)
    } else {
      void promptRenameGroup(g_.id, g_.name)
    }
  }

  // Related IDs for highlighting
  const relatedGroups = hoverTheme ? (themeToGroups[hoverTheme] || []) : []
  const relatedThemes = hoverGroup ? (groupToThemes[hoverGroup] || []) : []

  const allWorksInCategory = useMemo(() => {
    const ids = hoverTheme
      ? (localThemePrivateWorks[hoverTheme] ?? [])
      : hoverGroup
        ? (localGroupPrivateWorks[hoverGroup!] ?? [])
        : []
    return ids
      .map((id) => {
        const o = oeuvreById.get(id)
        if (!o) return null
        return {
          OeuvreID: o.OeuvreID,
          txtImageNameLink: o.txtImageNameLink ?? null,
          isPublic: !!(o as { is_public?: boolean }).is_public,
        }
      })
      .filter(Boolean) as { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }[]
  }, [hoverTheme, hoverGroup, localThemePrivateWorks, localGroupPrivateWorks, oeuvreById])

  const previewWorks = allWorksInCategory

  const mosaicColCount = useMemo(() => {
    const n = previewWorks.length
    let c = 1
    if (n > 1) c = 2
    if (n > 4) c = 3
    if (n > 9) c = 4
    if (n > 16) c = 5
    if (n > 25) c = 6
    if (n > 36) c = 7
    if (n > 49) c = 8
    if (n > 64) c = 10
    if (n > 100) c = 12
    return narrow ? Math.min(c, 3) : c
  }, [previewWorks.length, narrow])

  const padX = narrow
    ? 'max(12px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-right))'
    : '40px'
  const padY = narrow ? 'max(12px, env(safe-area-inset-top))' : '40px'

  return (
    <div
      style={{
        padding: `${padY} ${padX}`,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--bg0)',
        overflowX: 'hidden',
      }}
    >
      {msg && <div className="flash-msg">{msg.toUpperCase()}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '280px 1fr 300px',
          gap: narrow ? 20 : 40,
          width: '100%',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          alignItems: 'start',
        }}
      >

        {/* ── LEFT: THEMES ── */}
        <section
          style={{
            position: narrow ? 'static' : 'sticky',
            top: 0,
            maxHeight: narrow ? 'none' : 'calc(100vh - 160px)',
            overflowY: narrow ? 'visible' : 'auto',
            paddingRight: narrow ? 0 : 10,
            width: '100%',
            minWidth: 0,
          }}
        >
          <header style={{ marginBottom: narrow ? 16 : 32, paddingBottom: 16, borderBottom: '1px solid var(--bd)' }}>
            <h2 className="serif" style={{ fontSize: narrow ? 22 : 28, margin: 0, color: 'var(--tx)' }}>{t('themesSection')}</h2>
            <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 2, marginTop: 8 }}>
              {t('themes_collections_count_fmt').replace('{count}', String(themes.length)).toUpperCase()}
            </div>
          </header>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {themes.map(t_ => {
              const isRel = relatedThemes.includes(t_.id)
              const isHov = hoverTheme === t_.id
              return (
                <div key={t_.id} 
                  className={`row-item ${isHov ? 'hov' : ''} ${isRel ? 'rel' : ''}`}
                  onMouseEnter={() => { setHoverTheme(t_.id); setHoverGroup(null) }} 
                  onClick={() => {
                    if (!narrow || editTheme === t_.id) return
                    setHoverTheme(t_.id)
                    setHoverGroup(null)
                  }}
                  onContextMenu={(e) => onThemeRowContextMenu(t_, e)}
                  title={t('themes_row_context_menu_title')}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    minHeight: narrow ? 44 : undefined,
                    padding: narrow ? '10px 12px' : '12px 16px', borderRadius: 4, transition: 'all 0.2s',
                    background: isHov ? 'var(--bg1)' : isRel ? 'rgba(var(--ac-rgb), 0.05)' : 'transparent',
                    borderLeft: isRel ? '2px solid var(--ac)' : '2px solid transparent',
                    cursor: 'default'
                  }}
                >
                  {editTheme === t_.id ? (
                    <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
                      <input autoFocus value={editVal} onChange={e => setEditVal(cap(e.target.value))} style={{ flex: 1, minWidth: 0, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '4px 8px' }} onKeyDown={e => e.key === 'Enter' && saveTheme(t_.id)} />
                      <button type="button" className="btn sm primary" style={{ minHeight: 44, flexShrink: 0 }} onClick={() => saveTheme(t_.id)}>OK</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 14, fontWeight: isHov ? 600 : 400, color: isHov ? 'var(--tx)' : 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, paddingRight: 8 }}>{t_.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <span className="t-mono-sm" style={{ fontSize: 11, opacity: 0.4 }}>{localThemeWorkCount[t_.id] ?? 0}</span>
                        <div className="item-actions" style={{ display: 'flex', gap: 4, opacity: narrow || isHov ? 1 : 0 }}>
                          <button type="button" aria-label={t('edit')} onClick={(e) => { e.stopPropagation(); setEditTheme(t_.id); setEditVal(t_.name) }} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: 0 }}>✎</button>
                          <button type="button" aria-label={t('delete')} onClick={(e) => { e.stopPropagation(); deleteTheme(t_.id) }} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--rust)', cursor: 'pointer', padding: 0 }}>✕</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: narrow ? 20 : 32, padding: narrow ? 14 : 20, background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 4 }}>
            <input 
              placeholder={t('newTheme')} 
              value={newTheme} 
              onChange={e => setNewTheme(cap(e.target.value))} 
              onKeyDown={e => e.key === 'Enter' && addTheme()} 
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12, fontSize: 13, background: 'var(--bg0)', border: '1px solid var(--bd)', padding: '10px 14px', color: 'var(--tx)' }} 
            />
            <button type="button" className="btn primary block sm" onClick={addTheme} disabled={busy || !newTheme.trim()} style={{ width: '100%', minHeight: 44, fontSize: 10, letterSpacing: 1.5 }}>
              + {t('create').toUpperCase()}
            </button>
          </div>
        </section>

        {/* ── CENTER: MOSAIC PREVIEW ── */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: narrow ? 16 : 32, 
          width: '100%', 
          minHeight: 0,
          minWidth: 0,
          maxHeight: narrow ? 'min(55vh, 520px)' : 'calc(100vh - 160px)',
        }}>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            minWidth: 0,
            background: 'var(--bg1)', 
            border: '1px solid var(--bd)', 
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}>
            {previewWorks.length > 0 ? (
              <div className="mosaic-scroll" style={{ flex: 1, overflowY: 'auto', padding: narrow ? 12 : 24 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${mosaicColCount}, minmax(0, 1fr))`,
                  gap: previewWorks.length <= 4 ? (narrow ? 10 : 20) : previewWorks.length <= 16 ? 12 : 6,
                  width: '100%',
                  alignContent: 'start'
                }}>
                  {previewWorks.map((w, idx) => (
                    <div key={w.OeuvreID} className="mosaic-card" 
                      style={{ 
                        aspectRatio: '1', position: 'relative', cursor: 'pointer',
                        animation: 'fadeInUp 0.5s ease forwards',
                        animationDelay: `${idx * 15}ms`,
                        opacity: 0,
                        borderRadius: 4,
                        overflow: 'hidden'
                      }} 
                      onClick={() => {
                        const fullWork = oeuvreById.get(w.OeuvreID)
                        if (fullWork) onOpen(fullWork)
                      }}
                    >
                      <img src={thumbUrl(w.txtImageNameLink) ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {(hoverTheme != null || hoverGroup != null) && (() => {
                        const unlinkAria =
                          hoverTheme != null
                            ? t('themes_unlink_work_aria')
                            : t('themes_unlink_work_from_group_aria')
                        return (
                          <>
                            <button
                              type="button"
                              className="mosaic-unlink-btn"
                              title={unlinkAria}
                              aria-label={unlinkAria}
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (hoverTheme != null) {
                                  void unlinkWorkFromTheme(w.OeuvreID, hoverTheme)
                                } else if (hoverGroup != null) {
                                  void unlinkWorkFromGroup(w.OeuvreID, hoverGroup)
                                }
                              }}
                            >
                              <span className="mosaic-unlink-icon" aria-hidden>
                                ✕
                              </span>
                            </button>
                            <span className="mosaic-unlink-hint t-mono-sm">{unlinkAria}</span>
                          </>
                        )
                      })()}
                      <div
                        className="mosaic-pub-dot"
                        style={{
                          background: w.isPublic ? 'var(--green)' : 'var(--rust)',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', gap: 16 }}>
                <div style={{ fontSize: 32, opacity: 0.2 }}>✧</div>
                <div className="t-mono-sm" style={{ fontSize: 11, letterSpacing: 4, fontWeight: 500 }}>{t('themes_mosaic_hover_hint').toUpperCase()}</div>
              </div>
            )}
            
            {allWorksInCategory.length > 0 && (
              <div style={{ 
                padding: narrow ? '12px 14px' : '16px 24px', 
                borderTop: '1px solid var(--bd)', 
                background: 'var(--bg2)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                gap: 10,
                flexWrap: narrow ? 'wrap' : 'nowrap',
              }}>
                <div className="t-mono-sm" style={{ fontSize: 10, letterSpacing: 1, color: 'var(--tx)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {hoverTheme ? themes.find(t => t.id === hoverTheme)?.name : hoverGroup ? groups.find(g => g.id === hoverGroup)?.name : ''}
                </div>
                <div className="t-mono-sm" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 700, color: 'var(--ac)', flexShrink: 0 }}>
                  {t('themes_works_displayed_fmt').replace('{count}', String(allWorksInCategory.length)).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: GROUPS & ANALYTICS ── */}
        <aside
          style={{
            position: narrow ? 'static' : 'sticky',
            top: 0,
            maxHeight: narrow ? 'none' : 'calc(100vh - 160px)',
            overflowY: narrow ? 'visible' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: narrow ? 20 : 32,
            width: '100%',
            minWidth: 0,
          }}
        >
          
          {/* GROUPS */}
          <section>
            <header style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--bd)' }}>
              <h2 className="serif" style={{ fontSize: narrow ? 20 : 22, margin: 0, color: 'var(--tx)' }}>{t('workingGroups')}</h2>
              <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 2, marginTop: 8 }}>
                {t('themes_active_groups_count_fmt').replace('{count}', String(groups.length)).toUpperCase()}
              </div>
            </header>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {groups.map(g_ => {
                const isRel = relatedGroups.includes(g_.id)
                const isHov = hoverGroup === g_.id
                return (
                  <div key={g_.id} 
                    className={`row-item ${isHov ? 'hov' : ''} ${isRel ? 'rel' : ''}`}
                    onMouseEnter={() => { setHoverGroup(g_.id); setHoverTheme(null) }} 
                    onClick={() => {
                      if (!narrow || editGroup === g_.id) return
                      setHoverGroup(g_.id)
                      setHoverTheme(null)
                    }}
                    onContextMenu={(e) => onGroupRowContextMenu(g_, e)}
                    title={t('themes_row_context_menu_title')}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      minHeight: narrow ? 44 : undefined,
                      padding: narrow ? '10px 12px' : '10px 14px', borderRadius: 4, transition: 'all 0.2s',
                      background: isHov ? 'var(--bg1)' : isRel ? 'rgba(var(--ac-rgb), 0.05)' : 'transparent',
                      borderLeft: isRel ? '2px solid var(--ac)' : '2px solid transparent',
                      cursor: 'default'
                    }}
                  >
                    {editGroup === g_.id ? (
                      <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
                        <input autoFocus value={editVal} onChange={e => setEditVal(cap(e.target.value))} style={{ flex: 1, minWidth: 0, fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '4px 8px' }} onKeyDown={e => e.key === 'Enter' && saveGroup(g_.id)} />
                        <button type="button" className="btn sm primary" style={{ minHeight: 44, flexShrink: 0 }} onClick={() => saveGroup(g_.id)}>OK</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontSize: 13, fontWeight: isHov ? 600 : 400, color: isHov ? 'var(--tx)' : 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, paddingRight: 8 }}>{g_.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span className="t-mono-sm" style={{ fontSize: 10, opacity: 0.4 }}>{localGroupWorkCount[g_.id] ?? 0}</span>
                          <div className="item-actions" style={{ display: 'flex', gap: 4, opacity: narrow || isHov ? 1 : 0 }}>
                            <button type="button" aria-label={t('edit')} onClick={(e) => { e.stopPropagation(); setEditGroup(g_.id); setEditVal(g_.name) }} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: 0 }}>✎</button>
                            <button type="button" aria-label={t('delete')} onClick={(e) => { e.stopPropagation(); deleteGroup(g_.id) }} style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--rust)', cursor: 'pointer', padding: 0 }}>✕</button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ANALYTICS */}
          {(hoverTheme || hoverGroup) && (() => {
            const techMap: Record<string, { total: number, pub: number }> = {}
            let totalHT = 0
            let totalTTC = 0

            allWorksInCategory.forEach(w => {
              const full = oeuvreById.get(w.OeuvreID)
              if (full) {
                const prixHT = (full.Prix || 0)
                const tvaRate = full.tva_rate || 0
                const prixTTC = prixHT * (1 + tvaRate / 100)
                
                totalHT += prixHT
                totalTTC += prixTTC
                
                const techId = full.Technique
                const techName = (techId != null && tM[techId]) || 'UNKNOWN'
                if (!techMap[techName]) techMap[techName] = { total: 0, pub: 0 }
                techMap[techName].total++
                if (w.isPublic) techMap[techName].pub++
              }
            })

            return (
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', padding: narrow ? 16 : 24, borderRadius: 8, maxWidth: '100%', boxSizing: 'border-box' }}>
                <header style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>
                  <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 2, marginBottom: 8 }}>DATA INSIGHTS</div>
                  <div style={{ fontSize: narrow ? 13 : 15, fontWeight: 700, color: 'var(--tx)', textTransform: 'uppercase', wordBreak: 'break-word' }}>
                    {hoverTheme ? themes.find(t => t.id === hoverTheme)?.name : groups.find(g => g.id === hoverGroup)?.name}
                  </div>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '1fr 1fr', gap: 12 }}>
                    <div>
                      <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 4 }}>VALEUR (HT)</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>€{Math.round(totalHT / 1000)}k</div>
                    </div>
                    <div>
                      <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 4 }}>VALEUR (TTC)</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ac)' }}>€{Math.round(totalTTC / 1000)}k</div>
                    </div>
                  </div>

                  <div>
                    <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 12 }}>TECHNIQUE SPREAD</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(techMap).sort((a,b) => b[1].total - a[1].total).slice(0, 5).map(([name, s]) => (
                        <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx2)' }}>{name.toUpperCase()}</span>
                          <span className="t-mono-sm" style={{ fontSize: 9, fontWeight: 700 }}>{s.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </aside>

      </div>

      <style jsx>{`
        .flash-msg { position: fixed; bottom: max(32px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); max-width: calc(100vw - 24px); box-sizing: border-box; background: var(--ac); color: #000; padding: 12px 20px; font-size: 11px; z-index: 999; font-weight: 700; letter-spacing: 2px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border-radius: 4px; text-align: center; }
        .row-item:hover .item-actions { opacity: 1 !important; }
        .mosaic-unlink-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 2px solid rgba(255, 255, 255, 0.9);
          border-radius: 6px;
          background: var(--rust);
          color: #fff;
          cursor: pointer;
          z-index: 3;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
        }
        .mosaic-unlink-btn:disabled { cursor: wait; opacity: 0.7; }
        .mosaic-unlink-btn:focus-visible {
          outline: 2px solid #fff;
          outline-offset: 2px;
        }
        .mosaic-unlink-icon {
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
        }
        .mosaic-unlink-hint {
          position: absolute;
          top: 50px;
          right: 4px;
          max-width: calc(100% - 8px);
          padding: 5px 8px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.88);
          color: #fff;
          font-size: 9px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          text-align: right;
          opacity: 0;
          pointer-events: none;
          z-index: 3;
          transition: opacity 0.15s ease;
        }
        .mosaic-card:hover .mosaic-unlink-hint,
        .mosaic-unlink-btn:focus-visible + .mosaic-unlink-hint {
          opacity: 1;
        }
        .mosaic-pub-dot {
          position: absolute;
          bottom: 8px;
          right: 8px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.2);
          z-index: 1;
          pointer-events: none;
        }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        section::-webkit-scrollbar, aside::-webkit-scrollbar, .mosaic-scroll::-webkit-scrollbar { width: 4px; }
        section::-webkit-scrollbar-thumb, aside::-webkit-scrollbar-thumb, .mosaic-scroll::-webkit-scrollbar-thumb { background: var(--bd); border-radius: 10px; }
        @media (max-width: 767px) {
          .mosaic-unlink-hint { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function mergeThemeLists(prev: Theme[], incoming: Theme[]): Theme[] {
  if (incoming.length === 0) return prev
  const byId = new Map<number, Theme>()
  for (const item of incoming) byId.set(item.id, item)
  for (const item of prev) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  const merged = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  if (
    merged.length === prev.length &&
    merged.every((item, i) => item.id === prev[i]?.id && item.name === prev[i]?.name)
  ) {
    return prev
  }
  return merged
}

function mergeGroupLists(prev: Group[], incoming: Group[]): Group[] {
  if (incoming.length === 0) return prev
  const byId = new Map<string, Group>()
  for (const item of incoming) byId.set(item.id, item)
  for (const item of prev) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }
  const merged = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  if (
    merged.length === prev.length &&
    merged.every((item, i) => item.id === prev[i]?.id && item.name === prev[i]?.name)
  ) {
    return prev
  }
  return merged
}
