'use client'

// Overview — one-glance dashboard (B1, design pass 2026-11-13, mock
// `docs/design/2026-11-13/Overview.dc.html`, build notes `docs/archive/HANDOFF_2026-11-13_DESIGN_BUILD.md` §2).
// Desktop: header · a row of signal cells in fixed positions (signal first, number second) · four
// columns of panels filling the window (no page scroll) · status bar. Panels with more to show open
// in place when the pointer rests on them ("liquid grid"). Phone: signal rows, worst first.
// Same data as before — no new queries.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { listUnreadSuiviReminders, markSuiviReminderRead } from '@/app/atelier/reminders-actions'
import Link from 'next/link'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { useLocalJobs, LocalJobsControls, ARCHIVE_STALE_DAYS } from '@/components/atelier/overview/EmbeddingIndexCard'
import { SeeAgainCard } from '@/components/atelier/SeeAgainCard'
import { SignalMark, SIGNAL_COLOR, SIGNAL_RANK, type SignalKind } from '@/components/atelier/SignalMark'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import { daysUntil } from '@/lib/pipeline-deadlines'
import { filterEventsInDateKeyRange } from '@/lib/pipeline-calendar'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { Lang } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { formatPriceCompact } from '@/lib/format-price'
import {
  queueInventoryFilter,
  type InventoryHandoffCriterion,
} from '@/lib/atelier/inventory-filter-handoff'

function pad2Local(n: number) {
  return String(n).padStart(2, '0')
}

function localDateKeyFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2Local(d.getMonth() + 1)}-${pad2Local(d.getDate())}`
}

function mondayStartOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const mon = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - mon)
  return x
}

const tint = (kind: SignalKind, pct = 8) =>
  kind === 'wrong' || kind === 'attention' ? `color-mix(in srgb, ${SIGNAL_COLOR[kind]} ${pct}%, transparent)` : undefined

type CountRow = { key: string; label: string; count: number; go: () => void }
type Signal = { id: string; kind: SignalKind; label: string; value: string; detail: string; go: () => void }

/** Below this content width the four columns stack two by two and the page scrolls. */
const FIXED_MIN_WIDTH = 900

export function OverviewTab({
  oeuvres, tM, t, lang, onGoTab, initialReminders, initialOverviewBootstrap, isAdmin, conflicts,
  oeuvresCatalogueTotal,
}: {
  oeuvres:       Oeuvre[]
  tM:            Record<number, string>
  t:             (k: string) => string
  lang:          Lang
  onGoTab:       (tab: SegmentedAtelierTab) => void
  reminderCount: number
  initialReminders: SuiviReminderListRow[]
  initialOverviewBootstrap: AtelierOverviewBootstrap
  isAdmin:       boolean
  conflicts:     any[]
  oeuvresCataloguePartial?: boolean
  oeuvresCatalogueTotal?: number
}) {
  const fmt = (k: string, vars: Record<string, string | number>) => interpolateMessage(t(k), vars)
  const localeTag = lang === 'en' ? 'en-GB' : 'fr-FR'
  const num = (n: number) => n.toLocaleString(localeTag)
  const thisYear   = new Date().getFullYear()
  const yearPrefix = String(thisYear)

  // ── Counts (unchanged rules) ──────────────────────────────────────────
  let byYear = 0, withPrice = 0, available = 0, exposable = 0, catalogued = 0
  let missingDims = 0, missingImages = 0, missingLoc = 0, missingAddress = 0
  let missingTech = 0, missingSupport = 0, missingYear = 0, missingTitle = 0
  /** Photo shot but not yet validated — `addWorkImage` never clears NeedsPhotograph. */
  let needsPhotoValidation = 0
  let notCatalogued = 0
  let totalValue = 0
  for (const o of oeuvres) {
    if (o.Année?.startsWith(yearPrefix)) byYear++
    if (o.Prix && o.Prix > 0) { withPrice++; totalValue += o.Prix }
    if (o.statusId === 2) {
      available++
      if (o.Exposable) exposable++
    }
    if (!o.Hauteur || !o.Largeur) missingDims++
    if (!o.txtImageNameLink) missingImages++
    if (!o.LocalisationID) missingLoc++
    else if ((o as { localisation_address_id?: number | null }).localisation_address_id == null) missingAddress++
    if (o.Technique == null) missingTech++
    if (o.Support == null) missingSupport++
    if (!o.Année) missingYear++
    if (!o.Titre?.trim()) missingTitle++
    if (o.NeedsPhotograph) needsPhotoValidation++
    if (o.Catalogué) catalogued++
    else notCatalogued++
  }
  const worksTotal = oeuvresCatalogueTotal ?? oeuvres.length

  const backlog = initialOverviewBootstrap.backlog

  /** Hand a filter to the Inventory tab, then switch to it. */
  const goInventory = (label: string, criteria: InventoryHandoffCriterion[]) => {
    queueInventoryFilter({ label, criteria })
    onGoTab('inventory')
  }

  const needsRows: CountRow[] = [
    ...(isAdmin ? [{ key: 'approvals', label: t('ov_needs_approvals'), count: backlog.pendingApprovals, go: () => onGoTab('audit') }] : []),
    { key: 'photos', label: t('ov_needs_photo_validation'), count: needsPhotoValidation, go: () => goInventory(t('ov_needs_photo_validation'), [{ field: 'NeedsPhotograph', op: '= vrai' }]) },
    { key: 'field', label: t('ov_needs_field_tasks'), count: backlog.openFieldTasks, go: () => onGoTab('production') },
    { key: 'ledger', label: t('ov_needs_ledger'), count: backlog.openLedger, go: () => onGoTab('kaizen-ops') },
    { key: 'catalogue', label: t('ov_needs_not_catalogued'), count: notCatalogued, go: () => goInventory(t('ov_needs_not_catalogued'), [{ field: 'Catalogué', op: '= faux' }]) },
    { key: 'sessions', label: t('ov_needs_sessions'), count: backlog.sessionsToApply, go: () => onGoTab('journal') },
  ]
  const needsTotal = needsRows.reduce((s, r) => s + r.count, 0)

  const gapRows: CountRow[] = [
    { key: 'photo', label: t('ov_health_missing_photos'), count: missingImages, go: () => goInventory(t('ov_health_missing_photos'), [{ field: '_hasImage', op: 'est vide' }]) },
    { key: 'dims', label: t('ov_health_missing_dims'), count: missingDims, go: () => goInventory(t('ov_health_missing_dims'), [{ field: 'Hauteur', op: 'est vide' }]) },
    { key: 'loc', label: t('ov_health_missing_loc'), count: missingLoc, go: () => goInventory(t('ov_health_missing_loc'), [{ field: 'LocalisationID', op: 'est vide' }]) },
    { key: 'address', label: t('ov_health_missing_address'), count: missingAddress, go: () => goInventory(t('ov_health_missing_address'), [{ field: 'localisation_address_id', op: 'est vide' }]) },
    { key: 'tech', label: t('ov_health_missing_tech'), count: missingTech, go: () => goInventory(t('ov_health_missing_tech'), [{ field: 'Technique', op: 'est vide' }]) },
    { key: 'support', label: t('ov_health_missing_support'), count: missingSupport, go: () => goInventory(t('ov_health_missing_support'), [{ field: 'Support', op: 'est vide' }]) },
    { key: 'year', label: t('ov_health_missing_year'), count: missingYear, go: () => goInventory(t('ov_health_missing_year'), [{ field: 'Année', op: 'est vide' }]) },
    { key: 'title', label: t('ov_health_missing_title'), count: missingTitle, go: () => goInventory(t('ov_health_missing_title'), [{ field: 'Titre', op: 'est vide' }]) },
  ].sort((a, b) => b.count - a.count)
  const gapTotal = gapRows.reduce((s, r) => s + r.count, 0)
  const gapMax = Math.max(1, ...gapRows.map(r => r.count))

  // Reminders — whole unread list, refetched on every visit (the shell snapshot goes stale).
  const [reminderRows, setReminderRows] = useState<SuiviReminderListRow[]>(initialReminders)
  useEffect(() => {
    let cancelled = false
    void listUnreadSuiviReminders(200).then((rows) => {
      if (!cancelled) setReminderRows(rows)
    })
    return () => { cancelled = true }
  }, [])
  const markReminderDone = async (id: string) => {
    setReminderRows((rows) => rows.filter((r) => r.id !== id))
    const res = await markSuiviReminderRead(id)
    if (!res.ok) setReminderRows(await listUnreadSuiviReminders(200))
  }
  const reminders = useMemo(
    () => reminderRows.map(r => ({ r, days: daysUntil(r.remind_at) })).sort((a, b) => a.days - b.days),
    [reminderRows],
  )
  const remOverdue = reminders.filter(x => x.days < 0).length
  const remToday = reminders.filter(x => x.days === 0).length
  const remTomorrow = reminders.filter(x => x.days === 1).length
  const remNext7 = reminders.filter(x => x.days >= 2 && x.days <= 7).length

  const { expenseTotalTtc, salesIncomeTtc, upcomingPulse, overviewCalendarEvents, burningConcepts } = initialOverviewBootstrap
  const income = salesIncomeTtc ?? 0
  const expenses = expenseTotalTtc
  const net = income - expenses

  const deadlines = useMemo(
    () => upcomingPulse.map(p => ({ p, days: daysUntil(p.date) })).sort((a, b) => a.days - b.days),
    [upcomingPulse],
  )
  const dlOverdue = deadlines.filter(d => d.days < 0).length
  const dlToday = deadlines.filter(d => d.days === 0).length
  const dlNext7 = deadlines.filter(d => d.days > 0 && d.days <= 7).length

  const week = useMemo(() => {
    const start = mondayStartOfWeek(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const events = filterEventsInDateKeyRange(overviewCalendarEvents, localDateKeyFromDate(start), localDateKeyFromDate(end))
    const todayKey = localDateKeyFromDate(new Date())
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = localDateKeyFromDate(d)
      const evs = events.filter(e => e.dateKey === key)
      return { key, d, evs, today: key === todayKey }
    })
    return { start, end, days }
  }, [overviewCalendarEvents])

  const techSegments = useMemo(() => {
    const by = new Map<number | null, number>()
    for (const o of oeuvres) by.set(o.Technique ?? null, (by.get(o.Technique ?? null) ?? 0) + 1)
    const sorted = [...by.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 4).map(([id, n]) => ({ label: id == null ? t('od_unknown_tech') : (tM[id] ?? '—'), n }))
    const rest = sorted.slice(4).reduce((s, [, n]) => s + n, 0)
    if (rest > 0) top.push({ label: t('od_other'), n: rest })
    return top
  }, [oeuvres, tM, t])

  const recentWorks = useMemo(() => [...oeuvres].sort((a, b) => b.OeuvreID - a.OeuvreID).slice(0, 16), [oeuvres])

  const jobs = useLocalJobs(isAdmin)
  const jobsBacklog = (jobs.voice ?? 0) + (jobs.index ?? 0)
  const jobsLoading = jobs.voice == null && jobs.archiveDays === undefined

  // ── Signals (fixed positions; rules from docs/DESIGN_BRIEF_2026-11-13.md) ──
  const signals: Signal[] = []
  {
    const nz = needsRows.filter(r => r.count > 0)
    signals.push({
      id: 'needs', label: t('od_sig_needs'),
      kind: needsTotal > 0 ? 'attention' : 'ok',
      value: num(needsTotal),
      detail: nz.length ? nz.slice(0, 3).map(r => `${r.count} ${r.label}`).join(' · ') : t('od_all_clear'),
      go: () => (nz[0] ? nz[0].go() : onGoTab('journal')),
    })
    const worst = gapRows[0]
    signals.push({
      id: 'catalogue', label: t('od_sig_catalogue'),
      kind: gapTotal > 0 ? 'wrong' : 'ok',
      value: num(gapTotal),
      detail: gapTotal > 0 ? fmt('od_gaps_worst', { n: worst.count, label: worst.label }) : t('od_gaps_none'),
      go: () => (gapTotal > 0 ? worst.go() : onGoTab('inventory')),
    })
    if (isAdmin) {
      signals.push({
        id: 'integrity', label: t('od_sig_integrity'),
        kind: conflicts.length > 0 ? 'wrong' : 'ok',
        value: num(conflicts.length),
        detail: conflicts.length > 0 ? t('od_collisions') : t('od_no_collision'),
        go: () => onGoTab('contacts'),
      })
    }
    signals.push({
      id: 'deadlines', label: t('od_sig_deadlines'),
      kind: dlOverdue > 0 ? 'wrong' : dlToday > 0 ? 'attention' : 'ok',
      value: num(dlOverdue || dlToday || dlNext7),
      detail: fmt(dlOverdue > 0 ? 'od_dl_overdue' : dlToday > 0 ? 'od_dl_today' : 'od_dl_next7', { n: deadlines.length }),
      go: () => onGoTab('pipeline'),
    })
    signals.push({
      id: 'reminders', label: t('od_sig_reminders'),
      kind: remOverdue > 0 ? 'wrong' : remToday > 0 ? 'attention' : 'ok',
      value: num(remOverdue || remToday || remTomorrow + remNext7),
      detail: remOverdue > 0 ? fmt('od_rem_overdue', { n: remToday }) : remToday > 0 ? t('od_rem_today') : t('od_rem_next7'),
      go: () => onGoTab('notes'),
    })
    signals.push({
      id: 'money', label: t('od_sig_money'),
      // D3 (thresholds) open: until Pem sets "cash low", a negative net this year is the alarm.
      // D3 (Pem 2026-11-14): a negative net for the year is wrong (■), not just attention.
      kind: net < 0 ? 'wrong' : 'ok',
      value: `${net > 0 ? '+' : ''}${formatPriceCompact(net, lang)}`,
      detail: fmt('od_money_net', { year: thisYear }),
      go: () => onGoTab('fiscal'),
    })
    if (isAdmin) {
      const d = jobs.archiveDays
      signals.push({
        id: 'jobs', label: t('od_sig_jobs'),
        // D1 open: the mock's rule — backlog = ▲, archive older than 14 days (or never) = ■.
        kind: jobsLoading ? 'info' : jobs.archiveStale ? 'wrong' : jobsBacklog > 0 ? 'attention' : 'ok',
        value: jobs.voice == null ? '…' : num(jobsBacklog),
        detail: fmt('od_jobs_detail', { d: d === undefined ? '…' : d === null ? t('od_jobs_never') : fmt('od_jobs_days', { n: d }) }),
        go: () => flash('jobs'),
      })
    }
    signals.push({
      id: 'collection', label: t('od_sig_collection'),
      kind: 'info',
      value: num(worksTotal),
      detail: fmt('od_coll_detail', { n: available }),
      go: () => onGoTab('reports'),
    })
  }
  const tally = { wrong: 0, attention: 0, ok: 0 }
  for (const s of signals) if (s.kind !== 'info') tally[s.kind]++

  // ── Layout measurement: fill the window under the Atelier chrome ──────
  const narrow = useMediaQuery('(max-width: 767px)')
  const canHover = useMediaQuery('(hover: hover)')
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const rootRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ w: Math.round(r.width), h: Math.max(0, Math.round(window.innerHeight - r.top)) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [narrow])
  const fixed = !narrow && box.w >= FIXED_MIN_WIDTH
  const compact = fixed && box.h < 760
  const rowH = compact ? 22 : 26
  const hdrH = compact ? 26 : 30

  // Loaded-at clock (client only: no hydration mismatch).
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])

  // ── Liquid grid: one panel open at a time, by resting the pointer on it ──
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [flashed, setFlashed] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const hoverable = fixed && canHover
  const enter = (id: string) => {
    if (!hoverable) return
    clearTimeout(timer.current)
    if (openPanel === id) return
    timer.current = setTimeout(() => setOpenPanel(id), openPanel ? 250 : 700)
  }
  const leave = (id: string) => {
    if (!hoverable) return
    clearTimeout(timer.current)
    if (openPanel === id) timer.current = setTimeout(() => setOpenPanel(null), 300)
  }
  const toggle = (id: string) => { clearTimeout(timer.current); setOpenPanel(p => (p === id ? null : id)) }
  function flash(id: string) {
    setFlashed(id)
    document.getElementById(`ov-panel-${id}`)?.scrollIntoView({ block: 'nearest' })
    setTimeout(() => setFlashed(f => (f === id ? null : f)), 1200)
  }
  const panelProps = (id: string, more: number) => ({
    id, fixed, hdrH, open: openPanel === id, flashed: flashed === id, more, reduceMotion,
    onEnter: more > 0 ? () => enter(id) : undefined,
    onLeave: more > 0 ? () => leave(id) : undefined,
    onToggle: more > 0 ? () => toggle(id) : undefined,
    moreLabel: fmt('od_more', { n: more }),
    moreTitle: openPanel === id ? t('od_less_title') : fmt('od_more_title', { n: more }),
  })
  const sig = (id: string) => signals.find(s => s.id === id)!

  // ── Rows ──────────────────────────────────────────────────────────────
  const countLine = (r: CountRow, mark: SignalKind) => (
    <Line key={r.key} h={rowH} onClick={r.count > 0 ? r.go : undefined} dim={r.count === 0}>
      <span style={ELLIPSIS}>{r.label}</span>
      <b style={{ fontWeight: r.count > 0 ? 700 : 400 }}>{num(r.count)}</b>
      <SignalMark kind={r.count > 0 ? mark : 'ok'} />
    </Line>
  )

  const deadlineLine = ({ p, days }: { p: (typeof upcomingPulse)[number]; days: number }, i: number) => {
    const kind: SignalKind | null = days < 0 ? 'wrong' : days === 0 ? 'attention' : null
    return (
      <Line key={`${p.processId}-${p.etapeId ?? 'fin'}-${p.date}-${i}`} h={rowH + 4} onClick={() => onGoTab('pipeline')} bg={kind ? tint(kind) : undefined} cols="84px minmax(0, 1fr) 12px">
        <span style={{ fontSize: 12, fontWeight: kind ? 700 : 400, color: kind ? SIGNAL_COLOR[kind] : 'var(--tx2)', whiteSpace: 'nowrap' }}>
          {days < 0 ? fmt('od_days_late', { n: -days }) : days === 0 ? t('od_today') : fmt('od_in_days', { n: days })}
        </span>
        <span style={ELLIPSIS} title={p.label}>{p.label}</span>
        {kind ? <SignalMark kind={kind} /> : <span />}
      </Line>
    )
  }

  const reminderLine = ({ r, days }: { r: SuiviReminderListRow; days: number }) => {
    const kind: SignalKind | null = days < 0 ? 'wrong' : days === 0 ? 'attention' : null
    return (
      <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto 32px', alignItems: 'center', gap: 8, minHeight: narrow ? 46 : rowH, padding: '0 0 0 12px', borderBottom: '1px solid var(--bg2)' }}>
        {kind ? <SignalMark kind={kind} /> : <span />}
        <button type="button" onClick={() => onGoTab(r.process_id ? 'pipeline' : 'notes')} title={r.process_id ? t('ov_reminder_open_project') : t('ov_reminder_open_notes')}
          style={{ ...ELLIPSIS, textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'var(--tx)', font: 'inherit', cursor: 'pointer' }}>
          {r.message}
        </button>
        <span style={{ fontSize: 11, color: kind ? SIGNAL_COLOR[kind] : 'var(--tx3)', whiteSpace: 'nowrap' }}>
          {days === 0 ? t('ov_reminder_today') : days === 1 ? t('ov_reminder_tomorrow') : days < 0 ? fmt('od_days_late', { n: -days }) : fmt('od_in_days', { n: days })}
        </span>
        <button type="button" data-testid="overview-reminder-done" onClick={() => void markReminderDone(r.id)} title={t('ov_reminder_done')} aria-label={t('ov_reminder_done')}
          style={{ height: narrow ? 44 : rowH, background: 'none', border: 0, borderLeft: '1px solid var(--bg2)', color: 'var(--tx3)', cursor: 'pointer', font: 'inherit' }}>✓</button>
      </div>
    )
  }

  const thumb = (o: Oeuvre) => (
    <Link key={o.OeuvreID} href={`/atelier/inventory?work=${o.OeuvreID}`} aria-label={`#${o.OeuvreID} ${o.Titre ?? ''}`.trim()}
      style={{ display: 'block', aspectRatio: '1', background: 'var(--bg2)', position: 'relative', overflow: 'hidden', color: 'inherit', textDecoration: 'none' }}>
      {o.txtImageNameLink ? (
        <ImageLoupe file={o.txtImageNameLink} alt={o.Titre ?? `#${o.OeuvreID}`} style={{ width: '100%', height: '100%' }}>
          <WorkThumb file={o.txtImageNameLink} size={256} alt="" />
        </ImageLoupe>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 10 }}>{t('ov_no_image_placeholder')}</div>
      )}
      <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2px 4px', background: 'linear-gradient(transparent, color-mix(in srgb, var(--bg0) 80%, transparent))', color: 'var(--tx)', fontSize: 10, fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}>#{o.OeuvreID}</span>
    </Link>
  )

  // ── Phone: signal rows, worst first ───────────────────────────────────
  if (narrow) {
    const groups: SignalKind[] = ['wrong', 'attention', 'ok', 'info']
    const groupLabel: Record<SignalKind, string> = { wrong: t('od_wrong'), attention: t('od_attention'), ok: t('od_ok'), info: t('od_info') }
    return (
      <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--tx)', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '12px 16px 8px' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-instrument-next), serif', fontWeight: 400, fontSize: 26 }}>{t('od_title')}</h1>
          {now && <span style={{ color: 'var(--tx3)', fontSize: 12 }}>{now.toLocaleDateString(localeTag, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
        </div>
        <div data-testid="atelier-overview-executive" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderTop: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>
          {(['wrong', 'attention', 'ok'] as const).map((k, i) => (
            <div key={k} style={{ padding: '10px 16px', borderLeft: i ? '1px solid var(--bd)' : undefined, borderTop: `3px solid ${SIGNAL_COLOR[k]}`, background: tally[k] && k !== 'ok' ? tint(k) : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx2)' }}><SignalMark kind={k} />{groupLabel[k]}</div>
              <b style={{ fontSize: 26 }}>{tally[k]}</b>
            </div>
          ))}
        </div>
        {groups.map(g => {
          const rows = signals.filter(s => s.kind === g)
          if (!rows.length) return null
          return (
            <div key={g}>
              <div style={{ ...SECTION, height: 28, padding: '0 16px', background: 'var(--bg1)' }}>{groupLabel[g]}</div>
              {rows.map(s => (
                <button key={s.id} type="button" onClick={s.go} aria-label={`${s.label}: ${groupLabel[s.kind]}, ${s.value}`}
                  style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto 14px', alignItems: 'center', gap: 10, width: '100%', minHeight: 46, padding: '4px 16px', background: tint(s.kind), border: 0, borderBottom: '1px solid var(--bg2)', color: 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                  <SignalMark kind={s.kind} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{s.label}</span>
                    <span style={{ ...ELLIPSIS, display: 'block', fontSize: 12, color: 'var(--tx2)' }}>{s.detail}</span>
                  </span>
                  <b style={{ fontSize: 18 }}>{s.value}</b>
                  <span aria-hidden="true" style={{ color: 'var(--tx3)' }}>›</span>
                </button>
              ))}
            </div>
          )
        })}
        {/* Mobile action bar scrolls here (TeamPortalClient `openFieldReminders`). */}
        <div id="atelier-field-reminders" style={{ scrollMarginTop: 96, marginTop: 12 }}>
          <div style={{ ...SECTION, height: 28, padding: '0 16px', background: 'var(--bg1)' }}>{t('ov_reminders_title')} · {reminders.length}</div>
          <div data-testid="overview-reminders">
            {reminders.length === 0
              ? <div style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 13 }}>{t('od_no_reminder')}</div>
              : reminders.map(reminderLine)}
          </div>
        </div>
      </div>
    )
  }

  // ── Desktop / tablet ──────────────────────────────────────────────────
  const dlBase = deadlines.slice(0, 5)
  const dlMore = deadlines.slice(5)
  const remBase = reminders.filter(x => x.days <= 0)
  const remMore = reminders.filter(x => x.days > 0)
  const ideasBase = burningConcepts.slice(0, 3)
  const ideasMore = burningConcepts.slice(3)
  const thumbsBase = recentWorks.slice(0, compact ? 3 : 4)
  const thumbsMore = recentWorks.slice(compact ? 3 : 4)
  const fmtDay = (d: Date) => d.toLocaleDateString(localeTag, { day: 'numeric', month: 'short' })
  const column = (children: ReactNode, last = false): ReactNode => (
    <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: fixed ? 'hidden' : undefined, borderRight: last ? undefined : '1px solid var(--bd)' }}>
      {children}
      {fixed && <div style={{ flex: '1 1 0', minHeight: 0 }} />}
    </section>
  )
  const cell = (label: string, value: ReactNode, opts?: { color?: string; last?: boolean; title?: string }) => (
    <div title={opts?.title} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: compact ? '5px 12px' : '8px 12px', minWidth: 0, borderRight: opts?.last ? undefined : '1px solid var(--bg2)', borderBottom: '1px solid var(--bg2)' }}>
      <span style={{ fontSize: 11, color: 'var(--tx2)', ...ELLIPSIS }}>{label}</span>
      <b style={{ fontSize: compact ? 16 : 18, color: opts?.color, whiteSpace: 'nowrap' }}>{value}</b>
    </div>
  )
  const techTotal = Math.max(1, techSegments.reduce((s, x) => s + x.n, 0))
  const techColors = ['var(--ac)', 'color-mix(in srgb, var(--ac) 65%, var(--bd3))', 'var(--tx3)', 'var(--bd3)', 'var(--bd2)']

  return (
    <div ref={rootRef} style={{
      height: fixed ? box.h || undefined : undefined, display: 'flex', flexDirection: 'column', overflow: fixed ? 'hidden' : undefined,
      background: 'var(--bg0)', color: 'var(--tx)', fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums',
    }}>
      {/* Header */}
      <header style={{ flex: 'none', height: 44, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', background: 'var(--bg1)', borderBottom: '1px solid var(--bd)', minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-instrument-next), serif', fontWeight: 400, fontSize: 24, whiteSpace: 'nowrap' }}>{t('od_title')}</h1>
        {now && <span style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{now.toLocaleDateString(localeTag, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {now.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 10px', border: '1px solid var(--bd2)', borderRadius: 3, whiteSpace: 'nowrap' }}>
          {(['wrong', 'attention', 'ok'] as const).map(k => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SignalMark kind={k} /><b>{tally[k]}</b>{t(`od_${k}`)}</span>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {box.w > 1150 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 11, color: 'var(--tx3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('od_legend')}</span>
            {(['wrong', 'attention', 'ok', 'info'] as const).map(k => <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><SignalMark kind={k} />{t(`od_${k}`)}</span>)}
          </div>
        )}
      </header>

      {/* Signal row — fixed positions: the eye learns where each signal lives */}
      <nav aria-label={t('od_signals')} data-testid="atelier-overview-executive"
        style={{ flex: 'none', height: compact ? 96 : 112, display: 'grid', gridTemplateColumns: `repeat(${signals.length}, minmax(0, 1fr))`, borderBottom: '1px solid var(--bd)' }}>
        {signals.map((s, i) => (
          <button key={s.id} type="button" onClick={s.go} aria-label={`${s.label}: ${t(`od_${s.kind}`)}, ${s.value}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0, padding: compact ? '7px 12px' : '10px 12px',
              border: 0, borderRight: i < signals.length - 1 ? '1px solid var(--bd)' : 0, borderTop: `3px solid ${s.kind === 'info' ? 'var(--bd2)' : SIGNAL_COLOR[s.kind]}`,
              background: tint(s.kind) ?? 'transparent', color: 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: 'pointer',
            }}>
            <span style={{ ...SECTION, gap: 7, maxWidth: '100%' }}><SignalMark kind={s.kind} /><span style={ELLIPSIS}>{s.label}</span></span>
            <span style={{ fontSize: s.value.length > 7 ? (compact ? 22 : 26) : (compact ? 28 : 34), fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</span>
            <span style={{ ...ELLIPSIS, maxWidth: '100%', fontSize: 12, color: 'var(--tx2)' }} title={s.detail}>{s.detail}</span>
          </button>
        ))}
      </nav>

      {/* Detail columns */}
      <main style={{
        flex: fixed ? '1 1 0' : undefined, minHeight: 0, display: 'grid',
        gridTemplateColumns: fixed ? 'minmax(0, 1.15fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 0.9fr)' : 'repeat(2, minmax(0, 1fr))',
      }}>
        {/* Col 1 — act */}
        {column(<>
          <Panel {...panelProps('needs', 0)} kind={sig('needs').kind} title={t('ov_needs_you')} count={num(needsTotal)}>
            {needsRows.map(r => countLine(r, 'attention'))}
          </Panel>
          <Panel {...panelProps('catalogue', 0)} kind={gapTotal > 0 ? 'wrong' : 'ok'} title={t('od_catalogue_health')} count={num(gapTotal)}
            extra={fmt('od_gaps_of', { n: num(worksTotal) })} link={{ label: t('od_inventory_link'), onClick: () => onGoTab('inventory') }}>
            {isAdmin && (
              <Line h={rowH + 4} onClick={() => onGoTab('contacts')} bg={conflicts.length ? tint('wrong', 9) : undefined} dim={!conflicts.length} cols="12px minmax(0, 1fr) auto auto">
                <SignalMark kind={conflicts.length ? 'wrong' : 'ok'} />
                <span style={{ ...ELLIPSIS, fontWeight: conflicts.length ? 600 : 400 }}>{t('od_integrity_row')}</span>
                <b>{num(conflicts.length)}</b>
                {conflicts.length > 0 ? <span style={{ fontSize: 12, color: 'var(--rust)' }}>{t('od_resolve_link')}</span> : <span />}
              </Line>
            )}
            {gapRows.map(r => (
              <Line key={r.key} h={rowH} onClick={r.count > 0 ? r.go : undefined} dim={r.count === 0} cols="minmax(0, 150px) minmax(0, 1fr) 40px 12px">
                <span style={ELLIPSIS} title={r.label}>{r.label}</span>
                <span style={{ height: 6, background: 'var(--bg2)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(r.count / gapMax) * 100}%`, background: r.count > 0 ? 'var(--rust)' : 'transparent' }} />
                </span>
                <b style={{ textAlign: 'right', fontWeight: r.count > 0 ? 700 : 400 }}>{num(r.count)}</b>
                <SignalMark kind={r.count > 0 ? 'wrong' : 'ok'} />
              </Line>
            ))}
          </Panel>
        </>)}

        {/* Col 2 — time */}
        {column(<>
          <Panel {...panelProps('pipeline', dlMore.length)} kind={sig('deadlines').kind} title={t('od_pipeline')}
            extra={fmt('od_active_n', { n: deadlines.length })} link={{ label: t('od_calendar_link'), onClick: () => onGoTab('pipeline') }}
            moreContent={dlMore.map((d, i) => deadlineLine(d, i + 5))}>
            {dlBase.length ? dlBase.map((d, i) => deadlineLine(d, i)) : <Empty h={rowH}>{t('od_no_deadline')}</Empty>}
          </Panel>
          <Panel {...panelProps('week', 0)} kind="info" title={t('ov_this_week')} extra={`${fmtDay(week.start)} – ${fmtDay(week.end)}`}
            link={{ label: t('od_calendar_link'), onClick: () => onGoTab('pipeline') }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--bd)' }}>
              {week.days.map((d, i) => (
                <button key={d.key} type="button" onClick={() => onGoTab('pipeline')} title={d.evs.map(e => e.label).join('\n') || undefined}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, padding: compact ? '4px 6px' : '6px 8px', background: 'none', border: 0, borderRight: i < 6 ? '1px solid var(--bg2)' : 0, borderBottom: d.today ? '2px solid var(--ac)' : '2px solid transparent', color: 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, color: d.today ? 'var(--ac)' : 'var(--tx2)' }}>{d.d.toLocaleDateString(localeTag, { weekday: 'short' })} {d.d.getDate()}</span>
                  <b style={{ fontSize: 16, color: d.evs.length ? 'var(--tx)' : 'var(--tx3)' }}>{d.evs.length}</b>
                  <span style={{ ...ELLIPSIS, fontSize: 11, color: 'var(--tx2)' }}>{d.evs[0]?.label ?? ''}</span>
                </button>
              ))}
            </div>
          </Panel>
          <Panel {...panelProps('reminders', remMore.length)} domId="atelier-field-reminders" kind={sig('reminders').kind} title={t('ov_reminders_title')} count={num(reminders.length)}
            link={{ label: t('od_notes_link'), onClick: () => onGoTab('notes') }} moreContent={remMore.map(reminderLine)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderBottom: '1px solid var(--bd)' }}>
              {([['od_overdue', remOverdue, 'wrong'], ['od_today', remToday, 'attention'], ['od_tomorrow', remTomorrow, null], ['od_next7', remNext7, null]] as const).map(([k, n, kind], i) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: compact ? '4px 12px' : '7px 12px', borderRight: i < 3 ? '1px solid var(--bg2)' : 0, background: kind && n > 0 ? tint(kind) : undefined }}>
                  <span style={{ fontSize: 11, color: 'var(--tx2)', ...ELLIPSIS }}>{t(k)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: compact ? 17 : 20, fontWeight: 700, color: n > 0 ? 'var(--tx)' : 'var(--tx3)' }}>{n}{kind && n > 0 && <SignalMark kind={kind} />}</span>
                </div>
              ))}
            </div>
            <div data-testid="overview-reminders">
              {remBase.length ? remBase.map(reminderLine) : reminders.length === 0 ? <Empty h={rowH}>{t('od_no_reminder')}</Empty> : null}
            </div>
          </Panel>
        </>)}

        {/* Col 3 — money + collection */}
        {column(<>
          <Panel {...panelProps('money', 0)} kind={sig('money').kind} title={fmt('od_money', { year: thisYear })} titleTip={t('od_money_note')}
            link={{ label: t('od_fiscal_link'), onClick: () => onGoTab('fiscal') }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {cell(t('od_income'), formatPriceCompact(income, lang))}
              {cell(t('od_expenses'), formatPriceCompact(expenses, lang))}
              {cell(t('od_net'), `${net > 0 ? '+' : ''}${formatPriceCompact(net, lang)}`, { color: net < 0 ? 'var(--yellow)' : 'var(--sage)', last: true })}
            </div>
            <div role="img" aria-label={`${t('od_income')} ${formatPriceCompact(income, lang)} · ${t('od_expenses')} ${formatPriceCompact(expenses, lang)}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: compact ? '6px 12px' : '10px 12px', borderBottom: '1px solid var(--bd)' }}>
              {[[t('od_income'), income, 'var(--ac)'], [t('od_expenses'), expenses, 'var(--bd3)']].map(([l, v, c]) => (
                <div key={String(l)} style={{ display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr)', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--tx2)' }}>
                  <span>{l}</span>
                  <span style={{ height: 8, background: 'var(--bg2)' }}>
                    <span style={{ display: 'block', height: '100%', width: `${(Number(v) / Math.max(1, income, expenses)) * 100}%`, background: String(c) }} />
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel {...panelProps('collection', 0)} kind="info" title={t('od_sig_collection')} count={num(worksTotal)}
            link={{ label: t('od_reports_link'), onClick: () => onGoTab('reports') }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {cell(t('od_total_value'), formatPriceCompact(totalValue, lang))}
              {cell(t('ov_stat_available'), num(available))}
              {cell(t('od_exhibitable'), num(exposable), { last: true })}
              {cell(t('od_priced'), num(withPrice))}
              {cell(fmt('od_made_year', { year: thisYear }), num(byYear))}
              {cell(t('od_catalogued'), `${Math.round((catalogued / Math.max(1, oeuvres.length)) * 100)} %`, { last: true })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: compact ? '6px 12px' : '10px 12px' }}>
              <span style={{ fontSize: 11, color: 'var(--tx2)' }}>{t('byTechnique')}</span>
              <div role="img" aria-label={techSegments.map(s => `${s.label} ${Math.round((s.n / techTotal) * 100)} %`).join(', ')} style={{ display: 'flex', height: 10, gap: 2 }}>
                {techSegments.map((s, i) => <span key={i} title={`${s.label} · ${s.n}`} style={{ width: `${(s.n / techTotal) * 100}%`, background: techColors[i] }} />)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 12, color: 'var(--tx2)' }}>
                {techSegments.map((s, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, background: techColors[i] }} />{s.label} {Math.round((s.n / techTotal) * 100)} %
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        </>)}

        {/* Col 4 — studio life */}
        {column(<>
          {isAdmin && (
            <Panel {...panelProps('jobs', 0)} kind={sig('jobs').kind} title={t('od_sig_jobs')} testId="overview-embedding-index">
              <Line h={rowH} dim={(jobs.voice ?? 0) === 0}>
                <span style={ELLIPSIS} data-testid="overview-jobs-voice">{t('od_jobs_voice')}</span>
                <b>{jobs.voice == null ? '…' : num(jobs.voice)}</b>
                <SignalMark kind={(jobs.voice ?? 0) > 0 ? 'attention' : 'ok'} />
              </Line>
              <Line h={rowH} dim={(jobs.index ?? 0) === 0}>
                <span style={ELLIPSIS}>{t('od_jobs_index')}</span>
                <b>{jobs.index == null ? '…' : num(jobs.index)}</b>
                <SignalMark kind={(jobs.index ?? 0) > 0 ? 'attention' : 'ok'} />
              </Line>
              <div data-testid="overview-jobs-archive" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '5px 12px 6px', borderBottom: '1px solid var(--bg2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, ...ELLIPSIS }}>{t('od_jobs_archive')}</span>
                  <b>{jobs.archiveDays === undefined ? '…' : jobs.archiveDays === null ? t('od_jobs_never') : fmt('od_jobs_days', { n: jobs.archiveDays })}</b>
                  <SignalMark kind={jobs.archiveStale ? 'wrong' : 'ok'} />
                </span>
                <span role="img" aria-label={fmt('od_jobs_alarm', { n: ARCHIVE_STALE_DAYS })} style={{ position: 'relative', height: 6, background: 'var(--bg2)' }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ((jobs.archiveDays ?? ARCHIVE_STALE_DAYS) / ARCHIVE_STALE_DAYS) * 100)}%`, background: jobs.archiveStale ? 'var(--rust)' : 'var(--sage)' }} />
                </span>
                <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{fmt('od_jobs_alarm', { n: ARCHIVE_STALE_DAYS })}</span>
              </div>
              <LocalJobsControls jobs={jobs} t={t} />
            </Panel>
          )}
          <Panel {...panelProps('ideas', ideasMore.length)} kind="info" title={t('od_ideas')} count={num(burningConcepts.length)}
            link={{ label: t('od_concepts_link'), onClick: () => onGoTab('concepts') }}
            moreContent={ideasMore.map(c => <IdeaLine key={c.id} c={c} h={rowH + 2} onGo={() => onGoTab('concepts')} t={t} />)}>
            {ideasBase.length
              ? ideasBase.map(c => <IdeaLine key={c.id} c={c} h={rowH + 2} onGo={() => onGoTab('concepts')} t={t} />)
              : <Empty h={rowH}>{t('od_no_idea')}</Empty>}
          </Panel>
          <Panel {...panelProps('seeagain', 0)} kind="info" title={t('od_see_again')} shrink={10000} scroll>
            <div style={{ padding: '6px 12px' }}><SeeAgainCard context="overview" /></div>
          </Panel>
          <Panel {...panelProps('latest', thumbsMore.length)} kind="info" title={t('od_latest')} link={{ label: t('od_inventory_link'), onClick: () => onGoTab('inventory') }}
            moreContent={<div style={{ display: 'grid', gridTemplateColumns: `repeat(${compact ? 3 : 4}, minmax(0, 1fr))`, gap: 4, padding: '0 12px 8px' }}>{thumbsMore.map(thumb)}</div>}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compact ? 3 : 4}, minmax(0, 1fr))`, gap: 4, padding: '8px 12px 4px' }}>{thumbsBase.map(thumb)}</div>
          </Panel>
        </>, true)}
      </main>

      {/* Status bar */}
      <footer style={{ flex: 'none', height: 24, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderTop: '1px solid var(--bd)', background: 'var(--bg1)', fontSize: 11, color: 'var(--tx3)' }}>
        <span style={{ ...ELLIPSIS, flex: 1 }}>{t('od_status_hint')}</span>
        {now && <span style={{ whiteSpace: 'nowrap' }}>{fmt('od_loaded_at', { time: now.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' }) })}</span>}
      </footer>
    </div>
  )
}

// ── Building blocks (module level so they keep identity between renders) ──

const ELLIPSIS: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const SECTION: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)' }

function Panel({
  id, domId, fixed, hdrH, open, flashed, more, reduceMotion, onEnter, onLeave, onToggle, moreLabel, moreTitle,
  kind, title, titleTip, count, extra, link, children, moreContent, testId, shrink = 50, scroll = false,
}: {
  id: string; domId?: string; fixed: boolean; hdrH: number; open: boolean; flashed: boolean; more: number; reduceMotion: boolean
  onEnter?: () => void; onLeave?: () => void; onToggle?: () => void; moreLabel: string; moreTitle: string
  kind?: SignalKind; title: string; titleTip?: string; count?: string; extra?: string
  link?: { label: string; onClick: () => void }; children: ReactNode; moreContent?: ReactNode; testId?: string
  /** How fast this panel gives up height when its column is full (higher = first). */
  shrink?: number
  /** Scroll inside instead of clipping when squeezed (See again: its own buttons must stay reachable). */
  scroll?: boolean
}) {
  const style: CSSProperties = fixed
    ? open
      ? { flex: '1 1 auto', minHeight: 220, overflowY: 'auto' }
      : { flex: `0 ${shrink} auto`, minHeight: hdrH, overflow: 'hidden', overflowY: scroll ? 'auto' : 'hidden' }
    : {}
  return (
    <div id={domId ?? `ov-panel-${id}`} data-testid={testId} onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{
        ...style, position: 'relative', borderBottom: '1px solid var(--bd)',
        boxShadow: open ? 'inset 0 2px 0 var(--ac)' : flashed ? 'inset 0 0 0 2px var(--ac)' : undefined,
        transition: reduceMotion ? undefined : 'box-shadow 200ms',
        scrollMarginTop: 96,
      }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, height: hdrH, padding: '0 12px', background: 'var(--bg1)', borderBottom: '1px solid var(--bd)', boxShadow: open ? 'inset 0 2px 0 var(--ac)' : undefined }}>
        {kind && <SignalMark kind={kind} />}
        <h2 title={titleTip ?? title} style={{ ...SECTION, margin: 0, ...ELLIPSIS, flex: '0 1 auto' }}>{title}</h2>
        {count != null && <b>{count}</b>}
        {extra && <span title={extra} style={{ ...ELLIPSIS, flex: '0 20 auto', color: 'var(--tx3)' }}>{extra}</span>}
        <span style={{ flex: 1 }} />
        {more > 0 && onToggle && (
          <button type="button" onClick={onToggle} title={moreTitle} aria-expanded={open}
            style={{ background: 'none', border: 0, padding: '0 2px', fontSize: 11, color: open ? 'var(--ac)' : 'var(--tx3)', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }}>
            {open ? '−' : moreLabel}
          </button>
        )}
        {link && (
          <button type="button" onClick={link.onClick} style={{ background: 'none', border: 0, padding: 0, fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }}>{link.label}</button>
        )}
      </div>
      {children}
      {moreContent != null && more > 0 && (
        <div aria-hidden={!open} style={{
          maxHeight: open ? 4000 : 0, opacity: open ? 1 : 0, overflow: 'hidden',
          transition: reduceMotion ? undefined : 'max-height 380ms ease, opacity 380ms ease',
        }}>
          {moreContent}
        </div>
      )}
    </div>
  )
}

function Line({ children, h, onClick, dim, bg, cols = 'minmax(0, 1fr) auto 12px' }: {
  children: ReactNode; h: number; onClick?: () => void; dim?: boolean; bg?: string; cols?: string
}) {
  const style: CSSProperties = {
    display: 'grid', gridTemplateColumns: cols, alignItems: 'center', gap: 8, width: '100%', minHeight: h, padding: '0 12px',
    border: 0, borderBottom: '1px solid var(--bg2)', background: bg ?? 'transparent', color: dim ? 'var(--tx3)' : 'var(--tx)',
    font: 'inherit', textAlign: 'left', boxSizing: 'border-box',
  }
  return onClick
    ? <button type="button" onClick={onClick} style={{ ...style, cursor: 'pointer' }}>{children}</button>
    : <div style={style}>{children}</div>
}

function Empty({ children, h }: { children: ReactNode; h: number }) {
  return <div style={{ display: 'flex', alignItems: 'center', minHeight: h, padding: '0 12px', color: 'var(--tx3)', fontSize: 12, borderBottom: '1px solid var(--bg2)' }}>{children}</div>
}

function IdeaLine({ c, h, onGo, t }: { c: { id: string; titre: string; energie: number }; h: number; onGo: () => void; t: (k: string) => string }) {
  const energy = [t('ov_energy_1'), t('ov_energy_2'), t('ov_energy_3'), t('ov_energy_4'), t('ov_energy_5')][c.energie - 1]
  return (
    <Line h={h} onClick={onGo} cols="minmax(0, 1fr) auto">
      <span style={ELLIPSIS} title={c.titre}>{c.titre}</span>
      <span role="img" aria-label={energy} title={energy} style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 6, height: 10, background: i <= c.energie ? 'var(--ac)' : 'var(--bg2)' }} />)}
      </span>
    </Line>
  )
}
