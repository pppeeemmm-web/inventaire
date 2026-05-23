'use client'

// Vault — document vault with upload, preview, search/filter, and COA generation.
// Fetches documents client-side (dynamic content, team-auth required).

import React, { useState, useEffect, useRef, useTransition, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n/context'
import { createClient } from '@/lib/supabase/client'
import {
  uploadDocument, updateDocument, deleteDocument, getSignedUrl, generateCOA,
  renameFolder, moveDocuments, createFolder, renameDocument,
  type VaultDoc,
} from '@/app/atelier/vault/actions'
import { stringifyError } from '@/lib/error'
import type { Oeuvre } from '@/lib/types/database'

// ── Constants ─────────────────────────────────────────────────────────────

const DOC_KINDS: { value: string; label: string }[] = [
  { value: 'coa',       label: 'Certificats' },
  { value: 'contrat',   label: 'Contrats' },
  { value: 'facture',   label: 'Factures' },
  { value: 'pret',      label: 'Prêts / expo' },
  { value: 'police',    label: 'Polices' },
  { value: 'brouillon', label: 'Brouillons' },
  { value: 'ecriture',  label: 'Écrits' },
  { value: 'bible',     label: 'Studio Bible' },
  { value: 'autre',     label: 'Autres' },
]

// ── Props ─────────────────────────────────────────────────────────────────

interface Props {
  oeuvres: Oeuvre[]
  tM:      Record<number, string>
}

// ── Component ─────────────────────────────────────────────────────────────

export function Vault({ oeuvres, tM }: Props) {
  const { t } = useI18n()
  const [docs,     setDocs]     = useState<VaultDoc[]>([])
  const [loading,  setLoading]  = useState(true)
  const [kindFilter, setKindFilter] = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [sortKey,  setSortKey]  = useState<string>('date')
  const [sortDir,  setSortDir]  = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<VaultDoc | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showEdit,   setShowEdit]   = useState(false)
  const [editingDoc, setEditingDoc] = useState<VaultDoc | null>(null)
  const [showCoa,    setShowCoa]    = useState(false)
  const [delPending, startDel]      = useTransition()
  const [view,        setView]        = useState<'list' | 'grid'>('list')
  const [currentPath, setCurrentPath] = useState<string[]>([]) // Navigation path: ['Parent', 'Child']
  const [draggedDoc,  setDraggedDoc]  = useState<VaultDoc | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([]) // Bulk selection
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState<string | null>(null)

  const kindColor = (k: string) => {
    switch (k) {
      case 'coa':       return { bg: 'rgba(200, 168, 110, 0.15)', tx: 'var(--ac)' }
      case 'facture':   return { bg: 'rgba(114, 184, 114, 0.15)', tx: '#72b872' }
      case 'contrat':   return { bg: 'rgba(100, 180, 200, 0.15)', tx: '#64b4c8' }
      case 'police':    return { bg: 'rgba(200, 100, 100, 0.15)', tx: '#c86464' }
      case 'brouillon': return { bg: 'rgba(200, 160, 100, 0.15)', tx: '#c8a064' }
      case 'bible':     return { bg: 'rgba(192, 96, 96, 0.15)',  tx: '#c06060' }
      default:          return { bg: 'var(--bg2)', tx: 'var(--tx3)' }
    }
  }

  // ── Fetch documents ──────────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('document').select('*').order('created_at', { ascending: false })
    setDocs((data as VaultDoc[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  const currentFolderStr = currentPath.length > 0 ? currentPath.join('/') : null

  // Recursive folder tree builder
  const folderTree = useMemo(() => {
    const tree: any = { children: {} }
    docs.forEach(d => {
      if (!d.folder) return
      const parts = d.folder.split('/')
      let curr = tree
      parts.forEach(p => {
        if (!curr.children[p]) curr.children[p] = { name: p, children: {} }
        curr = curr.children[p]
      })
    })
    return tree
  }, [docs])

  // Derived folders and documents for the current view
  const { visibleFolders, visibleDocs } = useMemo(() => {
    const folderSet = new Set<string>()
    const docsInDir: VaultDoc[] = []

    docs.forEach(d => {
      if (d.name === '.keep') return // Hide system folder markers from list
      
      const folderPath = d.folder || ''
      const searchMatch = !search || d.name.toLowerCase().includes(search.toLowerCase())
      const kindMatch = !kindFilter || d.kind === kindFilter

      if (currentFolderStr) {
        if (folderPath === currentFolderStr) {
          if (searchMatch && kindMatch) docsInDir.push(d)
        } else if (folderPath.startsWith(currentFolderStr + '/')) {
          const relative = folderPath.slice(currentFolderStr.length + 1)
          const firstPart = relative.split('/')[0]
          folderSet.add(firstPart)
        }
      } else {
        if (!folderPath) {
          if (searchMatch && kindMatch) docsInDir.push(d)
        } else {
          const firstPart = folderPath.split('/')[0]
          folderSet.add(firstPart)
        }
      }
    })

    // Also include empty folders created by the user (which have .keep files)
    docs.filter(d => d.name === '.keep' && d.folder).forEach(d => {
      const folderPath = d.folder!
      if (currentFolderStr) {
        if (folderPath.startsWith(currentFolderStr + '/')) {
          const relative = folderPath.slice(currentFolderStr.length + 1)
          folderSet.add(relative.split('/')[0])
        }
      } else {
        folderSet.add(folderPath.split('/')[0])
      }
    })

    return { 
      visibleFolders: Array.from(folderSet).sort(), 
      visibleDocs: docsInDir 
    }
  }, [docs, currentFolderStr, search, kindFilter])

  const handleDownload = async (doc: VaultDoc) => {
    if (!doc.storage_path) return
    const res = await getSignedUrl(doc.storage_path)
    if ('url' in res) {
      const a = document.createElement('a')
      a.href = res.url
      a.download = doc.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } else {
      alert(t('vault_download_err_fmt').replace('{msg}', stringifyError(res.error)))
    }
  }
  
  const handleRenameFile = async (doc: VaultDoc) => {
    const newName = prompt(t('renameFile') || 'Renommer le fichier :', doc.name)
    if (newName && newName !== doc.name) {
      startDel(async () => {
        const res = await renameDocument(doc.id, newName)
        if ('ok' in res) {
          setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, name: newName } : d))
          if (selected?.id === doc.id) setSelected({ ...selected, name: newName })
        } else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
      })
    }
  }

  // ── Preview signed URL ───────────────────────────────────────────
  useEffect(() => {
    if (!selected?.storage_path) { setPreviewUrl(null); return }
    setPreviewUrl(null)
    getSignedUrl(selected.storage_path).then((r) => {
      if ('url' in r) setPreviewUrl(r.url)
    }).catch(err => {
      console.error("Vault Preview Error:", err)
    })
  }, [selected])

  // ── Sorting & Filtering ─────────────────────────────────────────
  const toggleSort = (k: string) => {
    if (sortKey === k) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const processed = useMemo(() => {
    let list = [...visibleDocs]

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name) * dir
      }
      if (sortKey === 'kind') {
        return (a.kind || '').localeCompare(b.kind || '') * dir
      }
      if (sortKey === 'date') {
        const da = a.doc_date || a.created_at
        const db = b.doc_date || b.created_at
        return (new Date(da).getTime() - new Date(db).getTime()) * dir
      }
      if (sortKey === 'oeuvre') {
        const getTitre = (d: VaultDoc) => {
          if (d.oeuvre_ids && d.oeuvre_ids.length > 1) return `${d.oeuvre_ids.length} oeuvres`
          const work = d.oeuvre_id ? oeuvres.find(o => o.OeuvreID === d.oeuvre_id) : null
          return work?.Titre || ''
        }
        return getTitre(a).localeCompare(getTitre(b)) * dir
      }
      return 0
    })
    
    return list
  }, [visibleDocs, sortKey, sortDir, oeuvres])

  const filtered = processed // For backward compatibility in rendering if needed, but we'll use processed

  const linkedWork = selected?.oeuvre_id
    ? oeuvres.find((o) => o.OeuvreID === selected.oeuvre_id)
    : null

  return (
    <div data-testid="atelier-vault-root" style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Sidebar ── */}
      <div style={{
        width: 260,
        background: 'var(--bg0)',
        borderRight: '1px solid var(--bd)',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden'
      }}>
        <div className="t-eyebrow" style={{ padding: '24px 20px 8px', fontSize: 10, opacity: 0.5, letterSpacing: 1.5 }}>
          COFFRE
        </div>
        <button
          className={`vault-kind ${!kindFilter && currentPath.length === 0 ? 'active' : ''}`}
          onClick={() => { setKindFilter(null); setCurrentPath([]) }}
          style={{ paddingLeft: 20, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <span>📂</span> {t('overview')} ({docs.length})
        </button>

        <div className="t-eyebrow" style={{ padding: '24px 20px 8px', fontSize: 10, opacity: 0.5, letterSpacing: 1.5 }}>
          {t('ramifications').toUpperCase()}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
          <button
            className={`vault-kind ${currentPath.length === 0 && !kindFilter ? 'active' : ''}`}
            onClick={() => { setCurrentPath([]); setKindFilter(null) }}
            onDragOver={e => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault()
              if (!draggedDoc) return
              const res = await moveDocuments([draggedDoc.id], null)
              if ('ok' in res) setDocs(prev => prev.map(d => d.id === draggedDoc.id ? { ...d, folder: null } : d))
            }}
            style={{ 
              width: '100%', 
              borderRadius: 4, 
              marginBottom: 4,
              paddingLeft: 12,
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              fontWeight: currentPath.length === 0 ? 600 : 400
            }}
          >
            <span style={{ fontSize: 16 }}>🏠</span>
            <span>{t('main')}</span>
          </button>
          <FolderTree 
            tree={folderTree} 
            level={1}
            currentPath={currentPath} 
            onSelect={(path) => { setCurrentPath(path); setKindFilter(null) }} 
            onDrop={async (doc, target) => {
              const res = await moveDocuments([doc.id], target)
              if ('ok' in res) setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, folder: target } : d))
            }}
            onRename={(oldPath, newPath) => {
              startDel(async () => {
                const res = await renameFolder(oldPath, newPath)
                if ('ok' in res) fetchDocs()
                else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
              })
            }}
          />
        </div>

        <div className="t-eyebrow" style={{ padding: '24px 20px 8px', fontSize: 10, opacity: 0.5, letterSpacing: 1.5 }}>
          TYPES
        </div>
        <div style={{ paddingBottom: 20 }}>
          {DOC_KINDS.map(({ value, label }) => {
            const count = docs.filter((d) => d.kind === value).length
            return (
              <button
                key={value}
                className={`vault-kind ${kindFilter === value ? 'active' : ''}`}
                onClick={() => { setKindFilter(value); setCurrentPath([]) }}
                style={{ paddingLeft: 20, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: kindColor(value).bg }} />
                <span style={{ flex: 1 }}>{label}</span>
                <span style={{ fontSize: 10, opacity: 0.4 }}>{count || ''}</span>
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--bd)', background: 'var(--bg1)' }}>
          <button className="btn primary sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => setShowUpload(true)}>
            + {t('import')}
          </button>
          <button className="btn ghost sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => {
            const name = prompt(t('newFolder') + ' :')
            if (name) {
              const fullPath = currentFolderStr ? `${currentFolderStr}/${name}` : name
              startDel(async () => {
                const res = await createFolder(fullPath)
                if ('ok' in res) fetchDocs()
                else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
              })
              setCurrentPath([...currentPath, name])
            }
          }}>
            📁 Nouveau dossier
          </button>
          <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => setShowCoa(true)}>
            ✦ Générer COA
          </button>
        </div>
      </div>

      {/* ── Centre: document list ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Breadcrumbs & Toolbar */}
        <div style={{ 
          padding: '12px 20px', 
          borderBottom: '1px solid var(--bd)', 
          flexShrink: 0, 
          display: 'flex', 
          gap: 12, 
          alignItems: 'center',
          background: 'var(--bg1)'
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <span 
              onClick={() => setCurrentPath([])} 
              style={{ cursor: 'pointer', color: 'var(--tx3)' }}
            >Coffre</span>
            {currentPath.map((part, i) => (
              <React.Fragment key={i}>
                <span style={{ opacity: 0.3 }}>/</span>
                <span 
                  onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                  style={{ 
                    cursor: 'pointer', 
                    fontWeight: i === currentPath.length - 1 ? 500 : 400,
                    color: i === currentPath.length - 1 ? 'var(--tx)' : 'var(--tx3)'
                  }}
                >{part}</span>
              </React.Fragment>
            ))}
          </div>

          {selectedIds.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginRight: 12 }}>
              <button 
                className="btn ghost sm" 
                style={{ color: '#ff8888' }}
                onClick={() => {
                  if (!confirm(t('vault_confirm_delete_n').replace('{n}', String(selectedIds.length)))) return
                  startDel(async () => {
                    for (const id of selectedIds) {
                      const d = docs.find(x => x.id === id)
                      if (d) await deleteDocument(id, d.storage_path)
                    }
                    setDocs(prev => prev.filter(d => !selectedIds.includes(d.id)))
                    setSelectedIds([])
                  })
                }}
              >Supprimer ({selectedIds.length})</button>
              <button 
                className="btn ghost sm"
                onClick={() => {
                  const target = prompt('Dossier de destination (ex: Archive/2024, laisser vide pour racine) :', currentFolderStr || '')
                  if (target === null) return
                  startDel(async () => {
                    const res = await moveDocuments(selectedIds, target === '' ? null : target)
                    if ('ok' in res) {
                      setDocs(prev => prev.map(d => selectedIds.includes(d.id) ? { ...d, folder: target === '' ? null : target } : d))
                      setSelectedIds([])
                    } else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                  })
                }}
              >Déplacer</button>
            </div>
          )}

          <input
            className="input"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 180, fontSize: 14, padding: '6px 12px' }}
          />

          <div style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
            <button 
              onClick={() => setView('list')}
              style={{ 
                padding: '6px 12px', background: view === 'list' ? 'var(--bg2)' : 'transparent',
                color: view === 'list' ? 'var(--ac)' : 'var(--tx3)', border: 'none', cursor: 'pointer'
              }}
            >≡</button>
            <button 
              onClick={() => setView('grid')}
              style={{ 
                padding: '6px 12px', background: view === 'grid' ? 'var(--bg2)' : 'transparent',
                color: view === 'grid' ? 'var(--ac)' : 'var(--tx3)', border: 'none', cursor: 'pointer'
              }}
            >▦</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }} className="t-mono-sm">
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }} className="t-mono-sm">
              {docs.length === 0 ? 'Aucun document.' : 'Aucun résultat.'}
            </div>
          ) : view === 'list' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                  <th className="t-label" style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400 }}>Nom</th>
                  <th className="t-label" style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400 }}>Type / Taille</th>
                  <th className="t-label" style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400 }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleFolders.map(f => (
                  <tr 
                    key={`folder-${f}`} 
                    onClick={() => setCurrentPath([...currentPath, f])}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault()
                      if (!draggedDoc) return
                      const target = currentFolderStr ? `${currentFolderStr}/${f}` : f
                      const res = await moveDocuments([draggedDoc.id], target)
                      if ('ok' in res) {
                        setDocs(prev => prev.map(d => d.id === draggedDoc.id ? { ...d, folder: target } : d))
                      }
                      setDraggedDoc(null)
                    }}
                    style={{ borderBottom: '1px solid var(--bd)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 16px', color: 'var(--ac)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ marginRight: 8 }}>📁</span>
                          {f}
                        </div>
                        <button 
                          className="btn ghost sm" 
                          onClick={(e) => {
                            e.stopPropagation()
                            const newName = prompt('Nouveau nom du dossier :', f)
                            if (newName && newName !== f) {
                              startDel(async () => {
                                const oldPath = currentFolderStr ? `${currentFolderStr}/${f}` : f
                                const newPath = currentFolderStr ? `${currentFolderStr}/${newName}` : newName
                                const res = await renameFolder(oldPath, newPath)
                                if ('ok' in res) fetchDocs()
                                else alert(`${t('error_prefix')} ${stringifyError(res.error)}`)
                              })
                            }
                          }}
                        >✎</button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 12 }}>Dossier</td>
                    <td></td>
                  </tr>
                ))}
                {filtered.map((doc) => {
                  const work = doc.oeuvre_id ? oeuvres.find((o) => o.OeuvreID === doc.oeuvre_id) : null
                  const isActive = selected?.id === doc.id
                  const isChecked = selectedIds.includes(doc.id)
                  return (
                    <tr
                      key={doc.id}
                      draggable
                      onDragStart={() => setDraggedDoc(doc)}
                      onDragEnd={() => setDraggedDoc(null)}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          setSelectedIds(prev => prev.includes(doc.id) ? prev.filter(x => x !== doc.id) : [...prev, doc.id])
                        } else {
                          setSelected(isActive ? null : doc)
                        }
                      }}
                      style={{
                        borderBottom: '1px solid var(--bd)',
                        background: isChecked ? 'rgba(200, 168, 110, 0.1)' : isActive ? 'var(--bg2)' : undefined,
                        cursor: 'pointer',
                        opacity: draggedDoc?.id === doc.id ? 0.4 : 1
                      }}
                    >
                      <td style={{ padding: '10px 16px', color: 'var(--tx)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => setSelectedIds(prev => prev.includes(doc.id) ? prev.filter(x => x !== doc.id) : [...prev, doc.id])} 
                            onClick={e => e.stopPropagation()}
                          />
                          <span>{mimeIcon(doc.mime_type)}</span>
                          {doc.name}
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {doc.kind && (
                            <span style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 2,
                              background: kindColor(doc.kind).bg, color: kindColor(doc.kind).tx,
                              textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
                              border: `1px solid ${kindColor(doc.kind).tx}33`
                            }}>
                              {kindLabel(doc.kind)}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{formatSize(doc.file_size ?? 0)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <DocActions 
                          doc={doc} 
                          onDownload={() => handleDownload(doc)}
                          onRename={() => handleRenameFile(doc)}
                          onDeleted={() => { setDocs((prev) => prev.filter((d) => d.id !== doc.id)); if (selected?.id === doc.id) setSelected(null) }} 
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <VaultGrid 
              folders={visibleFolders}
              docs={filtered} 
              selectedId={selected?.id} 
              selectedIds={selectedIds}
              onSelect={setSelected} 
              onToggleSelect={(id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              onEnterFolder={(f) => setCurrentPath([...currentPath, f])}
              onDownload={handleDownload}
              onRename={handleRenameFile}
              onDrop={(doc, folder) => {
                const target = currentFolderStr ? `${currentFolderStr}/${folder}` : folder
                startDel(async () => {
                  const res = await moveDocuments([doc.id], target)
                  if ('ok' in res) setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, folder: target } : d))
                })
              }}
              onRenameFolder={(oldName, newName) => {
                startDel(async () => {
                  const oldPath = currentFolderStr ? `${currentFolderStr}/${oldName}` : oldName
                  const newPath = currentFolderStr ? `${currentFolderStr}/${newName}` : newName
                  const res = await renameFolder(oldPath, newPath)
                  if ('ok' in res) fetchDocs()
                })
              }}
            />
          )}
        </div>
      </div>

      {/* ── Right rail: preview ────────────────────────────────── */}
      {selected && (
        <div style={{
          width: 340, flexShrink: 0, borderLeft: '1px solid var(--bd)',
          background: 'var(--bg1)', display: 'flex', flexDirection: 'column',
          overflow: 'auto',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="t-label" style={{ fontSize: 15 }}>{selected.name}</span>
            <button className="btn ghost sm" style={{ fontSize: 18 }} onClick={() => setSelected(null)}>×</button>
          </div>

          {/* Preview area */}
          <div style={{ flex: '0 0 220px', background: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {previewUrl
              ? isPdf(selected.mime_type)
                ? <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 0 }} title={selected.name} />
                : isImage(selected.mime_type)
                  ? (
                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                      <Image 
                        src={previewUrl} 
                        alt={selected.name} 
                        fill
                        unoptimized={true}
                        style={{ objectFit: 'contain' }} 
                      />
                    </div>
                  )
                  : <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Aperçu non disponible</div>
              : <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>Chargement aperçu…</div>
            }
          </div>

          {/* Metadata */}
          <div style={{ padding: '16px 20px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selected.kind && (
              <Row label="Type" value={kindLabel(selected.kind)} />
            )}
            {selected.oeuvre_ids && selected.oeuvre_ids.length > 0 ? (
              <Row 
                label={selected.oeuvre_ids.length > 1 ? "Œuvres" : "Œuvre"} 
                value={selected.oeuvre_ids.map(id => oeuvres.find(o => o.OeuvreID === id)?.Titre || `#${id}`).join(', ')} 
              />
            ) : linkedWork && (
              <Row label="Œuvre" value={linkedWork.Titre ?? `#${linkedWork.OeuvreID}`} />
            )}
            {selected.doc_date && (
              <Row label="Date" value={new Date(selected.doc_date).toLocaleDateString('fr-FR')} />
            )}
            {selected.file_size && (
              <Row label="Taille" value={formatSize(selected.file_size)} />
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {previewUrl && (
                <button
                  className="btn sm"
                  style={{ flex: 1, background: 'var(--bg2)', color: 'var(--tx1)' }}
                  onClick={() => window.open(previewUrl, '_blank')}
                  title="Ouvrir dans un nouvel onglet"
                >
                  ↗ Voir
                </button>
              )}
              <button
                className="btn sm"
                style={{ flex: 1, background: 'var(--ac)33', color: 'var(--ac)' }}
                onClick={() => handleDownload(selected)}
              >
                ↓ Télécharger
              </button>
              <button
                className="btn sm"
                style={{ flex: 1, background: 'var(--bg2)', color: 'var(--tx1)' }}
                onClick={() => { setEditingDoc(selected); setShowEdit(true); }}
              >
                Modifier
              </button>
              <button
                className="btn sm"
                style={{ flex: 1, background: '#442222', color: '#ff8888' }}
                onClick={() => {
                  if (!confirm(t('vault_confirm_delete_one'))) return
                  startDel(async () => {
                    const r = await deleteDocument(selected.id, selected.storage_path)
                    if ('ok' in r) {
                      setDocs(prev => prev.filter(d => d.id !== selected.id))
                      setSelected(null)
                    } else {
                      alert(`${t('error_prefix')} ${stringifyError(r.error)}`)
                    }
                  })
                }}
                disabled={delPending}
              >
                {delPending ? '…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && editingDoc && (
        <EditModal 
          doc={editingDoc}
          oeuvres={oeuvres}
          onClose={() => { setShowEdit(false); setEditingDoc(null); }}
          onUpdated={(d) => {
            setDocs(prev => prev.map(x => x.id === d.id ? d : x))
            setShowEdit(false)
            setEditingDoc(null)
            setSelected(d)
          }}
        />
      )}

      {/* ── Upload modal ────────────────────────────────────────── */}
      {showUpload && (
        <UploadModal
          oeuvres={oeuvres}
          onClose={() => setShowUpload(false)}
          onUploaded={(doc) => { setDocs((prev) => [doc, ...prev]); setShowUpload(false) }}
        />
      )}

      {/* ── COA generator modal ──────────────────────────────────── */}
      {showCoa && (
        <CoaModal
          oeuvres={oeuvres}
          tM={tM}
          onClose={() => setShowCoa(false)}
          onGenerated={(doc) => { setDocs((prev) => [doc, ...prev]); setShowCoa(false); setSelected(doc) }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, alignItems: 'start' }}>
      <div className="t-label">{label}</div>
      <div style={{ color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

function DocActions({ doc, onDownload, onRename, onDeleted }: { doc: VaultDoc; onDownload: () => void; onRename: () => void; onDeleted: () => void }) {
  const { t } = useI18n()
  const [confirm,  setConfirm]  = useState(false)
  const [pending,  startDelete] = useTransition()

  return (
    <div className="row gap-sm" onClick={(e) => e.stopPropagation()}>
      <button className="btn ghost sm" onClick={onDownload} title="Télécharger">↓</button>
      <button className="btn ghost sm" onClick={onRename} title="Renommer">✎</button>
      {!confirm
        ? <button className="btn ghost sm" style={{ color: 'var(--tx3)' }} onClick={(e) => { e.stopPropagation(); setConfirm(true) }}>✕</button>
        : <>
            <button className="btn ghost sm" style={{ color: '#c0392b' }} disabled={pending} onClick={(e) => {
              e.stopPropagation()
              startDelete(async () => {
                const r = await deleteDocument(doc.id, doc.storage_path)
                if ('ok' in r) onDeleted()
                else alert(`${t('error_prefix')} ${stringifyError(r.error)}`)
              })
            }}>{pending ? '…' : 'Oui'}</button>
            <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setConfirm(false) }}>Non</button>
          </>
      }
    </div>
  )
}

function FolderTree({ 
  tree, level, currentPath, onSelect, onDrop, onRename, parentPath = [] 
}: { 
  tree: any; level: number; currentPath: string[]; onSelect: (path: string[]) => void; onDrop: (d: VaultDoc, target: string) => void; onRename: (old: string, newP: string) => void; parentPath?: string[] 
}) {
  const children = Object.values(tree.children).sort((a: any, b: any) => a.name.localeCompare(b.name))
  const [isOver, setIsOver] = useState<string | null>(null)

  return (
    <>
      {children.map((child: any) => {
        const fullPath = [...parentPath, child.name]
        const fullPathStr = fullPath.join('/')
        const isActive = currentPath.join('/') === fullPathStr
        const isExpanded = currentPath.join('/').startsWith(fullPathStr)

        return (
          <div key={child.name}>
            <button
              className={`vault-kind ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(fullPath)}
              onDragOver={e => { e.preventDefault(); setIsOver(fullPathStr) }}
              onDragLeave={() => setIsOver(null)}
              onDrop={(e) => {
                e.preventDefault()
                setIsOver(null)
                // We'll need access to draggedDoc here, or use a window/context global
                // For simplicity, we assume Vault provides the onDrop handler
                // and we'll trigger it with the global 'draggedDoc' which we can move to a higher state or context
              }}
              style={{ 
                paddingLeft: 12 + level * 16,
                fontSize: 12,
                opacity: isActive ? 1 : 0.8,
                width: '100%',
                textAlign: 'left',
                borderRadius: 4,
                marginBottom: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: isOver === fullPathStr ? 'rgba(200, 168, 110, 0.1)' : undefined
              }}
            >
              <span style={{ fontSize: 9, opacity: 0.3, width: 10, textAlign: 'center' }}>
                {Object.keys(child.children).length > 0 ? (isExpanded ? '▼' : '▶') : '•'}
              </span>
              <span style={{ fontSize: 14 }}>{isExpanded ? '📂' : '📁'}</span>
              <span style={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 600 : 400
              }}>{child.name}</span>
              <span
                role="button"
                tabIndex={0}
                className="btn ghost sm"
                style={{ marginLeft: 'auto', padding: '0 4px', fontSize: 10, opacity: 0.5, cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  const n = prompt('Renommer le dossier :', child.name)
                  if (n && n !== child.name) {
                    const oldPath = fullPathStr
                    const newPath = [...parentPath, n].join('/')
                    onRename(oldPath, newPath)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    const n = prompt('Renommer le dossier :', child.name)
                    if (n && n !== child.name) onRename(fullPathStr, [...parentPath, n].join('/'))
                  }
                }}
              >✎</span>
            </button>
            {isExpanded && Object.keys(child.children).length > 0 && (
              <FolderTree 
                tree={child} 
                level={level + 1} 
                currentPath={currentPath} 
                onSelect={onSelect} 
                onDrop={onDrop}
                onRename={onRename}
                parentPath={fullPath}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function VaultGrid({ 
  folders, docs, selectedId, selectedIds, onSelect, onToggleSelect, onEnterFolder, onDownload, onRename, onDrop, onRenameFolder
}: { 
  folders: string[]; docs: VaultDoc[]; selectedId?: number; selectedIds: number[]; onSelect: (d: VaultDoc) => void; onToggleSelect: (id: number) => void; onEnterFolder: (f: string) => void; onDownload: (d: VaultDoc) => void; onRename: (d: VaultDoc) => void; onDrop: (d: VaultDoc, f: string) => void; onRenameFolder: (o: string, n: string) => void
}) {
  const [dragged, setDragged] = useState<VaultDoc | null>(null)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 20,
      padding: 24,
    }}>
      {folders.map(f => (
        <div
          key={`folder-${f}`}
          onClick={() => onEnterFolder(f)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => dragged && onDrop(dragged, f)}
          style={{
            background: 'var(--bg1)',
            border: '1px solid var(--bd)',
            borderRadius: 4,
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          <div style={{
            height: 120, background: 'var(--bg0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40
          }}>
            📁
          </div>
          <div style={{ padding: 12, fontSize: 13, fontWeight: 500, color: 'var(--ac)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {f}
            <button 
              className="btn ghost sm" 
              style={{ padding: '2px 4px', fontSize: 10 }}
              onClick={(e) => {
                e.stopPropagation()
                const n = prompt('Renommer le dossier :', f)
                if (n && n !== f) onRenameFolder(f, n)
              }}
            >✎</button>
          </div>
        </div>
      ))}
      {docs.map(doc => {
        const active = selectedId === doc.id
        const checked = selectedIds.includes(doc.id)
        return (
          <div
            key={doc.id}
            draggable
            onDragStart={() => setDragged(doc)}
            onDragEnd={() => setDragged(null)}
            onClick={(e) => {
              if (e.shiftKey) onToggleSelect(doc.id)
              else onSelect(doc)
            }}
            style={{
              background: checked ? 'rgba(200, 168, 110, 0.1)' : active ? 'var(--bg2)' : 'var(--bg1)',
              border: checked ? '1px solid var(--ac)' : active ? '1px solid var(--ac)66' : '1px solid var(--bd)',
              borderRadius: 4,
              overflow: 'hidden',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.1s',
              opacity: dragged?.id === doc.id ? 0.4 : 1,
              position: 'relative'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <div 
              style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
              onClick={e => e.stopPropagation()}
            >
              <input 
                type="checkbox" 
                checked={checked} 
                onChange={() => onToggleSelect(doc.id)} 
              />
            </div>

            <div style={{
              height: 120,
              background: 'var(--bg0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              position: 'relative'
            }}>
              {mimeIcon(doc.mime_type)}
              {doc.kind && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  fontSize: 8, padding: '2px 5px', borderRadius: 2,
                  background: 'var(--bg1)', color: 'var(--tx3)',
                  border: '1px solid var(--bd)', textTransform: 'uppercase', letterSpacing: 0.5
                }}>
                  {kindLabel(doc.kind)}
                </div>
              )}
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ 
                fontSize: 13, fontWeight: 500, color: 'var(--tx)', 
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
              }}>
                {doc.name}
              </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{formatSize(doc.file_size ?? 0)}</div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button 
                      className="btn ghost sm" 
                      onClick={e => { e.stopPropagation(); onRename(doc) }}
                      style={{ padding: '2px 6px' }}
                    >✎</button>
                    <button 
                      className="btn ghost sm" 
                      onClick={e => { e.stopPropagation(); onDownload(doc) }}
                      style={{ padding: '2px 6px' }}
                    >↓</button>
                  </div>
                </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Upload modal ──────────────────────────────────────────────────────────

function UploadModal({
  oeuvres, onClose, onUploaded,
}: {
  oeuvres:    Oeuvre[]
  onClose:    () => void
  onUploaded: (doc: VaultDoc) => void
}) {
  const [pending, startUpload] = useTransition()
  const [error,   setError]    = useState<string | null>(null)
  const [file,    setFile]     = useState<File | null>(null)
  const [q,       setQ]        = useState('')
  const [selIds,  setSelIds]   = useState<number[]>([])
  const [showCust, setShowCust] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = q.trim() 
    ? oeuvres.filter(o => 
        (o.Titre?.toLowerCase().includes(q.toLowerCase())) || 
        (String(o.OeuvreID) === q.trim())
      ).slice(0, 8)
    : []

  function toggleId(id: number) {
    setSelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return
    const fd = new FormData(e.currentTarget)
    startUpload(async () => {
      try {
        const r = await uploadDocument(fd)
        if ('error' in r) { setError(stringifyError(r.error)); return }
        onUploaded(r.doc)
      } catch (err) {
        setError(stringifyError(err))
      }
    })
  }

  return (
    <Overlay onClose={onClose}>
      <div className="t-eyebrow" style={{ marginBottom: 20 }}>Importer un document</div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* File picker */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: '1px dashed var(--bd)', padding: '24px 16px', textAlign: 'center',
            cursor: 'pointer', borderRadius: 4, background: file ? 'var(--bg2)' : undefined,
          }}
        >
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            {file ? file.name : 'Cliquer pour choisir un fichier'}
          </div>
          {file && <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 4 }}>{formatSize(file.size)}</div>}
        </div>
        <input ref={inputRef} type="file" name="file" style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

        <Field label="Description rapide" name="name" placeholder={file?.name ?? 'Bref résumé...'} />

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Type</label>
          <select 
            name="kind" 
            className="input" 
            style={{ width: '100%' }}
            onChange={(e) => setShowCust(e.target.value === 'custom')}
          >
            <option value="">— Choisir —</option>
            {DOC_KINDS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
            <option value="custom" style={{ color: 'var(--ac)' }}>+ Autre...</option>
          </select>
          {showCust && (
            <input 
              name="custom_kind" 
              className="input" 
              placeholder="Saisir le type..." 
              style={{ width: '100%', marginTop: 8 }}
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Œuvre(s) associée(s)</label>
          <div style={{ border: '1px solid var(--bd)', padding: 8, background: 'var(--bg0)' }}>
            <input 
              className="input sm" 
              placeholder="Rechercher une œuvre..." 
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ width: '100%', marginBottom: 8, fontSize: 11 }}
            />
            
            {filtered.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8, borderBottom: '1px solid var(--bd)', paddingBottom: 8 }}>
                {filtered.map(o => (
                  <button 
                    key={o.OeuvreID}
                    type="button"
                    onClick={() => toggleId(o.OeuvreID)}
                    style={{ 
                      textAlign: 'left', padding: '6px 10px', fontSize: 12, background: 'var(--bg1)', border: 'none',
                      color: selIds.includes(o.OeuvreID) ? 'var(--ac)' : 'var(--tx2)', cursor: 'pointer'
                    }}
                  >
                    {selIds.includes(o.OeuvreID) ? '✓ ' : '+ '} {o.Titre ?? `#${o.OeuvreID}`}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selIds.length === 0 && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Aucune sélection</span>}
              {selIds.map(id => {
                const o = oeuvres.find(x => x.OeuvreID === id)
                return (
                  <span key={id} style={{ padding: '4px 8px', background: 'var(--bg2)', fontSize: 11, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {o?.Titre ?? `#${id}`}
                    <button type="button" onClick={() => toggleId(id)} style={{ border: 'none', background: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </span>
                )
              })}
            </div>
            <input type="hidden" name="oeuvre_ids" value={selIds.join(',')} />
          </div>
        </div>

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Dossier</label>
          <input 
            name="folder" 
            className="input" 
            placeholder="Ex: Projet 2026, FacturesJackson..." 
            style={{ width: '100%' }}
          />
        </div>

        <Field label="Date du document" name="doc_date" type="date" />
        <Field label="Notes" name="notes" placeholder="Instructions, histoire ou détails additionnels…" />

        {error && <div className="t-mono-sm" style={{ color: '#c0392b' }}>{error}</div>}

        <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary" disabled={!file || pending}>
            {pending ? 'Import…' : 'Importer'}
          </button>
        </div>
      </form>
    </Overlay>
  )
}

// ── COA generator modal ───────────────────────────────────────────────────

function CoaModal({
  oeuvres, tM, onClose, onGenerated,
}: {
  oeuvres:     Oeuvre[]
  tM:          Record<number, string>
  onClose:     () => void
  onGenerated: (doc: VaultDoc) => void
}) {
  const [oeuvreId, setOeuvreId] = useState<number | null>(null)
  const [pending,  startGen]    = useTransition()
  const [error,    setError]    = useState<string | null>(null)

  const work = oeuvreId ? oeuvres.find((o) => o.OeuvreID === oeuvreId) : null

  function handleGenerate() {
    if (!oeuvreId) return
    startGen(async () => {
      try {
        const r = await generateCOA(oeuvreId)
        if ('error' in r) { setError(stringifyError(r.error)); return }
        onGenerated(r.doc)
      } catch (e) {
        setError(stringifyError(e))
      }
    })
  }

  return (
    <Overlay onClose={onClose}>
      <div className="t-eyebrow" style={{ marginBottom: 20 }}>Générer un certificat d&apos;authenticité</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Œuvre</label>
          <select
            className="input" style={{ width: '100%' }}
            value={oeuvreId ?? ''}
            onChange={(e) => setOeuvreId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Choisir une œuvre —</option>
            {oeuvres.slice(0, 500).map((o) => (
              <option key={o.OeuvreID} value={o.OeuvreID}>
                {o.Titre ?? `#${o.OeuvreID}`} {o.Année ? `(${o.Année.slice(0, 4)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {work && (
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--bd)',
            padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13,
          }}>
            <div className="t-label" style={{ marginBottom: 4 }}>Aperçu du certificat</div>
            <Row label="Titre"    value={work.Titre ?? 'Sans titre'} />
            <Row label="Année"    value={work.Année?.slice(0, 4) ?? '—'} />
            {work.Technique != null && <Row label="Technique" value={tM[work.Technique] ?? '—'} />}
            {work.Hauteur && work.Largeur && (
              <Row label="Dimensions" value={`${work.Hauteur} × ${work.Largeur} cm`} />
            )}
            <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--bg0)', borderRadius: 2 }}>
              <div className="t-label" style={{ marginBottom: 4 }}>Le certificat contiendra</div>
              <div className="t-mono-sm" style={{ color: 'var(--tx3)', lineHeight: 2 }}>
                Photo de l&apos;œuvre · Métadonnées · Déclaration d&apos;authenticité<br />
                Bloc de signature · Identifiant unique · Empreinte SHA-256 · QR code
              </div>
            </div>
          </div>
        )}

        {error && <div className="t-mono-sm" style={{ color: '#c0392b' }}>{error}</div>}

        <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Annuler</button>
          <button
            className="btn primary"
            disabled={!oeuvreId || pending}
            onClick={handleGenerate}
          >
            {pending ? 'Génération…' : '✦ Générer et sauvegarder'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Shared overlay wrapper ────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg1)', border: '1px solid var(--bd)',
          padding: 32, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflow: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function EditModal({ doc, oeuvres, onClose, onUpdated }: { doc: VaultDoc; oeuvres: any[]; onClose: () => void; onUpdated: (d: VaultDoc) => void }) {
  const [pending, startUpdate] = useTransition()
  const [error,   setError]    = useState<string | null>(null)
  const [q,       setQ]        = useState('')
  const [selIds,  setSelIds]   = useState<number[]>(doc.oeuvre_ids || (doc.oeuvre_id ? [doc.oeuvre_id] : []))
  
  const isCustomType = !DOC_KINDS.find(k => k.value === doc.kind)
  const [showCust, setShowCust] = useState(isCustomType)

  const filtered = q.trim() 
    ? oeuvres.filter(o => (o.Titre?.toLowerCase().includes(q.toLowerCase())) || (String(o.OeuvreID) === q.trim())).slice(0, 8)
    : []

  function toggleId(id: number) {
    setSelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    startUpdate(async () => {
      const fd = new FormData(e.currentTarget)
      const res = await updateDocument(doc.id, fd)
      if ('error' in res) setError(stringifyError(res.error))
      else onUpdated(res.doc)
    })
  }

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', opacity: 0.6 }}>
          <div className="t-mono-xs" style={{ fontSize: 11 }}>{doc.storage_path}</div>
        </div>

        <Field label="Description rapide" name="name" defaultValue={doc.name} />

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Type</label>
          <select 
            name="kind" 
            className="input" 
            style={{ width: '100%' }}
            defaultValue={isCustomType ? 'custom' : (doc.kind || '')}
            onChange={(e) => setShowCust(e.target.value === 'custom')}
          >
            <option value="">— Choisir —</option>
            {DOC_KINDS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
            <option value="custom" style={{ color: 'var(--ac)' }}>+ Autre...</option>
          </select>
          {showCust && (
            <input 
              name="custom_kind" 
              className="input" 
              defaultValue={isCustomType ? (doc.kind || '') : ''}
              placeholder="Saisir le type..." 
              style={{ width: '100%', marginTop: 8 }}
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Dossier</label>
          <input 
            name="folder" 
            className="input" 
            defaultValue={doc.folder || ''}
            placeholder="Ex: Projet 2026, FacturesJackson..." 
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Œuvre(s) associée(s)</label>
          <div style={{ border: '1px solid var(--bd)', padding: 8, background: 'var(--bg0)' }}>
            <input 
              className="input sm" 
              placeholder="Rechercher une œuvre..." 
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ width: '100%', marginBottom: 10, fontSize: 13, padding: '6px 10px' }}
            />
            {filtered.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8, borderBottom: '1px solid var(--bd)', paddingBottom: 8 }}>
                {filtered.map(o => (
                  <button key={o.OeuvreID} type="button" onClick={() => toggleId(o.OeuvreID)}
                    style={{ textAlign: 'left', padding: '6px 10px', fontSize: 12, background: 'var(--bg1)', border: 'none', color: selIds.includes(o.OeuvreID) ? 'var(--ac)' : 'var(--tx2)', cursor: 'pointer' }}>
                    {selIds.includes(o.OeuvreID) ? '✓ ' : '+ '} {o.Titre ?? `#${o.OeuvreID}`}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selIds.map(id => {
                const o = oeuvres.find(x => x.OeuvreID === id)
                return (
                  <span key={id} style={{ padding: '4px 8px', background: 'var(--bg2)', fontSize: 11, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {o?.Titre ?? `#${id}`}
                    <button type="button" onClick={() => toggleId(id)} style={{ border: 'none', background: 'none', color: 'var(--tx3)', cursor: 'pointer', fontSize: 14 }}>×</button>
                  </span>
                )
              })}
            </div>
            <input type="hidden" name="oeuvre_ids" value={selIds.join(',')} />
          </div>
        </div>

        <Field label="Date" name="doc_date" type="date" defaultValue={doc.doc_date ?? undefined} />
        <Field label="Notes" name="notes" defaultValue={doc.notes ?? ''} />

        {error && <div className="t-mono-sm" style={{ color: '#c0392b' }}>{error}</div>}

        <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? 'Enregistrement…' : 'Mettre à jour'}
          </button>
        </div>
      </form>
    </Overlay>
  )
}

function Field({ label, name, placeholder, type = 'text', defaultValue }: { label: string; name: string; placeholder?: string; type?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      <input name={name} type={type} placeholder={placeholder} className="input" defaultValue={defaultValue} style={{ width: '100%' }} />
    </div>
  )
}


// ── Helpers ───────────────────────────────────────────────────────────────

function mimeIcon(mime: string | null) {
  if (!mime) return '📄'
  if (mime === 'application/pdf') return '📕'
  if (mime.startsWith('image/'))  return '🖼'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  return '📄'
}

function isPdf(mime: string | null)   { return mime === 'application/pdf' }
function isImage(mime: string | null) { return !!mime?.startsWith('image/') }

function formatSize(bytes: number) {
  if (bytes < 1024)           return `${bytes} o`
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function kindLabel(kind: string) {
  return DOC_KINDS.find((k) => k.value === kind)?.label ?? kind
}

function SortInd({ k, current, dir }: { k: string; current: string; dir: 'asc' | 'desc' }) {
  if (k !== current) return <span style={{ opacity: 0.2, marginLeft: 4, fontSize: 11 }}>↕</span>
  return <span style={{ color: 'var(--ac)', marginLeft: 4, fontSize: 11 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}
