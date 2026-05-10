import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { thumbUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'
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
  onOpen:              (o: Oeuvre) => void
  tM:                  Record<number, string>
}

export function ThemesTab({ 
  initialThemes, initialGroups, themeWorkCount, groupWorkCount,
  themePrivateWorks = {}, groupPrivateWorks = {},
  themeToGroups = {}, groupToThemes = {},
  oeuvres, onOpen, tM
}: Props) {
  const sb = createClient()
  const { t } = useI18n()

  const [themes,     setThemes]     = useState<Theme[]>(initialThemes)
  const [groups,     setGroups]     = useState<Group[]>(initialGroups)
  const [newTheme,   setNewTheme]   = useState('')
  const [newGroup,   setNewGroup]   = useState('')
  const [editTheme,  setEditTheme]  = useState<number | null>(null)
  const [editGroup,  setEditGroup]  = useState<string | null>(null)
  const [editVal,    setEditVal]    = useState('')
  const [busy,       setBusy]       = useState(false)
  const [msg,        setMsg]        = useState<string | null>(null)

  // Interaction State
  const [hoverTheme, setHoverTheme] = useState<number | null>(null)
  const [hoverGroup, setHoverGroup] = useState<string | null>(null)

  const oeuvreById = useMemo(() => new Map(oeuvres.map((o) => [o.OeuvreID, o])), [oeuvres])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 2500) }

  // ── THEMES ──
  async function addTheme() {
    const name = newTheme.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await (sb.from('theme') as any).insert({ name }).select('id, name').single()
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
    const { error } = await (sb.from('theme') as any).update({ name }).eq('id', id)
    if (!error) { 
      setThemes(t_ => t_.map(x => x.id === id ? { ...x, name } : x))
      setEditTheme(null)
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function deleteTheme(id: number) {
    if (!confirm(t('delete') + '?')) return
    setBusy(true)
    await (sb.from('oeuvre_theme') as any).delete().eq('theme_id', id)
    const { error } = await (sb.from('theme') as any).delete().eq('id', id)
    if (!error) { 
      setThemes(t_ => t_.filter(x => x.id !== id))
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  // ── GROUPS ──
  async function addGroup() {
    const name = newGroup.trim()
    if (!name) return
    setBusy(true)
    const { data, error } = await (sb.from('working_group') as any).insert({ name }).select('id, name').single()
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
    const { error } = await (sb.from('working_group') as any).update({ name }).eq('id', id)
    if (!error) { 
      setGroups(g_ => g_.map(x => x.id === id ? { ...x, name } : x))
      setEditGroup(null)
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  async function deleteGroup(id: string) {
    if (!confirm(t('delete') + '?')) return
    setBusy(true)
    await (sb.from('working_group_work') as any).delete().eq('group_id', id)
    const { error } = await (sb.from('working_group') as any).delete().eq('id', id)
    if (!error) { 
      setGroups(g_ => g_.filter(x => x.id !== id))
      flash(t('batchSuccess')) 
    } else {
      flash(t('error') + ': ' + (error?.message ?? ''))
    }
    setBusy(false)
  }

  // Related IDs for highlighting
  const relatedGroups = hoverTheme ? (themeToGroups[hoverTheme] || []) : []
  const relatedThemes = hoverGroup ? (groupToThemes[hoverGroup] || []) : []

  const allWorksInCategory = useMemo(() => {
    const ids = hoverTheme
      ? (themePrivateWorks[hoverTheme] ?? [])
      : hoverGroup
        ? (groupPrivateWorks[hoverGroup!] ?? [])
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
  }, [hoverTheme, hoverGroup, themePrivateWorks, groupPrivateWorks, oeuvreById])

  const previewWorks = allWorksInCategory

  return (
    <div style={{ padding: '40px', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg0)' }}>
      {msg && <div className="flash-msg">{msg.toUpperCase()}</div>}

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '280px 1fr 300px', 
        gap: '40px', 
        width: '100%', 
        flex: 1,
        minHeight: 0,
        alignItems: 'start'
      }}>

        {/* ── LEFT: THEMES ── */}
        <section style={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', paddingRight: 10 }}>
          <header style={{ marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid var(--bd)' }}>
            <h2 className="serif" style={{ fontSize: 28, margin: 0, color: 'var(--tx)' }}>{t('themesSection')}</h2>
            <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 2, marginTop: 8 }}>{themes.length} COLLECTIONS</div>
          </header>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {themes.map(t_ => {
              const isRel = relatedThemes.includes(t_.id)
              const isHov = hoverTheme === t_.id
              return (
                <div key={t_.id} 
                  className={`row-item ${isHov ? 'hov' : ''} ${isRel ? 'rel' : ''}`}
                  onMouseEnter={() => { setHoverTheme(t_.id); setHoverGroup(null) }} 
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderRadius: 4, transition: 'all 0.2s',
                    background: isHov ? 'var(--bg1)' : isRel ? 'rgba(var(--ac-rgb), 0.05)' : 'transparent',
                    borderLeft: isRel ? '2px solid var(--ac)' : '2px solid transparent',
                    cursor: 'default'
                  }}
                >
                  {editTheme === t_.id ? (
                    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                      <input autoFocus value={editVal} onChange={e => setEditVal(cap(e.target.value))} style={{ flex: 1, fontSize: 13, background: 'var(--bg2)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '4px 8px' }} onKeyDown={e => e.key === 'Enter' && saveTheme(t_.id)} />
                      <button className="btn sm primary" onClick={() => saveTheme(t_.id)}>OK</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 14, fontWeight: isHov ? 600 : 400, color: isHov ? 'var(--tx)' : 'var(--tx2)' }}>{t_.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="t-mono-sm" style={{ fontSize: 11, opacity: 0.4 }}>{themeWorkCount[t_.id] ?? 0}</span>
                        <div className="item-actions" style={{ display: 'flex', gap: 4, opacity: isHov ? 1 : 0 }}>
                          <button onClick={() => { setEditTheme(t_.id); setEditVal(t_.name) }} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: 4 }}>✎</button>
                          <button onClick={() => deleteTheme(t_.id)} style={{ background: 'none', border: 'none', color: 'var(--rust)', cursor: 'pointer', padding: 4 }}>✕</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 32, padding: 20, background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 4 }}>
            <input 
              placeholder={t('newTheme')} 
              value={newTheme} 
              onChange={e => setNewTheme(cap(e.target.value))} 
              onKeyDown={e => e.key === 'Enter' && addTheme()} 
              style={{ width: '100%', marginBottom: 12, fontSize: 13, background: 'var(--bg0)', border: '1px solid var(--bd)', padding: '10px 14px', color: 'var(--tx)' }} 
            />
            <button className="btn primary block sm" onClick={addTheme} disabled={busy || !newTheme.trim()} style={{ width: '100%', fontSize: 10, letterSpacing: 1.5 }}>
              + {t('create').toUpperCase()}
            </button>
          </div>
        </section>

        {/* ── CENTER: MOSAIC PREVIEW ── */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 32, 
          width: '100%', 
          minHeight: 0,
          maxHeight: 'calc(100vh - 160px)' 
        }}>
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            background: 'var(--bg1)', 
            border: '1px solid var(--bd)', 
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}>
            {previewWorks.length > 0 ? (
              <div className="mosaic-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${
                    previewWorks.length <= 1 ? 1
                    : previewWorks.length <= 4 ? 2
                    : previewWorks.length <= 9 ? 3
                    : previewWorks.length <= 16 ? 4
                    : previewWorks.length <= 25 ? 5
                    : previewWorks.length <= 36 ? 6
                    : previewWorks.length <= 49 ? 7
                    : previewWorks.length <= 64 ? 8
                    : previewWorks.length <= 100 ? 10
                    : 12
                  }, 1fr)`,
                  gap: previewWorks.length <= 4 ? 20 : previewWorks.length <= 16 ? 12 : 6,
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
                      <img src={thumbUrl(w.txtImageNameLink)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ 
                        position: 'absolute', top: 8, right: 8, 
                        width: 8, height: 8, borderRadius: '50%',
                        background: w.isPublic ? 'var(--green)' : 'var(--rust)',
                        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.2)'
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', gap: 16 }}>
                <div style={{ fontSize: 32, opacity: 0.2 }}>✧</div>
                <div style={{ fontSize: 11, letterSpacing: 4, fontWeight: 500 }}>{t('clickToSelect').toUpperCase()}</div>
              </div>
            )}
            
            {allWorksInCategory.length > 0 && (
              <div style={{ 
                padding: '16px 24px', 
                borderTop: '1px solid var(--bd)', 
                background: 'var(--bg2)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center'
              }}>
                <div className="t-mono-sm" style={{ fontSize: 10, letterSpacing: 1, color: 'var(--tx)' }}>
                  {hoverTheme ? themes.find(t => t.id === hoverTheme)?.name : hoverGroup ? groups.find(g => g.id === hoverGroup)?.name : ''}
                </div>
                <div className="t-mono-sm" style={{ fontSize: 10, letterSpacing: 1.5, fontWeight: 700, color: 'var(--ac)' }}>
                  {allWorksInCategory.length} WORKS DISPLAYED
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: GROUPS & ANALYTICS ── */}
        <aside style={{ position: 'sticky', top: 0, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* GROUPS */}
          <section>
            <header style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--bd)' }}>
              <h2 className="serif" style={{ fontSize: 22, margin: 0, color: 'var(--tx)' }}>{t('workingGroups')}</h2>
              <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 2, marginTop: 8 }}>{groups.length} ACTIVE GROUPS</div>
            </header>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {groups.map(g_ => {
                const isRel = relatedGroups.includes(g_.id)
                const isHov = hoverGroup === g_.id
                return (
                  <div key={g_.id} 
                    className={`row-item ${isHov ? 'hov' : ''} ${isRel ? 'rel' : ''}`}
                    onMouseEnter={() => { setHoverGroup(g_.id); setHoverTheme(null) }} 
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 4, transition: 'all 0.2s',
                      background: isHov ? 'var(--bg1)' : isRel ? 'rgba(var(--ac-rgb), 0.05)' : 'transparent',
                      borderLeft: isRel ? '2px solid var(--ac)' : '2px solid transparent',
                      cursor: 'default'
                    }}
                  >
                    {editGroup === g_.id ? (
                      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                        <input autoFocus value={editVal} onChange={e => setEditVal(cap(e.target.value))} style={{ flex: 1, fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--bd)', color: 'var(--tx)', padding: '4px 8px' }} onKeyDown={e => e.key === 'Enter' && saveGroup(g_.id)} />
                        <button className="btn sm primary" onClick={() => saveGroup(g_.id)}>OK</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontSize: 13, fontWeight: isHov ? 600 : 400, color: isHov ? 'var(--tx)' : 'var(--tx2)' }}>{g_.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="t-mono-sm" style={{ fontSize: 10, opacity: 0.4 }}>{groupWorkCount[g_.id] ?? 0}</span>
                          <div className="item-actions" style={{ display: 'flex', gap: 4, opacity: isHov ? 1 : 0 }}>
                            <button onClick={() => { setEditGroup(g_.id); setEditVal(g_.name) }} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer', padding: 4 }}>✎</button>
                            <button onClick={() => deleteGroup(g_.id)} style={{ background: 'none', border: 'none', color: 'var(--rust)', cursor: 'pointer', padding: 4 }}>✕</button>
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
                const tvaRate = (full as any).tva_rate || 0
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
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', padding: 24, borderRadius: 8 }}>
                <header style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--bd)' }}>
                  <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', letterSpacing: 2, marginBottom: 8 }}>DATA INSIGHTS</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)', textTransform: 'uppercase' }}>
                    {hoverTheme ? themes.find(t => t.id === hoverTheme)?.name : groups.find(g => g.id === hoverGroup)?.name}
                  </div>
                </header>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
        .flash-msg { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); background: var(--ac); color: #000; padding: 12px 28px; font-size: 11px; z-index: 999; font-weight: 700; letter-spacing: 2px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border-radius: 4px; }
        .row-item:hover .item-actions { opacity: 1 !important; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        section::-webkit-scrollbar, aside::-webkit-scrollbar, .mosaic-scroll::-webkit-scrollbar { width: 4px; }
        section::-webkit-scrollbar-thumb, aside::-webkit-scrollbar-thumb, .mosaic-scroll::-webkit-scrollbar-thumb { background: var(--bd); border-radius: 10px; }
      `}</style>
    </div>
  )
}

function cap(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
