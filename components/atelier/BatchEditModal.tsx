'use client'

// BatchEditModal — edit many works at once, laid out like a mixing desk (B2, design pass
// 2026-11-13, mock `docs/design/2026-11-13/Batch.dc.html`). Every field starts "unchanged"
// (quiet grey, em dash); a field that will change turns gold (dot, label, border, row tint, ✕).
// The footer repeats what Apply will do. Only fields explicitly set are sent to `batchEdit`.
// Non-admins only see what the server lets them change in bulk (period, place made, broadcast,
// themes, groups — `batchEdit` returns `bulk_admin_only` for the rest).

import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { batchEdit, createTheme, createWorkingGroup, type BatchChanges } from '@/app/atelier/selection/actions'
import { reloadAtelierAfterBatchSuccess } from '@/lib/atelier/reload-after-batch'
import { gateErrorKey } from '@/lib/work-save-error'
import { surfaceError } from '@/lib/error-reporter/client'
import { PEM_CONTACT_ID, yearOf } from '@/lib/data'
import { usePeriodSource } from '@/lib/atelier/use-period-source'
import { placeLabel, sortPeriods, sortPlaces } from '@/lib/work-periods'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { calendarDayInParisFromIso } from '@/lib/session-calendar-day'
import type { Oeuvre } from '@/lib/types/database'

type ContactAddress = { id?: number; contact_id: number; label: string; adresse: string | null; ville: string | null; pays: string | null }

interface Props {
  ids:            number[]
  /** Loaded works — used for the selection strip only (no extra query). */
  oeuvres?:       Oeuvre[]
  /** Theme ids per work, as already loaded by the portal — gives the n/N chip counts. */
  themeIdsByWork?: Map<number, number[]>
  isAdmin:        boolean
  techniques:     { TechniqueID: number; Technique: string | null }[]
  supports:       { SupportID:   number; Support:   string | null }[]
  formats:        { FormatID:    number; Format:    string | null }[]
  addresses?:     ContactAddress[]
  themes:         { id: number; name: string }[]
  groups?:        { id: string; name: string }[]
  statusLabelMap: Record<number, string>
  tM?:            Record<number, string>
  onClose:        () => void
  onDone:         (count: number) => void
}

// Tri-state for boolean fields: null = unchanged, true/false = set
type Tri = null | boolean
type Flag = { key: string; label: string; value: Tri; set: (v: Tri) => void; testId?: string; adminOnly: boolean }

const GOLD_TINT = 'color-mix(in srgb, var(--ac) 7%, transparent)'

export function BatchEditModal({
  ids, oeuvres = [], themeIdsByWork, isAdmin, techniques, supports, formats, addresses = [],
  themes: initialThemes, groups: initialGroups = [], statusLabelMap, tM = {}, onClose, onDone,
}: Props) {
  const { t } = useI18n()
  const fmt = (key: Parameters<typeof t>[0], vars: Record<string, string | number>) => interpolateMessage(t(key), vars)
  const narrow = useMediaQuery('(max-width: 767px)')
  const [pending, startEdit] = useTransition()
  const [error,   setError]  = useState<string | null>(null)
  const N = ids.length

  // Local lists so a theme / group created here shows (and is selected) at once.
  const [localThemes, setLocalThemes] = useState(initialThemes)
  const [localGroups, setLocalGroups] = useState(initialGroups)
  const [creating, setCreating] = useState<'theme' | 'group' | null>(null)

  // Scalar fields — '' = unchanged
  const [titre,     setTitre]     = useState('')
  const [statusId,  setStatusId]  = useState('')
  const [technique, setTechnique] = useState('')
  const [support,   setSupport]   = useState('')
  const [format,    setFormat]    = useState('')
  const [prix,      setPrix]      = useState('')
  const [discount,  setDiscount]  = useState('')
  const [annee,     setAnnee]     = useState('')
  const [addressId, setAddressId] = useState('')
  const [locDetail, setLocDetail] = useState('')
  const [note,      setNote]      = useState('')
  /** '' unchanged · 'auto' · 'none' · period id */
  const [period,    setPeriod]    = useState('')
  const periodData = usePeriodSource()
  const periods = useMemo(() => sortPeriods(periodData.periods), [periodData.periods])
  /** '' unchanged · 'none' clear · place id (A3) */
  const [place, setPlace] = useState('')
  const places = useMemo(() => sortPlaces(periodData.places), [periodData.places])

  // Boolean fields — null = unchanged
  const [exposable,      setExposable]      = useState<Tri>(null)
  const [montee,         setMontee]         = useState<Tri>(null)
  const [encadree,       setEncadree]       = useState<Tri>(null)
  const [catalogued,     setCatalogued]     = useState<Tri>(null)
  const [isCommission,   setIsCommission]   = useState<Tri>(null)
  const [isGift,         setIsGift]         = useState<Tri>(null)
  const [isPaid,         setIsPaid]         = useState<Tri>(null)
  const [needsPhoto,     setNeedsPhoto]     = useState<Tri>(null)
  const [broadcastReady, setBroadcastReady] = useState<Tri>(null)

  // Junctions — ids to add / remove
  // One state per junction so quick successive clicks never read a stale set.
  const [themeSel, setThemeSel] = useState<JunctionSel<number>>(EMPTY_SEL as JunctionSel<number>)
  const [groupSel, setGroupSel] = useState<JunctionSel<string>>(EMPTY_SEL as JunctionSel<string>)
  const addThemes = themeSel.add, removeThemes = themeSel.rm
  const addGroups = groupSel.add, removeGroups = groupSel.rm
  const [themeFilter,  setThemeFilter]  = useState('')
  const [groupFilter,  setGroupFilter]  = useState('')

  function resetAll() {
    setTitre(''); setStatusId(''); setTechnique(''); setSupport(''); setFormat('')
    setPrix(''); setDiscount(''); setAnnee(''); setAddressId(''); setLocDetail(''); setNote(''); setPeriod(''); setPlace('')
    for (const s of [setExposable, setMontee, setEncadree, setCatalogued, setIsCommission, setIsGift, setIsPaid, setNeedsPhoto, setBroadcastReady]) s(null)
    setThemeSel(EMPTY_SEL as JunctionSel<number>); setGroupSel(EMPTY_SEL as JunctionSel<string>)
    setError(null)
  }

  const cycleTheme = (id: number) => setThemeSel(prev => cycleSel(prev, id))
  const cycleGroup = (id: string) => setGroupSel(prev => cycleSel(prev, id))

  async function handleCreate(kind: 'theme' | 'group') {
    const name = (kind === 'theme' ? themeFilter : groupFilter).trim()
    if (!name) return
    setCreating(kind)
    if (kind === 'theme') {
      const res = await createTheme(name)
      if (res.theme) {
        const th = res.theme
        setLocalThemes(prev => prev.some(x => x.id === th.id) ? prev : [...prev, th])
        setThemeSel(prev => ({ add: new Set(prev.add).add(th.id), rm: prev.rm }))
        setThemeFilter('')
      } else if (res.error) setError(res.error)
    } else {
      const res = await createWorkingGroup(name)
      if (res.group) {
        const g = res.group
        setLocalGroups(prev => prev.some(x => x.id === g.id) ? prev : [...prev, g])
        setGroupSel(prev => ({ add: new Set(prev.add).add(g.id), rm: prev.rm }))
        setGroupFilter('')
      } else if (res.error) setError(res.error)
    }
    setCreating(null)
  }

  /** Pem's own addresses (Atelier, Principal, …) — the only bulk address choice. */
  const pemAddresses = addresses.filter(a => a.contact_id === PEM_CONTACT_ID)

  // Dropdowns sorted alphabetically. Studio stages only (owner 2026-11-03): orders move works out.
  const sortedStatuses = Object.entries(statusLabelMap)
    .map(([id, label]) => ({ id: Number(id), label }))
    .filter(({ id }) => id === 1 || id === 2 || id === 3)
    .sort((a, b) => a.label.localeCompare(b.label))
  const sortedTechniques = [...techniques].sort((a, b) => (a.Technique ?? '').localeCompare(b.Technique ?? ''))
  const sortedSupports   = [...supports].sort((a, b) => (a.Support ?? '').localeCompare(b.Support ?? ''))
  const sortedFormats    = [...formats].sort((a, b) => (a.Format ?? '').localeCompare(b.Format ?? ''))

  // ── Selection strip (works already in memory) ──────────────────────────
  const selected = useMemo(() => {
    const want = new Set(ids)
    return oeuvres.filter(o => want.has(o.OeuvreID))
  }, [ids, oeuvres])
  const summary = useMemo(() => {
    const techs = new Set(selected.map(o => o.Technique).filter((x): x is number => x != null))
    const years = selected.map(o => yearOf(o.Année)).filter((y): y is number => y != null)
    const st = new Map<string, number>()
    for (const o of selected) {
      const l = o.statusId != null ? statusLabelMap[o.statusId] : null
      if (l) st.set(l, (st.get(l) ?? 0) + 1)
    }
    const parts = [fmt('bm_selected', { n: N })]
    if (techs.size === 1) parts.push(tM[[...techs][0]] ?? '')
    else if (techs.size > 1) parts.push(fmt('bm_techniques_n', { n: techs.size }))
    if (years.length) {
      const lo = Math.min(...years); const hi = Math.max(...years)
      parts.push(lo === hi ? String(lo) : `${lo} – ${hi}`)
    }
    const mix = [...st.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l, n]) => `${n} ${l}`)
    if (mix.length) parts.push(mix.join(', '))
    return parts.filter(Boolean).join(' · ')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, statusLabelMap, tM, N])

  const themeCount = useMemo(() => {
    if (!themeIdsByWork) return null
    const m = new Map<number, number>()
    for (const id of ids) for (const th of themeIdsByWork.get(id) ?? []) m.set(th, (m.get(th) ?? 0) + 1)
    return m
  }, [ids, themeIdsByWork])

  // ── Flags (all live yes/no fields) ─────────────────────────────────────
  const cap = (x: string) => x.charAt(0).toLocaleUpperCase() + x.slice(1)
  const flags: Flag[] = [
    { key: 'framed',     label: t('framed'),     value: encadree,     set: setEncadree,     adminOnly: true },
    { key: 'montee',     label: t('montee'),     value: montee,       set: setMontee,       adminOnly: true },
    { key: 'paid',       label: t('paid'),       value: isPaid,       set: setIsPaid,       adminOnly: true },
    { key: 'gift',       label: t('gift'),       value: isGift,       set: setIsGift,       adminOnly: true },
    { key: 'commission', label: t('commission'), value: isCommission, set: setIsCommission, adminOnly: true },
    { key: 'catalogued', label: t('catalogued'), value: catalogued,   set: setCatalogued,   adminOnly: true },
    { key: 'exposable',  label: t('exposable'),  value: exposable,    set: setExposable,    adminOnly: true },
    { key: 'needsPhoto', label: t('needsPhoto'), value: needsPhoto,   set: setNeedsPhoto,   adminOnly: true },
    { key: 'broadcast',  label: t('wf_broadcast_ready'), value: broadcastReady, set: setBroadcastReady, adminOnly: false, testId: 'batch-broadcast-ready-tri' },
  ].filter(f => isAdmin || !f.adminOnly).map(f => ({ ...f, label: cap(f.label) })) as Flag[]

  // ── What Apply will do (drives the gold states, the footer and the count) ─
  const optLabel = <T,>(list: T[], v: string, id: (x: T) => number, lab: (x: T) => string | null) =>
    v === 'null' ? t('remove') : (lab(list.find(x => String(id(x)) === v) as T) ?? v)
  const periodLabel = period === 'auto' ? t('batch_period_auto') : period === 'none' ? t('ps_period_none')
    : periods.find(p => String(p.id) === period)?.name ?? period
  const changes: { k: string; text: string }[] = []
  const add = (on: boolean, k: string, label: string, value?: string) => { if (on) changes.push({ k, text: value != null ? `${label} → ${value}` : label }) }
  add(statusId !== '', 'status', t('status'), statusLabelMap[Number(statusId)])
  add(annee !== '', 'year', t('year'), annee.trim() || t('remove'))
  add(titre !== '', 'title', t('title'), titre.trim() || t('remove'))
  add(technique !== '', 'technique', t('technique'), optLabel(sortedTechniques, technique, x => x.TechniqueID, x => x?.Technique ?? null))
  add(support !== '', 'support', t('support'), optLabel(sortedSupports, support, x => x.SupportID, x => x?.Support ?? null))
  add(format !== '', 'format', t('bm_format'), optLabel(sortedFormats, format, x => x.FormatID, x => x?.Format ?? null))
  add(period !== '', 'period', t('ps_period'), periodLabel)
  add(place !== '', 'place', t('ps_place_made'), place === 'none' ? t('remove') : places.find(p => String(p.id) === place)?.name ?? place)
  add(prix !== '', 'price', t('price'), `${prix} €`)
  add(discount !== '', 'discount', t('discount'), `${discount} %`)
  add(locDetail !== '', 'loc', t('localisationDetail'), locDetail.trim() || t('remove'))
  add(addressId !== '', 'address', t('batch_pem_address'), pemAddresses.find(a => String(a.id) === addressId)?.label)
  for (const f of flags) add(f.value !== null, f.key, f.label, f.value ? t('yes') : t('no'))
  if (addThemes.size || removeThemes.size) changes.push({ k: 'themes', text: `${t('bm_chip_themes')} ${[addThemes.size ? `+${addThemes.size}` : '', removeThemes.size ? `−${removeThemes.size}` : ''].filter(Boolean).join(' ')}` })
  if (addGroups.size || removeGroups.size) changes.push({ k: 'groups', text: `${t('bm_chip_groups')} ${[addGroups.size ? `+${addGroups.size}` : '', removeGroups.size ? `−${removeGroups.size}` : ''].filter(Boolean).join(' ')}` })
  add(note.trim() !== '', 'note', t('bm_chip_note'))
  const K = changes.length

  function handleSubmit() {
    const c: BatchChanges = {}
    if (titre      !== '') c.Titre      = titre.trim() || null
    if (statusId   !== '') c.statusId   = statusId  === 'null' ? null : Number(statusId)
    if (technique  !== '') c.Technique  = technique === 'null' ? null : Number(technique)
    if (support    !== '') c.Support    = support   === 'null' ? null : Number(support)
    if (format     !== '') c.Format     = format    === 'null' ? null : Number(format)
    if (addressId  !== '') c.localisation_address_id = Number(addressId)
    if (prix       !== '') c.Prix       = parseFloat(prix)
    if (discount   !== '') c.Discount   = parseFloat(discount)
    if (annee      !== '') c.Année      = annee.trim() || null
    if (locDetail  !== '') c.LocalisationDetail = locDetail.trim() || null
    if (note.trim() !== '') c.Commentaires = note.trim()
    if (period     !== '') c.periodChoice = period === 'auto' || period === 'none' ? period : Number(period)
    if (place      !== '') c.placeChoice  = place === 'none' ? 'none' : Number(place)

    if (exposable      !== null) c.Exposable       = exposable
    if (montee         !== null) c.Montee          = montee
    if (encadree       !== null) c.Encadree        = encadree
    if (catalogued     !== null) c['Catalogué']    = catalogued
    if (isCommission   !== null) c.IsCommission    = isCommission
    if (isGift         !== null) c.is_gift         = isGift
    if (isPaid         !== null) c.is_paid         = isPaid
    if (needsPhoto     !== null) c.NeedsPhotograph = needsPhoto
    if (broadcastReady !== null) c.broadcast_ready = broadcastReady

    if (addThemes.size    > 0) c.addThemeIds    = [...addThemes]
    if (removeThemes.size > 0) c.removeThemeIds = [...removeThemes]
    if (addGroups.size    > 0) c.addGroupIds    = [...addGroups]
    if (removeGroups.size > 0) c.removeGroupIds = [...removeGroups]

    // PrixFinal follows Prix / Discount
    if (c.Prix !== undefined) {
      const p = c.Prix ?? 0
      const d = c.Discount ?? 0
      if (p > 0) c.PrixFinal = d > 0 ? Math.round(p * (1 - d / 100)) : p
    }

    startEdit(async () => {
      try {
        const r = await batchEdit(ids, c)
        if ('error' in r) { const gate = gateErrorKey(r.error); setError(gate ? t(gate) : r.error); return }
        onDone(r.updated)
        reloadAtelierAfterBatchSuccess()
      } catch (e) {
        setError(String(e))
        surfaceError(String(e), e, { source: 'batch-edit' })
      }
    })
  }

  // ── Building blocks (hoisted below the component so inputs keep focus) ──
  const rowH = narrow ? 46 : 28
  const seg = (on: boolean, unchangedSeg: boolean) => segStyle(on, unchangedSeg, narrow)
  const rowProps = { narrow, resetLabel: (f: string) => fmt('bm_reset_field', { f }) }

  const filteredThemes = localThemes
    .filter(th => th.name.toLowerCase().includes(themeFilter.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const filteredGroups = localGroups
    .filter(g => g.name.toLowerCase().includes(groupFilter.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const themeExists = localThemes.some(x => x.name.toLowerCase() === themeFilter.trim().toLowerCase())
  const groupExists = localGroups.some(x => x.name.toLowerCase() === groupFilter.trim().toLowerCase())
  const junctionSummary = (a: number, r: number) => (a || r ? fmt('bm_chip_added_removed', { a, r }) : null)

  const searchRow = (value: string, onChange: (v: string) => void, ph: string, createLabel: string, kind: 'theme' | 'group', exists: boolean) => (
    <div style={{ display: 'flex', gap: 6, padding: '6px 12px', borderBottom: '1px solid var(--bg2)' }}>
      <input aria-label={ph} placeholder={ph} value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && value.trim() && !exists) void handleCreate(kind) }}
        style={{ flex: 1, minWidth: 0, height: narrow ? 40 : 26, boxSizing: 'border-box', padding: '0 8px', background: 'var(--bg0)', border: '1px solid var(--bd2)', borderRadius: 2, color: 'var(--tx)', font: 'inherit' }} />
      <button type="button" onClick={() => handleCreate(kind)} disabled={!value.trim() || exists || creating !== null}
        style={{ flex: 'none', height: narrow ? 40 : 26, padding: '0 10px', background: 'none', border: '1px solid var(--bd2)', borderRadius: 2, color: 'var(--tx2)', font: 'inherit', fontSize: 12, cursor: 'pointer', opacity: !value.trim() || exists ? 0.5 : 1 }}>
        {creating === kind ? '…' : createLabel}
      </button>
    </div>
  )

  // ── Columns ────────────────────────────────────────────────────────────
  const identity = (
    <>
      <SectionHead>{t('bm_sec_identity')}</SectionHead>
      {isAdmin && (
        <>
          <Row {...rowProps} label={t('status')} active={statusId !== ''} onReset={() => setStatusId('')} htmlFor="bm-status" help={t('batch_status_studio_help')}>
            <Select narrow={narrow} id="bm-status" value={statusId} onChange={setStatusId}>
              {sortedStatuses.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </Select>
          </Row>
          <Row {...rowProps} label={t('year')} active={annee !== ''} onReset={() => setAnnee('')} htmlFor="bm-year">
            <Text narrow={narrow} id="bm-year" value={annee} onChange={setAnnee} />
          </Row>
          <Row {...rowProps} label={t('title')} active={titre !== ''} onReset={() => setTitre('')} htmlFor="bm-title">
            <Text narrow={narrow} id="bm-title" value={titre} onChange={setTitre} placeholder={fmt('bm_title_ph', { n: N })} />
          </Row>
          <Row {...rowProps} label={t('technique')} active={technique !== ''} onReset={() => setTechnique('')} htmlFor="bm-tech">
            <Select narrow={narrow} id="bm-tech" value={technique} onChange={setTechnique}>
              <option value="null">{t('remove')}</option>
              {sortedTechniques.map(x => <option key={x.TechniqueID} value={x.TechniqueID}>{x.Technique}</option>)}
            </Select>
          </Row>
          <Row {...rowProps} label={t('support')} active={support !== ''} onReset={() => setSupport('')} htmlFor="bm-support">
            <Select narrow={narrow} id="bm-support" value={support} onChange={setSupport}>
              <option value="null">{t('remove')}</option>
              {sortedSupports.map(x => <option key={x.SupportID} value={x.SupportID}>{x.Support}</option>)}
            </Select>
          </Row>
          <Row {...rowProps} label={t('bm_format')} active={format !== ''} onReset={() => setFormat('')} htmlFor="bm-format">
            <Select narrow={narrow} id="bm-format" value={format} onChange={setFormat}>
              <option value="null">{t('remove')}</option>
              {sortedFormats.map(x => <option key={x.FormatID} value={x.FormatID}>{x.Format}</option>)}
            </Select>
          </Row>
        </>
      )}
      <Row {...rowProps} stack label={t('ps_period')} active={period !== ''} onReset={() => setPeriod('')}>
        <div role="group" aria-label={t('ps_period')} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1.5fr)', minWidth: 0 }}>
          <button type="button" aria-pressed={period === ''} onClick={() => setPeriod('')} style={seg(period === '', true)}>—</button>
          <button type="button" aria-pressed={period === 'auto'} onClick={() => setPeriod('auto')} style={{ ...seg(period === 'auto', false), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t('batch_period_auto')}>{t('bm_period_auto_short')}</button>
          <button type="button" aria-pressed={period === 'none'} onClick={() => setPeriod('none')} style={{ ...seg(period === 'none', false), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t('ps_period_none')}>{t('bm_period_none_short')}</button>
          <select data-testid="batch-period" aria-label={t('bm_period_named')}
            value={period !== '' && period !== 'auto' && period !== 'none' ? period : ''}
            onChange={e => setPeriod(e.target.value)}
            style={{ ...seg(period !== '' && period !== 'auto' && period !== 'none', false), minWidth: 0, padding: '0 4px' }}>
            <option value="">{t('bm_period_named')}</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </Row>
      <Row {...rowProps} label={t('ps_place_made')} active={place !== ''} onReset={() => setPlace('')} htmlFor="bm-place">
        <Select narrow={narrow} id="bm-place" testId="batch-place" value={place} onChange={setPlace}>
          <option value="none">{t('remove')}</option>
          {places.map(p => <option key={p.id} value={p.id}>{placeLabel(p)}</option>)}
        </Select>
      </Row>
    </>
  )

  const priceAndLocation = isAdmin ? (
    <>
      <SectionHead>{t('bm_sec_price')}</SectionHead>
      <Row {...rowProps} label={`${t('price')} (€)`} active={prix !== ''} onReset={() => setPrix('')} htmlFor="bm-price">
        <Text narrow={narrow} id="bm-price" type="number" value={prix} onChange={setPrix} />
      </Row>
      <Row {...rowProps} label={`${t('discount')} (%)`} active={discount !== ''} onReset={() => setDiscount('')} htmlFor="bm-disc">
        <Text narrow={narrow} id="bm-disc" type="number" value={discount} onChange={setDiscount} />
      </Row>
      <SectionHead>{t('bm_sec_location')}</SectionHead>
      <Row {...rowProps} label={t('localisationDetail')} active={locDetail !== ''} onReset={() => setLocDetail('')} htmlFor="bm-loc">
        <Text narrow={narrow} id="bm-loc" value={locDetail} onChange={setLocDetail} />
      </Row>
      <Row {...rowProps} label={t('batch_pem_address')} active={addressId !== ''} onReset={() => setAddressId('')} htmlFor="bm-pem" help={t('batch_pem_address_help')}>
        <Select narrow={narrow} id="bm-pem" value={addressId} onChange={setAddressId}>
          {pemAddresses.map(a => <option key={a.id} value={a.id}>{a.label}{a.ville ? ` — ${a.ville}` : ''}</option>)}
        </Select>
      </Row>
    </>
  ) : (
    <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tx3)' }}>{t('bm_admin_only_hint')}</div>
  )

  const flagsBlock = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr) 56px 56px 56px' : 'minmax(0, 1fr) 52px 52px 52px', alignItems: 'center', height: 26, padding: '0 12px', background: 'var(--bg2)', borderBottom: '1px solid var(--bd)', ...SECTION_TEXT }}>
        <h3 style={{ margin: 0, font: 'inherit' }}>{t('bm_sec_flags')}</h3>
        <span style={{ textAlign: 'center' }}>—</span>
        <span style={{ textAlign: 'center' }}>{t('yes')}</span>
        <span style={{ textAlign: 'center' }}>{t('no')}</span>
      </div>
      {flags.map(f => {
        const changed = f.value !== null
        return (
          <div key={f.key} role="radiogroup" aria-label={f.label} data-testid={f.testId}
            style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr) 56px 56px 56px' : 'minmax(0, 1fr) 52px 52px 52px', alignItems: 'center', minHeight: rowH, padding: '0 12px', borderBottom: '1px solid var(--bg2)', background: changed ? GOLD_TINT : undefined }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, color: changed ? 'var(--ac)' : 'var(--tx3)', fontWeight: changed ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.label}>
              {changed && <GoldDot />}{f.label}
            </span>
            <button type="button" role="radio" aria-checked={f.value === null} aria-label="—" onClick={() => f.set(null)} style={seg(f.value === null, true)}>—</button>
            <button type="button" role="radio" aria-checked={f.value === true} onClick={() => f.set(true)} style={seg(f.value === true, false)}>{t('yes')}</button>
            <button type="button" role="radio" aria-checked={f.value === false} onClick={() => f.set(false)} style={seg(f.value === false, false)}>{t('no')}</button>
          </div>
        )
      })}
    </>
  )

  const noteActive = note.trim() !== ''
  const noteBlock = isAdmin ? (
    <>
      <SectionHead active={noteActive} borderTop>
        <label htmlFor="bm-note" style={{ font: 'inherit' }}>{t('batch_note_add')}</label>
      </SectionHead>
      <div style={{ flex: narrow ? undefined : 1, display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: noteActive ? 'color-mix(in srgb, var(--ac) 5%, transparent)' : undefined }}>
        <textarea id="bm-note" data-testid="batch-note-add" value={note} onChange={e => setNote(e.target.value)} placeholder={t('batch_note_add_ph')}
          style={{ height: narrow ? 72 : 52, boxSizing: 'border-box', padding: '6px 8px', background: noteActive ? 'var(--bg2)' : 'transparent', border: `1px solid ${noteActive ? 'var(--ac)' : 'var(--bd)'}`, borderRadius: 2, color: 'var(--tx)', font: 'inherit', resize: 'none' }} />
        {noteActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 8px', border: '1px dashed var(--bd2)', borderRadius: 2, fontSize: 12 }}>
            <span style={{ color: 'var(--tx3)' }}>{fmt('bm_note_each', { n: N })}</span>
            <span style={{ overflowWrap: 'anywhere' }}><b style={{ color: 'var(--ac)' }}>{calendarDayInParisFromIso(new Date().toISOString())}</b> — {note.trim()}</span>
            <span style={{ color: 'var(--tx3)' }}>{t('bm_note_kept')}</span>
          </div>
        )}
      </div>
    </>
  ) : null

  const themesActive = addThemes.size > 0 || removeThemes.size > 0
  const groupsActive = addGroups.size > 0 || removeGroups.size > 0
  const themesBlock = (
    <>
      <SectionHead active={themesActive} extra={junctionSummary(addThemes.size, removeThemes.size)}>{t('themesSection')}</SectionHead>
      {searchRow(themeFilter, setThemeFilter, t('bm_search_themes'), t('bm_new_theme'), 'theme', themeExists)}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 12px', fontSize: 11, color: 'var(--tx3)', borderBottom: '1px solid var(--bg2)' }}>
        <span>{t('bm_chip_help')}</span>
        {themeCount && <><span style={{ flex: 1 }} /><span>{fmt('bm_chip_count_help', { n: N })}</span></>}
      </div>
      <div style={{ flex: narrow ? undefined : 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 5, padding: '8px 12px' }}>
        <Chips total={N} narrow={narrow} items={filteredThemes} addSet={addThemes} rmSet={removeThemes} onCycle={cycleTheme} counts={themeCount} />
        {filteredThemes.length === 0 && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('empty')}</span>}
      </div>
    </>
  )
  const groupsBlock = (
    <>
      <SectionHead active={groupsActive} borderTop extra={junctionSummary(addGroups.size, removeGroups.size)}>{t('workingGroups')}</SectionHead>
      {searchRow(groupFilter, setGroupFilter, t('bm_search_groups'), t('bm_new_group'), 'group', groupExists)}
      <div style={{ flex: 'none', maxHeight: narrow ? undefined : 150, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 5, padding: '8px 12px 10px' }}>
        <Chips total={N} narrow={narrow} items={filteredGroups} addSet={addGroups} rmSet={removeGroups} onCycle={cycleGroup} counts={null} />
        {filteredGroups.length === 0 && <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('empty')}</span>}
      </div>
    </>
  )

  const title = N === 1 ? t('bm_title_one') : fmt('bm_title', { n: N })
  const applyLabel = pending ? `${t('modifying')}…` : N === 1 ? t('bm_apply_one') : fmt('bm_apply', { n: N })
  const thumbs = selected.filter(o => o.txtImageNameLink).slice(0, narrow ? 8 : 20)

  return (
    <PemModalOverlay
      onClose={onClose}
      panelStyle={narrow
        ? { width: '100vw', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: 0 }
        : { width: 'min(1392px, calc(100vw - 48px))', height: 'min(648px, calc(100vh - 48px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--bd2)', borderRadius: 4, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: 'var(--tx)', fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>
        {/* Header */}
        <header style={{ flex: 'none', minHeight: narrow ? 56 : 52, display: 'flex', alignItems: 'center', gap: narrow ? 8 : 14, padding: narrow ? '6px 12px' : '0 16px', paddingTop: narrow ? 'max(6px, env(safe-area-inset-top))' : undefined, borderBottom: '1px solid var(--bd)' }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: narrow ? 'flex-start' : 'center', gap: narrow ? 0 : 14 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-instrument-next), serif', fontWeight: 400, fontSize: narrow ? 22 : 26, whiteSpace: 'nowrap' }}>{title}</h2>
            <span style={{ color: 'var(--tx2)', fontSize: narrow ? 11 : 13 }}>{t('bm_rule')}</span>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={resetAll} disabled={K === 0}
            style={{ flex: 'none', height: narrow ? 40 : 28, padding: '0 10px', background: 'none', border: '1px solid var(--bd2)', borderRadius: 3, color: 'var(--tx2)', font: 'inherit', cursor: 'pointer', opacity: K === 0 ? 0.5 : 1 }}>
            {t('bm_reset_all')}
          </button>
          <button type="button" onClick={onClose} aria-label={t('bm_close')} title={t('bm_close')}
            style={{ flex: 'none', width: narrow ? 44 : 28, height: narrow ? 44 : 28, display: 'grid', placeItems: 'center', background: 'none', border: '1px solid var(--bd2)', borderRadius: 3, color: 'var(--tx2)', cursor: 'pointer', font: 'inherit' }}>
            ✕
          </button>
        </header>

        {/* Selection strip */}
        <div style={{ flex: 'none', minHeight: 40, display: 'flex', alignItems: 'center', flexWrap: narrow ? 'wrap' : 'nowrap', gap: 4, padding: narrow ? '6px 12px' : '0 16px', background: 'var(--bg0)', borderBottom: '1px solid var(--bd)' }}>
          {thumbs.map(o => (
            <span key={o.OeuvreID} title={`#${o.OeuvreID} ${o.Titre ?? ''}`} style={{ display: 'block', flex: 'none', width: 24, height: 28, overflow: 'hidden', background: 'var(--bd)' }}>
              <WorkThumb file={o.txtImageNameLink!} size={64} displaySize="24px" alt="" />
            </span>
          ))}
          {N > thumbs.length && thumbs.length > 0 && <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--tx2)' }}>+{N - thumbs.length}</span>}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--tx2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={summary}>{summary}</span>
        </div>

        {/* Body */}
        {narrow ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {identity}{priceAndLocation}{flagsBlock}{noteBlock}{themesBlock}{groupsBlock}
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(3, minmax(0, 1fr))' : 'minmax(0, 1fr) minmax(0, 2fr)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflowY: 'auto', borderRight: '1px solid var(--bd)' }}>{identity}{isAdmin ? priceAndLocation : <>{flagsBlock}{priceAndLocation}</>}</div>
            {isAdmin && <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflowY: 'auto', borderRight: '1px solid var(--bd)' }}>{flagsBlock}{noteBlock}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, background: themesActive || groupsActive ? 'color-mix(in srgb, var(--ac) 3%, transparent)' : undefined }}>{themesBlock}{groupsBlock}</div>
          </div>
        )}

        {/* Footer — what Apply will do */}
        <footer style={{ flex: 'none', minHeight: narrow ? 64 : 56, display: 'flex', alignItems: 'center', gap: 8, padding: narrow ? '8px 12px max(8px, env(safe-area-inset-bottom))' : '0 16px', borderTop: '1px solid var(--bd2)', background: 'var(--bg2)' }}>
          <div style={{ flex: 1, minWidth: 0, maxHeight: narrow ? undefined : 50, display: 'flex', flexWrap: narrow ? 'nowrap' : 'wrap', alignItems: 'center', alignContent: 'center', gap: 4, overflow: 'hidden' }} title={changes.map(c => c.text).join(' · ')}>
            {error ? (
              <span style={{ color: 'var(--rust)', fontSize: 12 }}>{error}</span>
            ) : K === 0 ? (
              <span style={{ color: 'var(--tx2)', fontSize: 12 }}>{t('bm_nothing_yet')}</span>
            ) : (
              <>
                <b style={{ flex: 'none', fontSize: 15, color: 'var(--ac)' }}>{K}</b>
                <span style={{ flex: 'none', color: 'var(--tx2)', marginRight: 2 }}>{K === 1 ? t('bm_will_change_one') : t('bm_will_change_many')}</span>
                {narrow ? (
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{changes.map(c => c.text).join(' · ')}</span>
                ) : changes.map(c => (
                  <span key={c.k} style={{ flex: 'none', height: 22, display: 'flex', alignItems: 'center', padding: '0 7px', background: 'color-mix(in srgb, var(--ac) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--ac) 45%, transparent)', borderRadius: 2, fontSize: 12, whiteSpace: 'nowrap' }}>{c.text}</span>
                ))}
              </>
            )}
          </div>
          {!narrow && (
            <button type="button" onClick={onClose}
              style={{ flex: 'none', height: 34, padding: '0 16px', background: 'none', border: '1px solid var(--bd2)', borderRadius: 3, color: 'var(--tx)', font: 'inherit', cursor: 'pointer' }}>
              {t('cancel')}
            </button>
          )}
          <button type="button" onClick={handleSubmit} disabled={K === 0 || pending}
            style={{ flex: 'none', height: narrow ? 44 : 34, padding: '0 16px', background: K === 0 ? 'var(--bd)' : 'var(--ac)', border: 0, borderRadius: 3, color: K === 0 ? 'var(--tx2)' : 'var(--bg1)', font: 'inherit', fontWeight: 700, cursor: K === 0 ? 'default' : 'pointer' }}>
            {applyLabel}
          </button>
        </footer>
      </div>
    </PemModalOverlay>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function ctlStyle(active: boolean, narrow: boolean): CSSProperties {
  return {
    height: narrow ? 36 : 22, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '0 8px',
    background: active ? 'var(--bg2)' : 'transparent',
    border: `1px solid ${active ? 'var(--ac)' : 'var(--bd)'}`, borderRadius: 2,
    color: active ? 'var(--tx)' : 'var(--tx3)', font: 'inherit', fontSize: narrow ? 15 : 13,
  }
}

function segStyle(on: boolean, unchangedSeg: boolean, narrow: boolean): CSSProperties {
  return {
    height: narrow ? 44 : 22, margin: '0 2px', borderRadius: 2, font: 'inherit', fontSize: narrow ? 14 : 12, cursor: 'pointer',
    ...(unchangedSeg
      ? on ? { background: 'var(--bd)', border: '1px solid var(--bd2)', color: 'var(--tx2)' } : { background: 'none', border: '1px solid var(--bg2)', color: 'var(--tx3)' }
      : on ? { background: 'var(--ac)', border: '1px solid var(--ac)', color: 'var(--bg1)', fontWeight: 700 } : { background: 'none', border: '1px solid var(--bd)', color: 'var(--tx2)' }),
  }
}

function chipStyle(state: 'add' | 'rm' | 'u', has: boolean, narrow: boolean): CSSProperties {
  return {
    height: narrow ? 36 : 26, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 9px', borderRadius: 13, font: 'inherit', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
    ...(state === 'add' ? { background: 'var(--ac)', border: '1px solid var(--ac)', color: 'var(--bg1)', fontWeight: 700 }
      : state === 'rm' ? { background: 'color-mix(in srgb, var(--rust) 12%, transparent)', border: '1px solid var(--rust)', color: 'var(--tx)', textDecoration: 'line-through' }
      : { background: 'none', border: `1px solid ${has ? 'var(--bd2)' : 'var(--bd)'}`, color: has ? 'var(--tx2)' : 'var(--tx3)' }),
  }
}

function Row({ label, active, onReset, children, help, htmlFor, narrow, resetLabel, stack }: {
  label: string; active: boolean; onReset: () => void; children: ReactNode; help?: string; htmlFor?: string; narrow: boolean; resetLabel: (f: string) => string
  /** Phone: control on its own full-width line under the label (wide segmented controls). */
  stack?: boolean
}) {
  const stacked = narrow && stack
  return (
    <div style={{ borderBottom: '1px solid var(--bg2)', background: active ? GOLD_TINT : undefined }}>
      <div style={{ display: 'grid', gridTemplateColumns: stacked ? 'minmax(0, 1fr) 36px' : narrow ? '128px minmax(0, 1fr) 36px' : '132px minmax(0, 1fr) 22px', gridTemplateAreas: stacked ? '"l r" "c c"' : undefined, alignItems: 'center', gap: stacked ? '0 8px' : 8, minHeight: narrow ? 46 : 28, padding: stacked ? '0 12px 8px' : '0 12px' }}>
        <label htmlFor={htmlFor} style={{ gridArea: stacked ? 'l' : undefined, minHeight: stacked ? 40 : undefined, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, color: active ? 'var(--ac)' : 'var(--tx3)', fontWeight: active ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={label}>
          {active && <GoldDot />}{label}
        </label>
        {stacked ? <div style={{ gridArea: 'c', minWidth: 0 }}>{children}</div> : children}
        {active ? (
          <button type="button" onClick={onReset} aria-label={resetLabel(label)} title={resetLabel(label)}
            style={{ gridArea: stacked ? 'r' : undefined, width: narrow ? 36 : 22, height: narrow ? 36 : 22, display: 'grid', placeItems: 'center', background: 'none', border: 0, color: 'var(--tx2)', cursor: 'pointer', font: 'inherit' }}>✕</button>
        ) : <span style={stacked ? { gridArea: 'r' } : undefined} />}
      </div>
      {help && <div style={{ padding: narrow ? '0 12px 8px 148px' : '0 12px 5px 152px', marginTop: -3, fontSize: 11, lineHeight: 1.3, color: 'var(--tx3)' }}>{help}</div>}
    </div>
  )
}

function Select({ id, value, onChange, children, testId, narrow }: { id: string; value: string; onChange: (v: string) => void; children: ReactNode; testId?: string; narrow: boolean }) {
  return (
    <select id={id} data-testid={testId} value={value} onChange={e => onChange(e.target.value)} style={ctlStyle(value !== '', narrow)}>
      <option value="">—</option>
      {children}
    </select>
  )
}

function Text({ id, value, onChange, type = 'text', placeholder, narrow }: { id: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; narrow: boolean }) {
  return <input id={id} type={type} value={value} placeholder={placeholder ?? '—'} onChange={e => onChange(e.target.value)} style={ctlStyle(value !== '', narrow)} />
}

function Chips<K extends string | number>({ items, addSet, rmSet, onCycle, counts, total, narrow }: {
  items: { id: K; name: string }[]; addSet: Set<K>; rmSet: Set<K>; onCycle: (id: K) => void; counts: Map<K, number> | null; total: number; narrow: boolean
}) {
  return (
    <>
      {items.map(it => {
        const state = addSet.has(it.id) ? 'add' : rmSet.has(it.id) ? 'rm' : 'u'
        const c = counts?.get(it.id) ?? 0
        const countText = counts == null ? null : state === 'add' ? `${c}→${total}` : state === 'rm' ? `${c}→0` : `${c}/${total}`
        return (
          <button key={String(it.id)} type="button" title={it.name} onClick={() => onCycle(it.id)} style={chipStyle(state, counts == null || c > 0, narrow)}>
            {state === 'add' ? '+ ' : state === 'rm' ? '− ' : ''}{it.name}
            {countText && <span style={{ marginLeft: 5, fontSize: 11, color: state === 'add' ? 'var(--bg2)' : state === 'rm' ? 'var(--rust)' : 'var(--tx3)', display: 'inline-block' }}>{countText}</span>}
          </button>
        )
      })}
    </>
  )
}

type JunctionSel<K> = { add: Set<K>; rm: Set<K> }
const EMPTY_SEL: JunctionSel<never> = { add: new Set(), rm: new Set() }

/** One click cycles: unchanged → add to all → remove from all → unchanged. */
function cycleSel<K>(prev: JunctionSel<K>, id: K): JunctionSel<K> {
  const add = new Set(prev.add); const rm = new Set(prev.rm)
  if (add.has(id)) { add.delete(id); rm.add(id) } else if (rm.has(id)) { rm.delete(id) } else { add.add(id) }
  return { add, rm }
}

const SECTION_TEXT: CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tx2)' }

function GoldDot() {
  return <span aria-hidden="true" style={{ display: 'inline-block', flex: 'none', width: 6, height: 6, borderRadius: '50%', background: 'var(--ac)' }} />
}

function SectionHead({ children, active, extra, borderTop }: { children: ReactNode; active?: boolean; extra?: string | null; borderTop?: boolean }) {
  return (
    <h3 style={{
      margin: 0, flex: 'none', height: 26, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px',
      background: 'var(--bg2)', borderBottom: '1px solid var(--bd)', borderTop: borderTop ? '1px solid var(--bd)' : undefined,
      ...SECTION_TEXT, color: active ? 'var(--ac)' : 'var(--tx2)',
    }}>
      {active && <GoldDot />}{children}
      {extra && <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'var(--tx2)' }}>{extra}</span>}
    </h3>
  )
}
