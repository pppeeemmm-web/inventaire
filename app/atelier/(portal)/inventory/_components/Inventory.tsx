'use client'

// Inventory — filter bar + three views: list (table+preview), grid, graph placeholder.
// Mirrors source/team/inventory.jsx.

import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { imageUrl, thumbUrl, yearOf, statusOf, statusColor, stageOf, type StatusKey, formatInventoryDims, isAvailabilityRefinedToProduction } from '@/lib/data'
import { MissingThumb, WorkThumb } from '@/components/atelier/WorkThumb'
import { WorkStateChip } from '@/components/atelier/WorkStateChip'
import { formatPriceCompact, formatPriceFull } from '@/lib/format-price'
import { EmbeddingStatusBadge } from '@/components/atelier/EmbeddingStatusBadge'
import { useNonOkEmbeddingStatuses } from '@/hooks/useNonOkEmbeddingStatuses'
import type { OeuvreEmbeddingStatusMap } from '@/app/atelier/embedding-status-actions'
import Image from 'next/image'
import { stringifyError } from '@/lib/error'
import { gateErrorKey } from '@/lib/work-save-error'
import { toast } from '@/lib/ui/toast'
import { registerUndo, consumeUndo } from '@/lib/ui/undo'
import type { Oeuvre } from '@/lib/types/database'
import type { ContactAddress } from '@/components/atelier/contact-editor-types'
import { WorkDrawer, type WorkDrawerGuardHandle } from '@/components/atelier/WorkDrawer'
import { SelectionImagesDownloadModal } from '@/components/atelier/SelectionImagesDownloadModal'
import type { RefObject } from 'react'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { batchEdit } from '@/app/atelier/selection/actions'
import { consumeInventoryFilter } from '@/lib/atelier/inventory-filter-handoff'
import { consumeColourFilter, COLOUR_FILTER_EVENT } from '@/lib/atelier/colour-filter-handoff'
import { ColourFilterPanel, type ColourRank } from './ColourFilterPanel'
import { fetchCoverColourProfiles } from '@/app/atelier/(portal)/inventory/colour-actions'
import {
  isColourQueryActive,
  matchScore,
  monochromeScore,
  type ColourQuery,
  type ColourProfile,
} from '@/lib/colour-filter'
import type { ColourFamily } from '@/lib/colour-families'
import type { Agg, Dim } from '@/lib/pivot'
import { PivotPanel } from '@/components/atelier/PivotPanel'
import { PeriodSourceManager } from '@/components/atelier/PeriodSourceManager'
import { patchPeriodSource, usePeriodSource } from '@/lib/atelier/use-period-source'
import { addSourceToWorks } from '@/app/atelier/works/period-source-actions'
import { ReportLinkButton } from '@/components/atelier/ReportLinkButton'
import { effectivePeriod, effectivePlace, placeLabel, sortPlaces, workWhen, type EffectivePlace, type WorkPeriod } from '@/lib/work-periods'

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
const buildFieldLabels = (t: (k: DictKey) => string): Record<string, string> => ({
  OeuvreID:        'ID',
  Titre:           t('title'),
  Technique:       t('technique'),
  Support:         t('support'),
  _theme:          t('theme'),
  _group:          t('const_viewGroup'),
  Année:           t('year'),
  DateCreation:    t('inv_field_date_creation'),
  Prix:            t('price'),
  PrixFinal:       t('inv_field_prix_final'),
  Discount:        `${t('discount')} (%)`,
  Exposable:       t('inv_field_exposable'),
  Catalogué:       t('inv_field_catalogued'),
  Encadree:        t('framed'),
  Hauteur:         t('inv_field_height'),
  Largeur:         t('inv_field_width'),
  Profondeur:      t('inv_field_depth'),
  PresentationID:  t('presentation'),
  NeedsPhotograph: t('inv_field_needs_photo'),
  statusId:        t('inv_col_status'),
  ContactID:       t('contact'),
  LocalisationID:  t('inv_col_location'),
  AcheteurID:      t('buyer'),
  ReturnDate:      t('inv_field_return_date'),
  txtImageNameLink: 'Image',
  IsCommission:    t('commission'),
  DateLivraison:   t('deliveryDate'),
})

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

/** Read a runtime-dynamic key from an Oeuvre (no index signature on the interface). */
function oeuvreField(o: Oeuvre, key: string): unknown {
  return (o as unknown as Record<string, unknown>)[key]
}

function matchesCriterion(o: Oeuvre, c: Criterion, allFields: FieldDef[]): boolean {
  const fld = allFields.find((f) => f.k === c.field)
  if (!fld) return true
  
  // Special handling for photography flags (legacy mapping)
  if (c.field === 'photograph' || c.field === 'NeedsPhotograph' || c.field === 'needsphotograph') {
    const val = !!(o.NeedsPhotograph)
    return c.op === '= vrai' ? val : !val
  }

  const raw = oeuvreField(o, c.field)
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

/**
 * "Custodian · address" — who holds the work and where (docs/WORK_CUSTODY_MODEL.md), e.g.
 * "Pem · Atelier", "Galerie X · Paris". No address → the custodian's city.
 */
function custodyLabel(
  o: Oeuvre,
  cM: Record<number, string>,
  locMap: Record<number, string>,
  addrMap: Record<number, string>,
): string {
  const holder = o.LocalisationID
  if (holder == null) return '—'
  const name = cM[holder] || '—'
  const addrId = (o as { localisation_address_id?: number | null }).localisation_address_id
  const where = addrId != null ? addrMap[addrId] : locMap[holder]
  return where ? `${name} · ${where}` : name
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

/** Whole query is ID-list syntax only (digits + separators + #); must contain a digit. */
function looksLikeIdOnlyQuery(s: string): boolean {
  return /[\d]/.test(s) && /^[\d\s,\n\-–#]+$/.test(s)
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

type View = 'list' | 'grid' | 'graph' | 'pivot'

const INV_LIST_ROW_H = 44
const INV_TABLE_COLS = 14
/** Table cell text: two lines, then cut (full text in the cell's hover title). */
const INV_CLAMP2: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'normal', lineHeight: 1.2, overflowWrap: 'break-word' }
const INV_GRID_GAP = 12
const INV_GRID_PAD = 16
const INV_GRID_MIN_CELL = 140
const INV_GRID_ROW_H = 228

// ── Main component ──────────────────────────────────────────────────

export function Inventory({
  oeuvres, tM, sM, cM, pM, locMap, statusLabelMap,
  techniques, supports, formats = [], themes = [], groups = [],
  contacts = [], addresses = [], presentations = [],
  selection, setSelection, onOpen,
  oeuvreThemeIdsByOeuvre = {},
  oeuvreGroupIdsByOeuvre = {},
  oeuvresCatalogueTotal,
  onLoadMore,
  isAdmin = false,
  onJunctionSaved,
  onOeuvrePatched,
  onOeuvreRemoved,
  inventoryDrawerGuardRef,
  onInventoryPanelDirtyChange,
}: SharedProps & {
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats?:       { FormatID:    number; Format:    string | null }[]
  themes?:        { id: number; name: string }[]
  groups?:        { id: string; name: string }[]
  contacts?:      { ContactID: number; NomInstitution: string | null; Nom: string | null; Prénom: string | null; Role: string | null; Ville?: string | null; Pays?: string | null }[]
  addresses?:     ContactAddress[]
  presentations?: { PresentationID: number; Nom: string | null }[]
  /** From RSC (oeuvre_theme / working_group_work); avoids duplicate client fetch */
  oeuvreThemeIdsByOeuvre?: Record<number, number[]>
  oeuvreGroupIdsByOeuvre?: Record<number, string[]>
  /** When set and greater than `oeuvres.length`, inventory counts are a loaded subset of the catalogue. */
  oeuvresCatalogueTotal?: number
  /** Called when the user scrolls near the bottom of the list — triggers next page load. */
  onLoadMore?: () => void
  /** Admin-only controls in embedded WorkDrawer (field sessions, etc.). */
  isAdmin?: boolean
  onJunctionSaved?: (oeuvreId: number, themeIds: number[], groupIds: string[]) => void
  onOeuvrePatched?: (oeuvreId: number, patch: Partial<Oeuvre>) => void
  onOeuvreRemoved?: (oeuvreIds: number[]) => void
  inventoryDrawerGuardRef?: RefObject<WorkDrawerGuardHandle | null>
  onInventoryPanelDirtyChange?: (dirty: boolean) => void
}) {
  /** contact_addresses.id → label, for the custodian · address column. */
  const addrMap = useMemo(() => {
    const m: Record<number, string> = {}
    for (const a of addresses) if (a.id != null) m[a.id] = a.label || a.ville || ''
    return m
  }, [addresses])
  const { t } = useI18n()
  const embeddingStatusMap = useNonOkEmbeddingStatuses()

  const router = useRouter()
  const localPanelGuardRef = useRef<WorkDrawerGuardHandle>(null)
  const panelDrawerGuardRef = inventoryDrawerGuardRef ?? localPanelGuardRef

  const handlePanelDirtyChange = useCallback(
    (dirty: boolean) => {
      onInventoryPanelDirtyChange?.(dirty)
    },
    [onInventoryPanelDirtyChange],
  )

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
  const invCountDenominatorPartial =
    oeuvresCatalogueTotal != null && oeuvres.length < oeuvresCatalogueTotal

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
    // A column click takes over from the colour ranking (the colour filter itself stays).
    setColourRank('off')
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
  // Phone: the ~11 controls above the list sit behind one "Filtres" button (owner review 2026-11-12).
  const [phoneTools,  setPhoneTools]  = useState(false)
  const [showImagesZip, setShowImagesZip] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [loadingGrp,  setLoadingGrp]  = useState<string | null>(null)
  const [filterTheme, setFilterTheme] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')
  /** 'all' | 'none' | period id; same for sources. */
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  /** 'all' | 'none' | place id — the work's place, else its period's (Pem 2026-11-14). */
  const [filterPlace, setFilterPlace] = useState('all')
  const [showPeriods, setShowPeriods] = useState(false)
  const periodSource = usePeriodSource()
  const periodOf = useCallback(
    (o: Oeuvre): WorkPeriod | null => effectivePeriod(o.OeuvreID, workWhen(o), periodSource).period,
    [periodSource],
  )
  const placeOf = useCallback(
    (o: Oeuvre): EffectivePlace => effectivePlace(o.OeuvreID, workWhen(o), periodSource),
    [periodSource],
  )
  const sortedPlaces = useMemo(() => sortPlaces(periodSource.places), [periodSource.places])
  const sourceNameMap = useMemo(
    () => Object.fromEntries(periodSource.sources.map((x) => [x.id, x.name])) as Record<number, string>,
    [periodSource.sources],
  )
  const sortedPeriods = useMemo(
    () => [...periodSource.periods].sort((a, b) => a.start_year - b.start_year || a.id - b.id),
    [periodSource.periods],
  )
  const sortedSources = useMemo(
    () => [...periodSource.sources].sort((a, b) => a.name.localeCompare(b.name)),
    [periodSource.sources],
  )
  const [bulkSourceBusy, setBulkSourceBusy] = useState(false)
  const addSourceToSelection = useCallback(
    async (sourceId: number) => {
      if (!sourceId || selection.size === 0) return
      setBulkSourceBusy(true)
      try {
        const res = await addSourceToWorks(sourceId, Array.from(selection))
        if ('error' in res) {
          toast.error(`${t('error_prefix')} ${res.error}`)
          return
        }
        patchPeriodSource((d) => {
          const sourcesByWork = { ...d.sourcesByWork }
          for (const oid of res.added) {
            const cur = sourcesByWork[oid] ?? []
            if (!cur.includes(sourceId)) sourcesByWork[oid] = [...cur, sourceId]
          }
          return { ...d, sourcesByWork }
        })
        toast.success(
          t('ps_bulk_source_done_fmt')
            .replace('{name}', sourceNameMap[sourceId] ?? '')
            .replace('{n}', String(res.added.length)),
        )
      } finally {
        setBulkSourceBusy(false)
      }
    },
    [selection, sourceNameMap, t],
  )
  const [showColour, setShowColour] = useState(false)
  const [colourQ, setColourQ] = useState<ColourQuery>({ include: [], exclude: [], nearby: false })
  const [colourRank, setColourRank] = useState<ColourRank>('match')
  const [coverShares, setCoverShares] = useState<Record<number, ColourProfile> | null>(null)
  const [coverSharesLoading, setCoverSharesLoading] = useState(false)
  const nextCritId = useRef(0)

  // Apply a filter handed off from another tab (e.g. an Overview console row).
  // One-shot: `consumeInventoryFilter` clears it, so it never re-applies on re-mount.
  useEffect(() => {
    const handoff = consumeInventoryFilter()
    if (!handoff) return
    setCriteria(
      handoff.criteria.map((c) => ({
        id: nextCritId.current++,
        field: c.field,
        op: c.op,
        value: c.value ?? '',
      })),
    )
    setShowAdv(true)
  }, [])

  // Colour filter: palettes for the whole catalogue, fetched once when first needed.
  const colourInUse = showColour || isColourQueryActive(colourQ) || colourRank === 'mono'
  useEffect(() => {
    if (!colourInUse || coverShares || coverSharesLoading) return
    setCoverSharesLoading(true)
    void fetchCoverColourProfiles()
      .then((r) => {
        if ('error' in r) toast.error(t('error'))
        else setCoverShares(r)
      })
      .finally(() => setCoverSharesLoading(false))
  }, [colourInUse, coverShares, coverSharesLoading, t])

  // Drawer palette swatch → "works with this colour" (queued on navigation, or live event).
  useEffect(() => {
    const apply = (f: ColourFamily) => {
      setColourQ((prev) => ({ ...prev, include: [f], exclude: prev.exclude.filter((x) => x !== f) }))
      setColourRank('match')
      setShowColour(true)
    }
    const queued = consumeColourFilter()
    if (queued) apply(queued)
    const onEvt = (e: Event) => {
      consumeColourFilter()
      apply((e as CustomEvent<ColourFamily>).detail)
    }
    window.addEventListener(COLOUR_FILTER_EVENT, onEvt)
    return () => window.removeEventListener(COLOUR_FILTER_EVENT, onEvt)
  }, [])

  const colourScores = useMemo(() => {
    const filterOn = isColourQueryActive(colourQ)
    if (!coverShares || (!filterOn && colourRank !== 'mono')) return null
    const out = new Map<number, { match: number; mono: number; monoStrength: number }>()
    for (const [id, profile] of Object.entries(coverShares)) {
      const m = matchScore(profile, colourQ)
      if (m == null) continue
      const mono = colourRank === 'mono' ? monochromeScore(profile.s, colourQ.nearby) : { purity: 0, strength: 0 }
      out.set(Number(id), { match: m, mono: mono.purity, monoStrength: mono.strength })
    }
    return { filterOn, scores: out }
  }, [coverShares, colourQ, colourRank])

  const handlePanelWorkSaved = useCallback(
    (oeuvreId: number, patch: Partial<Oeuvre>) => {
      onOeuvrePatched?.(oeuvreId, patch)
      setFocused((prev) => (prev?.OeuvreID === oeuvreId ? { ...prev, ...patch } : prev))
    },
    [onOeuvrePatched],
  )

  useEffect(() => {
    if (!focused || panelDrawerGuardRef.current?.isDirty()) return
    const fresh = oeuvres.find((x) => x.OeuvreID === focused.OeuvreID)
    if (fresh && fresh !== focused) setFocused(fresh)
  }, [oeuvres, focused, panelDrawerGuardRef])

  const focusRowGuarded = useCallback((o: Oeuvre) => {
    if (!showPreview) {
      setFocused(o)
      return
    }
    if (focused?.OeuvreID === o.OeuvreID) {
      if (focused !== o) setFocused(o)
      return
    }
    if (!focused) {
      setFocused(o)
      return
    }
    const guard = panelDrawerGuardRef.current
    if (guard) guard.runGuarded(() => setFocused(o))
    else setFocused(o)
  }, [showPreview, focused, panelDrawerGuardRef])

  const allFields: FieldDef[] = useMemo(() => {
    if (oeuvres.length === 0) return []
    const sample = oeuvres[0]
    const keys = Object.keys(sample)
    
    // Curated order for known fields
    const FIELD_LABELS = buildFieldLabels(t)
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
        t: getFieldType(k, oeuvreField(sample, k))
      }))

    // Add virtual curation fields for advanced filter
    fields.push({ k: '_theme', l: t('theme'), t: 'lookup' })
    fields.push({ k: '_group', l: t('const_viewGroup'), t: 'lookup' })
    fields.push({ k: '_hasImage', l: t('inv_field_has_image'), t: 'lookup' })

    return fields
  }, [oeuvres, t])

  const handleLoadGroup = useCallback(async (id: string, mode: 'select' | 'filter' = 'select') => {
    setLoadingGrp(id)
    const sb = createClient()
    const { data } = await sb.from('working_group_work')
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

  // Phone keeps its own view (default grid: the wide table scrolls sideways); desktop keeps its own.
  // Saved only when the user picks a view (an effect used to write the initial value first).
  const viewKey = narrow ? 'pem_inv_view_phone' : 'pem_inv_view'
  useEffect(() => {
    // Pivot is a one-off analysis view: reopening the Inventory always shows the works
    // (owner 2026-11-03 landed on an empty-looking pivot and lost the list).
    let saved: View | null = null
    try {
      saved = localStorage.getItem(viewKey) as View | null
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked is not an error
    } catch {
      // storage blocked: fall back to the default view
    }
    setView(saved && saved !== 'pivot' ? saved : narrow ? 'grid' : 'list')
  }, [viewKey, narrow])
  const chooseView = (next: View) => {
    setView(next)
    try {
      localStorage.setItem(viewKey, next)
    // eslint-disable-next-line pem-i18n/no-silent-catch -- storage blocked is not an error
    } catch {
      // storage blocked: the choice still applies for this visit
    }
  }

  const filtered = useMemo(() => {
    const trimmedQ = q.trim()
    const sq = trimmedQ.toLowerCase()
    
    // ID list / ranges: leading #, or bare "1-10, 20" (digits + separators only)
    let idSet: Set<number> | null = null
    if (trimmedQ.startsWith('#') && trimmedQ.length > 1) {
      idSet = parseIdRanges(trimmedQ)
    } else if (looksLikeIdOnlyQuery(trimmedQ)) {
      const parsed = parseIdRanges(trimmedQ)
      if (parsed.size > 0) idSet = parsed
    }

    return oeuvres.filter((o) => {
      // Colour filter: works without a cover palette drop out while it is active.
      if (colourScores?.filterOn && !colourScores.scores.has(o.OeuvreID)) return false
      if (idSet) {
        if (!idSet.has(o.OeuvreID)) return false
      } else if (sq) {
        const themeNames = (oeuvreThemeMap.get(o.OeuvreID) ?? []).map(tid => thM[tid] ?? '').join(' ')
        const groupNames = (oeuvreGroupMap.get(o.OeuvreID) ?? []).map(gid => groupNameMap[gid] ?? '').join(' ')
        const periodName = periodOf(o)?.name ?? ''
        const pl = placeOf(o).place
        const placeName = pl ? `${pl.name} ${pl.town ?? ''}` : ''
        const sourceNames = (periodSource.sourcesByWork[o.OeuvreID] ?? []).map((id) => sourceNameMap[id] ?? '').join(' ')
        const sourceNotes = Object.values(periodSource.sourceNotes[o.OeuvreID] ?? {}).join(' ')
        const bag = `${o.Titre ?? ''} #${o.OeuvreID} ${o.Technique != null ? (tM[o.Technique] ?? '') : ''} ${o.Support != null ? (sM[o.Support] ?? '') : ''} ${themeNames} ${groupNames} ${periodName} ${placeName} ${sourceNames} ${sourceNotes}`.toLowerCase()
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

      // Period filter (automatic from the year, unless set by hand)
      if (filterPeriod !== 'all') {
        const pid = periodOf(o)?.id ?? null
        if (filterPeriod === 'none' ? pid != null : pid !== Number(filterPeriod)) return false
      }

      // Place filter (own place, else the period's)
      if (filterPlace !== 'all') {
        const plid = placeOf(o).place?.id ?? null
        if (filterPlace === 'none' ? plid != null : plid !== Number(filterPlace)) return false
      }

      // Source filter
      if (filterSource !== 'all') {
        const sids = periodSource.sourcesByWork[o.OeuvreID] ?? []
        if (filterSource === 'none' ? sids.length > 0 : !sids.includes(Number(filterSource))) return false
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
        // Cover image: `txtImageNameLink` is excluded from allFields (trigger-managed),
        // so it needs a virtual field to be filterable at all.
        if (c.field === '_hasImage') {
          const has = typeof o.txtImageNameLink === 'string' && o.txtImageNameLink.trim() !== ''
          if (c.op === "n'est pas vide") return has
          if (c.op === 'est vide')       return !has
          return true
        }
        return matchesCriterion(o, c, allFields)
      })) return false
      return true
    }).sort((a, b) => {
      // ── Colour ranking (Couleurs panel) ──
      if (colourScores && colourRank !== 'off') {
        const sa = colourScores.scores.get(a.OeuvreID)
        const sb = colourScores.scores.get(b.OeuvreID)
        const va = sa ? (colourRank === 'mono' ? sa.mono : sa.match) : -1
        const vb = sb ? (colourRank === 'mono' ? sb.mono : sb.match) : -1
        if (va !== vb) return vb - va
        if (colourRank === 'mono' && sa && sb && sa.monoStrength !== sb.monoStrength) return sb.monoStrength - sa.monoStrength
      }

      // ── Sorting Logic ──
      const dir = sortDir === 'asc' ? 1 : -1
      
      if (sortKey === 'OeuvreID') return (a.OeuvreID - b.OeuvreID) * dir
      if (sortKey === 'Titre') return (a.Titre || '').localeCompare(b.Titre || '') * dir
      if (sortKey === 'Année') return ((extractYear(a.Année) || 0) - (extractYear(b.Année) || 0)) * dir
      if (sortKey === 'Prix') return ((a.Prix || 0) - (b.Prix || 0)) * dir
      if (sortKey === 'Period') {
        const pa = periodOf(a)
        const pb = periodOf(b)
        return ((pa?.start_year ?? 99999) - (pb?.start_year ?? 99999) || (pa?.name ?? '').localeCompare(pb?.name ?? '')) * dir
      }
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
        return custodyLabel(a, cM, locMap, addrMap).localeCompare(custodyLabel(b, cM, locMap, addrMap)) * dir
      }
      if (sortKey === 'Comm') {
        // Broadcast column: ready-to-broadcast works first (status has its own column/sort).
        const ba = (a as { broadcast_ready?: boolean }).broadcast_ready ? 1 : 0
        const bb = (b as { broadcast_ready?: boolean }).broadcast_ready ? 1 : 0
        return (bb - ba) * dir
      }

      return 0
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oeuvres, q, tech, support, status, filterTheme, filterGroup, filterPeriod, filterSource, filterPlace, periodOf, placeOf, periodSource, sourceNameMap, criteria, oeuvreThemeMap, oeuvreGroupMap, thM, groupNameMap, tM, sM, statusLabelMap, allFields, sortKey, sortDir, cM, locMap, addrMap, colourScores, colourRank])

  const invPivotDims: Dim<Oeuvre>[] = useMemo(
    () => [
      {
        id: 'technique',
        label: t('technique'),
        get: (o) => (o.Technique != null ? (tM[o.Technique] ?? String(o.Technique)) : '—'),
      },
      {
        id: 'year',
        label: t('year'),
        get: (o) => (yearOf(o.Année) != null ? String(yearOf(o.Année)) : '—'),
      },
      {
        id: 'status',
        label: t('status'),
        get: (o) => statusLabelMap[o.statusId ?? 0] ?? String(statusOf(o, statusLabelMap)),
      },
      {
        id: 'theme',
        label: t('theme'),
        get: (o) =>
          (oeuvreThemeMap.get(o.OeuvreID) ?? [])
            .map((tid) => thM[tid] ?? '')
            .filter(Boolean)
            .join(', ') || '—',
      },
      {
        id: 'workgroup',
        label: t('workingGroup'),
        get: (o) =>
          (oeuvreGroupMap.get(o.OeuvreID) ?? [])
            .map((gid) => groupNameMap[gid] ?? '')
            .filter(Boolean)
            .join(', ') || '—',
      },
      {
        id: 'location',
        label: t('localisation'),
        get: (o) => custodyLabel(o, cM, locMap, addrMap),
      },
      {
        id: 'anonymity',
        label: t('confidentiality'),
        get: (o) => (o.anonymity_level != null ? String(o.anonymity_level) : '—'),
      },
      {
        id: 'period',
        label: t('ps_period'),
        get: (o) => periodOf(o)?.name ?? '—',
      },
      {
        id: 'place',
        label: t('ps_place_made'),
        get: (o) => { const pl = placeOf(o).place; return pl ? pl.name : '—' },
      },
      {
        id: 'source',
        label: t('ps_source'),
        get: (o) =>
          (periodSource.sourcesByWork[o.OeuvreID] ?? [])
            .map((id) => sourceNameMap[id] ?? '')
            .filter(Boolean)
            .sort()
            .join(', ') || '—',
      },
    ],
    [t, tM, thM, groupNameMap, oeuvreThemeMap, oeuvreGroupMap, cM, locMap, addrMap, statusLabelMap, periodOf, placeOf, periodSource, sourceNameMap],
  )

  const invPivotValues: Agg<Oeuvre>[] = useMemo(
    () => [
      { id: 'count', label: t('pivotCount'), kind: 'count' },
      {
        id: 'sumPrice',
        label: `${t('pivotSum')} (${t('price')})`,
        kind: 'sum',
        get: (o) => Number((o as { PrixFinal?: number | null }).PrixFinal ?? o.Prix ?? 0),
      },
      {
        id: 'avgPrice',
        label: `${t('pivotAverage')} (${t('price')})`,
        kind: 'avg',
        get: (o) => Number((o as { PrixFinal?: number | null }).PrixFinal ?? o.Prix ?? 0),
      },
    ],
    [t],
  )

  const activeStages = useMemo(() => {
    const present = new Set(oeuvres.map(o => statusOf(o, statusLabelMap)))
    return [
      { k: 'en_production',   l: t('wf_prod_atelier_l'),              c: 'var(--rust)' },
      { k: 'available',       l: t('wf_prod_avail_l'),                c: 'var(--sage)' },
      { k: 'reserved',        l: t('wf_own_reserved_l'),              c: 'var(--magenta)' },
      { k: 'consigned',       l: t('wf_own_consigned_l'),             c: 'var(--magenta)' },
      { k: 'loan',            l: t('wf_own_loan_l'),                  c: 'var(--magenta)' },
      { k: 'sold',            l: t('wf_own_sold_l'),                  c: 'var(--teal)' },
      { k: 'gift',            l: t('wf_own_gift_l'),                  c: 'var(--tx)'   },
      { k: 'artist_archive',  l: t('wf_own_archive_l'),               c: 'var(--mt)'   },
      { k: 'destroyed',       l: t('status_destroyed'),               c: 'var(--tx3)'  },
      { k: 'lost',            l: t('status_lost'),                    c: 'var(--tx3)'  },
    ].filter(s => present.has(s.k as StatusKey))
  }, [oeuvres, statusLabelMap, t])

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

  const activeFilterCount =
    [filterTheme, filterGroup, filterPeriod, filterSource, filterPlace].filter((v) => v !== 'all').length +
    criteria.length +
    (isColourQueryActive(colourQ) ? 1 : 0)

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
        <div
          className="t-mono-sm"
          style={{ color: 'var(--tx3)', whiteSpace: 'nowrap', marginRight: 8 }}
          title={
            invCountDenominatorPartial
              ? t('atelier_header_works_badge_title')
              : undefined
          }
        >
          {filtered.length}
          <span style={{ opacity: 0.5 }}>/{oeuvres.length}</span>
        </div>

        {/* Search */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`${t('search')}${t('inventorySearchIdHint')}`}
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

        {narrow ? (
          <button
            type="button"
            data-testid="inv-phone-tools"
            aria-expanded={phoneTools}
            onClick={() => setPhoneTools((v) => !v)}
            className={`btn ${phoneTools ? 'primary' : 'ghost'} sm`}
            style={{ minHeight: 44, fontSize: 12 }}
          >
            {t('inv_phone_tools')}
            {activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} {phoneTools ? '▴' : '▾'}
          </button>
        ) : null}

        {!narrow || phoneTools ? (
        <>
        {/* Theme */}
        <InvSelect
          value={filterTheme} onChange={setFilterTheme}
          label={t('theme')}
          options={[['all', t('const_allThemes')], ...sortedThemes.map((x) => [String(x.id), x.name] as [string, string])]}
        />

        {/* Group */}
        <InvSelect
          value={filterGroup} onChange={setFilterGroup}
          label={t('const_viewGroup')}
          options={[['all', t('const_allGroups')], ...groups.map((x) => [x.id, x.name] as [string, string])]}
        />

        {/* Period */}
        <InvSelect
          value={filterPeriod} onChange={setFilterPeriod}
          label={t('ps_period')}
          options={[
            ['all', t('ps_filter_all_periods')],
            ['none', t('ps_filter_no_period')],
            ...sortedPeriods.map((x) => [String(x.id), x.name] as [string, string]),
          ]}
        />

        {/* Place (own, else the period's) */}
        <InvSelect
          value={filterPlace} onChange={setFilterPlace}
          label={t('ps_place_made')}
          options={[
            ['all', t('ps_filter_all_places')],
            ['none', t('ps_filter_no_place')],
            ...sortedPlaces.map((x) => [String(x.id), x.name] as [string, string]),
          ]}
        />

        {/* Source */}
        <InvSelect
          value={filterSource} onChange={setFilterSource}
          label={t('ps_source')}
          options={[
            ['all', t('ps_filter_all_sources')],
            ['none', t('ps_filter_no_source')],
            ...sortedSources.map((x) => [String(x.id), x.name] as [string, string]),
          ]}
        />

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--bd)', flexWrap: 'wrap' }}>
          {(
            [
              ['list', '≡', t('listView')],
              ['grid', '▦', t('gridView')],
              ['pivot', '⊞', t('pivotView')],
            ] as const
          ).map(([k, glyph, title], i, arr) => (
            <button
              key={k}
              type="button"
              onClick={() => chooseView(k)}
              title={title}
              style={{
                padding: '8px 14px', fontSize: 14,
                minHeight: 44,
                color: view === k ? 'var(--ac)' : 'var(--tx3)',
                background: view === k ? 'var(--bg2)' : 'transparent',
                borderRight: i < arr.length - 1 ? '1px solid var(--bd)' : 'none',
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

        {/* Colour filter toggle */}
        <button
          type="button"
          data-testid="inv-colour-toggle"
          aria-expanded={showColour}
          onClick={() => setShowColour((v) => !v)}
          style={{
            padding: '8px 12px', fontSize: 13,
            color: (showColour || isColourQueryActive(colourQ) || colourRank === 'mono') ? 'var(--bg0)' : 'var(--tx3)',
            background: (showColour || isColourQueryActive(colourQ) || colourRank === 'mono') ? 'var(--ac)' : 'transparent',
            border: '1px solid var(--bd)',
            cursor: 'pointer',
          }}
        >
          {isColourQueryActive(colourQ)
            ? t('inv_colour_btn_active_fmt').replace('{n}', String(colourQ.include.length + colourQ.exclude.length))
            : t('inv_colour_btn')}
        </button>

        {/* Periods + sources manager */}
        <button
          type="button"
          data-testid="inv-periods-toggle"
          aria-expanded={showPeriods}
          onClick={() => setShowPeriods((v) => !v)}
          style={{
            padding: '8px 12px', fontSize: 13,
            color: showPeriods ? 'var(--bg0)' : 'var(--tx3)',
            background: showPeriods ? 'var(--ac)' : 'transparent',
            border: '1px solid var(--bd)',
            cursor: 'pointer',
          }}
        >
          {t('ps_manage_short')}
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
          title={t('inv_title_select_all_shown')}
        >
          {t('selectAll')} ({filtered.length})
        </button>
        </>
        ) : null}

        {/* Selection count & Delete */}
        {selection.size > 0 && (
          <div className="row gap-sm" style={{ borderLeft: '1px solid var(--bd)', paddingLeft: 12, marginLeft: 4 }}>
            <button
              type="button"
              data-testid="inventory-clear-selection"
              onClick={() => {
                const prev = new Set(selection)
                setSelection(new Set())
                offerSelectionUndo(prev)
              }}
              className="btn ghost sm"
              style={{ fontSize: 12, padding: '8px 12px' }}
              title={t('selection_clear_title')}
            >
              ✕ {t('clear')} ({selection.size})
            </button>
            {/* Give one source to every selected work */}
            {sortedSources.length > 0 && (
              <select
                value=""
                disabled={bulkSourceBusy}
                aria-label={t('ps_bulk_source_label')}
                title={t('ps_bulk_source_label')}
                data-testid="inv-bulk-source"
                onChange={(e) => void addSourceToSelection(Number(e.target.value))}
                className="input"
                style={{ width: 'auto', fontSize: 12, padding: '6px 8px', minHeight: 36 }}
              >
                <option value="">{t('ps_bulk_source_pick')}</option>
                {sortedSources.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={async () => {
                if (!confirm(t('confirmMoveWorksToTrash'))) return
                const ids = Array.from(selection)
                const { deleteSelectedWorks, restoreSoftDeletedWorks } = await import('@/app/atelier/works/actions')
                const res = await deleteSelectedWorks(ids)
                if ('error' in res) {
                  const gate = gateErrorKey(stringifyError(res.error))
                  const msg =
                    res.error === 'work_delete_no_rows' || res.error === 'work_delete_partial'
                      ? t(res.error as 'work_delete_no_rows')
                      : gate ? t(gate) : `${t('error')}: ${stringifyError(res.error)}`
                  toast.error(msg)
                  if (res.deletedIds?.length) onOeuvreRemoved?.(res.deletedIds)
                  return
                }
                onOeuvreRemoved?.(res.deletedIds ?? ids)
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
              {t('delete')} ({selection.size})
            </button>
          </div>
        )}

        {/* Clear filters */}
        {(q || tech !== 'all' || support !== 'all' || status !== 'all' || filterTheme !== 'all' || filterGroup !== 'all' || filterPeriod !== 'all' || filterSource !== 'all' || criteria.length > 0) && (
          <button
            onClick={() => {
              setQ('')
              setTech('all')
              setSupport('all')
              setStatus('all')
              setFilterTheme('all')
              setFilterGroup('all')
              setFilterPeriod('all')
              setFilterPlace('all')
              setFilterSource('all')
              setCriteria([])
            }}
            className="btn ghost sm"
            style={{ fontSize: 12, padding: '6px 10px', color: 'var(--rust)' }}
          >
            {t('clear')}
          </button>
        )}

        {/* Rapport: Studio → Rapports on the Œuvres source, like Production / Kaizen / Ventes / Contacts */}
        {!narrow || phoneTools ? <ReportLinkButton source="works" style={{ minHeight: 36, fontSize: 12 }} /> : null}

        {/* Bulk image download — whatever the current filter shows (desktop only) */}
        {!narrow && (
          <button
            type="button"
            data-testid="inventory-images-zip"
            onClick={() => setShowImagesZip(true)}
            disabled={selection.size === 0 && filtered.length === 0}
            title={selection.size > 0 ? t('inv_images_zip_title_selection') : t('inv_images_zip_title')}
            className="btn ghost sm"
            style={{ fontSize: 12, padding: '8px 12px' }}
          >
            {/* Selection wins when there is one; otherwise whatever the filter shows. */}
            {t('curation_dock_download_images')}{' '}
            {interpolateMessage(t(selection.size > 0 ? 'inv_images_zip_selected_fmt' : 'inv_images_zip_shown_fmt'), {
              count: selection.size > 0 ? selection.size : filtered.length,
            })}
          </button>
        )}
        {showImagesZip && (
          <SelectionImagesDownloadModal
            ids={selection.size > 0 ? Array.from(selection) : filtered.map((o) => o.OeuvreID)}
            loadedOfTotal={selection.size === 0 && oeuvresCatalogueTotal != null ? { loaded: oeuvres.length, total: oeuvresCatalogueTotal } : undefined}
            onClose={() => setShowImagesZip(false)}
          />
        )}

        {/* Legend toggle */}
        {!narrow || phoneTools ? (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLegend((v) => !v)}
            title={t('inv_title_color_legend')}
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
              position: 'absolute', top: '100%', left: 0, zIndex: 60,
              background: 'var(--bg2)', border: '1px solid var(--bd2)',
              padding: '12px 16px', minWidth: 160, marginTop: 4, whiteSpace: 'nowrap',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div className="t-eyebrow" style={{ marginBottom: 12, fontSize: 11 }}>{t('legend')}</div>
              {activeStages.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>{t('inv_legend_empty')}</div>}
              {activeStages.map((it, i) => (
                <div key={i} className="row gap-sm" style={{ marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: it.c }} />
                  <div className="t-mono-sm" style={{ fontSize: 12 }}>{it.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        ) : null}


        {/* Preview toggle (desktop only: the side preview never shows on a phone) */}
        {!narrow ? (
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
          title={t('inv_title_toggle_side_preview')}
        >
          {showPreview ? `${t('inv_preview')} ◀` : `${t('inv_preview')} ▶`}
        </button>
        ) : null}


        {/* Selection count */}
        <div className="t-mono-sm" style={{ color: selection.size > 0 ? 'var(--ac)' : 'var(--tx3)', minWidth: narrow ? 0 : 60, textAlign: 'right' }}>
          {selection.size > 0 ? `${selection.size} ${t('selected')}` : ''}
        </div>
      </div>

      {showColour && (
        <ColourFilterPanel
          query={colourQ}
          setQuery={setColourQ}
          rank={colourRank}
          setRank={setColourRank}
          catalogueMatches={colourScores?.filterOn ? colourScores.scores.size : null}
          loading={coverSharesLoading}
          narrow={narrow}
        />
      )}

      {showPeriods && (
        <div style={{ padding: narrow ? '8px 12px' : '8px 28px' }}>
          <PeriodSourceManager works={oeuvres} onClose={() => setShowPeriods(false)} />
        </div>
      )}

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
              rows={filtered} tM={tM} sM={sM} cM={cM} locMap={locMap} addrMap={addrMap} statusLabelMap={statusLabelMap}
              embeddingStatusMap={embeddingStatusMap}
              focused={focused} setFocused={focusRowGuarded}
              selection={selection} setSelection={setSelection}
              sortKey={sortKey} sortDir={sortDir} toggleSort={toggleSort}
              onImageDoubleClick={() => { setShowPreview(true); setPreviewExpanded(true) }}
              onOpen={onOpen}
              onLoadMore={onLoadMore}
              periodName={(o) => periodOf(o)?.name ?? ''}
              placeOf={placeOf}
            />
            {showPreview && !narrow && (
              <WorkDrawer
                ref={panelDrawerGuardRef}
                o={focused}
                mode="panel"
                tM={tM} sM={sM} cM={cM} pM={pM} fM={fM} locMap={locMap}
                statusLabelMap={statusLabelMap}
                selection={selection} toggleInSel={toggleInSel}
                onClose={() => {
                  panelDrawerGuardRef.current?.runGuarded(() => setShowPreview(false))
                }}
                onEdit={onOpen}
                thM={thM} oeuvreThemeMap={oeuvreThemeMap} oeuvreGroupMap={oeuvreGroupMap}
                groupNameMap={groupNameMap}
                techniques={techniques} supports={supports} formats={formats}
                themes={themes} contacts={contacts} addresses={addresses} groups={groups}
                presentations={presentations}
                expanded={previewExpanded}
                setExpanded={setPreviewExpanded}
                isAdmin={isAdmin}
                onJunctionSaved={onJunctionSaved}
                onWorkSaved={handlePanelWorkSaved}
                onOeuvreRemoved={onOeuvreRemoved}
                onDrawerDirtyChange={handlePanelDirtyChange}
              />
            )}
          </>
        )}
        {view === 'grid' && (
          <InvGrid
            rows={filtered} tM={tM} statusLabelMap={statusLabelMap}
            embeddingStatusMap={embeddingStatusMap}
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
        {view === 'pivot' && (
          <div style={{ flex: 1, overflow: 'auto', padding: narrow ? 10 : 20, minHeight: 0 }}>
            <PivotPanel<Oeuvre>
              rows={filtered}
              availableDims={invPivotDims}
              availableValues={invPivotValues}
              defaultRowDimId="technique"
              defaultColDimId=""
              defaultValueIds={['count', 'sumPrice']}
              title={t('pivot')}
              exportFileName="inventory-pivot"
            />
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
                <option key={f.k} value={f.k}>{f.l}</option>
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
              type="button"
              onClick={() => removeCriterion(c.id)}
              aria-label={t('delete')}
              style={{ ...FIS, cursor: 'pointer', color: 'var(--tx3)', minHeight: 44, minWidth: 44 }}
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
  rows, tM, sM, cM, locMap, addrMap, statusLabelMap, embeddingStatusMap, focused, setFocused, selection, setSelection,
  sortKey, sortDir, toggleSort,
  onImageDoubleClick, onOpen, publicMode, onLoadMore, periodName, placeOf,
}: {
  rows:           Oeuvre[]
  tM:             Record<number, string>
  sM:             Record<number, string>
  cM:             Record<number, string>
  locMap:         Record<number, string>
  addrMap:        Record<number, string>
  statusLabelMap: Record<number, string>
  embeddingStatusMap: OeuvreEmbeddingStatusMap
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
  onLoadMore?:    () => void
  periodName?:    (o: Oeuvre) => string
  /** Second line of the period cell: the place (greyed when it comes from the period). */
  placeOf?:       (o: Oeuvre) => EffectivePlace
}) {
  const { t, lang } = useI18n()
  const lastSelIdxRef = useRef<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const visible = rows
  const isNarrow = useMediaQuery('(max-width: 359px)')
  // Owner 2026-11-13: the table fits its pane. When the list is narrow (drawer open, small screen),
  // dimensions + year and contact + location share a two-line column instead of running off the right.
  const [tableW, setTableW] = useState(0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setTableW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const tight = tableW > 0 && tableW < 1100

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !onLoadMore) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore() },
      { rootMargin: '300px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onLoadMore])
  const [bcOverride, setBcOverride] = useState<Record<number, boolean>>({})
  const [bcBusy, setBcBusy] = useState<number | null>(null)
  const routerInv = useRouter()
  async function toggleBroadcast(oid: number, next: boolean) {
    setBcOverride((p) => ({ ...p, [oid]: next }))
    setBcBusy(oid)
    try {
      const r = await batchEdit([oid], { broadcast_ready: next })
      if ('error' in r) {
        toast.error(r.error)
        setBcOverride((p) => { const n = { ...p }; delete n[oid]; return n })
        return
      }
      routerInv.refresh()
    } finally {
      setBcBusy(null)
    }
  }

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
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  const sortThRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    width: '100%',
  }
  const sortThLabel: React.CSSProperties = {
    minWidth: 0,
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
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
        minWidth: tight ? 720 : 980,
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
            <th onClick={() => toggleSort('OeuvreID')} style={{ ...headerBase, width: 44, color: 'var(--tx3)', cursor: 'pointer' }}>
              <div style={sortThRow}>
                <span style={sortThLabel}>ID</span>
                <span style={{ flexShrink: 0 }}><SortInd k="OeuvreID" current={sortKey} dir={sortDir} /></span>
              </div>
            </th>
            <th style={{ width: 44, padding: '8px 2px', ...cellDivider, background: 'var(--bg1)' }} />
            <th onClick={() => toggleSort('Titre')} style={{ ...headerBase, width: tight ? undefined : '18%', cursor: 'pointer' }}>
              <div style={sortThRow}>
                <span style={sortThLabel}>{t('title')}</span>
                <span style={{ flexShrink: 0 }}><SortInd k="Titre" current={sortKey} dir={sortDir} /></span>
              </div>
            </th>
            <th style={{ ...headerBase, width: tight ? undefined : '22%' }} title={t('concept_field_medium')}>{t('concept_field_medium')}</th>
            {tight ? (
              <th style={{ ...headerBase, width: 70 }} title={`${t('dimensions')} / ${t('year')}`}>
                <div style={sortThLabel}>{t('dimensions')}</div>
                <div onClick={() => toggleSort('Année')} style={{ ...sortThRow, cursor: 'pointer', color: 'var(--tx3)' }}>
                  <span style={sortThLabel}>{t('year')}</span>
                  <span style={{ flexShrink: 0 }}><SortInd k="Année" current={sortKey} dir={sortDir} /></span>
                </div>
              </th>
            ) : (
              <>
                <th style={{ ...headerBase, width: 70 }} title={t('dimensions')}>{t('dimensions')}</th>
                <th onClick={() => toggleSort('Année')} style={{ ...headerBase, width: 48, cursor: 'pointer' }}>
                  <div style={sortThRow}>
                    <span style={sortThLabel}>{t('year')}</span>
                    <span style={{ flexShrink: 0 }}><SortInd k="Année" current={sortKey} dir={sortDir} /></span>
                  </div>
                </th>
              </>
            )}
            <th onClick={() => toggleSort('Period')} style={{ ...headerBase, width: tight ? 74 : 90, cursor: 'pointer' }} title={t('ps_col_period')}>
              <div style={sortThRow}>
                <span style={sortThLabel}>{t('ps_col_period')}</span>
                <span style={{ flexShrink: 0 }}><SortInd k="Period" current={sortKey} dir={sortDir} /></span>
              </div>
            </th>
            <th onClick={() => toggleSort('Prix')} style={{ ...headerBase, width: tight ? 68 : 80, cursor: 'pointer' }}>
              <div style={sortThRow}>
                <span style={sortThLabel}>{t('price')}</span>
                <span style={{ flexShrink: 0 }}><SortInd k="Prix" current={sortKey} dir={sortDir} /></span>
              </div>
            </th>
            {tight ? (
              <th style={{ ...headerBase, width: 124 }}>
                <div onClick={() => toggleSort('Contact')} style={{ ...sortThRow, cursor: 'pointer' }}>
                  <span style={sortThLabel}>Contact</span>
                  <span style={{ flexShrink: 0 }}><SortInd k="Contact" current={sortKey} dir={sortDir} /></span>
                </div>
                <div onClick={() => toggleSort('Custodian')} style={{ ...sortThRow, cursor: 'pointer', color: 'var(--tx3)' }}>
                  <span style={sortThLabel}>{t('inv_col_location')}</span>
                  <span style={{ flexShrink: 0 }}><SortInd k="Custodian" current={sortKey} dir={sortDir} /></span>
                </div>
              </th>
            ) : (
              <>
                <th onClick={() => toggleSort('Contact')} style={{ ...headerBase, width: 100, cursor: 'pointer' }}>
                  <div style={sortThRow}>
                    <span style={sortThLabel}>Contact</span>
                    <span style={{ flexShrink: 0 }}><SortInd k="Contact" current={sortKey} dir={sortDir} /></span>
                  </div>
                </th>
                <th onClick={() => toggleSort('Custodian')} style={{ ...headerBase, width: 110, cursor: 'pointer' }}>
                  <div style={sortThRow}>
                    <span style={sortThLabel}>{t('inv_col_location')}</span>
                    <span style={{ flexShrink: 0 }}><SortInd k="Custodian" current={sortKey} dir={sortDir} /></span>
                  </div>
                </th>
              </>
            )}
            <th
              colSpan={2}
              onClick={() => toggleSort('Status')}
              style={{ ...headerBase, width: 116, cursor: 'pointer' }}
              title={t('inv_title_status_col')}
            >
              <div style={sortThRow}>
                <span style={sortThLabel}>{t('inv_col_status')}</span>
                <span style={{ flexShrink: 0 }}><SortInd k="Status" current={sortKey === 'Stage' ? 'Status' : sortKey} dir={sortDir} /></span>
              </div>
            </th>
            <th
              onClick={() => toggleSort('Comm')}
              style={{ ...headerBase, width: 72, cursor: 'pointer', borderRight: 'none' }}
              title={t('inv_title_broadcast_col')}
            >
              <div style={sortThRow}>
                <span style={sortThLabel}>{t('inv_col_broadcast')}</span>
                <span style={{ flexShrink: 0 }}><SortInd k="Comm" current={sortKey} dir={sortDir} /></span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr>
              <td colSpan={tight ? INV_TABLE_COLS - 2 : INV_TABLE_COLS} style={{ height: padTop, padding: 0, border: 'none', lineHeight: 0 }} />
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
                  <td style={{ color: 'var(--tx3)', fontSize: 11, padding: '0 2px', whiteSpace: 'nowrap', ...cellDivider, verticalAlign: 'middle' }}>
                    {o.OeuvreID}
                    {(() => {
                      if (!o.is_public) {
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
                    {/* Loupe (owner 2026-11-13): hover on a computer, long press on a phone — replaces the double-click that widened the panel. */}
                    <div 
                      className="thumb" 
                      style={{ 
                        width: 40, height: 40, cursor: o.txtImageNameLink ? 'zoom-in' : undefined, 
                        border: '1px solid var(--bd)', borderRadius: 2, overflow: 'hidden',
                        position: 'relative'
                      }}
                    >
                      {o.txtImageNameLink 
                        ? (
                          <ImageLoupe file={o.txtImageNameLink} alt={o.Titre ?? ''} style={{ width: '100%', height: '100%' }}>
                            <WorkThumb file={o.txtImageNameLink} alt={o.Titre ?? ''} size={96} displaySize="40px" />
                          </ImageLoupe>
                        )
                        : <MissingThumb id={o.OeuvreID} onOpen={() => onOpen(o)} />}
                    </div>
                  </td>
                  {/* Owner 2026-11-13: nothing cut silently — two lines, then the full text on hover. */}
                  <td title={o.Titre || undefined} style={{ color: 'var(--tx)', padding: '0 4px', ...cellDivider, verticalAlign: 'middle' }}>
                    <div style={INV_CLAMP2}>{o.Titre || '—'}</div>
                  </td>
                  {(() => {
                    const medium = [o.Technique != null ? (tM[o.Technique] ?? '') : '', o.Support != null ? (sM[o.Support] ?? '') : ''].filter(Boolean).join(' · ')
                    return (
                      <td title={medium || undefined} style={{ padding: '0 4px', opacity: 0.8, fontSize: 13, ...cellDivider, verticalAlign: 'middle' }}>
                        <div style={INV_CLAMP2}>{medium}</div>
                      </td>
                    )
                  })()}
                  {tight ? (
                    <td title={dims || undefined} style={{ padding: '0 4px', opacity: 0.8, fontSize: 12, lineHeight: 1.25, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', ...cellDivider, verticalAlign: 'middle' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{dims || '—'}</div>
                      <div style={{ color: 'var(--tx3)' }}>{yearOf(o.Année) ?? '—'}</div>
                    </td>
                  ) : (
                    <>
                      <td style={{ padding: '0 4px', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>{dims}</td>
                      <td style={{ padding: '0 4px', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>{yearOf(o.Année) ?? '—'}</td>
                    </>
                  )}
                  {(() => {
                    const pn = periodName?.(o) || ''
                    const ep = placeOf?.(o)
                    const pl = ep?.place ? placeLabel(ep.place) : ''
                    const tip = [pn, pl && (ep?.fromPeriod ? `${pl} (${t('ps_place_from_period_line')})` : pl)].filter(Boolean).join(' — ')
                    const one: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    return (
                      <td title={tip || undefined} style={{ padding: '0 4px', overflow: 'hidden', fontSize: 12, ...cellDivider, verticalAlign: 'middle' }}>
                        <div style={{ ...one, opacity: 0.8 }}>{pn || '—'}</div>
                        {ep?.place ? (
                          <div data-testid="inv-place" style={{ ...one, fontSize: 11, color: 'var(--tx3)', fontStyle: ep.fromPeriod ? 'italic' : 'normal' }}>{ep.place.name}</div>
                        ) : null}
                      </td>
                    )
                  })()}
                  <td title={o.Prix ? formatPriceFull(Number(o.Prix), lang) : undefined} style={{ padding: '0 6px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>{o.Prix ? formatPriceCompact(Number(o.Prix), lang) : '—'}</td>
                  {(() => {
                    const level = o.anonymity_level ?? 0
                    const contactName = o.ContactID != null ? (cM[o.ContactID] ?? '—') : 'Pem'
                    const contactEl = publicMode && level >= 1
                      ? <span style={{ opacity: 0.3 }}>{t('inv_masked')}</span>
                      : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                          <span title={contactName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{contactName}</span>
                          {level === 1 && <span title={t('inv_title_contact_hidden')} style={{ color: 'var(--ac)', flexShrink: 0 }}>👤</span>}
                          {level === 2 && <span title={t('inv_title_private')} style={{ opacity: 0.6, flexShrink: 0 }}>🔒</span>}
                        </span>
                      )
                    const custody = custodyLabel(o, cM, locMap, addrMap)
                    if (tight) {
                      return (
                        <td style={{ padding: '0 4px', overflow: 'hidden', opacity: 0.8, fontSize: 12, lineHeight: 1.25, ...cellDivider, verticalAlign: 'middle' }}>
                          {contactEl}
                          <div title={custody} style={{ color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{custody}</div>
                        </td>
                      )
                    }
                    return (
                      <>
                        <td style={{ padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>
                          {contactEl}
                        </td>
                        <td title={custody} style={{ padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.8, ...cellDivider, verticalAlign: 'middle' }}>
                          {custody}
                        </td>
                      </>
                    )
                  })()}
                  <td style={{ padding: '0 6px', overflow: 'hidden', whiteSpace: 'nowrap', verticalAlign: 'middle', ...cellDivider }} colSpan={2}>
                    <WorkStateChip o={o} statusLabelMap={statusLabelMap} compact />
                  </td>
                  <td style={{ padding: '0 4px', verticalAlign: 'middle', borderRight: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <EmbeddingStatusBadge
                        oeuvreId={o.OeuvreID}
                        status={embeddingStatusMap[o.OeuvreID]}
                      />
                      {!isNarrow && (() => {
                        const live = bcOverride[o.OeuvreID] ?? !!(o as { broadcast_ready?: boolean }).broadcast_ready
                        const busy = bcBusy === o.OeuvreID
                        return (
                          <input
                            type="checkbox"
                            data-testid={`inv-broadcast-toggle-${o.OeuvreID}`}
                            checked={live}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => { if (!busy) toggleBroadcast(o.OeuvreID, !live) }}
                            disabled={busy}
                            aria-label={t('bc_quick_toggle_aria')}
                            title={t('bc_quick_toggle_aria')}
                            style={{ width: 16, height: 16, accentColor: 'var(--ac)', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1 }}
                          />
                        )
                      })()}
                    </div>
                  </td>
                </tr>
            )
          })}
          {padBot > 0 && (
            <tr>
              <td colSpan={tight ? INV_TABLE_COLS - 2 : INV_TABLE_COLS} style={{ height: padBot, padding: 0, border: 'none', lineHeight: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > 500 && (
        <div className="t-mono-sm" style={{ padding: 16, textAlign: 'center', color: 'var(--tx3)' }}>
          {interpolateMessage(t('inv_rows_shown_fmt'), { count: rows.length })}
        </div>
      )}
      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  )
}

// ── InvGrid ─────────────────────────────────────────────────────────

function InvGrid({
  rows,
  tM,
  statusLabelMap,
  embeddingStatusMap,
  selection,
  toggleInSel,
  onOpen,
}: {
  rows:           Oeuvre[]
  tM:             Record<number, string>
  statusLabelMap: Record<number, string>
  embeddingStatusMap: OeuvreEmbeddingStatusMap
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
            <ImageLoupe file={o.txtImageNameLink} alt={o.Titre ?? ''} style={{ width: '100%', height: '100%' }}>
              <WorkThumb file={o.txtImageNameLink} alt={o.Titre ?? ''} size={160} displaySize="100%" />
            </ImageLoupe>
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
        <div style={{ marginBottom: 4 }}>
          <EmbeddingStatusBadge
            oeuvreId={o.OeuvreID}
            status={embeddingStatusMap[o.OeuvreID]}
          />
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

