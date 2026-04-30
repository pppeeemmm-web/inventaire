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

// PEM's own ContactID — default owner when ContactID is null
const PEM_CONTACT_ID = 13

// ── Advanced filter ─────────────────────────────────────────────────
interface Criterion { id: number; field: string; op: string; value: string; value2?: string }

const FIELD_DEFS = [
  { k: 'OeuvreID',        l: 'ID',            t: 'num'    },
  { k: 'Titre',            l: 'Title',         t: 'text'   },
  { k: 'Technique',        l: 'Technique',    t: 'lookup' },
  { k: 'Support',          l: 'Support',      t: 'lookup' },
  { k: '_theme',           l: 'Theme',         t: 'lookup' },
  { k: 'Année',            l: 'Year',           t: 'year'   },
  { k: 'Prix',             l: 'Prix',           t: 'num'    },
  { k: 'PrixFinal',        l: 'Final price',  t: 'num'    },
  { k: 'Exposable',        l: 'Exhibitable',  t: 'bool'   },
  { k: 'Catalogué',        l: 'Catalogued',   t: 'bool'   },
  { k: 'Encadree',         l: 'Framed',       t: 'bool'   },
  { k: 'Tirage',           l: 'Tirage',         t: 'text'   },
  { k: 'Commentaires',     l: 'Notes',        t: 'text'   },
  { k: 'statusId',          l: 'Status',        t: 'lookup' },
  { k: 'ContactID',        l: 'Contact',       t: 'lookup' },
  { k: 'LocalisationID',   l: 'Location',      t: 'lookup' },
  { k: 'txtImageNameLink', l: 'Image',         t: 'text'   },
] as const

type FieldKey = typeof FIELD_DEFS[number]['k']

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

function matchesCriterion(o: Oeuvre, c: Criterion): boolean {
  const fld = FIELD_DEFS.find((f) => f.k === c.field)
  if (!fld) return true
  const raw = (o as Record<string, unknown>)[c.field]
  const val = raw != null ? String(raw) : ''
  const cv  = c.value ?? ''
  switch (c.op) {
    case 'contient':          return val.toLowerCase().includes(cv.toLowerCase())
    case 'ne contient pas':   return !val.toLowerCase().includes(cv.toLowerCase())
    case '=':                 return val === cv
    case '≠':                 return val !== cv
    case '>':                 return Number(val) > Number(cv)
    case '<':                 return Number(val) < Number(cv)
    case '≥':                 return Number(val) >= Number(cv)
    case '≤':                 return Number(val) <= Number(cv)
    case 'est vide':          return raw == null || raw === ''
    case "n'est pas vide":    return raw != null && raw !== ''
    case '= vrai':            return raw === true
    case '= faux':            return !raw
    // ── Year operators ─────────────────────────────────────────────
    case 'between': {
      if (c.field !== 'Année') return true
      const yr  = extractYear(raw)
      const lo  = parseInt(cv)
      const hi  = parseInt(c.value2 ?? cv)
      return !isNaN(yr) && yr >= Math.min(lo, hi) && yr <= Math.max(lo, hi)
    }
    default: {
      // For year fields with numeric ops, compare extracted year
      const fld2 = FIELD_DEFS.find((f) => f.k === c.field)
      if (fld2?.t === 'year') {
        const yr = extractYear(raw)
        const n  = parseInt(cv)
        switch (c.op) {
          case '=':  return yr === n
          case '>':  return yr >  n
          case '<':  return yr <  n
          case '≥':  return yr >= n
          case '≤':  return yr <= n
        }
      }
      return true
    }
  }
}

function parseIdRanges(input: string): Set<number> {
  const ids = new Set<number>()
  input.split(',').forEach((part) => {
    const p = part.trim()
    const range = p.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const a = parseInt(range[1]), b = parseInt(range[2])
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) ids.add(i)
    } else if (/^\d+$/.test(p)) {
      ids.add(parseInt(p))
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
  const [idInput,     setIdInput]     = useState('')
  const [showAdv,     setShowAdv]     = useState(false)
  const [showGroups,  setShowGroups]  = useState(false)
  const [loadingGrp,  setLoadingGrp]  = useState<string | null>(null)
  const nextCritId = useRef(0)

  const handleLoadGroup = useCallback(async (id: string) => {
    setLoadingGrp(id)
    const sb = createClient()
    const { data } = await (sb.from('working_group_work') as any)
      .select('oeuvre_id')
      .eq('group_id', id)
    if (data) setSelection(new Set((data as { oeuvre_id: number }[]).map((r) => r.oeuvre_id)))
    setShowGroups(false)
    setLoadingGrp(null)
  }, [setSelection])

  // OeuvreTheme junction: Map<OeuvreID, ThemeID[]>
  const [oeuvreThemeMap, setOeuvreThemeMap] = useState<Map<number, number[]>>(new Map())
  useEffect(() => {
    const sb = createClient()
    ;(sb.from('OeuvreTheme') as any).select('OeuvreID, ThemeID').then(({ data }: { data: { OeuvreID: number; ThemeID: number }[] | null }) => {
      if (!data) return
      const map = new Map<number, number[]>()
      data.forEach(({ OeuvreID, ThemeID }) => {
        if (!map.has(OeuvreID)) map.set(OeuvreID, [])
        map.get(OeuvreID)!.push(ThemeID)
      })
      setOeuvreThemeMap(map)
    })
  }, [])

  const thM = useMemo(
    () => Object.fromEntries(themes.map((t) => [t.ThemeID, t.Nom])),
    [themes],
  )

  const fM = useMemo(
    () => Object.fromEntries(formats.map((f) => [f.FormatID, f.Format ?? ''])),
    [formats],
  )

  useEffect(() => {
    const saved = localStorage.getItem('pem_inv_view') as View | null
    if (saved) setView(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem('pem_inv_view', view)
  }, [view])

  const filtered = useMemo(() => {
    const sq = q.trim().toLowerCase()
    return oeuvres.filter((o) => {
      if (sq) {
        const bag = `${o.Titre ?? ''} #${o.OeuvreID} ${o.Technique != null ? (tM[o.Technique] ?? '') : ''} ${o.Support != null ? (sM[o.Support] ?? '') : ''}`.toLowerCase()
        if (!bag.includes(sq)) return false
      }
      if (tech !== 'all' && String(o.Technique ?? '') !== tech) return false
      if (support !== 'all' && String(o.Support ?? '') !== support) return false
      if (status !== 'all' && statusOf(o, statusLabelMap) !== status) return false
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
        return matchesCriterion(o, c)
      })) return false
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oeuvres, q, tech, support, status, tM, sM, statusLabelMap, criteria, oeuvreThemeMap])

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
  function selectByIds() {
    if (!idInput.trim()) return
    const ids = parseIdRanges(idInput)
    const next = new Set(selection)
    oeuvres.forEach((o) => { if (ids.has(o.OeuvreID)) next.add(o.OeuvreID) })
    setSelection(next)
    setIdInput('')
  }

  // passed to InvList for range selection

  const statusOptions: [string, string][] = [
    ['all', 'Tous'],
    ['studio',    'Atelier'],
    ['consigned', 'Consigné'],
    ['sold',      'Vendu'],
    ['loan',      'Prêt'],
    ['wip',       'En cours'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Filter bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto auto auto auto auto',
        gap: 8,
        padding: '12px 28px',
        borderBottom: '1px solid var(--bd)',
        alignItems: 'center',
      }}>
        {/* Count */}
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
          {filtered.length}<span style={{ opacity: 0.5 }}>/{oeuvres.length}</span>
        </div>

        {/* Search */}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search')}
          style={{
            padding: '7px 10px',
            background: 'var(--bg1)',
            border: '1px solid var(--bd)',
            color: 'var(--tx)',
            fontSize: 11,
          }}
        />

        {/* Technique */}
        <InvSelect
          value={tech} onChange={setTech}
          label={t('technique')}
          options={[['all', t('allTech')], ...techniques.map((x) => [String(x.TechniqueID), x.Technique ?? ''] as [string, string])]}
        />

        {/* Support */}
        <InvSelect
          value={support} onChange={setSupport}
          label={t('support')}
          options={[['all', t('allSupports')], ...supports.map((x) => [String(x.SupportID), x.Support ?? ''] as [string, string])]}
        />

        {/* Status */}
        <InvSelect
          value={status} onChange={setStatus}
          label={t('status')}
          options={statusOptions}
        />

        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--bd)' }}>
          {([['list', '≡', t('listView')], ['grid', '▦', t('gridView')], ['graph', '✦', t('graphView')]] as const).map(([k, glyph, title]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              title={title}
              style={{
                padding: '6px 10px', fontSize: 12,
                color: view === k ? 'var(--ac)' : 'var(--tx3)',
                background: view === k ? 'var(--bg2)' : 'transparent',
                borderRight: k !== 'graph' ? '1px solid var(--bd)' : 'none',
              }}
            >{glyph}</button>
          ))}
        </div>

        {/* Advanced filter toggle */}
        <button
          onClick={() => setShowAdv((v) => !v)}
          style={{
            padding: '7px 10px', fontSize: 11,
            color: (showAdv || criteria.length > 0) ? 'var(--ac)' : 'var(--tx3)',
            background: (showAdv || criteria.length > 0) ? 'var(--bg2)' : 'transparent',
            border: '1px solid var(--bd)',
            cursor: 'pointer',
          }}
        >
          {criteria.length > 0 ? `Filtres (${criteria.length})` : 'Filtres +'}
        </button>

        {/* Saved groups */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowGroups((v) => !v)}
            style={{
              padding: '7px 10px', fontSize: 11,
              color: showGroups ? 'var(--ac)' : 'var(--tx3)',
              background: showGroups ? 'var(--bg2)' : 'transparent',
              border: '1px solid var(--bd)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Groupes {groups.length > 0 ? `(${groups.length})` : ''}
          </button>
          {showGroups && groups.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 50,
              background: 'var(--bg2)', border: '1px solid var(--bd2)',
              minWidth: 220, marginTop: 4,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleLoadGroup(g.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 12px', fontSize: 11,
                    color: loadingGrp === g.id ? 'var(--ac)' : 'var(--tx)',
                    background: 'transparent',
                    borderBottom: '1px solid var(--bd)',
                    cursor: 'pointer',
                  }}
                >
                  {loadingGrp === g.id ? '…' : '▶ '}{g.name}
                </button>
              ))}
            </div>
          )}
          {showGroups && groups.length === 0 && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 50,
              background: 'var(--bg2)', border: '1px solid var(--bd2)',
              padding: '10px 14px', fontSize: 11, color: 'var(--tx3)',
              marginTop: 4,
            }}>
              Aucun groupe sauvegardé
            </div>
          )}
        </div>

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
          idInput={idInput} setIdInput={setIdInput}
          onSelectByIds={selectByIds}
          tM={tM} sM={sM} cM={cM} thM={thM} statusLabelMap={statusLabelMap}
        />
      )}

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {view === 'list' && (
          <>
            <InvList
              rows={filtered} tM={tM} sM={sM} statusLabelMap={statusLabelMap}
              focused={focused} setFocused={setFocused}
              selection={selection} setSelection={setSelection}
            />
            <InvPreview
              o={focused} tM={tM} sM={sM} cM={cM} pM={pM} locMap={locMap} statusLabelMap={statusLabelMap}
              selection={selection} toggleInSel={toggleInSel}
              onOpen={onOpen}
            />
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
  idInput, setIdInput, onSelectByIds,
  tM, sM, cM, thM, statusLabelMap,
}: {
  criteria:       Criterion[]
  setCriteria:    (c: Criterion[]) => void
  nextCritId:     React.MutableRefObject<number>
  idInput:        string
  setIdInput:     (s: string) => void
  onSelectByIds:  () => void
  tM:             Record<number, string>
  sM:             Record<number, string>
  cM:             Record<number, string>
  thM:            Record<number, string>
  statusLabelMap: Record<number, string>
}) {
  const IS: React.CSSProperties = {
    fontFamily: 'inherit', fontSize: 10,
    background: 'var(--bg1)', border: '1px solid var(--bd)',
    color: 'var(--tx)', padding: '3px 6px', outline: 'none',
  }

  function lookupOpts(field: string): [string, string][] {
    if (field === 'Technique')      return Object.entries(tM).sort((a,b) => a[1].localeCompare(b[1])).map(([k,v]) => [k, v])
    if (field === 'Support')        return Object.entries(sM).sort((a,b) => a[1].localeCompare(b[1])).map(([k,v]) => [k, v])
    if (field === '_theme')         return Object.entries(thM).sort((a,b) => a[1].localeCompare(b[1])).map(([k,v]) => [k, v])
    if (field === 'statusId')        return Object.entries(statusLabelMap).map(([k,v]) => [k, v])
    if (field === 'ContactID' || field === 'LocalisationID')
                                    return Object.entries(cM).sort((a,b) => a[1].localeCompare(b[1])).map(([k,v]) => [k, v])
    return []
  }

  function addCriterion() {
    const id = nextCritId.current++
    setCriteria([...criteria, { id, field: 'Titre', op: 'contient', value: '' }])
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
      {/* ID range selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="t-mono-sm" style={{ color: 'var(--tx3)', minWidth: 24 }}>IDs</span>
        <input
          value={idInput}
          onChange={(e) => setIdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSelectByIds()}
          placeholder="4, 10–20, 204"
          style={{ ...IS, width: 160 }}
        />
        <button
          onClick={onSelectByIds}
          style={{ ...IS, cursor: 'pointer' }}
        >
          Sélectionner
        </button>
        <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
          — adds to current selection
        </span>
      </div>

      {/* Criteria rows */}
      {criteria.map((c) => {
        const fld  = FIELD_DEFS.find((f) => f.k === c.field) ?? FIELD_DEFS[0]
        const ops  = opsForType(fld.t)
        const opts = lookupOpts(c.field)
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Field */}
            <select
              value={c.field}
              onChange={(e) => {
                const newFld = FIELD_DEFS.find((f) => f.k === e.target.value) ?? FIELD_DEFS[0]
                updateCriterion(c.id, { field: e.target.value, op: opsForType(newFld.t)[0], value: '' })
              }}
              style={{ ...IS, maxWidth: 130 }}
            >
              {FIELD_DEFS.map((f) => <option key={f.k} value={f.k}>{f.l}</option>)}
            </select>

            {/* Operator */}
            <select
              value={c.op}
              onChange={(e) => updateCriterion(c.id, { op: e.target.value })}
              style={{ ...IS, maxWidth: 150 }}
            >
              {ops.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>

            {/* Value — hidden for bool and empty/notEmpty ops */}
            {fld.t !== 'bool' && !noValue(c.op) && (
              opts.length > 0 ? (
                <select
                  value={c.value}
                  onChange={(e) => updateCriterion(c.id, { value: e.target.value })}
                  style={{ ...IS, maxWidth: 180 }}
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
                    style={{ ...IS, width: 72 }}
                  />
                  <span className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '0 4px' }}>≤ x ≤</span>
                  <input
                    type="number"
                    value={c.value2 ?? ''}
                    onChange={(e) => updateCriterion(c.id, { value2: e.target.value })}
                    placeholder="to"
                    style={{ ...IS, width: 72 }}
                  />
                </>
              ) : (
                <input
                  type={fld.t === 'num' || fld.t === 'year' ? 'number' : 'text'}
                  value={c.value}
                  onChange={(e) => updateCriterion(c.id, { value: e.target.value })}
                  placeholder={fld.t === 'year' ? '2020' : ''}
                  style={{ ...IS, width: 100 }}
                />
              )
            )}

            {/* Remove */}
            <button
              onClick={() => removeCriterion(c.id)}
              style={{ ...IS, cursor: 'pointer', color: 'var(--tx3)' }}
            >✕</button>
          </div>
        )
      })}

      {/* Add criterion */}
      <button
        onClick={addCriterion}
        style={{ ...IS, cursor: 'pointer', color: 'var(--ac)', border: '1px dashed var(--bd)', alignSelf: 'flex-start', padding: '3px 12px' }}
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
  rows, tM, sM, statusLabelMap, focused, setFocused, selection, setSelection,
}: {
  rows:           Oeuvre[]
  tM:             Record<number, string>
  sM:             Record<number, string>
  statusLabelMap: Record<number, string>
  focused:        Oeuvre | null
  setFocused:     (o: Oeuvre) => void
  selection:      Set<number>
  setSelection:   (s: Set<number>) => void
}) {
  const { t } = useI18n()
  const lastSelIdxRef = useRef<number | null>(null)
  const visible = rows

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
    <div style={{ flex: 1, minWidth: 0, overflow: 'auto', borderRight: '1px solid var(--bd)' }}>
      <table className="tbl" style={{ tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th style={{ width: 32 }}></th>
            <th style={{ width: 40 }}>ID</th>
            <th style={{ width: 64 }}></th>
            <th>{t('title')}</th>
            <th>{t('technique')}</th>
            <th>{t('support')}</th>
            <th className="num">{t('dimensions')}</th>
            <th className="num">{t('year')}</th>
            <th>{t('status')}</th>
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
            return (
              <tr
                key={o.OeuvreID}
                onClick={() => setFocused(o)}
                style={{
                  background: isFoc ? 'var(--bg2)' : sBg,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${sCol === 'transparent' ? 'var(--bd)' : sCol}`,
                }}
              >
                {/* Checkbox — full-cell hit area, shift+click for range */}
                <td
                  style={{ textAlign: 'center', padding: '0 8px', cursor: 'pointer' }}
                  onClick={(e) => handleCheck(e, o.OeuvreID, idx)}
                  title="Cliquer pour sélectionner · Maj+clic pour sélectionner une plage"
                >
                  <div style={{
                    width: 16, height: 16, margin: '0 auto',
                    border: `1.5px solid ${isSel ? 'var(--ac)' : 'var(--bd2)'}`,
                    background: isSel ? 'var(--ac)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: 'var(--bg0)', lineHeight: 1,
                    transition: 'background 0.1s, border-color 0.1s',
                  }}>
                    {isSel ? '✓' : ''}
                  </div>
                </td>
                {/* Inline edit button */}
                <td style={{ padding: '0 4px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/atelier/works/${o.OeuvreID}/edit`) }}
                    title="Éditer"
                    style={{
                      padding: '2px 6px', fontSize: 10,
                      color: 'var(--tx3)', background: 'transparent',
                      border: '1px solid transparent', cursor: 'pointer',
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ac)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--tx3)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
                  >✎</button>
                </td>
                <td style={{ color: 'var(--tx3)', fontSize: 9 }}>{o.OeuvreID}</td>
                {/* Thumb */}
                <td>
                  <div className="thumb" style={{ width: 52, height: 52 }}>
                    {o.txtImageNameLink
                      ? <img src={thumbUrl(o.txtImageNameLink, 96) ?? ''} loading="lazy" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div className="ph" style={{ fontSize: 8 }}>—</div>}
                  </div>
                </td>
                <td style={{ color: 'var(--tx)' }}>{o.Titre || '—'}</td>
                <td>{o.Technique != null ? (tM[o.Technique] ?? '—') : '—'}</td>
                <td>{o.Support != null ? (sM[o.Support] ?? '—') : '—'}</td>
                <td className="num">{dims}</td>
                <td className="num">{yearOf(o.Année) ?? '—'}</td>
                <td><StatusChip s={st} /></td>
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
  o, tM, sM, cM, pM, locMap, statusLabelMap, selection, toggleInSel, onOpen,
}: {
  o:              Oeuvre | null
  tM:             Record<number, string>
  sM:             Record<number, string>
  cM:             Record<number, string>
  pM:             Record<number, string>
  locMap:         Record<number, string>
  statusLabelMap: Record<number, string>
  selection:      Set<number>
  toggleInSel:    (id: number) => void
  onOpen:         (o: Oeuvre) => void
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

  // Owner/contact: default to PEM if not set
  const ownerLabel = o.ContactID != null
    ? (cM[o.ContactID] ?? 'Pem')
    : 'Pem'

  function fmtDate(d: string | null | undefined) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('fr-FR') } catch { return d }
  }

  // ── Hover-expand + wheel zoom (1×–2×) ───────────────────────────────
  // Compact (default): 380px panel, square crop
  // Expanded (hover or zoomed): up to 50vw panel, fixed-height image container.
  //   objectFit:contain shows native proportions without the container growing to
  const isExpanded = hovered || imgZoom > 1

  // Active image: filmstrip selection → fall back to o.txtImageNameLink
  const activeImgPath = workImages.length > 0 && activeImgIdx >= 0
    ? workImages[activeImgIdx]?.txtImageNameLink ?? o.txtImageNameLink
    : o.txtImageNameLink

  // ── Drawer width drives everything, no square starting point ─
  // The image is always width:100% height:auto (fit, native proportions).
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

  const flexBasis = !isExpanded
    ? '380px'
    : isPortrait
      ? 'min(33vw, 600px)'
      : isSquare
        ? 'min(50vw, 900px)'
        : 'min(44vw, 800px)'

  const scaleVal = imgZoom

  return (
    // Hover target is the whole panel — not just the image.
    // This prevents flicker when moving mouse from image to metadata below.
    <div
      style={{
        flex: `0 0 ${flexBasis}`,
        padding: 24,
        overflow: 'auto',
        background: 'var(--bg1)',
        borderLeft: '1px solid var(--bd)',
        transition: 'flex-basis 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        isDragging.current = false
        if (imgZoom <= 1) setHovered(false)
      }}
    >
      {/* Header row: ID + edit button + zoom indicator */}
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
        {imgZoom > 1 && (
          <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
            ×{imgZoom.toFixed(1)}
          </span>
        )}
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
                display: 'block', width: '100%', height: 'auto',
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
        <div className="t-label" style={{ paddingTop: 8 }}>{t('exposable')}</div>
        <div style={{ color: o.Exposable ? 'var(--sage)' : 'var(--tx3)', paddingTop: 8 }}>{o.Exposable ? '✓' : '—'}</div>

        <div className="t-label">{t('framed')}</div>
        <div style={{ color: o.Encadree ? 'var(--tx2)' : 'var(--tx3)' }}>{o.Encadree ? '✓' : '—'}</div>

        <div className="t-label">{t('catalogued')}</div>
        <div style={{ color: o.Catalogué ? 'var(--tx2)' : 'var(--tx3)' }}>{o.Catalogué ? '✓' : '—'}</div>

        <div className="t-label">Public</div>
        <div style={{ color: (o as any).is_public ? 'var(--cyan)' : 'var(--tx3)' }}>{(o as any).is_public ? '✓' : '—'}</div>

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
