'use client'

// Concepts — ideas before works: energy, medium, themes, optional sketch upload (R2 AVIF).
// TODO(block-B-followup): concept_themes junction table — link concept.themes[] to OeuvreTheme ids for cross-tab filtering.

import { useState, useEffect, useCallback } from 'react'
import { fetchConcepts, type ConceptRow } from '@/app/atelier/concepts/actions'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { CATEGORY_IDS, CATEGORY_KEYS, STATUT_KEYS } from '@/components/atelier/concepts/concept-constants'
import { inputSt } from '@/components/atelier/concepts/concept-form-styles'
import { NewConceptForm } from '@/components/atelier/concepts/NewConceptForm'
import { ConceptCard } from '@/components/atelier/concepts/ConceptCard'

export function Concepts() {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const [concepts,  setConcepts]  = useState<ConceptRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [filter,    setFilter]    = useState<string>('all')
  const [search,    setSearch]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await fetchConcepts()
    setConcepts(rows)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function handleCreated(c: ConceptRow) {
    setConcepts((prev) => [c, ...prev])
    setShowForm(false)
  }

  function handleUpdated(c: ConceptRow) {
    setConcepts((prev) => prev.map((x) => x.id === c.id ? c : x)
      .sort((a, b) => {
        const ea = a.energie ?? 0; const eb = b.energie ?? 0
        if (eb !== ea) return eb - ea
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      }),
    )
  }

  function handleDeleted(id: string) {
    setConcepts((prev) => prev.filter((x) => x.id !== id))
  }

  const visible = concepts.filter((c) => {
    if (filter !== 'all') {
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
  const burning   = concepts.filter((c) => (c.energie ?? 0) >= 4).length
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
      {STATUT_KEYS.map((v) => filterBtn(v, t(`concept_status_${v}`)))}
      <div style={{ margin: '12px 0 4px', borderTop: '1px solid var(--bd)' }} />
      {CATEGORY_IDS.map((id) => filterBtn(id, t(CATEGORY_KEYS[id])))}
      <div style={{ borderTop: '1px solid var(--bd)', marginTop: 12, paddingTop: 12 }}>
        <div className="t-label" style={{ marginBottom: 8 }}>{t('concept_stat_heading')}</div>
        {[
          [t('concept_stat_total'), total],
          [t('concept_stat_active'), active],
          [t('concept_stat_burning'), burning],
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
      style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', height: '100%', minHeight: 0 }}
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
          {STATUT_KEYS.map((v) => (
            <button key={v} type="button" onClick={() => setFilter(v)}
              style={{
                padding: '8px 12px', fontSize: 10, flexShrink: 0,
                background: filter === v ? 'var(--bg2)' : 'var(--bg1)',
                border: '1px solid var(--bd)', color: filter === v ? 'var(--tx)' : 'var(--tx3)',
                borderRadius: 2, cursor: 'pointer',
              }}>
              {t(`concept_status_${v}`)}
            </button>
          ))}
          {CATEGORY_IDS.map((id) => (
            <button key={id} type="button" onClick={() => setFilter(id)}
              style={{
                padding: '8px 12px', fontSize: 10, flexShrink: 0,
                background: filter === id ? 'var(--bg2)' : 'var(--bg1)',
                border: '1px solid var(--bd)', color: filter === id ? 'var(--tx)' : 'var(--tx3)',
                borderRadius: 2, cursor: 'pointer',
              }}>
              {t(CATEGORY_KEYS[id])}
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
            style={{ ...inputSt, flex: 1, minWidth: 0, maxWidth: narrow ? '100%' : 280, padding: '8px 10px' }}
          />
          <div style={{ flex: narrow ? undefined : 1, minWidth: narrow ? '100%' : 0 }} />
          <button type="button" className="btn sm" style={{ minHeight: 44, width: narrow ? '100%' : 'auto' }} onClick={() => setShowForm((x) => !x)}>
            {showForm ? t('concept_btn_close_new') : t('concept_btn_new')}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px max(12px, env(safe-area-inset-right)) 20px max(12px, env(safe-area-inset-left))' }}>
          {showForm && (
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
                narrow={narrow}
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
