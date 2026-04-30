'use client'

// ConceptsTab — Idée / Concept space.
// Raw ideas before they become works: capture energy, medium, themes, description.
// Sorted by energie (burning ideas first). Click to expand & edit.

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchConcepts, createConcept, updateConcept, deleteConcept,
  type ConceptRow,
} from '@/app/atelier/concepts/actions'

// ── Constants ────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<string, string> = {
  idee:           'Idée',
  exploration:    'Exploration',
  en_cours:       'En cours',
  abandonne:      'Abandonné',
  devenu_oeuvre:  'Devenu œuvre',
}

const STATUT_COLORS: Record<string, string> = {
  idee:           'var(--tx3)',
  exploration:    'var(--ac)',
  en_cours:       'var(--cyan)',
  abandonne:      'var(--rust)',
  devenu_oeuvre:  'var(--sage)',
}

const ENERGIE_LABELS = ['', '❄️ Vague', '🌱 Naissante', '🔥 Active', '⚡ Urgente', '🌋 Brûlante']

const MEDIUMS = ['Peinture', 'Dessin', 'Gravure', 'Sculpture', 'Installation', 'Vidéo', 'Photo', 'Autre']

const inputSt: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 11,
  background: 'var(--bg0)', border: '1px solid var(--bd)',
  color: 'var(--tx)', outline: 'none', boxSizing: 'border-box',
}

const labelSt: React.CSSProperties = {
  fontSize: 9, letterSpacing: 1, color: 'var(--tx3)',
  textTransform: 'uppercase', marginBottom: 4, display: 'block',
}

// ── Helper ───────────────────────────────────────────────────────────────────

function energieDot(e: number | null) {
  if (!e) return null
  const colors = ['', '#888', '#a0b060', '#e08020', '#e04040', '#c020c0']
  return (
    <span style={{
      display: 'inline-flex', gap: 2, alignItems: 'center',
    }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i < e ? colors[e] : 'var(--bg2)',
        }} />
      ))}
    </span>
  )
}

// ── New concept form (inline panel) ──────────────────────────────────────────

function NewConceptForm({ onCreated, onCancel }: {
  onCreated: (c: ConceptRow) => void
  onCancel:  () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setBusy(true); setErr('')
    const fd = new FormData(formRef.current)
    const res = await createConcept(fd)
    setBusy(false)
    if ('error' in res) { setErr(res.error); return }
    onCreated(res.concept)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{
      background: 'var(--bg1)', border: '1px solid var(--ac)',
      padding: 20, marginBottom: 16,
    }}>
      <div className="t-eyebrow" style={{ marginBottom: 16, color: 'var(--ac)' }}>Nouvelle idée</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>Titre *</label>
          <input name="titre" style={inputSt} placeholder="Titre de l'idée…" autoFocus required />
        </div>
        <div>
          <label style={labelSt}>Medium</label>
          <select name="medium" style={inputSt}>
            <option value="">—</option>
            {MEDIUMS.map((m) => <option key={m} value={m.toLowerCase()}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Énergie</label>
          <select name="energie" style={inputSt}>
            <option value="">—</option>
            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{ENERGIE_LABELS[n]}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>Description / intuition</label>
          <textarea name="description" style={{ ...inputSt, height: 72, resize: 'vertical' }}
            placeholder="Décris l'idée, l'intention, les sensations…" />
        </div>
        <div>
          <label style={labelSt}>Thèmes (séparés par virgule)</label>
          <input name="themes" style={inputSt} placeholder="corps, mémoire, lumière…" />
        </div>
        <div>
          <label style={labelSt}>Référence visuelle (URL ou note)</label>
          <input name="image_note" style={inputSt} placeholder="https://… ou description" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>Notes libres</label>
          <textarea name="notes" style={{ ...inputSt, height: 56, resize: 'vertical' }} />
        </div>
      </div>

      {err && <div style={{ color: 'var(--rust)', fontSize: 10, marginBottom: 8 }}>{err}</div>}

      <div className="row gap-sm">
        <button type="submit" className="btn sm" disabled={busy}>
          {busy ? 'Création…' : 'Créer l\'idée'}
        </button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  )
}

// ── Concept card (expandable) ─────────────────────────────────────────────────

function ConceptCard({ concept, onUpdated, onDeleted }: {
  concept:   ConceptRow
  onUpdated: (c: ConceptRow) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [busy,     setBusy]     = useState(false)

  // Local edit state
  const [titre,       setTitre]      = useState(concept.titre)
  const [description, setDesc]       = useState(concept.description ?? '')
  const [medium,      setMedium]     = useState(concept.medium ?? '')
  const [themesStr,   setThemesStr]  = useState((concept.themes ?? []).join(', '))
  const [statut,      setStatut]     = useState(concept.statut)
  const [energie,     setEnergie]    = useState<number | ''>(concept.energie ?? '')
  const [imageNote,   setImageNote]  = useState(concept.image_note ?? '')
  const [notes,       setNotes]      = useState(concept.notes ?? '')

  async function save() {
    setBusy(true)
    const themes = themesStr ? themesStr.split(',').map((t) => t.trim()).filter(Boolean) : null
    const res = await updateConcept(concept.id, {
      titre:       titre.trim() || 'Sans titre',
      description: description.trim() || null,
      medium:      medium || null,
      themes,
      statut,
      energie:     energie === '' ? null : Number(energie),
      image_note:  imageNote.trim() || null,
      notes:       notes.trim() || null,
    })
    setBusy(false)
    if ('ok' in res) {
      onUpdated({
        ...concept,
        titre:       titre.trim() || 'Sans titre',
        description: description.trim() || null,
        medium:      medium || null,
        themes:      themes,
        statut,
        energie:     energie === '' ? null : Number(energie),
        image_note:  imageNote.trim() || null,
        notes:       notes.trim() || null,
        updated_at:  new Date().toISOString(),
      })
      setEditing(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer l'idée "${concept.titre}" ?`)) return
    setBusy(true)
    await deleteConcept(concept.id)
    onDeleted(concept.id)
  }

  const isAbandoned  = concept.statut === 'abandonne'
  const isBecameWork = concept.statut === 'devenu_oeuvre'

  return (
    <div style={{
      border: '1px solid var(--bd)',
      borderLeft: `3px solid ${STATUT_COLORS[concept.statut] ?? 'var(--bd)'}`,
      background: 'var(--bg1)',
      opacity: isAbandoned ? 0.5 : 1,
      marginBottom: 8,
    }}>
      {/* Card header */}
      <div
        onClick={() => { setExpanded((x) => !x); setEditing(false) }}
        style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        {/* Energie dots */}
        <div style={{ flexShrink: 0 }}>{energieDot(concept.energie)}</div>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--tx)',
            textDecoration: isAbandoned ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {concept.titre}
          </div>
          <div style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 2, display: 'flex', gap: 10 }}>
            {concept.medium && <span>{concept.medium}</span>}
            {concept.themes?.length ? <span>{concept.themes.slice(0, 3).join(' · ')}</span> : null}
            {concept.description && <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
              {concept.description.slice(0, 60)}{concept.description.length > 60 ? '…' : ''}
            </span>}
          </div>
        </div>

        {/* Status chip */}
        <div style={{
          fontSize: 9, letterSpacing: 1, padding: '2px 7px',
          border: `1px solid ${STATUT_COLORS[concept.statut] ?? 'var(--bd)'}`,
          color: STATUT_COLORS[concept.statut] ?? 'var(--tx3)',
          flexShrink: 0,
        }}>
          {STATUT_LABELS[concept.statut] ?? concept.statut}
        </div>

        <div style={{ color: 'var(--tx3)', fontSize: 12, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--bd)', padding: '16px 16px 12px' }}>
          {editing ? (
            /* ── Edit mode ── */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>Titre</label>
                <input style={inputSt} value={titre} onChange={(e) => setTitre(e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Statut</label>
                <select style={inputSt} value={statut} onChange={(e) => setStatut(e.target.value)}>
                  {Object.entries(STATUT_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelSt}>Énergie</label>
                <select style={inputSt} value={energie} onChange={(e) => setEnergie(e.target.value === '' ? '' : Number(e.target.value))}>
                  <option value="">—</option>
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{ENERGIE_LABELS[n]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Medium</label>
                <select style={inputSt} value={medium} onChange={(e) => setMedium(e.target.value)}>
                  <option value="">—</option>
                  {MEDIUMS.map((m) => <option key={m} value={m.toLowerCase()}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Thèmes</label>
                <input style={inputSt} value={themesStr} onChange={(e) => setThemesStr(e.target.value)} placeholder="corps, mémoire…" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>Description</label>
                <textarea style={{ ...inputSt, height: 80, resize: 'vertical' }}
                  value={description} onChange={(e) => setDesc(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>Référence visuelle</label>
                <input style={inputSt} value={imageNote} onChange={(e) => setImageNote(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>Notes</label>
                <textarea style={{ ...inputSt, height: 64, resize: 'vertical' }}
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="row gap-sm" style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                <button className="btn sm" onClick={save} disabled={busy}>
                  {busy ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
                <button className="btn ghost sm" onClick={() => setEditing(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <div>
              {concept.description && (
                <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.6, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                  {concept.description}
                </div>
              )}

              {/* Meta row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12 }}>
                {concept.energie && (
                  <div>
                    <div style={{ ...labelSt, marginBottom: 2 }}>Énergie</div>
                    <div style={{ fontSize: 10, color: 'var(--tx2)' }}>{ENERGIE_LABELS[concept.energie]}</div>
                  </div>
                )}
                {concept.medium && (
                  <div>
                    <div style={{ ...labelSt, marginBottom: 2 }}>Medium</div>
                    <div style={{ fontSize: 10, color: 'var(--tx2)' }}>{concept.medium}</div>
                  </div>
                )}
                {concept.themes?.length ? (
                  <div>
                    <div style={{ ...labelSt, marginBottom: 2 }}>Thèmes</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {concept.themes.map((th) => (
                        <span key={th} style={{
                          fontSize: 9, padding: '2px 6px',
                          border: '1px solid var(--bd)', color: 'var(--tx3)',
                        }}>{th}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {concept.image_note && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelSt}>Référence visuelle</div>
                  {concept.image_note.startsWith('http') ? (
                    <a href={concept.image_note} target="_blank" rel="noreferrer"
                      style={{ fontSize: 10, color: 'var(--ac)', wordBreak: 'break-all' }}>
                      {concept.image_note}
                    </a>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--tx2)', fontStyle: 'italic' }}>{concept.image_note}</div>
                  )}
                </div>
              )}

              {concept.notes && (
                <div style={{ marginBottom: 12 }}>
                  <div style={labelSt}>Notes</div>
                  <div style={{ fontSize: 10, color: 'var(--tx2)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {concept.notes}
                  </div>
                </div>
              )}

              {isBecameWork && concept.oeuvre_id && (
                <div style={{ marginBottom: 12, fontSize: 10, color: 'var(--sage)' }}>
                  ✓ Devenu l'œuvre #{concept.oeuvre_id}
                </div>
              )}

              <div style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 10 }}>
                Créé {new Date(concept.created_at).toLocaleDateString('fr-FR')}
                {concept.updated_at !== concept.created_at &&
                  ` · modifié ${new Date(concept.updated_at).toLocaleDateString('fr-FR')}`}
              </div>

              <div className="row gap-sm">
                <button className="btn ghost sm" onClick={() => setEditing(true)}>Modifier</button>
                <button className="btn ghost sm" style={{ color: 'var(--rust)' }} onClick={handleDelete} disabled={busy}>
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export function ConceptsTab() {
  const [concepts,  setConcepts]  = useState<ConceptRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [filter,    setFilter]    = useState<string>('all')   // statut filter
  const [search,    setSearch]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await fetchConcepts()
    setConcepts(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function handleCreated(c: ConceptRow) {
    setConcepts((prev) => [c, ...prev])
    setShowForm(false)
  }

  function handleUpdated(c: ConceptRow) {
    setConcepts((prev) => prev.map((x) => x.id === c.id ? c : x)
      .sort((a, b) => {
        const ea = a.energie ?? 0, eb = b.energie ?? 0
        if (eb !== ea) return eb - ea
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
    )
  }

  function handleDeleted(id: string) {
    setConcepts((prev) => prev.filter((x) => x.id !== id))
  }

  // Filter + search
  const visible = concepts.filter((c) => {
    if (filter !== 'all' && c.statut !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        c.titre.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q) ||
        (c.themes ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (c.medium ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // Stats
  const total     = concepts.length
  const active    = concepts.filter((c) => c.statut === 'exploration' || c.statut === 'en_cours').length
  const burning   = concepts.filter((c) => (c.energie ?? 0) >= 4).length
  const converted = concepts.filter((c) => c.statut === 'devenu_oeuvre').length

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── Sidebar: filters ─────────────────────────────────────── */}
      <div style={{
        width: 200, flexShrink: 0, borderRight: '1px solid var(--bd)',
        padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4,
        overflowY: 'auto',
      }}>
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>Filtres</div>

        {[
          ['all',            `Toutes (${total})`],
          ['idee',           'Idée'],
          ['exploration',    'Exploration'],
          ['en_cours',       'En cours'],
          ['abandonne',      'Abandonné'],
          ['devenu_oeuvre',  'Devenu œuvre'],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            style={{
              textAlign: 'left', padding: '6px 10px', fontSize: 11,
              background: filter === v ? 'var(--bg2)' : 'transparent',
              color: filter === v ? 'var(--tx)' : 'var(--tx3)',
              border: 'none', cursor: 'pointer',
              borderLeft: filter === v ? `2px solid var(--ac)` : '2px solid transparent',
            }}
          >
            {l}
          </button>
        ))}

        <div style={{ borderTop: '1px solid var(--bd)', marginTop: 12, paddingTop: 12 }}>
          <div className="t-label" style={{ marginBottom: 8 }}>Statistiques</div>
          {[
            ['Total',     total],
            ['Actives',   active],
            ['Brûlantes', burning],
            ['Devenues œuvres', converted],
          ].map(([l, v]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>
              <span>{l}</span>
              <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{
          borderBottom: '1px solid var(--bd)', padding: '12px 24px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une idée…"
            style={{ ...inputSt, width: 280, padding: '6px 10px' }}
          />
          <div style={{ flex: 1 }} />
          <button className="btn sm" onClick={() => setShowForm((x) => !x)}>
            {showForm ? '✕ Annuler' : '+ Nouvelle idée'}
          </button>
        </div>

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {showForm && (
            <NewConceptForm
              onCreated={handleCreated}
              onCancel={() => setShowForm(false)}
            />
          )}

          {loading ? (
            <div style={{ color: 'var(--tx3)', fontSize: 11 }}>Chargement…</div>
          ) : visible.length === 0 ? (
            <div style={{ color: 'var(--tx3)', fontSize: 11, textAlign: 'center', marginTop: 40 }}>
              {search || filter !== 'all'
                ? 'Aucune idée correspondante.'
                : 'Aucune idée pour l\'instant. Créez la première !'}
            </div>
          ) : (
            visible.map((c) => (
              <ConceptCard
                key={c.id}
                concept={c}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
