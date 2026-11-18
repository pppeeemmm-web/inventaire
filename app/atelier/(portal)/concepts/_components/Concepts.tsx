'use client'

// Idées (was Concepts / « Recherche ») — R1: ideas and concepts are one kind. Each shows its weight
// (Petite / Recherche) and maturity (Graine · Pousse · Mûre); Pem (admin) sets both and edits ideas,
// the team reads them, discusses them (note_line lines) and proposes new ones (« Proposer une idée »).
// TODO(block-B-followup): concept_themes junction table — link concept.themes[] to OeuvreTheme ids for cross-tab filtering.

import { useState, useEffect, useCallback } from 'react'
import { fetchConcepts, fetchIdeaLines, type ConceptRow, type IdeaLine } from '@/app/atelier/(portal)/concepts/actions'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { CATEGORY_IDS, CATEGORY_KEYS, IDEA_MATURITIES, IDEA_WEIGHTS, STATUT_KEYS } from '@/components/atelier/concepts/concept-constants'
import { MATURITY_KEY, WEIGHT_KEY } from '@/components/atelier/concepts/IdeaMarks'
import { ProposeIdea } from '@/components/atelier/concepts/ProposeIdea'
import { inputSt } from '@/components/atelier/concepts/concept-form-styles'
import { NewConceptForm } from '@/components/atelier/concepts/NewConceptForm'
import { ConceptCard } from '@/components/atelier/concepts/ConceptCard'
import { LooseReminders } from '@/components/atelier/concepts/LooseReminders'
import { fetchConceptDocuments, type ConceptDocument } from '@/app/atelier/(portal)/concepts/document-actions'

const EMPTY_DOCS: ConceptDocument[] = []
const EMPTY_LINES: IdeaLine[] = []

export function Concepts({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [concepts,  setConcepts]  = useState<ConceptRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [filter,    setFilter]    = useState<string>('all')
  const [search,    setSearch]    = useState('')
  const [docsByConcept, setDocsByConcept] = useState<Map<string, ConceptDocument[]>>(() => new Map())
  const [linesByConcept, setLinesByConcept] = useState<Map<string, IdeaLine[]>>(() => new Map())

  const load = useCallback(async () => {
    setLoading(true)
    const [rows, docs, lines] = await Promise.all([fetchConcepts(), fetchConceptDocuments(), fetchIdeaLines()])
    setConcepts(rows)
    const byIdea = new Map<string, IdeaLine[]>()
    for (const l of lines) byIdea.set(l.conceptId, [...(byIdea.get(l.conceptId) ?? []), l])
    setLinesByConcept(byIdea)
    const byConcept = new Map<string, ConceptDocument[]>()
    for (const d of docs) {
      if (!d.concept_id) continue
      byConcept.set(d.concept_id, [...(byConcept.get(d.concept_id) ?? []), d])
    }
    setDocsByConcept(byConcept)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function handleCreated(c: ConceptRow) {
    setConcepts((prev) => [c, ...prev])
    setShowForm(false)
  }

  function handleUpdated(c: ConceptRow) {
    setConcepts((prev) => prev.map((x) => x.id === c.id ? c : x))
  }

  function handleLineAdded(line: IdeaLine) {
    setLinesByConcept((prev) => {
      const next = new Map(prev)
      next.set(line.conceptId, [...(prev.get(line.conceptId) ?? []), line])
      return next
    })
  }

  function handleDeleted(id: string) {
    setConcepts((prev) => prev.filter((x) => x.id !== id))
  }

  const visible = concepts.filter((c) => {
    if (filter !== 'all') {
      if (IDEA_WEIGHTS.includes(filter as (typeof IDEA_WEIGHTS)[number]) && c.weight !== filter) return false
      if (IDEA_MATURITIES.includes(filter as (typeof IDEA_MATURITIES)[number]) && c.maturity !== filter) return false
      const isStatus = STATUT_KEYS.includes(filter as (typeof STATUT_KEYS)[number])
      if (isStatus && c.statut !== filter) return false
      const isCategory = CATEGORY_IDS.includes(filter as (typeof CATEGORY_IDS)[number])
      if (isCategory && c.category !== filter) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        c.titre.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q) ||
        (c.themes ?? []).some((x) => x.toLowerCase().includes(q)) ||
        (c.medium ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const total     = concepts.length
  const active    = concepts.filter((c) => c.statut === 'exploration' || c.statut === 'en_cours').length
  const ripe      = concepts.filter((c) => c.maturity === 'mure').length
  const converted = concepts.filter((c) => c.statut === 'devenu_oeuvre').length

  const filterBtn = (value: string, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      style={{
        textAlign: 'left', padding: '6px 10px', fontSize: 11,
        background: filter === value ? 'var(--bg2)' : 'transparent',
        color: filter === value ? 'var(--tx)' : 'var(--tx3)',
        border: 'none', cursor: 'pointer',
        borderLeft: filter === value ? '2px solid var(--ac)' : '2px solid transparent',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )

  const sidebarInner = (
    <>
      <div className="t-eyebrow" style={{ marginBottom: 12 }}>{t('filters')}</div>
      {filterBtn('all', `${t('concept_filter_all')} (${total})`)}
      <div className="t-label" style={{ margin: '10px 0 4px' }}>{t('ideas_filter_weight')}</div>
      {IDEA_WEIGHTS.map((w) => filterBtn(w, t(WEIGHT_KEY[w])))}
      <div className="t-label" style={{ margin: '10px 0 4px' }}>{t('ideas_filter_maturity')}</div>
      {IDEA_MATURITIES.map((m) => filterBtn(m, t(MATURITY_KEY[m])))}
      <div style={{ margin: '12px 0 4px', borderTop: '1px solid var(--bd)' }} />
      {STATUT_KEYS.map((v) => filterBtn(v, t(`concept_status_${v}`)))}
      <div style={{ margin: '12px 0 4px', borderTop: '1px solid var(--bd)' }} />
      {CATEGORY_IDS.map((id) => filterBtn(id, t(CATEGORY_KEYS[id])))}
      <div style={{ borderTop: '1px solid var(--bd)', marginTop: 12, paddingTop: 12 }}>
        <div className="t-label" style={{ marginBottom: 8 }}>{t('concept_stat_heading')}</div>
        {[
          [t('concept_stat_total'), total],
          [t('concept_stat_active'), active],
          [t('ideas_stat_ripe'), ripe],
          [t('concept_stat_converted'), converted],
        ].map(([l, v]) => (
          <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--tx3)', marginBottom: 4 }}>
            <span>{l}</span>
            <span style={{ color: 'var(--tx)', fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>
    </>
  )

  return (
    <div
      data-testid="concepts-tab-root"
      role="tabpanel"
      aria-label={t('concept_tab_aria')}
      style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', height: '100%', minHeight: 0, flex: 1, minWidth: 0 }}
    >
      {narrow ? (
        <div
          aria-label={t('concept_filters_aria')}
          style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--bd)',
            padding: '10px max(12px, env(safe-area-inset-right)) 10px max(12px, env(safe-area-inset-left))',
            overflowX: 'auto',
            display: 'flex',
            gap: 6,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {filterBtn('all', `${t('concept_filter_all')} (${total})`)}
          {[
            ...IDEA_WEIGHTS.map((w) => [w, t(WEIGHT_KEY[w])] as const),
            ...IDEA_MATURITIES.map((m) => [m, t(MATURITY_KEY[m])] as const),
            ...STATUT_KEYS.map((v) => [v, t(`concept_status_${v}`)] as const),
            ...CATEGORY_IDS.map((id) => [id, t(CATEGORY_KEYS[id])] as const),
          ].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setFilter(v)}
              style={{
                padding: '8px 12px', fontSize: 10, flexShrink: 0, minHeight: 44,
                background: filter === v ? 'var(--bg2)' : 'var(--bg1)',
                border: '1px solid var(--bd)', color: filter === v ? 'var(--tx)' : 'var(--tx3)',
                borderRadius: 2, cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div style={{
          width: 200, flexShrink: 0, borderRight: '1px solid var(--bd)',
          padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4,
          overflowY: 'auto',
        }}>
          {sidebarInner}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div style={{
          borderBottom: '1px solid var(--bd)',
          padding: '12px max(12px, env(safe-area-inset-right)) 12px max(12px, env(safe-area-inset-left))',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap',
        }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('concept_search_ph')}
            style={{ ...inputSt, flex: 1, minWidth: 0, maxWidth: narrow ? '100%' : 280, padding: '8px 10px', minHeight: narrow ? 44 : undefined }}
          />
          <div style={{ flex: narrow ? undefined : 1, minWidth: narrow ? '100%' : 0 }} />
          {isAdmin && (
            <button type="button" className="btn sm" style={{ minHeight: 44, width: narrow ? '100%' : 'auto' }} onClick={() => setShowForm((x) => !x)}>
              {showForm ? t('concept_btn_close_new') : t('concept_btn_new')}
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px max(12px, env(safe-area-inset-right)) 20px max(12px, env(safe-area-inset-left))' }}>
          {!isAdmin && (
            <div data-testid="idea-team-entry" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ProposeIdea narrow={narrow} />
              <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ideas_team_hint')}</div>
            </div>
          )}
          {isAdmin ? <LooseReminders narrow={narrow} onIdea={(c) => setConcepts((prev) => [c, ...prev])} /> : null}
          {isAdmin && showForm && (
            <NewConceptForm
              narrow={narrow}
              onCreated={handleCreated}
              onCancel={() => setShowForm(false)}
            />
          )}

          {loading ? (
            <div style={{ color: 'var(--tx3)', fontSize: 11 }}>{t('concept_loading')}</div>
          ) : visible.length === 0 ? (
            <div style={{ color: 'var(--tx3)', fontSize: 11, textAlign: 'center', marginTop: 40 }}>
              {search || filter !== 'all' ? t('concept_empty_filtered') : t('concept_empty_none')}
            </div>
          ) : (
            visible.map((c) => (
              <ConceptCard
                key={c.id}
                concept={c}
                documents={docsByConcept.get(c.id) ?? EMPTY_DOCS}
                lines={linesByConcept.get(c.id) ?? EMPTY_LINES}
                isAdmin={isAdmin}
                narrow={narrow}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
                onLineAdded={handleLineAdded}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
