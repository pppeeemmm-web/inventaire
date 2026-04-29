'use client'

// VaultTab — document vault with upload, preview, search/filter, and COA generation.
// Fetches documents client-side (dynamic content, team-auth required).

import { useState, useEffect, useRef, useTransition, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  uploadDocument, deleteDocument, getSignedUrl, generateCOA,
  type VaultDoc,
} from '@/app/atelier/vault/actions'
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
  const [selected, setSelected] = useState<VaultDoc | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showCoa,    setShowCoa]    = useState(false)

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
    })
  }, [selected])

  // ── Filtered list ────────────────────────────────────────────────
  const filtered = docs.filter((d) => {
    if (kindFilter && d.kind !== kindFilter) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

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
            style={{ width: '100%', fontSize: 12 }}
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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                  {['Nom', 'Type', 'Œuvre', 'Date', ''].map((h) => (
                    <th key={h} className="t-label" style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 400 }}>{h}</th>
                  ))}
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
                            fontSize: 10, padding: '2px 7px', borderRadius: 2,
                            background: 'var(--bg2)', color: 'var(--tx3)',
                            textTransform: 'uppercase', letterSpacing: 1,
                          }}>
                            {kindLabel(doc.kind)}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 11 }}>
                        {work ? (work.Titre ?? `#${work.OeuvreID}`) : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 11, whiteSpace: 'nowrap' }}>
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
            <span className="t-label">{selected.name}</span>
            <button className="btn ghost sm" onClick={() => setSelected(null)}>×</button>
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
          <div style={{ padding: '16px 20px', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {selected.kind && (
              <Row label="Type" value={kindLabel(selected.kind)} />
            )}
            {linkedWork && (
              <Row label="Œuvre" value={linkedWork.Titre ?? `#${linkedWork.OeuvreID}`} />
            )}
            {selected.doc_date && (
              <Row label="Date" value={new Date(selected.doc_date).toLocaleDateString('fr-FR')} />
            )}
            {selected.file_size && (
              <Row label="Taille" value={formatSize(selected.file_size)} />
            )}
            {selected.notes && (
              <div>
                <div className="t-label" style={{ marginBottom: 4 }}>Notes</div>
                <div style={{ color: 'var(--tx2)', lineHeight: 1.6 }}>{selected.notes}</div>
              </div>
            )}

            {/* COA fields */}
            {selected.cert_id && (
              <>
                <div>
                  <div className="t-label" style={{ marginBottom: 4, letterSpacing: 1 }}>Référence</div>
                  <div className="t-mono-sm" style={{ color: 'var(--tx)', letterSpacing: 1 }}>{selected.cert_id}</div>
                </div>
                <div>
                  <div className="t-label" style={{ marginBottom: 4, letterSpacing: 1 }}>Empreinte SHA-256</div>
                  <div className="t-mono-sm" style={{ color: 'var(--tx3)', wordBreak: 'break-all', lineHeight: 1.5 }}>{selected.cert_hash}</div>
                </div>
              </>
            )}

            {previewUrl && (
              <a
                href={previewUrl}
                download={selected.name}
                className="btn ghost sm"
                style={{ textAlign: 'center', marginTop: 4 }}
              >
                ↓ Télécharger
              </a>
            )}
          </div>
        </div>
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
      const r = await deleteDocument(doc.id, doc.storage_path)
      if ('ok' in r) onDeleted()
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
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return
    const fd = new FormData(e.currentTarget)
    startUpload(async () => {
      try {
        const r = await uploadDocument(fd)
        if ('error' in r) { setError(r.error); return }
        onUploaded(r.doc)
      } catch (err) {
        setError(String(err))
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

        <Field label="Nom" name="name" placeholder={file?.name ?? 'Nom du document'} />

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Type</label>
          <select name="kind" className="input" style={{ width: '100%' }}>
            <option value="">— Choisir —</option>
            {DOC_KINDS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Œuvre associée</label>
          <select name="oeuvre_id" className="input" style={{ width: '100%' }}>
            <option value="">— Aucune —</option>
            {oeuvres.slice(0, 200).map((o) => (
              <option key={o.OeuvreID} value={o.OeuvreID}>
                {o.Titre ?? `#${o.OeuvreID}`} {o.Année ? `(${o.Année.slice(0, 4)})` : ''}
              </option>
            ))}
          </select>
        </div>

        <Field label="Date du document" name="doc_date" type="date" />
        <Field label="Notes" name="notes" placeholder="Notes optionnelles…" />

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
        if ('error' in r) { setError(r.error); return }
        onGenerated(r.doc)
      } catch (e) {
        setError(String(e))
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
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11,
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

function Field({ label, name, placeholder, type = 'text' }: { label: string; name: string; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      <input name={name} type={type} placeholder={placeholder} className="input" style={{ width: '100%' }} />
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
