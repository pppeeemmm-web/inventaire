'use client'

// InventoryTab — filter bar + three views: list (table+preview), grid, graph placeholder.
// Mirrors source/team/inventory.jsx.

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf, statusOf, stageColor, type StatusKey } from '@/lib/data'
import { StatusChip } from '@/components/ui/StatusChip'
import type { Oeuvre } from '@/lib/types/database'

// ── Types ───────────────────────────────────────────────────────────

// PEM's own ContactID — default owner when ContactID FIS null
const PEM_CONTACT_ID = 13

// ── Advanced filter ─────────────────────────────────────────────────
interface Criterion { id: number; field: string; op: string; value: string; value2?: string }

// ── Field Labels Mapping ──
const FIELD_LABELS: Record<string, string> = {
  OeuvreID:        'ID',
  Titre:           'Titre',
  Technique:       'Technique',
  Support:         'Support',
  _theme:          'Thème',
  _group:          'Groupe',
  Année:           'Année',
  DateCreation:    'Date création',
  Prix:            'Prix',
  PrixFinal:       'Prix final',
  Discount:        'Remise (%)',
  Exposable:       'Exposable',
  Catalogué:       'Cataloguée',
  Encadree:        'Encadrée',
  Tirage:          'Tirage',
  Hauteur:         'Hauteur (cm)',
  Largeur:         'Largeur (cm)',
  Profondeur:      'Profondeur (cm)',
  Poids:           'Poids (kg)',
  PresentationID:  'Présentation',
  Commentaires:    'Notes',
  NeedsPhotograph: 'À photographier',
  StageProduction: 'Stade production',
  statusId:        'Statut',
  ContactID:       'Contact',
  LocalisationID:  'Localisation',
  AcheteurID:      'Acheteur',
  ReturnDate:      'Date retour',
  anonymity_level: 'Anonymat',
  txtImageNameLink: 'Image',
  IsCommission:    'Commission',
  DateLivraison:   'Deadline',
  Historique:      'Historique',
}

interface FieldDef { k: string; l: string; t: 'num' | 'text' | 'bool' | 'lookup' | 'year' }

function getFieldType(k: string, sampleValue: any): FieldDef['t'] {
  if (k === 'Année') return 'year'
  if (k.toLowerCase().includes('status') || k.toLowerCase().includes('id')) return 'lookup'
  if (typeof sampleValue === 'number') return 'num'
  if (typeof sampleValue === 'boolean') return 'bool'
  return 'text'
}

const OPS_TEXT   = ['contient', 'ne contient pas', '=', '≠', 'est vide', "n'est pas vide"] as const
const OPS_NUM    = ['=', '≠', '>', '<', '≥', '≤', 'est vide', "n'est pas vide"] as const
const OPS_BOOL   = ['= vrai', '= faux'] as const
const OPS_LOOKUP = ['=', '≠', 'est vide', "n'est pas vide"] as const
const OPS_YEAR   = ['=', '>', '<', '≥', '≤', 'between'] as const

function opsForType(t: string): readonly string[] {
  if (t === 'year')   return OPS_YEAR
  if (t === 'num')    return OPS_NUM
  if (t === 'bool')   return OPS_BOOL
  if (t === 'lookup') return OPS_LOOKUP
  return OPS_TEXT
}

function extractYear(s: unknown): number {
  if (s == null) return NaN
  const m = String(s).match(/^(\d{4})/)
  return m ? parseInt(m[1]) : NaN
}

function matchesCriterion(o: Oeuvre, c: Criterion, allFields: FieldDef[]): boolean {
  const fld = allFields.find((f) => f.k === c.field)
  if (!fld) return true
  
  // Special handling for photography flags (legacy mapping)
  if (c.field === 'photograph' || c.field === 'NeedsPhotograph' || c.field === 'needsphotograph') {
    const val = !!((o as any).NeedsPhotograph || (o as any).needsphotograph)
    return c.op === '= vrai' ? val : !val
  }

  const raw = (o as Record<string, unknown>)[c.field]
  const val = raw != null ? String(raw) : ''
  const cv  = c.value ?? ''

  // 1. Boolean types
  if (fld.t === 'bool') {
    const bVal = !!raw
    return c.op === '= vrai' ? bVal : !bVal
  }

  // 2. Empty / Not Empty (all types)
  if (c.op === 'est vide')       return raw == null || raw === ''
  if (c.op === "n'est pas vide") return raw != null && raw !== ''

  // 3. Numeric & Year types
  if (fld.t === 'num' || fld.t === 'year') {
    const n  = fld.t === 'year' ? extractYear(raw) : Number(raw)
    const v1 = Number(cv)
    const v2 = Number(c.value2 ?? cv)

    if (c.op === 'between') {
      return !isNaN(n) && n >= Math.min(v1, v2) && n <= Math.max(v1, v2)
    }
    
    if (['=', '>', '<', '≥', '≤', '≠'].includes(c.op)) {
      if (isNaN(n)) return false
      switch (c.op) {
        case '=': return n === v1
        case '≠': return n !== v1
        case '>': return n > v1
        case '<': return n < v1
        case '≥': return n >= v1
        case '≤': return n <= v1
      }
    }
  }

  // 4. Text & Fallback
  switch (c.op) {
    case 'contient':          return val.toLowerCase().includes(cv.toLowerCase())
    case 'ne contient pas':   return !val.toLowerCase().includes(cv.toLowerCase())
    case '=':                 return val === cv
    case '≠':                 return val !== cv
    default:                  return true
  }
}

function parseIdRanges(input: string): Set<number> {
  const ids = new Set<number>()
  // Split by comma, space, or newline
  const parts = input.split(/[,\s\n]+/)
  parts.forEach((p) => {
    const clean = p.trim().replace(/^#/, '')
    if (!clean) return
    
    // Range: 100-105
    const range = clean.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const a = parseInt(range[1]), b = parseInt(range[2])
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) ids.add(i)
    } else if (/^\d+$/.test(clean)) {
      ids.add(parseInt(clean))
    }
  })
  return ids
}

interface SharedProps {
  oeuvres:        Oeuvre[]
  tM:             Record<number, string>
  sM:             Record<number, string>
  cM:             Record<number, string>
  pM:             Record<number, string>   // presentation map
  locMap:         Record<number, string>   // ContactID → "Ville, Pays"
  statusLabelMap: Record<number, string>
  selection:      Set<number>
  setSelection:   (s: Set<number>) => void
  onOpen:         (o: Oeuvre) => void
}

type View = 'list' | 'grid' | 'graph'

// ── Main component ──────────────────────────────────────────────────

export function InventoryTab({
  oeuvres, tM, sM, cM, pM, locMap, statusLabelMap,
  techniques, supports, formats = [], themes = [], groups = [],
  selection, setSelection, onOpen,
}: SharedProps & {
  techniques: { TechniqueID: number; Technique: string | null }[]
  supports:   { SupportID:   number; Support:   string | null }[]
  formats?:   { FormatID:    number; Format:    string | null }[]
  themes?:    { ThemeID: number; Nom: string }[]
  groups?:    { id: string; name: string }[]
}) {
  const { t } = useI18n()

  const [q,           setQ]           = useState('')
  const [tech,        setTech]        = useState('all')
  const [support,     setSupport]     = useState('all')
  const [status,      setStatus]      = useState('all')
  const [view,        setView]        = useState<View>('list')
  const [focused,     setFocused]     = useState<Oeuvre | null>(null)
  const [criteria,    setCriteria]    = useState<Criterion[]>([])
  const [showAdv,     setShowAdv]     = useState(false)
  const [showLegend,  setShowLegend]  = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [loadingGrp,  setLoadingGrp]  = useState<string | null>(null)
  const [filterTheme, setFilterTheme] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')
  const nextCritId = useRef(0)

  const allFields: FieldDef[] = useMemo(() => {
    if (oeuvres.length === 0) return []
    const sample = oeuvres[0]
    const keys = Object.keys(sample)
    
    // Curated order for known fields
    const labelKeys = Object.keys(FIELD_LABELS)
    const sorted = keys.sort((a, b) => {
      const ia = labelKeys.indexOf(a)
      const ib = labelKeys.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return a.localeCompare(b)
    })

    const fields = sorted
      .filter(k => ![
        'txtImageNameLink', 
        'theme', // themes are handled separately via _theme virtual field
        'is_public' // deprecated by anonymity_level
      ].includes(k))
      .map(k => ({
        k,
        l: FIELD_LABELS[k] || k,
        t: getFieldType(k, (sample as any)[k])
      }))

    // Add virtual curation fields for advanced filter
    fields.push({ k: '_theme', l: 'Thème',  t: 'lookup' })
    fields.push({ k: '_group', l: 'Groupe', t: 'lookup' })

    return fields
  }, [oeuvres])

  const handleLoadGroup = useCallback(async (id: string, mode: 'select' | 'filter' = 'select') => {
    setLoadingGrp(id)
    const sb = createClient()
    const { data } = await (sb.from('working_group_work') as any)
      .select('oeuvre_id')
      .eq('group_id', id)
    
    if (data) {
      if (mode === 'select') {
        setSelection(new Set((data as { oeuvre_id: number }[]).map((r) => r.oeuvre_id)))
      } else {
        setFilterGroup(id)
      }
    }
    setShowGroups(false)
    setLoadingGrp(null)
  }, [setSelection])

  // OeuvreTheme junction: Map<OeuvreID, ThemeID[]>
  const [oeuvreThemeMap, setOeuvreThemeMap] = useState<Map<number, number[]>>(new Map())
  const [oeuvreGroupMap, setOeuvreGroupMap] = useState<Map<number, string[]>>(new Map())

  useEffect(() => {
    const sb = createClient()
    // Fetch Themes
    ;(sb.from('OeuvreTheme') as any).select('OeuvreID, ThemeID').range(0, 10000).then(({ data }: { data: { OeuvreID: number; ThemeID: number }[] | null }) => {
      if (!data) return
      const map = new Map<number, number[]>()
      data.forEach(({ OeuvreID, ThemeID }) => {
        if (!map.has(OeuvreID)) map.set(OeuvreID, [])
        map.get(OeuvreID)!.push(ThemeID)
      })
      setOeuvreThemeMap(map)
    })
    // Fetch Groups
    ;(sb.from('working_group_work') as any).select('oeuvre_id, group_id').range(0, 10000).then(({ data }: { data: { oeuvre_id: number; group_id: string }[] | null }) => {
      if (!data) return
      const map = new Map<number, string[]>()
      data.forEach(({ oeuvre_id, group_id }) => {
        if (!map.has(oeuvre_id)) map.set(oeuvre_id, [])
        map.get(oeuvre_id)!.push(group_id)
      })
      setOeuvreGroupMap(map)
    })
  }, [])

  const sortedThemes = useMemo(() => [...themes].sort((a, b) => a.Nom.localeCompare(b.Nom, 'fr')), [themes])
  const thM = useMemo(
    () => Object.fromEntries(themes.map((t) => [t.ThemeID, t.Nom])),
    [themes],
  )

  const fM = useMemo(
    () => Object.fromEntries(formats.map((f) => [f.FormatID, f.Format ?? ''])),
    [formats],
  )

  const groupNameMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.name])),
    [groups],
  )

  useEffect(() => {
    const saved = localStorage.getItem('pem_inv_view') as View | null
    if (saved) setView(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('pem_inv_view', view)
  }, [view])

  const filtered = useMemo(() => {
    const trimmedQ = q.trim()
    const sq = trimmedQ.toLowerCase()
    
    // Support for "#ID, ID-ID" filtering
    let idSet: Set<number> | null = null
    if (trimmedQ.startsWith('#') && trimmedQ.length > 1) {
      idSet = parseIdRanges(trimmedQ)
    }

    return oeuvres.filter((o) => {
      if (idSet) {
        if (!idSet.has(o.OeuvreID)) return false
      } else if (sq) {
        const themeNames = (oeuvreThemeMap.get(o.OeuvreID) ?? []).map(tid => thM[tid] ?? '').join(' ')
        const groupNames = (oeuvreGroupMap.get(o.OeuvreID) ?? []).map(gid => groupNameMap[gid] ?? '').join(' ')
        const bag = `${o.Titre ?? ''} #${o.OeuvreID} ${o.Technique != null ? (tM[o.Technique] ?? '') : ''} ${o.Support != null ? (sM[o.Support] ?? '') : ''} ${themeNames} ${groupNames}`.toLowerCase()
        if (!bag.includes(sq)) return false
      }
      if (tech !== 'all' && String(o.Technique ?? '') !== tech) return false
      if (support !== 'all' && String(o.Support ?? '') !== support) return false
      if (status !== 'all' && statusOf(o, statusLabelMap) !== status) return false
      
      // Theme filter
      if (filterTheme !== 'all') {
        const tids = oeuvreThemeMap.get(o.OeuvreID) ?? []
        if (!tids.includes(Number(filterTheme))) return false
      }

      // Group filter
      if (filterGroup !== 'all') {
        const gids = oeuvreGroupMap.get(o.OeuvreID) ?? []
        if (!gids.includes(filterGroup)) return false
      }

      if (!criteria.every((c) => {
        // Special handling for theme (many-to-many via OeuvreTheme)
        if (c.field === '_theme') {
          const themeIds = oeuvreThemeMap.get(o.OeuvreID) ?? []
          if (c.op === "n'est pas vide") return themeIds.length > 0
          if (c.op === 'est vide')       return themeIds.length === 0
          const tid = parseInt(c.value)
          if (isNaN(tid)) return true
          if (c.op === '=') return themeIds.includes(tid)
          if (c.op === '≠') return !themeIds.includes(tid)
          return true
        }
        // Special handling for group
        if (c.field === '_group') {
          const groupIds = oeuvreGroupMap.get(o.OeuvreID) ?? []
          if (c.op === "n'est pas vide") return groupIds.length > 0
          if (c.op === 'est vide')       return groupIds.length === 0
          const gid = c.value
          if (!gid) return true
          if (c.op === '=') return groupIds.includes(gid)
          if (c.op === '≠') return !groupIds.includes(gid)
          return true
        }
        return matchesCriterion(o, c, allFields)
      })) return false
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oeuvres, q, tech, support, status, filterTheme, filterGroup, tM, sM, statusLabelMap, criteria, oeuvreThemeMap, oeuvreGroupMap, allFields])

  const activeStages = useMemo(() => {
    const present = new Set(oeuvres.map(o => (o as any).StageProduction).filter(Boolean))
    return [
      { k: 'idea',      l: t('stage_idea'),       c: 'var(--ac)' },
      { k: 'wip',       l: t('stage_wip'),        c: 'var(--rust)' },
      { k: 'drying',    l: t('stage_drying'),     c: 'var(--dust)' },
      { k: 'mounting',  l: t('stage_mounting'),   c: 'var(--dust)' },
      { k: 'framing',   l: t('stage_framing'),    c: 'var(--dust)' },
      { k: 'shot',      l: t('stage_shot'),       c: 'var(--cyan)' },
      { k: 'catalogued',l: t('stage_catalogued'), c: 'var(--sage)' },
    ].filter(s => present.has(s.k))
  }, [oeuvres, t])

  // Keep focused in sync with filtered results
  useEffect(() => {
    if (!focused || !filtered.find((o) => o.OeuvreID === focused.OeuvreID)) {
      setFocused(filtered[0] ?? null)
    }
  }, [filtered]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleInSel(oid: number) {
    const next = new Set(selection)
    if (next.has(oid)) next.delete(oid)
    else next.add(oid)
    setSelection(next)
  }

  // passed to InvList for range selection

  const statusOptions: [string, string][] = [
    ['all', 'Tous'],
    ['studio',    'Atelier'],
    ['consigned', 'Dépôt (Galerie)'],
    ['loan',      'Prêt (Institution)'],
    ['sold',      'Vendu'],
    ['wip',       'En cours'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: '12px 28px',
        borderBottom: '1px solid var(--bd)',
        alignItems: 'center',
        background: 'var(--bg1)',
      }}>
        {/* Count */}
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap', marginRight: 8 }}>
          {filtered.length}<span style={{ opacity: 0.5 }}>/{oeuvres.length}</span>
        </div>

        {/* Search */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${t('search')} (ex: #1-10, 20...)`}
          style={{
            flex: 1,
            minWidth: 200,
            padding: '10px 14px',
            background: 'var(--bg2)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            fontSize: 13,
          }}
        />

        {/* Theme */}
        <InvSelect
          value={filterTheme} onChange={setFilterTheme}
          label={t('theme')}
          options={[['all', 'Tous les thèmes'], ...sortedThemes.map((x) => [String(x.ThemeID), x.Nom] as [string, string])]}
        />

        {/* Group */}
        <InvSelect
          value={filterGroup} onChange={setFilterGroup}
          label="Groupe"
          options={[['all', 'Tous les groupes'], ...groups.map((x) => [x.id, x.name] as [string, string])]}
        />

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--bd)' }}>
          {([['list', '≡', t('listView')], ['grid', '▦', t('gridView')]] as const).map(([k, glyph, title]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              title={title}
              style={{
                padding: '6px 10px', fontSize: 12,
                color: view === k ? 'var(--ac)' : 'var(--tx3)',
                background: view === k ? 'var(--bg2)' : 'transparent',
                borderRight: k === 'list' ? '1px solid var(--bd)' : 'none',
              }}
            >{glyph}</button>
          ))}
        </div>

        {/* Advanced filter toggle */}
        <button
          onClick={() => setShowAdv((v) => !v)}
          style={{
            padding: '7px 10px', fontSize: 11,
            color: (showAdv || criteria.length > 0) ? 'var(--bg0)' : 'var(--tx3)',
            background: (showAdv || criteria.length > 0) ? 'var(--ac)' : 'transparent',
            border: '1px solid var(--bd)',
            cursor: 'pointer',
            boxShadow: criteria.length > 0 ? '0 0 10px rgba(200,168,110,0.3)' : 'none',
          }}
        >
          {criteria.length > 0 ? `✓ ${t('filters')} (${criteria.length})` : `${t('filters')} +`}
        </button>

        {/* Select all filtered */}
        <button
          onClick={() => {
            const next = new Set(selection)
            filtered.forEach(o => next.add(o.OeuvreID))
            setSelection(next)
          }}
          className="btn sm"
          style={{ 
            fontSize: 9, padding: '6px 12px', 
            border: '1px solid var(--bd)',
            background: filtered.length > 0 ? 'var(--bg2)' : 'transparent',
            color: filtered.length > 0 ? 'var(--ac)' : 'var(--tx3)',
            cursor: 'pointer',
          }}
          title="Sélectionner tous les résultats affichés"
        >
          {t('selectAll')} ({filtered.length})
        </button>

        {/* Clear filters */}
        {(q || tech !== 'all' || support !== 'all' || status !== 'all' || filterTheme !== 'all' || filterGroup !== 'all' || criteria.length > 0) && (
          <button
            onClick={() => {
              setQ('')
              setTech('all')
              setSupport('all')
              setStatus('all')
              setFilterTheme('all')
              setFilterGroup('all')
              setCriteria([])
            }}
            className="btn ghost sm"
            style={{ fontSize: 9, padding: '4px 8px', color: 'var(--rust)' }}
          >
            {t('clear')}
          </button>
        )}

        {/* Legend toggle */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLegend((v) => !v)}
            title="Légende des couleurs"
            style={{
              padding: '7px 12px', fontSize: 10, letterSpacing: 1,
              color: showLegend ? 'var(--ac)' : 'var(--tx3)',
              background: showLegend ? 'var(--bg2)' : 'transparent',
              border: '1px solid var(--bd)',
              cursor: 'pointer',
            }}
          >
            {t('legend')}
          </button>
          {showLegend && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 60,
              background: 'var(--bg2)', border: '1px solid var(--bd2)',
              padding: '12px 16px', minWidth: 160, marginTop: 4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div className="t-eyebrow" style={{ marginBottom: 10, fontSize: 8 }}>{t('legend')}</div>
              {activeStages.length === 0 && <div style={{ fontSize: 9, opacity: 0.5 }}>Aucune œuvre en production</div>}
              {activeStages.map((it, i) => (
                <div key={i} className="row gap-sm" style={{ marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: it.c }} />
                  <div className="t-mono-sm" style={{ fontSize: 9 }}>{it.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Preview toggle */}
        <button
          onClick={() => setShowPreview((v) => !v)}
          style={{
            padding: '7px 12px', fontSize: 11,
            color: showPreview ? 'var(--ac)' : 'var(--tx3)',
            background: showPreview ? 'var(--bg2)' : 'transparent',
            border: '1px solid var(--bd)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Afficher/masquer l'aperçu latéral"
        >
          {showPreview ? 'Aperçu ◀' : 'Aperçu ▶'}
        </button>


        {/* Selection count */}
        <div className="t-mono-sm" style={{ color: selection.size > 0 ? 'var(--ac)' : 'var(--tx3)', minWidth: 60, textAlign: 'right' }}>
          {selection.size > 0 ? `${selection.size} ${t('selected')}` : ''}
        </div>
      </div>

      {/* Advanced filter panel */}
      {showAdv && (
        <CriteriaPanel
          criteria={criteria} setCriteria={setCriteria}
          nextCritId={nextCritId}
          setQ={setQ}
          tM={tM} sM={sM} cM={cM} thM={thM} pM={pM} statusLabelMap={statusLabelMap}
          groups={groups}
          allFields={allFields}
        />
      )}

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {view === 'list' && (
          <>
            <InvList
              rows={filtered} tM={tM} sM={sM} cM={cM} locMap={locMap} statusLabelMap={statusLabelMap}
              focused={focused} setFocused={setFocused}
              selection={selection} setSelection={setSelection}
              onImageDoubleClick={() => { setShowPreview(true); setPreviewExpanded(true) }}
            />
            {showPreview && (
              <InvPreview
                o={focused} tM={tM} sM={sM} cM={cM} pM={pM} fM={fM} locMap={locMap} statusLabelMap={statusLabelMap}
                thM={thM} oeuvreThemeMap={oeuvreThemeMap} oeuvreGroupMap={oeuvreGroupMap}
                groupNameMap={groupNameMap}
                selection={selection} toggleInSel={toggleInSel}
                onOpen={setFocused}
                onClose={() => setShowPreview(false)}
                expanded={previewExpanded}
                setExpanded={setPreviewExpanded}
              />
            )}
          </>
        )}
        {view === 'grid' && (
          <InvGrid
            rows={filtered} tM={tM} statusLabelMap={statusLabelMap}
            selection={selection} toggleInSel={toggleInSel}
            onOpen={onOpen}
          />
        )}
        {view === 'graph' && (
          <div style={{ flex: 1, padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 8, textAlign: 'center' }}>
              {filtered.length} œuvres · vue constellation
            </div>
            <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>
              Constellation — implémentation à venir
            </div>
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', marginTop: 8 }}>
              {t('clickToSelect')} · shift pour ajouter · lasso pour tracer une région
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── CriteriaPanel ───────────────────────────────────────────────────

function CriteriaPanel({
  criteria, setCriteria, nextCritId,
  setQ,
  tM, sM, cM, thM, pM, statusLabelMap, groups, allFields
}: {
  criteria:       Criterion[]
  setCriteria:    (c: Criterion[]) => void
  nextCritId:     React.MutableRefObject<number>
  setQ:           (q: string) => void
  tM:             Record<number, string>
  sM:             Record<number, string>
  cM:             Record<number, string>
  pM:             Record<number, string>
  thM:            Record<number, string>
  statusLabelMap: Record<number, string>
  groups:         { id: string; name: string }[]
  allFields:      FieldDef[]
}) {
  const { t } = useI18n()
  const FIS: React.CSSProperties = {
    fontFamily: 'inherit', fontSize: 10,
    background: 'var(--bg1)', border: '1px solid var(--bd)',
    color: 'var(--tx)', padding: '3px 6px', outline: 'none',
  }

  function lookupOpts(field: string): [string, string][] {
    const maps: Record<string, Record<string | number, string>> = {
      Technique:       tM,
      Support:         sM,
      _theme:          thM,
      _group:          Object.fromEntries(groups.map(g => [g.id, g.name])),
      statusId:        statusLabelMap,
      ContactID:       cM,
      LocalisationID:  cM,
      AcheteurID:      cM,
      PresentationID:  pM,
      StageProduction: { 'idea': 'Idée', 'wip': 'En cours', 'drying': 'Séchage', 'mounting': 'À monter', 'framing': 'À encadrer', 'shot': 'À photographier', 'catalogued': 'À cataloguer' },
      anonymity_level: { '0': 'Public', '1': 'Anonyme', '2': 'Privé' }
    }
    const map = maps[field]
    if (map) {
      return Object.entries(map)
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
        .map(([k, v]) => [k, v])
    }
    return []
  }

  function addCriterion() {
    const id = nextCritId.current++
    setCriteria([...criteria, { id, field: allFields[0].k, op: 'contient', value: '' }])
  }

  function updateCriterion(id: number, patch: Partial<Criterion>) {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function removeCriterion(id: number) {
    setCriteria(criteria.filter((c) => c.id !== id))
  }

  const noValue = (op: string) => op === 'est vide' || op === "n'est pas vide"

  return (
    <div style={{
      borderBottom: '1px solid var(--bd)',
      padding: '8px 28px 10px',
      background: 'var(--bg0)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>

      {/* Criteria rows */}
      {criteria.map((c) => {
        const fld  = allFields.find((f) => f.k === c.field) ?? allFields[0]
        const ops  = opsForType(fld.t)
        const opts = lookupOpts(c.field)
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Field */}
            <select
              value={c.field}
              onChange={(e) => {
                const newFld = allFields.find((f) => f.k === e.target.value) ?? allFields[0]
                updateCriterion(c.id, { field: e.target.value, op: opsForType(newFld.t)[0], value: '' })
              }}
              style={{ ...FIS, maxWidth: 130 }}
            >
              {allFields.map((f) => (
                <option key={f.k} value={f.k}>{FIELD_LABELS[f.k] || f.l}</option>
              ))}
            </select>

            {/* Operator */}
            <select
              value={c.op}
              onChange={(e) => updateCriterion(c.id, { op: e.target.value })}
              style={{ ...FIS, maxWidth: 150 }}
            >
              {ops.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>

            {/* Value — hidden for bool and empty/notEmpty ops */}
            {fld.t !== 'bool' && !noValue(c.op) && (
              opts.length > 0 ? (
                <select
                  value={c.value}
                  onChange={(e) => updateCriterion(c.id, { value: e.target.value })}
                  style={{ ...FIS, maxWidth: 180 }}
                >
                  <option value="">—</option>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : c.op === 'between' ? (
                <>
                  <input
                    type="number"
                    value={c.value}
                    onChange={(e) => updateCriterion(c.id, { value: e.target.value })}
                    placeholder="from"
                    style={{ ...FIS, width: 72 }}
                  />
                  <span className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '0 4px' }}>≤ x ≤</span>
                  <input
                    type="number"
                    value={c.value2 ?? ''}
                    onChange={(e) => updateCriterion(c.id, { value2: e.target.value })}
                    placeholder="to"
                    style={{ ...FIS, width: 72 }}
                  />
                </>
              ) : (
                <input
                  type={fld.t === 'num' || fld.t === 'year' ? 'number' : 'text'}
                  value={c.value}
                  onChange={(e) => updateCriterion(c.id, { value: e.target.value })}
                  placeholder={fld.t === 'year' ? '2020' : ''}
                  style={{ ...FIS, width: 100 }}
                />
              )
            )}

            {/* Remove */}
            <button
              onClick={() => removeCriterion(c.id)}
              style={{ ...FIS, cursor: 'pointer', color: 'var(--tx3)' }}
            >✕</button>
          </div>
        )
      })}

      {/* Add criterion */}
      <button
        onClick={addCriterion}
        style={{ ...FIS, cursor: 'pointer', color: 'var(--ac)', border: '1px dashed var(--bd)', alignSelf: 'flex-start', padding: '3px 12px' }}
      >
        + filter
      </button>
    </div>
  )
}

// ── InvSelect ───────────────────────────────────────────────────────

function InvSelect({
  value, onChange, label, options,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  options: [string, string][]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '7px 10px',
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        color: 'var(--tx)',
        fontSize: 11,
      }}
    >
      {options.map(([v, lb]) => (
        <option key={v} value={v}>{v === 'all' ? lb : `${label}: ${lb}`}</option>
      ))}
    </select>
  )
}

// ── InvList ─────────────────────────────────────────────────────────

function InvList({
  rows, tM, sM, cM, locMap, statusLabelMap, focused, setFocused, selection, setSelection, onImageDoubleClick, publicMode,
}: {
  rows:           Oeuvre[]
  tM:             Record<number, string>
  sM:             Record<number, string>
  cM:             Record<number, string>
  locMap:         Record<number, string>
  statusLabelMap: Record<number, string>
  focused:        Oeuvre | null
  setFocused:     (o: Oeuvre) => void
  selection:      Set<number>
  setSelection:   (s: Set<number>) => void
  onImageDoubleClick: () => void
  publicMode?:    boolean
}) {
  const { t } = useI18n()
  const lastSelIdxRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const visible = rows

  // Restore scroll position on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('pem_inv_scroll')
    if (saved && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(saved)
    }
  }, [])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    sessionStorage.setItem('pem_inv_scroll', String(e.currentTarget.scrollTop))
  }

  function handleCheck(e: React.MouseEvent, oid: number, idx: number) {
    e.stopPropagation()
    const next = new Set(selection)
    if (e.shiftKey && lastSelIdxRef.current !== null) {
      // Range select: add all items between last and current (inclusive)
      const lo = Math.min(lastSelIdxRef.current, idx)
      const hi = Math.max(lastSelIdxRef.current, idx)
      visible.slice(lo, hi + 1).forEach((r) => next.add(r.OeuvreID))
      setSelection(next)
    } else {
      if (next.has(oid)) { next.delete(oid) } else { next.add(oid) }
      setSelection(next)
      lastSelIdxRef.current = idx
    }
  }

  const router = useRouter()

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{ flex: 1, minWidth: 0, overflow: 'auto', borderRight: '1px solid var(--bd)' }}
    >
      <table className="tbl" style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr style={{ height: 32 }}>
            <th style={{ width: 42, padding: '0 8px' }}>
              <div style={{
                width: 14, height: 14, margin: '0 auto',
                border: `1.5px solid ${visible.length > 0 && visible.every(o => selection.has(o.OeuvreID)) ? 'var(--ac)' : 'var(--bd2)'}`,
                background: visible.length > 0 && visible.every(o => selection.has(o.OeuvreID)) ? 'var(--ac)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: 'var(--bg0)', cursor: 'pointer',
              }} onClick={() => {
                const allSel = visible.every(o => selection.has(o.OeuvreID))
                const next = new Set(selection)
                if (allSel) {
                  visible.forEach(o => next.delete(o.OeuvreID))
                } else {
                  visible.forEach(o => next.add(o.OeuvreID))
                }
                setSelection(next)
              }}>
                {visible.length > 0 && visible.every(o => selection.has(o.OeuvreID)) ? '✓' : ''}
              </div>
            </th>
            <th style={{ width: 28, padding: '0 2px' }}></th>
            <th style={{ width: 32, color: 'var(--tx3)', fontSize: 7, padding: '0 2px' }}>ID</th>
            <th style={{ width: 44, padding: '0 4px' }}></th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 'auto' }}>{t('title')}</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 120 }}>{t('technique')}</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 120 }}>{t('support')}</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 90 }}>Dims</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 60 }}>Année</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 100 }}>Prix</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 140 }}>Contact</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 160 }}>Localisation</th>
            <th style={{ textAlign: 'left', padding: '0 6px', fontSize: 10, width: 100 }}>{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((o, idx) => {
            const isSel = selection.has(o.OeuvreID)
            const isFoc = focused?.OeuvreID === o.OeuvreID
            const st    = statusOf(o, statusLabelMap)
            const dims  = o.Hauteur && o.Largeur ? `${o.Hauteur}×${o.Largeur}` : '—'
            const isGoneRow = st === 'sold' || st === 'gift'
            const sCol  = isGoneRow ? 'transparent' : stageColor((o as any).StageProduction)
            const sBg   = sCol === 'transparent' ? '' : `color-mix(in srgb, ${sCol} 8%, var(--bg1))`
            
            const baseBg = isFoc ? 'var(--bg2)' : sBg
            const rowBg  = isSel 
              ? `color-mix(in srgb, var(--ac) 20%, ${baseBg || 'var(--bg1)'})`
              : baseBg

            return (
                <tr
                  key={o.OeuvreID}
                  onClick={() => setFocused(o)}
                  onDoubleClick={() => onImageDoubleClick()}
                  style={{
                    background: rowBg,
                    cursor: 'pointer',
                    borderLeft: `3px solid ${isSel ? 'var(--ac)' : sCol === 'transparent' ? 'var(--bd)' : sCol}`,
                    height: 44,
                  }}
                >
                  <td style={{ textAlign: 'center', padding: '0 8px' }}>
                    <div style={{
                      width: 14, height: 14, margin: '0 auto',
                      border: `1.5px solid ${isSel ? 'var(--ac)' : 'var(--bd2)'}`,
                      background: isSel ? 'var(--ac)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: 'var(--bg0)',
                    }} onClick={(e) => { e.stopPropagation(); handleCheck(e, o.OeuvreID, idx) }}>
                      {isSel ? '✓' : ''}
                    </div>
                  </td>
                  <td style={{ padding: '0 2px' }}>
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/atelier/works/${o.OeuvreID}/edit`) }} style={{ color: 'var(--tx3)', fontSize: 9 }}>✎</button>
                  </td>
                  <td style={{ color: 'var(--tx3)', fontSize: 8, padding: '0 2px', whiteSpace: 'nowrap' }}>
                    {o.OeuvreID}
                    {(() => {
                      const level = (o as any).anonymity_level ?? (o.is_public === false ? 2 : 0)
                      if (level === 2) return <span title="Privé (Confidentiel)" style={{ marginLeft: 4, opacity: 0.6 }}>🔒</span>
                      if (level === 1) return <span title="Anonyme (Confidentiel)" style={{ marginLeft: 4, color: 'var(--ac)' }}>👤</span>
                      return null
                    })()}
                  </td>
                  <td style={{ padding: '2px' }}>
                    <div 
                      className="thumb" 
                      style={{ 
                        width: 40, height: 40, cursor: 'zoom-in', 
                        border: '1px solid var(--bd)', borderRadius: 2, overflow: 'hidden' 
                      }}
                      onDoubleClick={(e) => { 
                        e.stopPropagation(); 
                        onImageDoubleClick(); 
                      }}
                      title="DOUBLE-CLICK pour agrandir l'aperçu"
                    >
                      {o.txtImageNameLink 
                        ? <img src={thumbUrl(o.txtImageNameLink, 96) ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> 
                        : <div className="ph" style={{ fontSize: 8 }}>—</div>}
                    </div>
                  </td>
                  <td style={{ color: 'var(--tx)', padding: '0 6px', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.Titre || '—'}</td>
                  <td style={{ padding: '0 6px', fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.Technique != null ? (tM[o.Technique] ?? '—') : '—'}</td>
                  <td style={{ padding: '0 6px', fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.Support != null ? (sM[o.Support] ?? '—') : '—'}</td>
                  <td style={{ padding: '0 6px', fontSize: 9.5, whiteSpace: 'nowrap' }}>{dims}</td>
                  <td style={{ padding: '0 6px', fontSize: 9.5 }}>{yearOf(o.Année) ?? '—'}</td>
                  <td style={{ padding: '0 6px', fontSize: 9.5, whiteSpace: 'nowrap' }}>{o.Prix ? `€ ${Number(o.Prix).toLocaleString('fr-FR')}` : '—'}</td>
                  <td style={{ padding: '0 6px', fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(() => {
                      const level = (o as any).anonymity_level ?? (o.is_public === false ? 2 : 0)
                      if (publicMode && level >= 1) return <span style={{ opacity: 0.3 }}>[Anonyme]</span>
                      return o.ContactID != null ? (cM[o.ContactID] ?? '—') : 'Pem'
                    })()}
                  </td>
                  <td style={{ padding: '0 6px', fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {((o as any).LocalisationID != null ? locMap[(o as any).LocalisationID] : 'Pem - Atelier') || '—'}
                  </td>
                  <td style={{ padding: '0 6px' }}><StatusChip s={st} /></td>
                </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > 500 && (
        <div className="t-mono-sm" style={{ padding: 16, textAlign: 'center', color: 'var(--tx3)' }}>
          {rows.length} œuvres affichées
        </div>
      )}
    </div>
  )
}

// ── InvPreview ──────────────────────────────────────────────────────

function InvPreview({
  o, tM, sM, cM, pM, fM, locMap, statusLabelMap, thM, oeuvreThemeMap, oeuvreGroupMap, groupNameMap, selection, toggleInSel, onOpen, onClose,
  expanded, setExpanded,
}: {
  o:              Oeuvre | null
  tM:             Record<number, string>
  sM:             Record<number, string>
  cM:             Record<number, string>
  pM:             Record<number, string>
  fM:             Record<number, string>
  locMap:         Record<number, string>
  statusLabelMap: Record<number, string>
  thM:             Record<number, string>
  oeuvreThemeMap:  Map<number, number[]>
  oeuvreGroupMap:  Map<number, string[]>
  groupNameMap:    Record<string, string>
  selection:      Set<number>
  toggleInSel:    (id: number) => void
  onOpen:         (o: Oeuvre) => void
  onClose:        () => void
  expanded:       boolean
  setExpanded:    (b: boolean) => void
}) {
  const router = useRouter()

  const [imgZoom,      setImgZoom]      = useState(1)
  const [imgPan,       setImgPan]       = useState({ x: 0, y: 0 })
  const [naturalSize,  setNaturalSize]  = useState<{ w: number; h: number } | null>(null)
  const [hovered,      setHovered]      = useState(false)
  const [workImages,   setWorkImages]   = useState<{ ImageID: number; txtImageNameLink: string | null; SeqNo: number | null }[]>([])
  const [activeImgIdx, setActiveImgIdx] = useState<number>(-1)
  const imgContainerRef = useRef<HTMLDivElement>(null)
  const isDragging      = useRef(false)
  const dragStart       = useRef({ x: 0, y: 0, px: 0, py: 0 })

  // Reset state + lazy-load tblImage when work changes
  useEffect(() => {
    setImgZoom(1)
    setImgPan({ x: 0, y: 0 })
    setNaturalSize(null)
    setHovered(false)
    setWorkImages([])
    setActiveImgIdx(-1)
    if (!o?.OeuvreID) return
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('tblImage')
        .select('ImageID, txtImageNameLink, SeqNo')
        .eq('OeuvreID', o.OeuvreID)
        .order('SeqNo', { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setWorkImages(data)
            setActiveImgIdx(data.length - 1)
          }
        })
    })
  }, [o?.OeuvreID])

  // Reset zoom/pan when collapsing or when work changes
  useEffect(() => {
    if (!expanded || !o?.OeuvreID) {
      setImgZoom(1)
      setImgPan({ x: 0, y: 0 })
    }
  }, [expanded, o?.OeuvreID])

  // Non-passive wheel: zoom 1×–2× (200%) only while hovered
  useEffect(() => {
    const el = imgContainerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setImgZoom((z) => {
        const next = Math.min(2, Math.max(1, z - e.deltaY * 0.003))
        if (next <= 1) setImgPan({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [o?.OeuvreID])

  // Must be called unconditionally before any early return
  const { t } = useI18n()

  if (!o) {
    return (
      <div style={{ flex: '0 0 360px', padding: 20, color: 'var(--tx3)' }} className="t-mono-sm">—</div>
    )
  }
  const isSel  = selection.has(o.OeuvreID)
  const st     = statusOf(o, statusLabelMap)
  const isSold = st === 'sold'
  const isLoan = st === 'loan' || st === 'consigned'
  const isGone = st === 'sold' || st === 'gift'  // left the atelier — stade irrelevant
  const dims   = o.Hauteur && o.Largeur
    ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm`
    : null

  // Price display: sold works always show price (or "—"); others show "Sur demande" if no price
  const priceDisplay = (() => {
    const p = (o as any).PrixFinal ?? o.Prix
    if (p && p > 0) return `€\u202f${Number(p).toLocaleString('fr-FR')}`
    return isGone ? '—' : t('surDemande')
  })()

  const level = (o as any).anonymity_level ?? (o.is_public === false ? 2 : 0)

  // Owner/contact: default to PEM if not set
  const ownerLabel = o.ContactID != null ? (cM[o.ContactID] ?? 'Pem') : 'Pem'

  function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
  }

  // ── Expansion Logic ───────────────────────────────
  // Compact (default): 380px panel
  // Expanded: driven by prop (double-click from list) or image zoom
  const isExpanded = expanded || imgZoom > 1

  // Active image: filmstrip selection → fall back to o.txtImageNameLink
  const activeImgPath = workImages.length > 0 && activeImgIdx >= 0
    ? workImages[activeImgIdx]?.txtImageNameLink ?? o.txtImageNameLink
    : o.txtImageNameLink

  // ── Drawer width drives everything, no square starting point ─
  // The image FIS always width:100% height:auto (fit, native proportions).
  // Drawer width alone controls how large the image appears.
  //
  // Compact (no hover):
  //   480px — image renders at native proportions at that width.
  //
  // Expanded landscape (w > h):
  //   min(66vw, 1400px) — image fills width, height follows ratio naturally.
  //
  // Expanded portrait or square (h ≥ w):
  //   calc(92vh × w/h + 48px) — image at that width has height:auto = 92vh exactly.
  //   Math: width = 92vh × (w/h), image height = width / (w/h) = 92vh. ✓
  //   92vh: generous height, metadata reachable by scrolling (user-accepted tradeoff).
  //   Falls back to landscape sizing until naturalSize loads (brief onLoad delay).
  const ratio      = naturalSize ? naturalSize.w / naturalSize.h : null
  const isPortrait = ratio !== null && ratio < 0.95
  const isSquare   = ratio !== null && ratio >= 0.95 && ratio <= 1.05

  // ── Expansion Widths ───────────────────────────────
  const flexBasis = !isExpanded
    ? '360px' // Tighter idle state
    : '80vw'  // 80% of viewport

  const scaleVal = imgZoom

  return (
    // Hover target FIS the whole panel — not just the image.
    // This prevents flicker when moving mouse from image to metadata below.
    <div
      style={{
        flex: `0 0 ${flexBasis}`,
        padding: 40,
        overflow: 'auto',
        background: 'var(--bg1)',
        borderLeft: '1px solid var(--bd)',
        transition: 'flex-basis 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isExpanded ? '-10px 0 40px rgba(0,0,0,0.4)' : 'none',
        position: 'relative',
      }}
    >
      {/* Header row: ID + edit button + zoom indicator + CLOSE */}
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="row gap-sm" style={{ alignItems: 'center' }}>
          <div className="t-eyebrow" style={{ color: 'var(--tx3)' }}>#{o.OeuvreID}</div>
          <button
            className="btn ghost sm"
            onClick={() => router.push(`/atelier/works/${o.OeuvreID}/edit`)}
            style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 0.5 }}
          >
            ✎ {t('edit')}
          </button>
        </div>
        <div className="row gap-sm">
          {imgZoom > 1 && (
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', marginRight: 8 }}>
              ×{imgZoom.toFixed(1)}
            </span>
          )}
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{ 
              background: 'transparent', border: '1px solid var(--bd)', color: 'var(--tx3)', 
              cursor: 'pointer', fontSize: 10, padding: '2px 6px', marginRight: 4,
            }}
            title={expanded ? "Réduire" : "Agrandir"}
          >
            {expanded ? '◀' : '▶'}
          </button>
          <button 
            onClick={onClose}
            style={{ 
              background: 'transparent', border: 'none', color: 'var(--tx3)', 
              cursor: 'pointer', fontSize: 16, padding: '0 4px' 
            }}
            title={t('close')}
          >×</button>
        </div>
      </div>

      {/* Image — always fit (width:100% height:auto), drawer width controls the size */}
      <div
        ref={imgContainerRef}
        style={{
          width: '100%', overflow: 'hidden',
          background: 'var(--bg0)',
          cursor: imgZoom > 1 ? 'grab' : 'default',
          userSelect: 'none', marginBottom: 16,
        }}
        onMouseDown={(e) => {
          if (imgZoom > 1) {
            isDragging.current = true
            dragStart.current = { x: e.clientX, y: e.clientY, px: imgPan.x, py: imgPan.y }
          }
        }}
        onMouseMove={(e) => {
          if (isDragging.current) {
            setImgPan({
              x: dragStart.current.px + (e.clientX - dragStart.current.x),
              y: dragStart.current.py + (e.clientY - dragStart.current.y),
            })
          }
        }}
        onMouseUp={() => { isDragging.current = false }}
      >
        {activeImgPath
          ? <img
              draggable={false}
              src={imageUrl(activeImgPath) ?? ''}
              alt={o.Titre ?? ''}
              onLoad={(e) => {
                const el = e.currentTarget
                if (el.naturalWidth > 0) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight })
              }}
              style={{
                display: 'block', 
                maxWidth: '100%', 
                maxHeight: isExpanded ? '80vh' : 'none',
                width: 'auto',
                height: 'auto',
                margin: '0 auto',
                transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${scaleVal})`,
                transformOrigin: 'center center',
                transition: 'transform 0.06s ease-out',
              }}
            />
          : <div className="ph" style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>—</div>}
      </div>

      {/* Filmstrip — shown when work has multiple images */}
      {workImages.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {workImages.map((img, idx) => (
            <button
              key={img.ImageID}
              onClick={() => { setActiveImgIdx(idx); setImgZoom(1); setImgPan({ x: 0, y: 0 }) }}
              style={{
                width: 44, height: 44, padding: 0,
                border: `2px solid ${idx === activeImgIdx ? 'var(--ac)' : 'var(--bd)'}`,
                overflow: 'hidden', cursor: 'pointer', background: 'var(--bg0)',
                flexShrink: 0,
              }}
              title={`Image ${idx + 1}${idx === workImages.length - 1 ? ' (couverture)' : ''}`}
            >
              {img.txtImageNameLink && (
                <img
                  src={thumbUrl(img.txtImageNameLink, 96) ?? ''}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <h2 className="serif" style={{ fontSize: 24, color: 'var(--tx)', marginBottom: 14, lineHeight: 1.15 }}>
        {o.Titre || '—'}
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '5px 14px',
        fontSize: 10.5,
        marginBottom: 16,
      }}>

        {/* ── Identité ─────────────────────────────────────────── */}
        <div className="t-label">{t('year')}</div>
        <div style={{ color: 'var(--tx2)' }}>{yearOf(o.Année) ?? '—'}</div>

        <div className="t-label">{t('technique')}</div>
        <div style={{ color: 'var(--tx2)' }}>{o.Technique != null ? (tM[o.Technique] ?? '—') : '—'}</div>

        <div className="t-label">{t('support')}</div>
        <div style={{ color: 'var(--tx2)' }}>{o.Support != null ? (sM[o.Support] ?? '—') : '—'}</div>

        <div className="t-label">Format</div>
        <div style={{ color: 'var(--tx2)' }}>{(o as any).Format != null ? (fM[(o as any).Format] ?? '—') : '—'}</div>

        <div className="t-label">{t('presentation')}</div>
        <div style={{ color: (o as any).PresentationID != null ? 'var(--tx2)' : 'var(--tx3)' }}>
          {(o as any).PresentationID != null ? (pM[(o as any).PresentationID] ?? '—') : '—'}
        </div>

        <div className="t-label">{t('dimensions')}</div>
        <div style={{ color: 'var(--tx2)' }}>{dims ?? '—'}</div>

        {/* ── État ─────────────────────────────────────────────── */}
        <div className="t-label" style={{ paddingTop: 8 }}>{t('status')}</div>
        <div style={{ paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusChip s={st} />
          {(o as any).statusId != null && statusLabelMap[(o as any).statusId] && (
            <span style={{ color: 'var(--tx3)', fontSize: 10 }}>
              {statusLabelMap[(o as any).statusId]}
            </span>
          )}
        </div>

        <div className="t-label">Stade</div>
        <div>
          {isGone ? (
            // Sold or gifted — no longer in production, irrelevant
            <span style={{ color: 'var(--tx3)' }}>—</span>
          ) : o.Catalogué ? (
            // Catalogued = finished, greyed out
            <span style={{
              fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
              border: '1px solid var(--tx3)', color: 'var(--tx3)', padding: '1px 6px',
            }}>Fini</span>
          ) : (o as any).StageProduction ? (() => {
            const stageLabels: Record<string, string> = {
              idea: 'Idée', wip: 'En cours', drying: 'Séchage',
              mounting: 'À monter', framing: 'À encadrer', shot: 'À photographier', catalogued: 'À cataloguer',
            }
            const sc = stageColor((o as any).StageProduction)
            const sl = stageLabels[(o as any).StageProduction] ?? (o as any).StageProduction
            return (
              <span style={{
                fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                border: `1px solid ${sc}`, color: sc, padding: '1px 6px',
              }}>{sl}</span>
            )
          })() : <span style={{ color: 'var(--tx3)' }}>—</span>}
        </div>

        <div className="t-label">{t('contact')}</div>
        <div style={{ color: 'var(--tx2)' }}>{ownerLabel}</div>

        {/* ── Localisation ──────────────────────────────────────── */}
        {(() => {
          const locLabel =
            ((o as any).LocalisationID != null ? locMap[(o as any).LocalisationID] : null) ||
            (o.ContactID != null && o.ContactID !== PEM_CONTACT_ID ? locMap[o.ContactID] : null) ||
            null
          return (
            <>
              <div className="t-label">{t('localisation')}</div>
              <div style={{ color: locLabel ? 'var(--tx2)' : 'var(--tx3)' }}>{locLabel ?? '—'}</div>
            </>
          )
        })()}

        {isLoan && (
          <>
            <div className="t-label">{t('returnDate')}</div>
            <div style={{ color: (o as any).ReturnDate ? 'var(--ac)' : 'var(--tx3)' }}>
              {fmtDate((o as any).ReturnDate)}
            </div>
          </>
        )}

        {/* ── Curation ── */}
        <div className="t-label" style={{ paddingTop: 8 }}>{t('themes')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 4 }}>
          {(() => {
            const ids = oeuvreThemeMap.get(o.OeuvreID) ?? []
            if (ids.length === 0) return <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>—</span>
            return ids.map(tid => (
              <span key={tid} style={{ 
                fontSize: 9, background: 'var(--bg0)', border: '1px solid var(--bd)', 
                padding: '1px 6px', color: 'var(--tx2)', borderRadius: 2 
              }}>
                {thM[tid] ?? tid}
              </span>
            ))
          })()}
        </div>

        <div className="t-label">{t('workingGroups')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 4 }}>
          {(() => {
            const ids = oeuvreGroupMap.get(o.OeuvreID) ?? []
            if (ids.length === 0) return <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>—</span>
            return ids.map(gid => (
              <span key={gid} style={{ 
                fontSize: 9, background: 'color-mix(in srgb, var(--ac) 10%, var(--bg0))', 
                border: '1px solid var(--bd)', padding: '1px 6px', color: 'var(--tx)', borderRadius: 2 
              }}>
                {groupNameMap[gid] ?? gid}
              </span>
            ))
          })()}
        </div>

        {/* ── Finance ───────────────────────────────────────────── */}
        <div className="t-label" style={{ paddingTop: 8 }}>Prix</div>
        <div style={{ color: 'var(--tx2)', paddingTop: 8 }}>
          {o.Prix && (o.Prix as any) > 0 ? `€ ${Number(o.Prix).toLocaleString('fr-FR')}` : '—'}
        </div>

        {(o as any).Discount != null && (o as any).Discount > 0 && (
          <>
            <div className="t-label">{t('discount')}</div>
            <div style={{ color: 'var(--tx3)' }}>{(o as any).Discount}%</div>
          </>
        )}

        <div className="t-label">Prix final</div>
        <div style={{ color: 'var(--tx2)' }}>{priceDisplay}</div>

        {/* ── Flags ─────────────────────────────────────────────── */}
        <div className="t-label">Anonymat</div>
        <div>
          {level === 0 && <span style={{ color: 'var(--tx3)' }}>Public</span>}
          {level === 1 && <span style={{ color: 'var(--ac)' }}>Anonyme (contact masqué)</span>}
          {level === 2 && <span style={{ color: 'var(--tx3)', opacity: 0.5 }}>Privé (œuvre masquée)</span>}
        </div>

        <div className="t-label">{t('commission')}</div>
        <div style={{ color: o.IsCommission ? 'var(--tx2)' : 'var(--tx3)' }}>{o.IsCommission ? '✓' : '—'}</div>

        {o.IsCommission && (
          <>
            <div className="t-label">{t('deliveryDate')}</div>
            <div style={{ color: (o as any).DateLivraison ? 'var(--ac)' : 'var(--tx3)' }}>
              {fmtDate((o as any).DateLivraison)}
            </div>
          </>
        )}
      </div>

      {/* ── Commentaires ──────────────────────────────────────────── */}
      {o.Commentaires && (
        <div style={{ marginBottom: 14 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Commentaires</div>
          <div style={{
            fontSize: 10.5, color: 'var(--tx2)', lineHeight: 1.65,
            padding: '10px 12px',
            background: 'var(--bg0)', border: '1px solid var(--bd)',
          }}>
            {o.Commentaires}
          </div>
        </div>
      )}

      {/* ── Historique ────────────────────────────────────────────── */}
      {(o as any).Historique && (
        <div style={{ marginBottom: 14 }}>
          <div className="t-label" style={{ marginBottom: 4 }}>Historique</div>
          <div style={{
            fontSize: 10, color: 'var(--tx2)', lineHeight: 1.8,
            padding: '10px 12px',
            background: 'var(--bg0)', border: '1px solid var(--bd)',
            fontFamily: 'var(--font-mono, monospace)',
            whiteSpace: 'pre-wrap',
          }}>
            {(o as any).Historique}
          </div>
        </div>
      )}

      <div className="row gap-sm" style={{ marginTop: 16 }}>
        <button className={`btn ${isSel ? 'primary' : ''}`} onClick={() => toggleInSel(o.OeuvreID)}>
          {isSel ? `✓ ${t('selected')}` : t('addToSel')}
        </button>
      </div>
    </div>
  )
}

// ── InvGrid ─────────────────────────────────────────────────────────

function InvGrid({
  rows, tM, statusLabelMap, selection, toggleInSel, onOpen,
}: {
  rows:           Oeuvre[]
  tM:             Record<number, string>
  statusLabelMap: Record<number, string>
  selection:      Set<number>
  toggleInSel:    (id: number) => void
  onOpen:         (o: Oeuvre) => void
}) {
  const [cols, setCols] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('pem_grid_cols') ?? '5') || 5 } catch { return 5 }
  })
  // cardRatio: stored as integer 1–10 mapping to aspectRatio 0.5–1.5 (portrait → square → landscape)
  // Default 4 → ratio 0.75 (3:4 portrait) — good for most paintings
  const [cardRatio, setCardRatio] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('pem_grid_ratio') ?? '4') || 4 } catch { return 4 }
  })
  const handleCols = (n: number) => {
    setCols(n)
    try { localStorage.setItem('pem_grid_cols', String(n)) } catch {}
  }
  const handleRatio = (n: number) => {
    setCardRatio(n)
    try { localStorage.setItem('pem_grid_ratio', String(n)) } catch {}
  }
  // Map slider 1–10 → aspect ratio 0.5–1.5
  const aspectRatio = (0.5 + (cardRatio - 1) * (1.0 / 9)).toFixed(3)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 28px' }}>
      {/* Column + height sliders */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>Colonnes</span>
          <input
            type="range" min={2} max={10} step={1} value={cols}
            onChange={(e) => handleCols(parseInt(e.target.value))}
            style={{ width: 100, accentColor: 'var(--ac)' }}
          />
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', minWidth: 14 }}>{cols}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>Hauteur</span>
          <input
            type="range" min={1} max={10} step={1} value={cardRatio}
            onChange={(e) => handleRatio(parseInt(e.target.value))}
            style={{ width: 100, accentColor: 'var(--ac)' }}
          />
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', minWidth: 28 }}>
            {cardRatio <= 3 ? 'tall' : cardRatio <= 6 ? 'mid' : 'wide'}
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
        {rows.map((o) => {
          const isSel     = selection.has(o.OeuvreID)
          const stGrid    = statusOf(o, statusLabelMap)
          const isGoneGrid = stGrid === 'sold' || stGrid === 'gift'
          const sCol  = isGoneGrid ? 'transparent' : stageColor((o as any).StageProduction)
          const sBg   = sCol === 'transparent' ? 'var(--bg1)' : `color-mix(in srgb, ${sCol} 10%, var(--bg1))`
          return (
            <div
              key={o.OeuvreID}
              onClick={() => onOpen(o)}
              style={{
                cursor: 'pointer',
                border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd)'}`,
                borderTop: `3px solid ${sCol === 'transparent' ? 'var(--bd)' : sCol}`,
                background: sBg,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div className="thumb" style={{ aspectRatio }}>
                {o.txtImageNameLink
                  ? <img src={thumbUrl(o.txtImageNameLink, 384) ?? ''} loading="lazy" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div className="ph" style={{ fontSize: 8 }}>—</div>}
              </div>

              {/* Selection checkbox — 22 px, semi-transparent bg when unselected */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleInSel(o.OeuvreID) }}
                style={{
                  position: 'absolute', top: 6, left: 6,
                  width: 22, height: 22,
                  border: `1.5px solid ${isSel ? 'var(--ac)' : 'rgba(255,255,255,0.5)'}`,
                  background: isSel ? 'var(--ac)' : 'rgba(10,10,11,0.6)',
                  fontSize: 11, color: 'var(--bg0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.1s, border-color 0.1s',
                }}
              >{isSel ? '✓' : ''}</button>

              <div style={{ padding: '8px 10px', fontSize: 10 }}>
                <div style={{ color: 'var(--tx3)', fontSize: 8, letterSpacing: 1 }}>#{o.OeuvreID}</div>
                <div style={{ color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                  {o.Titre || '—'}
                </div>
                <div style={{ color: 'var(--tx2)', fontSize: 9, marginTop: 3 }}>
                  {o.Technique != null ? tM[o.Technique] ?? '—' : '—'} · {yearOf(o.Année) ?? '—'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
