'use client'

// InventoryTab — filter bar + three views: list (table+preview), grid, graph placeholder.
// Mirrors source/team/inventory.jsx.

import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { imageUrl, thumbUrl, yearOf, statusOf, statusColor, stageOf, type StatusKey, formatInventoryDims, isAvailabilityRefinedToProduction } from '@/lib/data'
import { MissingThumb, WorkThumb } from './WorkThumb'
import { WorkStateChip } from './WorkStateChip'
import Image from 'next/image'
import { stringifyError } from '@/lib/error'
import { toast } from '@/lib/ui/toast'
import { registerUndo, consumeUndo } from '@/lib/ui/undo'
import type { Oeuvre } from '@/lib/types/database'
import { WorkDrawer, type WorkDrawerGuardHandle } from './WorkDrawer'
import { useMediaQuery } from '@/lib/useMediaQuery'

// ── Types ───────────────────────────────────────────────────────────

// PEM's own ContactID — default owner when ContactID FIS null
const PEM_CONTACT_ID = 13

function setsEqualNum(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}

function SortInd({ k, current, dir }: { k: string; current: string; dir: 'asc' | 'desc' }) {
  if (k !== current) return <span style={{ opacity: 0.2, marginLeft: 4, fontSize: 13 }}>↕</span>
  return <span style={{ color: 'var(--ac)', marginLeft: 4, fontSize: 13 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

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
  NeedsPhotograph: 'À photographier',
  statusId:        'État',
  ContactID:       'Contact',
  LocalisationID:  'Localisation',
  AcheteurID:      'Acheteur',
  ReturnDate:      'Date retour',
  txtImageNameLink: 'Image',
  IsCommission:    'Commission',
  DateLivraison:   'Deadline',
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

const INV_LIST_ROW_H = 44
const INV_TABLE_COLS = 14
const INV_GRID_GAP = 12
const INV_GRID_PAD = 16
const INV_GRID_MIN_CELL = 140
const INV_GRID_ROW_H = 228

// ── Main component ──────────────────────────────────────────────────

export function InventoryTab({
  oeuvres, tM, sM, cM, pM, locMap, statusLabelMap,
  techniques, supports, formats = [], themes = [], groups = [],
  contacts = [], presentations = [],
  selection, setSelection, onOpen,
  oeuvreThemeIdsByOeuvre = {},
  oeuvreGroupIdsByOeuvre = {},
}: SharedProps & {
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats?:       { FormatID:    number; Format:    string | null }[]
  themes?:        { id: number; name: string }[]
  groups?:        { id: string; name: string }[]
  contacts?:      { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  presentations?: { PresentationID: number; Nom: string | null }[]
  /** From RSC (oeuvre_theme / working_group_work); avoids duplicate client fetch */
  oeuvreThemeIdsByOeuvre?: Record<number, number[]>
  oeuvreGroupIdsByOeuvre?: Record<number, string[]>
}) {
  const { t } = useI18n()

  const router = useRouter()

  const offerSelectionUndo = useCallback(
    (prev: Set<number>) => {
      const runUndo = () => {
        void (async () => {
          try {
            const ok = await consumeUndo()
            if (!ok) return
          } catch {
            toast.error(t('undoFailed'))
          }
        })()
      }
      const tid = toast.success(t('selectionUndoHint'), {
        ttlMs: 8000,
        action: { label: t('undo'), onClick: runUndo },
      })
      registerUndo({
        ttlMs: 8000,
        linkedToastId: tid,
        undo: () => {
          setSelection(new Set(prev))
        },
      })
    },
    [setSelection, t],
  )
  const narrow = useMediaQuery('(max-width: 767px)')

  const headerBase: React.CSSProperties = {
    padding: '0 4px',
    color: 'var(--tx)',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    verticalAlign: 'bottom',
  }

  const compactHeader: React.CSSProperties = {
    ...headerBase,
    height: 72,
    overflow: 'visible',
    textAlign: 'left',
  }

  const slantedHeaderInner: React.CSSProperties = {
    display: 'inline-block',
    transform: 'translateY(10px) rotate(-35deg)',
    transformOrigin: 'bottom left',
  }
  const [q,           setQ]           = useState('')
  const [tech,        setTech]        = useState('all')
  const [support,     setSupport]     = useState('all')
  const [status,      setStatus]      = useState('all')
  const [view,        setView]        = useState<View>('list')
  const [sortKey,     setSortKey]     = useState<string>('OeuvreID')
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('desc')
  const toggleSort = (k: string) => {
    if (sortKey === k) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }
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
  const panelDrawerGuardRef = useRef<WorkDrawerGuardHandle>(null)

  const focusRowGuarded = useCallback((o: Oeuvre) => {
    if (!showPreview) {
      setFocused(o)
      return
    }
    if (focused?.OeuvreID === o.OeuvreID) return
    if (!focused) {
      setFocused(o)
      return
    }
    panelDrawerGuardRef.current?.runGuarded(() => setFocused(o))
  }, [showPreview, focused])

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
        l: k === 'anonymity_level' ? t('confidentiality') : (FIELD_LABELS[k] || k),
        t: getFieldType(k, (sample as any)[k])
      }))

    // Add virtual curation fields for advanced filter
    fields.push({ k: '_theme', l: 'Thème',  t: 'lookup' })
    fields.push({ k: '_group', l: 'Groupe', t: 'lookup' })

    return fields
  }, [oeuvres, t])

  const handleLoadGroup = useCallback(async (id: string, mode: 'select' | 'filter' = 'select') => {
    setLoadingGrp(id)
    const sb = createClient()
    const { data } = await (sb.from('working_group_work') as any)
      .select('oeuvre_id')
      .eq('group_id', id)
    
    if (data) {
      if (mode === 'select') {
        const prev = new Set(selection)
        const next = new Set((data as { oeuvre_id: number }[]).map((r) => r.oeuvre_id))
        if (!setsEqualNum(prev, next)) {
          setSelection(next)
          offerSelectionUndo(prev)
        }
      } else {
        setFilterGroup(id)
      }
    }
    setLoadingGrp(null)
  }, [setSelection, selection, offerSelectionUndo])

  const oeuvreThemeMap = useMemo(() => {
    const m = new Map<number, number[]>()
    for (const [k, arr] of Object.entries(oeuvreThemeIdsByOeuvre)) m.set(Number(k), arr)
    return m
  }, [oeuvreThemeIdsByOeuvre])

  const oeuvreGroupMap = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const [k, arr] of Object.entries(oeuvreGroupIdsByOeuvre)) m.set(Number(k), arr)
    return m
  }, [oeuvreGroupIdsByOeuvre])

  const sortedThemes = useMemo(() => [...themes].sort((a, b) => a.name.localeCompare(b.name, 'fr')), [themes])
  const thM = useMemo(
    () => Object.fromEntries(themes.map((t) => [t.id, t.name])),
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
    }).sort((a, b) => {
      // ── Sorting Logic ──
      const dir = sortDir === 'asc' ? 1 : -1
      
      if (sortKey === 'OeuvreID') return (a.OeuvreID - b.OeuvreID) * dir
      if (sortKey === 'Titre') return (a.Titre || '').localeCompare(b.Titre || '') * dir
      if (sortKey === 'Année') return ((extractYear(a.Année) || 0) - (extractYear(b.Année) || 0)) * dir
      if (sortKey === 'Prix') return ((a.Prix || 0) - (b.Prix || 0)) * dir
      if (sortKey === 'Status') {
        const sa = statusOf(a, statusLabelMap)
        const sb = statusOf(b, statusLabelMap)
        return sa.localeCompare(sb) * dir
      }
      if (sortKey === 'Stage') {
        const sa = statusOf(a, statusLabelMap)
        const sb = statusOf(b, statusLabelMap)
        return sa.localeCompare(sb) * dir
      }
      if (sortKey === 'Contact') {
        const ca = a.ContactID != null ? (cM[a.ContactID] || '') : 'Pem'
        const cb = b.ContactID != null ? (cM[b.ContactID] || '') : 'Pem'
        return ca.localeCompare(cb) * dir
      }
      if (sortKey === 'Custodian') {
        const la = (a as any).LocalisationID != null ? (locMap[(a as any).LocalisationID] || '') : 'Pem'
        const lb = (b as any).LocalisationID != null ? (locMap[(b as any).LocalisationID] || '') : 'Pem'
        return la.localeCompare(lb) * dir
      }
      if (sortKey === 'Comm') {
        const ca = statusOf(a, statusLabelMap)
        const cb = statusOf(b, statusLabelMap)
        return ca.localeCompare(cb) * dir
      }

      return 0
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oeuvres, q, tech, support, status, filterTheme, filterGroup, criteria, oeuvreThemeMap, oeuvreGroupMap, thM, groupNameMap, tM, sM, statusLabelMap, allFields, sortKey, sortDir, cM, locMap])

  const activeStages = useMemo(() => {
    const present = new Set(oeuvres.map(o => statusOf(o, statusLabelMap)))
    return [
      { k: 'en_production',   l: 'En production', c: 'var(--rust)' },
      { k: 'available',       l: 'Disponible',    c: 'var(--sage)' },
      { k: 'reserved',        l: 'Réservé',       c: 'var(--dust)' },
      { k: 'consigned',       l: 'Consigné',      c: 'var(--dust)' },
      { k: 'loan',            l: 'Prêt',          c: 'var(--cyan)' },
      { k: 'sold',            l: 'Vendu',         c: 'var(--mt)'   },
      { k: 'gift',            l: 'Don',           c: 'var(--mt)'   },
      { k: 'artist_archive',  l: 'Archive (Pem)', c: 'var(--mt)'   },
      { k: 'private_archive', l: 'Archive privée',c: 'var(--mt)'   },
    ].filter(s => present.has(s.k as StatusKey))
  }, [oeuvres, statusLabelMap])

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
    ['all',             'Tous'],
    ['en_production',   'En production'],
    ['available',       'Disponible'],
    ['reserved',        'Réservé'],
    ['consigned',       'Consigné'],
    ['loan',            'Prêt'],
    ['sold',            'Vendu'],
    ['gift',            'Don'],
    ['artist_archive',  'Archive (Pem)'],
    ['private_archive', 'Archive privée'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: narrow ? '10px 12px' : '12px 28px',
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
            minWidth: narrow ? 140 : 200,
            padding: '10px 14px',
            background: 'var(--bg2)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            fontSize: 15,
          }}
        />

        {/* Theme */}
        <InvSelect
          value={filterTheme} onChange={setFilterTheme}
          label={t('theme')}
          options={[['all', 'Tous les thèmes'], ...sortedThemes.map((x) => [String(x.id), x.name] as [string, string])]}
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
                padding: '8px 14px', fontSize: 14,
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
            padding: '8px 12px', fontSize: 13,
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
            const prev = new Set(selection)
            const next = new Set(selection)
            filtered.forEach(o => next.add(o.OeuvreID))
            if (setsEqualNum(prev, next)) return
            setSelection(next)
            offerSelectionUndo(prev)
          }}
          className="btn sm"
          style={{ 
            fontSize: 12, padding: '8px 16px', 
            border: '1px solid var(--bd)',
            background: filtered.length > 0 ? 'var(--bg2)' : 'transparent',
            color: filtered.length > 0 ? 'var(--ac)' : 'var(--tx3)',
            cursor: 'pointer',
          }}
          title="Sélectionner tous les résultats affichés"
        >
          {t('selectAll')} ({filtered.length})
        </button>

        {/* Selection count & Delete */}
        {selection.size > 0 && (
          <div className="row gap-sm" style={{ borderLeft: '1px solid var(--bd)', paddingLeft: 12, marginLeft: 4 }}>
            <button
              onClick={async () => {
                if (!confirm(t('confirmMoveWorksToTrash'))) return
                const ids = Array.from(selection)
                const { deleteSelectedWorks, restoreSoftDeletedWorks } = await import('@/app/atelier/works/actions')
                const res = await deleteSelectedWorks(ids)
                if ('error' in res) {
                  alert(`${t('error')}: ${stringifyError(res.error)}`)
                  return
                }
                setSelection(new Set())
                router.refresh()
                const runUndo = () => {
                  void (async () => {
                    try {
                      const ok = await consumeUndo()
                      if (!ok) return
                    } catch {
                      toast.error(t('undoFailed'))
                    }
                  })()
                }
                const tid = toast.success(t('workTrashHint'), {
                  ttlMs: 8000,
                  action: { label: t('undo'), onClick: runUndo },
                })
                registerUndo({
                  ttlMs: 8000,
                  linkedToastId: tid,
                  undo: async () => {
                    const r = await restoreSoftDeletedWorks(ids)
                    if ('error' in r) {
                      toast.error(t('restoreWorkFailed'))
                      throw new Error(r.error)
                    }
                    router.refresh()
                  },
                })
              }}
              className="btn sm"
              style={{ fontSize: 12, padding: '8px 16px', background: 'var(--rust)22', color: 'var(--rust)', border: '1px solid var(--rust)44' }}
            >
              Supprimer ({selection.size})
            </button>
          </div>
        )}

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
            style={{ fontSize: 12, padding: '6px 10px', color: 'var(--rust)' }}
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
              padding: '8px 16px', fontSize: 13, letterSpacing: 1,
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
              <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>{t('legend')}</div>
              {activeStages.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>Aucune œuvre en production</div>}
              {activeStages.map((it, i) => (
                <div key={i} className="row gap-sm" style={{ marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: it.c }} />
                  <div className="t-mono-sm" style={{ fontSize: 12 }}>{it.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Preview toggle */}
        <button
          onClick={() => setShowPreview((v) => !v)}
          style={{
            padding: '8px 16px', fontSize: 13,
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
          narrow={narrow}
        />
      )}

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {view === 'list' && (
          <>
            <InvList
              rows={filtered} tM={tM} sM={sM} cM={cM} locMap={locMap} statusLabelMap={statusLabelMap}
              focused={focused} setFocused={focusRowGuarded}
              selection={selection} setSelection={setSelection}
              sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort}
              onImageDoubleClick={() => { setShowPreview(true); setPreviewExpanded(true) }}
              onOpen={onOpen}
            />
            {showPreview && !narrow && (
              <WorkDrawer
                ref={panelDrawerGuardRef}
                o={focused}
                mode="panel"
                tM={tM} sM={sM} cM={cM} pM={pM} fM={fM} locMap={locMap}
                statusLabelMap={statusLabelMap}
                selection={selection} toggleInSel={toggleInSel}
                onClose={() => setShowPreview(false)}
                onEdit={onOpen}
                thM={thM} oeuvreThemeMap={oeuvreThemeMap} oeuvreGroupMap={oeuvreGroupMap}
                groupNameMap={groupNameMap}
                techniques={techniques} supports={supports} formats={formats}
                themes={themes} contacts={contacts} groups={groups}
                presentations={presentations}
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
  tM, sM, cM, thM, pM, statusLabelMap, groups, allFields,
  narrow = false,
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
  narrow?:        boolean
}) {
  const { t } = useI18n()
  const FIS: React.CSSProperties = {
    fontFamily: 'inherit', fontSize: 13,
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
      anonymity_level: { '0': t('anon_lvl_0'), '1': t('anon_lvl_1'), '2': t('anon_lvl_2') }
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
      padding: narrow ? '8px 12px 10px' : '8px 28px 10px',
      background: 'var(--bg0)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>

      {/* Criteria rows */}
      {criteria.map((c) => {
        const fld  = allFields.find((f) => f.k === c.field) ?? allFields[0]
        const ops  = opsForType(fld.t)
        const opts = lookupOpts(c.field)
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
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
        fontSize: 14,
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
  rows, tM, sM, cM, locMap, statusLabelMap, focused, setFocused, selection, setSelection, 
  sortKey, sortDir, toggleSort,
  onImageDoubleClick, onOpen, publicMode,
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
  sortKey:        string
  sortDir:        'asc' | 'desc'
  toggleSort:     (k: string) => void
  onImageDoubleClick: () => void
  onOpen:         (o: Oeuvre) => void
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

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => INV_LIST_ROW_H,
    overscan: 15,
  })

  const vItems = virtualizer.getVirtualItems()
  const padTop = vItems.length ? vItems[0].start : 0
  const padBot = vItems.length ? virtualizer.getTotalSize() - vItems[vItems.length - 1].end : 0

  function focusRowAt(nextIdx: number) {
    const o = visible[nextIdx]
    if (!o) return
    setFocused(o)
    virtualizer.scrollToIndex(nextIdx, { align: 'auto' })
  }

  function onKeyNav(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const cur = focused ? visible.findIndex((x) => x.OeuvreID === focused.OeuvreID) : -1
    if (e.key === 'ArrowDown') focusRowAt(cur < 0 ? 0 : Math.min(visible.length - 1, cur + 1))
    else focusRowAt(cur <= 0 ? 0 : cur - 1)
  }

  const router = useRouter()

  const cellDivider: React.CSSProperties = {
    borderRight: '1px solid var(--bd)',
  }

  const headerBase: React.CSSProperties = {
    ...cellDivider,
    padding: '10px 6px',
    color: 'var(--tx)',
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    textAlign: 'left',
    lineHeight: 1.2,
    background: 'var(--bg1)',
  }

  return (
    <div
      ref={scrollRef}
      data-testid="inventory-virtual-scroll"
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={onKeyNav}
      style={{ flex: 1, minWidth: 0, overflow: 'auto', borderRight: '1px solid var(--bd)', outline: 'none' }}
    >
      <table style={{ 
        width: '100%', 
        tableLayout: 'fixed', 
        borderCollapse: 'collapse', 
        borderSpacing: 0,
        background: 'var(--bg1)',
        fontSize: 14,
      }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          <tr style={{ borderBottom: '1px solid var(--bd)' }}>
            <th style={{ width: 30, textAlign: 'center', padding: '8px 4px', ...cellDivider, background: 'var(--bg1)' }}>
              <div style={{
                width: 12, height: 12, margin: '0 auto',
                border: `1.5px solid ${visible.length > 0 && visible.every(o => selection.has(o.OeuvreID)) ? 'var(--ac)' : 'var(--bd2)'}`,
                background: visible.length > 0 && visible.every(o => selection.has(o.OeuvreID)) ? 'var(--ac)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }} onClick={() => {
                const allSel = visible.every(o => selection.has(o.OeuvreID))
                const next = new Set(selection)
                if (allSel) visible.forEach(o => next.delete(o.OeuvreID))
                else visible.forEach(o => next.add(o.OeuvreID))
                setSelection(next)
              }}>
                {visible.length > 0 && visible.every(o => selection.has(o.OeuvreID)) ? '✓' : ''}
              </div>
            </th>
            <th style={{ width: 22, padding: '8px 2px', ...cellDivider, background: 'var(--bg1)' }} />
            <th onClick={() => toggleSort('OeuvreID')} style={{ ...headerBase, width: 44, color: 'var(--tx3)', cursor: 'pointer' }}>ID <SortInd k="OeuvreID" current={sortKey} dir={sortDir} /></th>
            <th style={{ width: 44, padding: '8px 2px', ...cellDivider, background: 'var(--bg1)' }} />
            <th onClick={() => toggleSort('Titre')} style={{ ...headerBase, width: '18%', cursor: 'pointer' }}>{t('title')} <SortInd k="Titre" current={sortKey} dir={sortDir} /></th>
            <th style={{ ...headerBase, width: '22%' }}>Médium</th>
            <th style={{ ...headerBase, width: 70 }}>Dims</th>
            <th onClick={() => toggleSort('Année')} style={{ ...headerBase, width: 48, cursor: 'pointer' }}>
              Année <SortInd k="Année" current={sortKey} dir={sortDir} />
            </th>
            <th onClick={() => toggleSort('Prix')} style={{ ...headerBase, width: 80, cursor: 'pointer' }}>
              Prix <SortInd k="Prix" current={sortKey} dir={sortDir} />
            </th>
            <th onClick={() => toggleSort('Contact')} style={{ ...headerBase, width: 100, cursor: 'pointer' }}>
              Contact <SortInd k="Contact" current={sortKey} dir={sortDir} />
            </th>
            <th onClick={() => toggleSort('Custodian')} style={{ ...headerBase, width: 110, cursor: 'pointer' }}>
              Emplacement <SortInd k="Custodian" current={sortKey} dir={sortDir} />
            </th>
            <th
              colSpan={2}
              onClick={() => toggleSort('Status')}
              style={{ ...headerBase, width: 160, cursor: 'pointer' }}
              title="État commercial (disponible, production, réservé, vendu…)"
            >
              État <SortInd k="Status" current={sortKey === 'Stage' ? 'Status' : sortKey} dir={sortDir} />
            </th>
            <th
              onClick={() => toggleSort('Comm')}
              style={{ ...headerBase, width: 80, cursor: 'pointer', borderRight: 'none' }}
              title="Rappel si réservé (l’état détaillé est dans la colonne État)"
            >
              Réserve <SortInd k="Comm" current={sortKey} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr>
              <td colSpan={INV_TABLE_COLS} style={{ height: padTop, padding: 0, border: 'none', lineHeight: 0 }} />
            </tr>
          )}
          {vItems.map((vi) => {
            const o = visible[vi.index]
            const idx = vi.index
            const isSel = selection.has(o.OeuvreID)
            const isFoc = focused?.OeuvreID === o.OeuvreID
            const st    = statusOf(o, statusLabelMap)
            const dims  = formatInventoryDims(o.Hauteur, o.Largeur, o.Support != null ? sM[o.Support] : null, o.Profondeur)
            const sCol  = statusColor(st)
            
            // CLEAN LOGIC: Background is ONLY for Focus or Selection.
            const rowBg = isFoc 
              ? 'var(--bg2)' // Clear focus color
              : isSel 
                ? 'rgba(255,255,255,0.05)' // Subtle selection hint
                : 'transparent' // Default dark

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
                  <td style={{ textAlign: 'center', padding: '0 8px', ...cellDivider, verticalAlign: 'middle' }}>
                    <div style={{
                      width: 14, height: 14, margin: '0 auto',
                      border: `1.5px solid ${isSel ? 'var(--ac)' : 'var(--bd2)'}`,
                      background: isSel ? 'var(--ac)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: 'var(--bg0)',
                    }} onClick={(e) => handleCheck(e, o.OeuvreID, idx)}>
                      {isSel ? '✓' : ''}
                    </div>
                  </td>
                  <td style={{ padding: '0 2px', ...cellDivider, verticalAlign: 'middle' }}>
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/atelier?work=${o.OeuvreID}`) }} style={{ color: 'var(--tx3)', fontSize: 12 }}>✎</button>
                  </td>
                  <td style={{ color: 'var(--tx3)', fontSize: 11, padding: '0 2px', whiteSpace: 'nowrap', ...cellDivider, verticalAlign: 'middle' }}>
                    {o.OeuvreID}
                    {(() => {
                      if (!(o as any).is_public) {
                        return <span title="Œuvre privée (Non publique)" style={{ marginLeft: 4, opacity: 0.6 }}>🔒</span>
                      }
                      if (isAvailabilityRefinedToProduction(o, statusLabelMap)) {
                        return <span title={t('inv_refinement_gate')} style={{ marginLeft: 4, opacity: 0.65 }}>🔒</span>
                      }
                      // Photography Gate Indicator (explicit « En production » + HR pending)
                      if (!o.Catalogué && o.statusId === 1 && o.txtImageNameLink) {
                        return <span title="En attente de validation Haute-Résolution" style={{ marginLeft: 6, color: 'var(--ac)', fontSize: 9, fontWeight: 700 }}>● GATE</span>
                      }
                      return null
                    })()}
                  </td>
                  <td style={{ padding: '2px', ...cellDivider, verticalAlign: 'middle' }}>
                    <div 
                      className="thumb" 
                      style={{ 
                        width: 40, height: 40, cursor: 'zoom-in', 
                        border: '1px solid var(--bd)', borderRadius: 2, overflow: 'hidden',
                        position: 'relative'
                      }}
                      onDoubleClick={(e) => { 
                        e.stopPropagation(); 
                        onImageDoubleClick(); 
                      }}
                      title="DOUBLE-CLICK pour agrandir l'aperçu"
                    >
                      {o.txtImageNameLink 
                        ? <WorkThumb file={o.txtImageNameLink} alt={o.Titre ?? ''} size={96} displaySize="40px" /> 
                        : <MissingThumb id={o.OeuvreID} onOpen={() => onOpen(o)} />}
                    </div>
                  </td>
                  <td style={{ color: 'var(--tx)', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...cellDivider, verticalAlign: 'middle' }}>{o.Titre || '—'}</td>
                  <td style={{ padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>
                    {o.Technique != null ? (tM[o.Technique] ?? '') : ''} 
                    {o.Support != null ? ` · ${sM[o.Support] ?? ''}` : ''}
                  </td>
                  <td style={{ padding: '0 4px', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>{dims}</td>
                  <td style={{ padding: '0 4px', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>{yearOf(o.Année) ?? '—'}</td>
                  <td style={{ padding: '0 4px', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>{o.Prix ? `€ ${Number(o.Prix).toLocaleString('fr-FR')}` : '—'}</td>
                  <td style={{ padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>
                    {(() => {
                      const level = (o as any).anonymity_level ?? 0
                      const contactName = o.ContactID != null ? (cM[o.ContactID] ?? '—') : 'Pem'
                      
                      if (publicMode && level >= 1) return <span style={{ opacity: 0.3 }}>[Masqué]</span>
                      
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{contactName}</span>
                          {level === 1 && <span title="Contact masqué" style={{ color: 'var(--ac)' }}>👤</span>}
                          {level === 2 && <span title="Privé (Confidentiel)" style={{ opacity: 0.6 }}>🔒</span>}
                        </span>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>
                    {(() => {
                      // TRUTH ENFORCEMENT: If the status implies it's gone (Consigned, Loaned, Sold, Gifted), 
                      // we MUST show the actual location. Otherwise, it is at the Atelier.
                      const isExternal = ['consigned', 'loan', 'sold', 'gift'].includes(st)
                      if (!isExternal) return 'Pem - Atelier'
                      return ((o as any).LocalisationID != null ? locMap[(o as any).LocalisationID] : 'Pem - Atelier') || '—'
                    })()}
                  </td>
                  <td style={{ padding: '0 4px', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellDivider }} colSpan={2}>
                    <WorkStateChip o={o} statusLabelMap={statusLabelMap} />
                  </td>
                  <td style={{ padding: '0 4px', verticalAlign: 'middle', borderRight: 'none' }}>
                    {st === 'reserved' && <span className="chip dust" style={{ fontSize: 10 }}>RÉSERVÉ</span>}
                  </td>
                </tr>
            )
          })}
          {padBot > 0 && (
            <tr>
              <td colSpan={INV_TABLE_COLS} style={{ height: padBot, padding: 0, border: 'none', lineHeight: 0 }} />
            </tr>
          )}
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

// ── InvGrid ─────────────────────────────────────────────────────────

function InvGrid({
  rows,
  tM,
  statusLabelMap,
  selection,
  toggleInSel,
  onOpen,
}: {
  rows:           Oeuvre[]
  tM:             Record<number, string>
  statusLabelMap: Record<number, string>
  selection:      Set<number>
  toggleInSel:    (oid: number) => void
  onOpen:         (o: Oeuvre) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(4)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth - INV_GRID_PAD * 2
      setCols(Math.max(1, Math.floor((w + INV_GRID_GAP) / (INV_GRID_MIN_CELL + INV_GRID_GAP))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rowCount = Math.ceil(rows.length / cols) || 0

  const gridVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => INV_GRID_ROW_H,
    overscan: 2,
  })

  const gvItems = gridVirtualizer.getVirtualItems()

  function renderCard(o: Oeuvre) {
    const isSel = selection.has(o.OeuvreID)
    const st = statusOf(o, statusLabelMap)
    const sCol = statusColor(st)
    return (
      <div
        key={o.OeuvreID}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen(o)
          }
        }}
        style={{
          position: 'relative',
          background: 'var(--bg1)',
          border: `1px solid ${isSel ? 'var(--ac)' : 'var(--bd)'}`,
          borderLeft: `4px solid ${sCol === 'transparent' ? 'var(--bd)' : sCol}`,
          borderRadius: 4,
          padding: 8,
          cursor: 'pointer',
        }}
      >
        <div
          style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}
          onClick={(e) => {
            e.stopPropagation()
            toggleInSel(o.OeuvreID)
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              border: `1.5px solid ${isSel ? 'var(--ac)' : 'var(--bd2)'}`,
              background: isSel ? 'var(--ac)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--bg0)',
              cursor: 'pointer',
            }}
          >
            {isSel ? '✓' : ''}
          </div>
        </div>
        <div
          style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid var(--bd)',
            marginBottom: 8,
            background: 'var(--bg2)',
          }}
        >
          {o.txtImageNameLink ? (
            <WorkThumb file={o.txtImageNameLink} alt={o.Titre ?? ''} size={160} displaySize="100%" />
          ) : (
            <MissingThumb id={o.OeuvreID} onOpen={() => onOpen(o)} />
          )}
        </div>
        <div
          className="t-mono-sm"
          style={{
            fontSize: 12,
            color: 'var(--tx)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: 4,
          }}
          title={o.Titre ?? ''}
        >
          {o.Titre || '—'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {o.Technique != null ? (tM[o.Technique] ?? '') : ''}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      data-testid="inventory-virtual-grid"
      style={{
        flex: 1,
        minWidth: 0,
        overflow: 'auto',
        padding: `${INV_GRID_PAD}px 0`,
      }}
    >
      <div style={{ height: gridVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {gvItems.map((gv) => {
          const start = gv.index * cols
          const slice = rows.slice(start, start + cols)
          return (
            <div
              key={gv.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${gv.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, minmax(${INV_GRID_MIN_CELL}px, 1fr))`,
                gap: INV_GRID_GAP,
                paddingLeft: INV_GRID_PAD,
                paddingRight: INV_GRID_PAD,
                boxSizing: 'border-box',
              }}
            >
              {slice.map((o) => renderCard(o))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

