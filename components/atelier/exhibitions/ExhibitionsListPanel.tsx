'use client'

import type { CSSProperties } from 'react'
import { pipelineTypeLabel, type ProcessType } from '@/components/atelier/PipelineTab'

const inputSt: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: 13,
  background: 'var(--bg0)',
  border: '1px solid var(--bd)',
  color: 'var(--tx)',
  outline: 'none',
  boxSizing: 'border-box',
}

const STATUT_COLORS: Record<string, string> = {
  a_confirmer: '#a0a040',
  prevue: '#6080c0',
  en_cours: 'var(--ac)',
  passee: '#888',
}

const STATUT_LABELS: Record<string, string> = {
  a_confirmer: 'À confirmer',
  prevue: 'Prévue',
  en_cours: 'En cours',
  passee: 'Passée',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export interface ExhibitionsListItem {
  id: string
  nom: string
  type: string | null
  statut: string
  date_fin: string | null
  steps: { statut: string }[]
}

export function ExhibitionsListPanel({
  selectedId,
  exhibitions,
  filteredExhibitions,
  filter,
  showNew,
  creating,
  newNom,
  newType,
  lang,
  onSelect,
  onToggleNew,
  onSetFilter,
  onCreate,
  onCancelCreate,
  onSetNewNom,
  onSetNewType,
}: {
  selectedId: string | null
  exhibitions: ExhibitionsListItem[]
  filteredExhibitions: ExhibitionsListItem[]
  filter: 'all' | 'en_cours' | 'gagne' | 'termine'
  showNew: boolean
  creating: boolean
  newNom: string
  newType: string
  lang: 'fr' | 'en'
  onSelect: (id: string) => void
  onToggleNew: () => void
  onSetFilter: (next: 'all' | 'en_cours' | 'gagne' | 'termine') => void
  onCreate: (event: React.FormEvent<HTMLFormElement>) => void
  onCancelCreate: () => void
  onSetNewNom: (name: string) => void
  onSetNewType: (type: string) => void
}) {
  return (
    <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={onToggleNew} className="btn sm" style={{ flexShrink: 0 }}>+ Nouveau</button>
        <select
          value={filter}
          onChange={(e) => onSetFilter(e.target.value as 'all' | 'en_cours' | 'gagne' | 'termine')}
          style={{ ...inputSt, fontSize: 9, flex: 1, padding: '4px 6px' }}
        >
          <option value="all">Tous</option>
          {Object.entries(STATUT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {showNew && (
        <form onSubmit={onCreate} style={{ padding: '10px 12px', borderBottom: '1px solid var(--bd)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input name="nom" value={newNom} onChange={(e) => onSetNewNom(e.target.value)} placeholder="Nom de l'exposition…" style={inputSt} autoFocus />
          <select value={newType} onChange={(e) => onSetNewType(e.target.value)} style={inputSt}>
            <option value="exposition">{pipelineTypeLabel('exposition' as ProcessType, lang)}</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" disabled={creating} className="btn sm" style={{ flex: 1 }}>Créer</button>
            <button type="button" onClick={onCancelCreate} className="btn sm">Annuler</button>
          </div>
        </form>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredExhibitions.length === 0 ? (
          <div style={{ padding: '20px 14px', fontSize: 10, color: 'var(--tx3)', fontStyle: 'italic' }}>Aucune exposition.</div>
        ) : filteredExhibitions.map((ex) => {
          const done = ex.steps.filter((s) => s.statut === 'fait').length
          const total = ex.steps.length
          const pct = total > 0 ? Math.round((done / total) * 100) : 0
          const accentColor = STATUT_COLORS[ex.statut] ?? 'var(--bd)'
          return (
            <button key={ex.id} onClick={() => onSelect(ex.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px',
              background: selectedId === ex.id ? 'var(--bg2)' : 'transparent',
              border: 'none', borderBottom: '1px solid var(--bd)', cursor: 'pointer',
              borderLeft: selectedId === ex.id ? `3px solid ${accentColor}` : '3px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--tx)', fontWeight: selectedId === ex.id ? 500 : 400, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.nom}
                </div>
                <div style={{ fontSize: 8, color: accentColor, flexShrink: 0, letterSpacing: 0.5 }}>
                  {pct}%
                </div>
              </div>
              <div style={{ marginTop: 4, height: 2, background: 'var(--bg2)', borderRadius: 1 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: accentColor, borderRadius: 1 }} />
              </div>
              <div style={{ marginTop: 3, fontSize: 8, color: 'var(--tx3)' }}>
                {ex.type ?? 'exposition'}
                {ex.date_fin && <span> · {fmtDate(ex.date_fin)}</span>}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 12, fontSize: 9, color: 'var(--tx3)' }}>
        <span>{exhibitions.filter((e) => e.statut === 'en_cours').length} en cours</span>
        <span>{exhibitions.filter((e) => e.statut === 'gagne').length} gagnés</span>
        <span>{exhibitions.filter((e) => e.statut === 'termine').length} terminés</span>
      </div>
    </div>
  )
}
