'use client'

// VaultTab — document vault with upload, preview, search/filter, and COA generation.
// Fetches documents client-side (dynamic content, team-auth required).

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  uploadDocument, updateDocument, deleteDocument, getSignedUrl, generateCOA,
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

export function VaultTab({ oeuvres, tM }: Props) {
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
    let list = docs.filter((d) => {
      if (kindFilter && d.kind !== kindFilter) return false
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

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
  }, [docs, kindFilter, search, sortKey, sortDir, oeuvres])

  const filtered = processed // For backward compatibility in rendering if needed, but we'll use processed

  const linkedWork = selected?.oeuvre_id
    ? oeuvres.find((o) => o.OeuvreID === selected.oeuvre_id)
    : null

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Left sidebar: kind filter ──────────────────────────── */}
      <div style={{
        width: 180, flexShrink: 0, borderRight: '1px solid var(--bd)',
        background: 'var(--bg1)', display: 'flex', flexDirection: 'column',
        padding: '20px 0',
      }}>
        <div className="t-eyebrow" style={{ padding: '0 20px', marginBottom: 12 }}>Coffre</div>

        <button
          className={`vault-kind ${!kindFilter ? 'active' : ''}`}
          onClick={() => setKindFilter(null)}
        >
          Tous <span className="cnt">{docs.length}</span>
        </button>

        {DOC_KINDS.map(({ value, label }) => {
          const cnt = docs.filter((d) => d.kind === value).length
          return (
            <button
              key={value}
              className={`vault-kind ${kindFilter === value ? 'active' : ''}`}
              onClick={() => setKindFilter(kindFilter === value ? null : value)}
            >
              {label}
              {cnt > 0 && <span className="cnt">{cnt}</span>}
            </button>
          )
        })}

        <div style={{ marginTop: 'auto', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => setShowUpload(true)}>
            + Importer
          </button>
          <button className="btn ghost sm" style={{ width: '100%' }} onClick={() => setShowCoa(true)}>
            ✦ Générer COA
          </button>
        </div>
      </div>

      {/* ── Centre: document list ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Search bar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
          <input
            className="input"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}
          />
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }} className="t-mono-sm">
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }} className="t-mono-sm">
              {docs.length === 0 ? 'Aucun document. Importez ou générez un certificat.' : 'Aucun résultat.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                  <th className="t-label" onClick={() => toggleSort('name')} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400, cursor: 'pointer' }}>
                    Nom <SortInd k="name" current={sortKey} dir={sortDir} />
                  </th>
                  <th className="t-label" onClick={() => toggleSort('kind')} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400, cursor: 'pointer' }}>
                    Type <SortInd k="kind" current={sortKey} dir={sortDir} />
                  </th>
                  <th className="t-label" onClick={() => toggleSort('oeuvre')} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400, cursor: 'pointer' }}>
                    Œuvre <SortInd k="oeuvre" current={sortKey} dir={sortDir} />
                  </th>
                  <th className="t-label" onClick={() => toggleSort('date')} style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400, cursor: 'pointer' }}>
                    Date <SortInd k="date" current={sortKey} dir={sortDir} />
                  </th>
                  <th className="t-label" style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const work = doc.oeuvre_id ? oeuvres.find((o) => o.OeuvreID === doc.oeuvre_id) : null
                  const isActive = selected?.id === doc.id
                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setSelected(isActive ? null : doc)}
                      style={{
                        borderBottom: '1px solid var(--bd)',
                        background: isActive ? 'var(--bg2)' : undefined,
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '10px 16px', color: 'var(--tx)' }}>
                        <span style={{ marginRight: 8 }}>{mimeIcon(doc.mime_type)}</span>
                        {doc.name}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {doc.kind && (
                          <span style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 2,
                            background: kindColor(doc.kind).bg, color: kindColor(doc.kind).tx,
                            textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600,
                            border: `1px solid ${kindColor(doc.kind).tx}33`
                          }}>
                            {kindLabel(doc.kind)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 12 }}>
                        {doc.oeuvre_ids && doc.oeuvre_ids.length > 1 ? (
                          <span title={doc.oeuvre_ids.map(id => oeuvres.find(o => o.OeuvreID === id)?.Titre || `#${id}`).join(', ')}>
                            {doc.oeuvre_ids.length} œuvres
                          </span>
                        ) : work ? (
                          work.Titre ?? `#${work.OeuvreID}`
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {doc.doc_date
                          ? new Date(doc.doc_date).toLocaleDateString('fr-FR')
                          : new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <DocActions doc={doc} onDeleted={() => { setDocs((prev) => prev.filter((d) => d.id !== doc.id)); if (selected?.id === doc.id) setSelected(null) }} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
                  ? <img src={previewUrl} alt={selected.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
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
                  if (!confirm('Supprimer ce document ?')) return
                  startDel(async () => {
                    const r = await deleteDocument(selected.id, selected.storage_path)
                    if ('ok' in r) {
                      setDocs(prev => prev.filter(d => d.id !== selected.id))
                      setSelected(null)
                    } else {
                      alert(`Erreur : ${stringifyError(r.error)}`)
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 8, alignItems: 'start' }}>
      <div className="t-label">{label}</div>
      <div style={{ color: 'var(--tx2)' }}>{value}</div>
    </div>
  )
}

function DocActions({ doc, onDeleted }: { doc: VaultDoc; onDeleted: () => void }) {
  const [confirm,  setConfirm]  = useState(false)
  const [pending,  startDelete] = useTransition()

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    startDelete(async () => {
      try {
        const r = await deleteDocument(doc.id, doc.storage_path)
        if ('ok' in r) {
          onDeleted()
        } else {
          alert(`Erreur lors de la suppression : ${stringifyError(r.error)}`)
        }
      } catch (err) {
        alert(`Erreur critique : ${stringifyError(err)}`)
      }
    })
  }

  return (
    <div className="row gap-sm" onClick={(e) => e.stopPropagation()}>
      {!confirm
        ? <button className="btn ghost sm" style={{ color: 'var(--tx3)' }} onClick={(e) => { e.stopPropagation(); setConfirm(true) }}>✕</button>
        : <>
            <button className="btn ghost sm" style={{ color: '#c0392b' }} disabled={pending} onClick={handleDelete}>{pending ? '…' : 'Oui'}</button>
            <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setConfirm(false) }}>Non</button>
          </>
      }
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
      <div className="t-eyebrow" style={{ marginBottom: 20 }}>Générer un certificat d'authenticité</div>

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
                Photo de l'œuvre · Métadonnées · Déclaration d'authenticité<br />
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

        <Field label="Date du document" name="doc_date" type="date" defaultValue={doc.doc_date || ''} />
        <Field label="Notes" name="notes" defaultValue={doc.notes || ''} placeholder="Instructions, histoire ou détails additionnels…" />

        {error && <div className="t-mono-sm" style={{ color: '#c0392b' }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
          <button type="button" className="btn-text" onClick={onClose} disabled={pending}>ANNULER</button>
          <button type="submit" className="btn" style={{ minWidth: 120 }} disabled={pending}>
            {pending ? '...' : 'ENREGISTRER'}
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
