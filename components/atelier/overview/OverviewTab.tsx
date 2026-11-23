'use client'

// Overview — « coup d'œil » (design 2026-11-23, docs/design/2026-11-23/OverviewGlance.md + OverviewGlance_Mockup.html).
// Each signal appears once, as a card; the old strip + « Le reste » rail (the same counts twice) are gone.
//   Desktop, one screen and nothing scrolls inside it: header · [ left column: Le Fil (admin) or the team member's
//   own lines, then the calendar ] · [ one liquid grid: 9 signal cards + Dernières œuvres / À revoir / Idées ] · status bar.
//   A card shows the rows its size allows (« + n autres » when cut); a click widens it in place (one at a time),
//   « Ouvrir l'écran » leaves for the section. Short or narrow screens: the page scrolls, nothing inside it does.
//   Phone: signal rows worst first, a tap opens the row in place; the calendar as a list; the team member's lines.
// Counts are unchanged (`lib/atelier/overview-counts.ts`, `getOverviewBusiness`, the bootstrap, the reminders read).

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { openReadOr, primeOverviewOpen } from '@/lib/atelier/open-reads'
import { OVERVIEW_REMINDER_LIMIT, overviewOpenKey } from '@/lib/atelier/open-read-keys'
import { listUnreadSuiviReminders, markSuiviReminderRead } from '@/app/atelier/reminders-actions'
import { getOverviewCatalogueCounts } from '@/app/atelier/overview-stats-actions'
import { getOverviewBusiness, type OverviewBusiness } from '@/app/atelier/overview-business-actions'
import { computeOverviewCounts, type OverviewCounts } from '@/lib/atelier/overview-counts'
import Link from 'next/link'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { ImageLoupe } from '@/components/atelier/ImageLoupe'
import { useLocalJobs, LocalJobsControls, ARCHIVE_STALE_DAYS } from '@/components/atelier/overview/EmbeddingIndexCard'
import { SeeAgainCard } from '@/components/atelier/SeeAgainCard'
import { OverviewFil } from '@/components/atelier/overview/OverviewFil'
import { OverviewMine } from '@/components/atelier/overview/OverviewMine'
import { FitList } from '@/components/atelier/overview/FitList'
import { OverviewCalendar, buildCalItems, calStatus, effKey, localKey, type CalItem } from '@/components/atelier/overview/OverviewCalendar'
import { SignalMark, SIGNAL_COLOR, type SignalKind } from '@/components/atelier/SignalMark'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import { daysUntil } from '@/lib/pipeline-deadlines'
import { toLocalDateKey } from '@/lib/pipeline-calendar'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { Lang } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { interpolateMessage } from '@/lib/i18n/message-core'
import { formatPriceCompact } from '@/lib/format-price'
import {
  queueInventoryFilter,
  type InventoryHandoffCriterion,
} from '@/lib/atelier/inventory-filter-handoff'

const tint = (kind: SignalKind, pct = 8) =>
  kind === 'wrong' || kind === 'attention' ? `color-mix(in srgb, ${SIGNAL_COLOR[kind]} ${pct}%, transparent)` : undefined

type CountRow = { key: string; label: string; count: number; go: () => void }
type Signal = { id: string; kind: SignalKind; label: string; value: string; detail: string; go: () => void }
/** One line of a card: a label, a value, optionally a jump and a one-tap action (the reminder ✓). */
type CardRow = {
  key: string
  label: string
  value?: string
  kind?: SignalKind
  dim?: boolean
  go?: () => void
  action?: { label: string; title: string; testId?: string; onClick: () => void }
}
type Card = {
  id: string
  sig: Signal
  viz: ReactNode
  rows: CardRow[]
  /** Phone rows when they differ from the desk's (the reminders list has its own section there). */
  phoneRows?: CardRow[]
  head?: string
  /** Tooltip on the card header (the money note). */
  title?: string
  /** No « Ouvrir l'écran »: the card has no screen of its own to go to (local jobs). */
  noScreen?: boolean
  extra?: ReactNode
  rowsTestId?: string
}

/** Below this content width the left column goes above the grid and the page scrolls. */
const STACK_BELOW_WIDTH = 900
/** Smallest comfortable height of one grid row; fewer pixels than rows × this → the page scrolls instead. */
const MIN_ROW_H = 96
const MIN_CARD_W = 190
const MIN_CARD_W_WIDE_CAL = 140
const HEADER_H = 44
const FOOTER_H = 24

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
  // An idea line opens that idea's desk (Idées 2026-11-23), not the bare tab.
  const router = useRouter()
  const fmt = (k: string, vars: Record<string, string | number>) => interpolateMessage(t(k), vars)
  const localeTag = lang === 'en' ? 'en-GB' : 'fr-FR'
  const num = (n: number) => n.toLocaleString(localeTag)
  const thisYear   = new Date().getFullYear()

  // ── Counts (unchanged rules, `lib/atelier/overview-counts.ts`) ──────────
  // While the browser holds only part of the catalogue, the server's counts over the whole of it
  // (TODO 18); once it is all in, the loaded rows (live after edits).
  const [serverCounts, setServerCounts] = useState<OverviewCounts | null>(null)
  useEffect(() => {
    let cancelled = false
    void openReadOr(overviewOpenKey.counts, () => getOverviewCatalogueCounts()).then((c) => {
      if (!cancelled) setServerCounts(c)
    })
    return () => { cancelled = true }
  }, [])
  // Orders, shipments, events, system (Pem 2026-11-18) — one small server read.
  const [biz, setBiz] = useState<OverviewBusiness | null>(null)
  useEffect(() => {
    let cancelled = false
    void getOverviewBusiness().then((b) => { if (!cancelled) setBiz(b) }).catch(() => { /* the cards show « … » */ })
    return () => { cancelled = true }
  }, [])
  const loadedCounts = useMemo(() => computeOverviewCounts(oeuvres, thisYear), [oeuvres, thisYear])
  const catalogueIn = oeuvresCatalogueTotal == null || oeuvres.length >= oeuvresCatalogueTotal
  const counts = !catalogueIn && serverCounts ? serverCounts : loadedCounts
  const {
    byYear, withPrice, available, exposable, catalogued, missingDims, missingImages, missingLoc, missingAddress,
    missingTech, missingSupport, missingYear, missingTitle, needsPhotoValidation, notCatalogued, totalValue,
  } = counts
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
    // Places phase B (Pem 2026-11-23: « make sure I don't miss that crucial information »): the list is audit rule 9.
    { key: 'place_unlinked', label: t('ov_needs_place_unlinked'), count: biz?.placeUnlinked ?? 0, go: () => onGoTab('audit') },
    { key: 'catalogue', label: t('ov_needs_not_catalogued'), count: notCatalogued, go: () => goInventory(t('ov_needs_not_catalogued'), [{ field: 'Catalogué', op: '= faux' }]) },
    { key: 'sessions', label: t('ov_needs_sessions'), count: backlog.sessionsToApply, go: () => onGoTab('journal') },
  ]
  const needsTotal = needsRows.reduce((s, r) => s + r.count, 0)

  const gapRows: CountRow[] = [
    { key: 'photo', label: t('ov_health_missing_photos'), count: missingImages, go: () => goInventory(t('ov_health_missing_photos'), [{ field: '_hasImage', op: 'est vide' }]) },
    { key: 'dims', label: t('ov_health_missing_dims'), count: missingDims, go: () => goInventory(t('ov_health_missing_dims'), [{ field: 'Hauteur', op: 'est vide' }]) },
    { key: 'loc', label: t('ov_health_missing_loc'), count: missingLoc, go: () => goInventory(t('ov_health_missing_loc'), [{ field: 'LocalisationID', op: 'est vide' }]) },
    { key: 'address', label: t('ov_health_missing_address'), count: missingAddress, go: () => goInventory(t('ov_health_missing_address'), [{ field: 'place_id', op: 'est vide' }]) },
    { key: 'tech', label: t('ov_health_missing_tech'), count: missingTech, go: () => goInventory(t('ov_health_missing_tech'), [{ field: 'Technique', op: 'est vide' }]) },
    { key: 'support', label: t('ov_health_missing_support'), count: missingSupport, go: () => goInventory(t('ov_health_missing_support'), [{ field: 'Support', op: 'est vide' }]) },
    { key: 'year', label: t('ov_health_missing_year'), count: missingYear, go: () => goInventory(t('ov_health_missing_year'), [{ field: 'Année', op: 'est vide' }]) },
    { key: 'title', label: t('ov_health_missing_title'), count: missingTitle, go: () => goInventory(t('ov_health_missing_title'), [{ field: 'Titre', op: 'est vide' }]) },
  ].sort((a, b) => b.count - a.count)
  const gapTotal = gapRows.reduce((s, r) => s + r.count, 0)

  // Reminders — whole unread list, refetched on every visit (the shell snapshot goes stale).
  const [reminderRows, setReminderRows] = useState<SuiviReminderListRow[]>(initialReminders)
  // One read for the tab (TODO 18), unless the page opened here and the frame's read carries it.
  // Layout effect = before this tab's and the See again card's effects take their slice.
  useLayoutEffect(() => {
    primeOverviewOpen()
  }, [])
  useEffect(() => {
    let cancelled = false
    void openReadOr(overviewOpenKey.reminders, () => listUnreadSuiviReminders(OVERVIEW_REMINDER_LIMIT)).then((rows) => {
      if (!cancelled) setReminderRows(rows)
    })
    return () => { cancelled = true }
  }, [])
  const markReminderDone = async (id: string) => {
    setReminderRows((rows) => rows.filter((r) => r.id !== id))
    const res = await markSuiviReminderRead(id)
    if (!res.ok) setReminderRows(await listUnreadSuiviReminders(OVERVIEW_REMINDER_LIMIT))
  }
  const reminders = useMemo(
    () => reminderRows.map(r => ({ r, days: daysUntil(r.remind_at) })).sort((a, b) => a.days - b.days),
    [reminderRows],
  )
  const remOverdue = reminders.filter(x => x.days < 0).length
  const remToday = reminders.filter(x => x.days === 0).length
  const remTomorrow = reminders.filter(x => x.days === 1).length
  const remNext7 = reminders.filter(x => x.days >= 2 && x.days <= 7).length

  const { expenseTotalTtc, salesIncomeTtc, overviewCalendarEvents, overviewEventSpans, burningConcepts } = initialOverviewBootstrap
  const income = salesIncomeTtc ?? 0
  const expenses = expenseTotalTtc
  const net = income - expenses

  // Calendar items: the bootstrap's open deadlines (events = deadlines of an exposition / collaboration / edition)
  // plus the reminders as they stand now (a ✓ here or in the Rappels card moves both).
  const todayKey = localKey(new Date())
  const calItems = useMemo<CalItem[]>(() => {
    const deadlineItems = buildCalItems(overviewCalendarEvents).filter((i) => i.kind !== 'rm')
    // Same day key as the deadline's own (`toLocalDateKey`), compared as strings.
    const endKeyOf = (e: { end: string }) => toLocalDateKey(e.end)
    const deadlineAt = new Set(deadlineItems.map((i) => `${i.processId}|${i.dateKey}|${i.label}`))
    // An event that lasts several days is one span (its end-date deadline would only repeat the last day).
    // A span already over counts only while the Pipeline still shows its end-date deadline (its `skipDateFin` rules):
    // a deadline hidden there is never « late » here.
    const liveSpans = overviewEventSpans.filter((e) => endKeyOf(e) >= todayKey || deadlineAt.has(`${e.processId}|${endKeyOf(e)}|${e.label}`))
    const spanned = new Set(overviewEventSpans.map((e) => `${e.processId}|${endKeyOf(e)}|${e.label}`))
    const dated = deadlineItems.filter((i) => !(i.processId && spanned.has(`${i.processId}|${i.dateKey}|${i.label}`)))
    const spans: CalItem[] = liveSpans.map((e) => ({ id: `s:${e.processId}`, kind: 'ev', dateKey: e.start, endKey: endKeyOf(e), label: e.label, processId: e.processId }))
    const rm: CalItem[] = reminderRows.map((r) => ({
      id: `r:${r.id}`, kind: 'rm', dateKey: toLocalDateKey(r.remind_at), label: r.message, processId: r.process_id, reminderId: r.id,
    }))
    return [...dated, ...spans, ...rm].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.label.localeCompare(b.label))
  }, [overviewCalendarEvents, overviewEventSpans, reminderRows, todayKey])
  // ONE source for the calendar's status line, the tally and the phone rows.
  const cal = calStatus(calItems, todayKey)
  const openCalItem = (i: CalItem) => onGoTab(i.kind === 'rm' && !i.processId ? 'notes' : 'pipeline')

  const techSegments = useMemo(() => {
    const sorted = [...counts.byTechnique].sort((a, b) => b[1] - a[1])
    const top = sorted.slice(0, 4).map(([id, n]) => ({ label: id == null ? t('od_unknown_tech') : (tM[id] ?? '—'), n }))
    const rest = sorted.slice(4).reduce((s, [, n]) => s + n, 0)
    if (rest > 0) top.push({ label: t('od_other'), n: rest })
    return top
  }, [counts, tM, t])
  const techTotal = Math.max(1, techSegments.reduce((s, x) => s + x.n, 0))
  const techColors = ['var(--ac)', 'color-mix(in srgb, var(--ac) 65%, var(--bd3))', 'var(--tx3)', 'var(--bd3)', 'var(--bd2)']

  const recentWorks = useMemo(() => [...oeuvres].sort((a, b) => b.OeuvreID - a.OeuvreID).slice(0, 24), [oeuvres])

  const jobs = useLocalJobs(isAdmin)
  const jobsBacklog = (jobs.voice ?? 0) + (jobs.index ?? 0)
  const jobsLoading = jobs.voice == null && jobs.archiveDays === undefined

  // Which card is widened (one at a time) and how wide the calendar is.
  const [openCard, setOpenCard] = useState<string | null>(null)
  const [calBig, setCalBig] = useState(false)
  const [filCount, setFilCount] = useState<number | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      setOpenCard(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Signals (fixed positions; rules from docs/archive/DESIGN_BRIEF_2026-11-13.md) ──
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
    // Deadlines and events live in the calendar (desk) and are rows of their own on the phone; both read `cal`,
    // the calendar's own status (overdue = wrong, today = attention) — the tally cannot say another number.
    signals.push({
      id: 'deadlines', label: t('od_sig_deadlines'),
      kind: cal.late > 0 ? 'wrong' : cal.today > 0 ? 'attention' : 'ok',
      value: num(cal.late || cal.today || cal.next7),
      detail: fmt(cal.late > 0 ? 'od_dl_overdue' : cal.today > 0 ? 'od_dl_today' : 'od_dl_next7', { n: cal.dl + cal.ev }),
      go: () => onGoTab('pipeline'),
    })
    signals.push({
      id: 'reminders', label: t('od_sig_reminders'),
      kind: remOverdue > 0 ? 'wrong' : remToday > 0 ? 'attention' : 'ok',
      value: num(remOverdue || remToday || remTomorrow + remNext7),
      // « Rappels 0 » beside the panel's « Rappels 40 » read as two counts (stress test 2026-11-18): the signal
      // counts what is due within 7 days, so its line names the total the card shows.
      detail: remOverdue > 0 ? fmt('od_rem_overdue', { n: remToday }) : remToday > 0 ? t('od_rem_today') : fmt('od_rem_next7', { n: reminders.length }),
      go: () => onGoTab('notes'),
    })
    signals.push({
      id: 'money', label: t('od_sig_money'),
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
        go: () => setOpenCard('jobs'),
      })
    }
    signals.push({
      id: 'orders', label: t('od_sig_orders'),
      kind: !biz ? 'info' : biz.shipments > 0 ? 'attention' : 'ok',
      value: biz ? num(biz.orders) : '…',
      detail: fmt('od_orders_detail', { n: biz ? biz.shipments : '…' }),
      go: () => onGoTab(biz && biz.shipments > 0 ? 'logistics' : 'sales'),
    })
    signals.push({
      id: 'events', label: t('od_sig_events'),
      kind: 'info',
      value: num(cal.ev),
      detail: t('od_events_detail'),
      go: () => onGoTab('exhibitions'),
    })
    if (isAdmin) {
      const run = biz?.lastRuleRun ?? null
      const ruleBreaks = run ? (run.error ? 1 : run.breaks) : 0
      const errs = biz?.errors7d ?? 0
      signals.push({
        id: 'system', label: t('od_sig_system'),
        kind: !biz ? 'info' : ruleBreaks > 0 ? 'wrong' : errs > 0 ? 'attention' : 'ok',
        value: biz ? num(errs) : '…',
        detail: fmt('od_system_detail', {
          rules: !run ? t('od_rules_unknown') : ruleBreaks > 0 ? fmt('od_rules_breaks', { n: ruleBreaks }) : t('od_rules_ok'),
        }),
        go: () => onGoTab('audit'),
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
  const sig = (id: string) => signals.find(s => s.id === id)!
  // The tally counts every signal (the calendar's deadlines included) and, for the admin, the Fil.
  const tally = { wrong: 0, attention: 0, ok: 0 }
  for (const s of signals) if (s.kind !== 'info') tally[s.kind]++
  if (isAdmin && filCount != null) tally[filCount > 0 ? 'attention' : 'ok']++

  // ── Cards: one per signal that is not the calendar's or the Fil's (fixed order, Pem 2026-11-23) ──
  const relDay = (days: number) => (days < 0 ? fmt('od_days_late', { n: -days }) : days === 0 ? t('od_today') : days === 1 ? t('od_tomorrow') : fmt('od_in_days', { n: days }))
  const countRow = (r: CountRow, mark: SignalKind): CardRow => ({
    key: r.key, label: r.label, value: num(r.count), kind: r.count > 0 ? mark : 'ok', dim: r.count === 0, go: r.count > 0 ? r.go : undefined,
  })
  const bars = (v: number[], hot = 0) => {
    const m = Math.max(1, ...v)
    return (
      <span aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 16 }}>
        {v.map((x, i) => <i key={i} style={{ display: 'block', flex: '1 1 0', minWidth: 3, height: Math.max(2, (x / m) * 16), background: i < hot && x > 0 ? 'var(--rust)' : 'var(--bd2)' }} />)}
      </span>
    )
  }
  const cards: Card[] = []
  cards.push({
    id: 'needs', sig: sig('needs'),
    viz: bars(needsRows.map((r) => r.count)),
    rows: needsRows.map((r) => countRow(r, 'attention')),
  })
  cards.push({
    id: 'reminders', sig: sig('reminders'),
    viz: bars([remOverdue, remToday, remTomorrow, remNext7], 1),
    head: `${t('od_overdue')} ${remOverdue} · ${t('od_today')} ${remToday} · ${t('od_tomorrow')} ${remTomorrow} · ${t('od_next7')} ${remNext7}`,
    rowsTestId: 'overview-reminders',
    rows: reminders.length
      ? reminders.map(({ r, days }) => ({
        key: r.id, label: r.message, value: relDay(days), kind: days < 0 ? 'wrong' : days === 0 ? 'attention' : undefined,
        go: () => onGoTab(r.process_id ? 'pipeline' : 'notes'),
        action: { label: '✓', title: t('ov_reminder_done'), testId: 'overview-reminder-done', onClick: () => void markReminderDone(r.id) },
      }))
      : [{ key: 'none', label: t('od_no_reminder'), dim: true }],
    phoneRows: ([['od_overdue', remOverdue, 'wrong'], ['od_today', remToday, 'attention'], ['od_tomorrow', remTomorrow, undefined], ['od_next7', remNext7, undefined]] as const)
      .map(([k, n, kind]) => ({ key: k, label: t(k), value: num(n), kind: n > 0 ? kind : undefined, dim: n === 0 })),
  })
  cards.push({
    id: 'catalogue', sig: sig('catalogue'),
    viz: bars(gapRows.map((r) => r.count), 3),
    head: fmt('od_gaps_of', { n: num(worksTotal) }),
    rows: gapRows.map((r) => countRow(r, 'wrong')),
  })
  if (isAdmin) {
    cards.push({
      id: 'integrity', sig: sig('integrity'), viz: null,
      rows: [conflicts.length > 0
        ? { key: 'conflicts', label: t('od_integrity_row'), value: num(conflicts.length), kind: 'wrong', go: () => onGoTab('contacts') }
        : { key: 'none', label: t('od_no_collision'), dim: true }],
    })
  }
  cards.push({
    id: 'orders', sig: sig('orders'),
    viz: bars([biz?.orders ?? 0, biz?.shipments ?? 0]),
    rows: [
      { key: 'open', label: t('card_orders_open'), value: biz ? num(biz.orders) : '…', go: () => onGoTab('sales') },
      { key: 'ship', label: t('card_orders_ship'), value: biz ? num(biz.shipments) : '…', kind: biz && biz.shipments > 0 ? 'attention' : undefined, go: () => onGoTab('logistics') },
    ],
  })
  cards.push({
    id: 'money', sig: sig('money'),
    viz: bars([income, expenses]),
    head: fmt('od_money', { year: thisYear }),
    title: t('od_money_note'),
    rows: [
      { key: 'income', label: t('od_income'), value: formatPriceCompact(income, lang) },
      { key: 'expenses', label: t('od_expenses'), value: formatPriceCompact(expenses, lang) },
      { key: 'net', label: t('od_net'), value: `${net > 0 ? '+' : ''}${formatPriceCompact(net, lang)}`, kind: net < 0 ? 'wrong' : undefined },
    ],
  })
  cards.push({
    id: 'collection', sig: sig('collection'),
    viz: (
      <span role="img" aria-label={techSegments.map((s) => `${s.label} ${Math.round((s.n / techTotal) * 100)} %`).join(', ')} style={{ display: 'flex', height: 8, gap: 2 }}>
        {techSegments.map((s, i) => <i key={i} title={`${s.label} · ${s.n}`} style={{ display: 'block', width: `${(s.n / techTotal) * 100}%`, background: techColors[i] }} />)}
      </span>
    ),
    rows: [
      { key: 'value', label: t('od_total_value'), value: formatPriceCompact(totalValue, lang) },
      { key: 'avail', label: t('ov_stat_available'), value: num(available) },
      { key: 'expo', label: t('od_exhibitable'), value: num(exposable) },
      { key: 'priced', label: t('od_priced'), value: num(withPrice) },
      { key: 'year', label: fmt('od_made_year', { year: thisYear }), value: num(byYear) },
      { key: 'cat', label: t('od_catalogued'), value: `${Math.round((catalogued / Math.max(1, counts.total)) * 100)} %` },
      ...techSegments.map((s, i) => ({ key: `tech${i}`, label: s.label, value: `${Math.round((s.n / techTotal) * 100)} %`, dim: true })),
    ],
  })
  if (isAdmin) {
    const d = jobs.archiveDays
    cards.push({
      id: 'jobs', sig: sig('jobs'),
      viz: bars([jobs.voice ?? 0, jobs.index ?? 0, jobs.archiveStale ? 1 : 0]),
      head: fmt('od_jobs_alarm', { n: ARCHIVE_STALE_DAYS }),
      noScreen: true,
      extra: <LocalJobsControls jobs={jobs} t={t} />,
      rows: [
        { key: 'voice', label: t('od_jobs_voice'), value: jobs.voice == null ? '…' : num(jobs.voice), kind: (jobs.voice ?? 0) > 0 ? 'attention' : 'ok' },
        { key: 'index', label: t('od_jobs_index'), value: jobs.index == null ? '…' : num(jobs.index), kind: (jobs.index ?? 0) > 0 ? 'attention' : 'ok' },
        { key: 'archive', label: t('od_jobs_archive'), value: d === undefined ? '…' : d === null ? t('od_jobs_never') : fmt('od_jobs_days', { n: d }), kind: jobs.archiveStale ? 'wrong' : 'ok' },
      ],
    })
    const run = biz?.lastRuleRun ?? null
    const ruleBreaks = run ? (run.error ? 1 : run.breaks) : 0
    cards.push({
      id: 'system', sig: sig('system'), viz: null,
      rows: [
        { key: 'errors', label: t('card_sys_errors'), value: biz ? num(biz.errors7d ?? 0) : '…', kind: (biz?.errors7d ?? 0) > 0 ? 'attention' : undefined, go: () => onGoTab('audit') },
        { key: 'rules', label: t('card_sys_rules'), value: !run ? t('od_rules_unknown') : ruleBreaks > 0 ? fmt('od_rules_breaks', { n: ruleBreaks }) : t('od_rules_ok'), kind: ruleBreaks > 0 ? 'wrong' : undefined, go: () => onGoTab('audit') },
      ],
    })
  }

  // ── Layout measurement: fill the window under the Atelier chrome ──────
  const narrow = useMediaQuery('(max-width: 767px)')
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
  const stacked = box.w < STACK_BELOW_WIDTH
  const leftW = stacked ? box.w : calBig ? Math.min(Math.round(box.w * 0.6), 1000) : Math.min(380, Math.max(250, Math.round(box.w * 0.17)))
  const gridW = stacked ? box.w : box.w - leftW
  const mainH = box.h - HEADER_H - FOOTER_H
  // With the calendar widened the grid is narrow: thinner cards, and Dernières œuvres is one cell, so it still fits one screen.
  const cols = Math.max(1, Math.floor(gridW / (calBig ? MIN_CARD_W_WIDE_CAL : MIN_CARD_W)))
  // Cells: one per card, Dernières œuvres 2 × 2, À revoir, Idées; an opened card takes 2 × 3 (one at a time).
  const cellsNeeded = cards.length + (calBig ? 3 : 6) + (openCard ? 5 : 0)
  const rows = Math.max(2, Math.ceil(cellsNeeded / cols))
  // One screen and nothing scrolls inside it — or, when the rows would be too thin, the page scrolls and nothing inside does.
  const oneScreen = !narrow && !stacked && box.w > 0 && rows * MIN_ROW_H <= mainH
  const openSpanRows = Math.min(3, rows)

  // Loaded-at clock (client only: no hydration mismatch).
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => { setNow(new Date()) }, [])

  const thumb = (o: Oeuvre) => (
    <Link key={o.OeuvreID} href={`/atelier/inventory?work=${o.OeuvreID}`} aria-label={`#${o.OeuvreID} ${o.Titre ?? ''}`.trim()}
      style={{ display: 'block', aspectRatio: '1', alignSelf: 'start', background: 'var(--bg2)', position: 'relative', overflow: 'hidden', color: 'inherit', textDecoration: 'none' }}>
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

  // ── Phone: signal rows, worst first; a tap opens the row in place ─────
  if (narrow) {
    const groups: SignalKind[] = ['wrong', 'attention', 'ok', 'info']
    const groupLabel: Record<SignalKind, string> = { wrong: t('od_wrong'), attention: t('od_attention'), ok: t('od_ok'), info: t('od_info') }
    const byId = new Map(cards.map((c) => [c.id, c]))
    const phoneSignals = signals.filter((s) => byId.has(s.id) || s.id === 'deadlines' || s.id === 'events')
    // Today first, then what is overdue (nearest first), then what is coming — old items never push today out of the 8.
    const rank = (i: CalItem) => { const k = effKey(i, todayKey); return k === todayKey ? 0 : k < todayKey ? 1 : 2 }
    const agenda = calItems
      .filter((i) => i.kind !== 'rm')
      .sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? effKey(b, todayKey).localeCompare(effKey(a, todayKey)) : effKey(a, todayKey).localeCompare(effKey(b, todayKey))))
      .slice(0, 8)
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
          const list = phoneSignals.filter(s => s.kind === g)
          if (!list.length) return null
          return (
            <div key={g}>
              <div style={{ ...SECTION, height: 28, padding: '0 16px', background: 'var(--bg1)' }}>{groupLabel[g]}</div>
              {list.map(s => {
                const c = byId.get(s.id)
                if (!c) {
                  // Deadlines / events: no rows of their own here — the row jumps, as it always did.
                  return (
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
                  )
                }
                const open = openCard === s.id
                return (
                  <div key={s.id} data-testid={`overview-card-${s.id}`}>
                    <button type="button" aria-expanded={open} onClick={() => setOpenCard(open ? null : s.id)} aria-label={`${s.label}: ${groupLabel[s.kind]}, ${s.value}`}
                      style={{ display: 'grid', gridTemplateColumns: '14px minmax(0, 1fr) auto 14px', alignItems: 'center', gap: 10, width: '100%', minHeight: 46, padding: '4px 16px', background: tint(s.kind), border: 0, borderBottom: '1px solid var(--bg2)', color: 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                      <SignalMark kind={s.kind} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600 }}>{s.label}</span>
                        <span style={{ ...ELLIPSIS, display: 'block', fontSize: 12, color: 'var(--tx2)' }}>{s.detail}</span>
                      </span>
                      <b style={{ fontSize: 18 }}>{s.value}</b>
                      <span aria-hidden="true" style={{ color: 'var(--tx3)' }}>{open ? '▾' : '›'}</span>
                    </button>
                    {open && (
                      <div style={{ background: 'var(--bg1)' }}>
                        {(c.phoneRows ?? c.rows).map((r) => (
                          <button key={r.key} type="button" disabled={!r.go} onClick={r.go}
                            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', width: '100%', minHeight: 44, padding: '4px 16px', border: 0, borderBottom: '1px solid var(--bg2)', background: 'none', color: r.dim ? 'var(--tx3)' : 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: r.go ? 'pointer' : 'default' }}>
                            <span style={{ ...ELLIPSIS }}>{r.label}</span>
                            <b style={{ fontWeight: r.dim ? 400 : 700 }}>{r.value}</b>
                          </button>
                        ))}
                        {c.noScreen ? null : <button type="button" onClick={s.go} style={{ display: 'block', width: 'calc(100% - 32px)', margin: '8px 16px', minHeight: 44, border: '1px solid var(--bd2)', borderRadius: 8, background: 'none', color: 'var(--tx)', font: 'inherit', cursor: 'pointer' }}>{t('card_open_screen')}</button>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
        {!isAdmin && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--bd)' }}>
            <OverviewMine onGoIdeas={() => onGoTab('concepts')} narrow />
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ ...SECTION, height: 28, padding: '0 16px', background: 'var(--bg1)' }}>{t('cal_title')}</div>
          {agenda.length === 0
            ? <div style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 13 }}>{t('od_no_deadline')}</div>
            : agenda.map((i) => (
              <button key={i.id} type="button" onClick={() => openCalItem(i)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', width: '100%', minHeight: 44, padding: '4px 16px', border: 0, borderBottom: '1px solid var(--bg2)', background: 'none', color: 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span style={ELLIPSIS}>{i.kind === 'ev' ? '● ' : '◆ '}{i.label}</span>
                <span style={{ fontSize: 12, color: effKey(i, todayKey) < todayKey ? 'var(--rust)' : 'var(--tx3)', whiteSpace: 'nowrap' }}>{relDay(Math.round((new Date(`${effKey(i, todayKey)}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime()) / 86_400_000))}</span>
              </button>
            ))}
        </div>
        {/* Mobile action bar scrolls here (TeamPortalClient `openFieldReminders`). */}
        <div id="atelier-field-reminders" style={{ scrollMarginTop: 96, marginTop: 12 }}>
          <div style={{ ...SECTION, height: 28, padding: '0 16px', background: 'var(--bg1)' }}>{t('ov_reminders_title')} · {reminders.length}</div>
          <div data-testid="overview-reminders">
            {reminders.length === 0
              ? <div style={{ padding: '10px 16px', color: 'var(--tx3)', fontSize: 13 }}>{t('od_no_reminder')}</div>
              : reminders.map(({ r, days }) => {
                const kind: SignalKind | null = days < 0 ? 'wrong' : days === 0 ? 'attention' : null
                return (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto 44px', alignItems: 'center', gap: 8, minHeight: 46, padding: '0 0 0 12px', borderBottom: '1px solid var(--bg2)' }}>
                    {kind ? <SignalMark kind={kind} /> : <span />}
                    <button type="button" onClick={() => onGoTab(r.process_id ? 'pipeline' : 'notes')} title={r.process_id ? t('ov_reminder_open_project') : t('ov_reminder_open_notes')}
                      style={{ ...ELLIPSIS, textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'var(--tx)', font: 'inherit', cursor: 'pointer' }}>
                      {r.message}
                    </button>
                    <span style={{ fontSize: 11, color: kind ? SIGNAL_COLOR[kind] : 'var(--tx3)', whiteSpace: 'nowrap' }}>{days === 0 ? t('ov_reminder_today') : days === 1 ? t('ov_reminder_tomorrow') : relDay(days)}</span>
                    <button type="button" data-testid="overview-reminder-done" onClick={() => void markReminderDone(r.id)} title={t('ov_reminder_done')} aria-label={t('ov_reminder_done')}
                      style={{ height: 44, background: 'none', border: 0, borderLeft: '1px solid var(--bg2)', color: 'var(--tx3)', cursor: 'pointer', font: 'inherit' }}>✓</button>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    )
  }

  // ── Desktop / tablet ──────────────────────────────────────────────────
  const ideasRows = burningConcepts.map(c => <IdeaLine key={c.id} c={c} h={28} onGo={() => router.push(`/atelier/concepts?concept=${c.id}`)} t={t} />)
  const contentCard = (id: string, title: string, link: { label: string; onClick: () => void } | null, span: CSSProperties, children: ReactNode) => (
    <section key={id} data-testid={`overview-card-${id}`} style={{ ...span, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', borderRight: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 12px', background: 'var(--bg1)', borderBottom: '1px solid var(--bd)' }}>
        <h2 style={{ ...SECTION, margin: 0, flex: 1 }}>{title}</h2>
        {link && <button type="button" onClick={link.onClick} style={{ background: 'none', border: 0, padding: 0, fontSize: 12, color: 'var(--tx2)', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap' }}>{link.label}</button>}
      </div>
      {children}
    </section>
  )

  return (
    <div ref={rootRef} style={{
      height: oneScreen ? box.h || undefined : undefined, display: 'flex', flexDirection: 'column', overflow: oneScreen ? 'hidden' : undefined,
      background: 'var(--bg0)', color: 'var(--tx)', fontFamily: 'var(--font-ui)', fontSize: 13, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums',
    }}>
      {/* Header: title, date, the tally */}
      <header data-testid="atelier-overview-executive" style={{ flex: 'none', height: HEADER_H, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', background: 'var(--bg1)', borderBottom: '1px solid var(--bd)', minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-instrument-next), serif', fontWeight: 400, fontSize: 24, whiteSpace: 'nowrap' }}>{t('od_title')}</h1>
        {now && <span style={{ color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{now.toLocaleDateString(localeTag, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {now.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' })}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 10px', border: '1px solid var(--bd2)', borderRadius: 3, whiteSpace: 'nowrap' }}>
          {(['wrong', 'attention', 'ok'] as const).map(k => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SignalMark kind={k} /><b>{tally[k]}</b>{t(`od_${k}`)}</span>
          ))}
        </div>
      </header>

      <main style={{ flex: oneScreen ? '1 1 0' : undefined, minHeight: 0, display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'stretch' : oneScreen ? 'stretch' : 'flex-start' }}>
        {/* Left column: Le Fil (or the team member's lines), then the calendar — never empty, never dead space */}
        <aside aria-label={t('cal_title')} style={{ flex: 'none', width: stacked ? undefined : leftW, display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: stacked ? undefined : '1px solid var(--bd)', height: oneScreen ? '100%' : stacked ? undefined : 'auto', transition: reduceMotion ? undefined : 'width 150ms' }}>
          {isAdmin
            ? <OverviewFil compact fit={oneScreen} onCount={setFilCount} />
            : <OverviewMine compact fit={oneScreen} onGoIdeas={() => onGoTab('concepts')} />}
          <div style={{ flex: oneScreen ? '1 1 0' : 'none', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <OverviewCalendar
              items={calItems} big={calBig} onToggleBig={() => setCalBig((b) => !b)} fit={oneScreen}
              onOpenItem={openCalItem} onReminderDone={(id) => void markReminderDone(id)} onGoPipeline={() => onGoTab('pipeline')}
            />
          </div>
        </aside>

        {/* The grid: liquid, rows share the height, so on a big screen the cards just get bigger */}
        <div data-testid="overview-grid" style={{
          flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'grid', gridAutoFlow: 'dense',
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: oneScreen ? `repeat(${rows}, minmax(0, 1fr))` : undefined,
          gridAutoRows: oneScreen ? 'minmax(0, 1fr)' : 'minmax(120px, auto)',
          height: oneScreen ? '100%' : undefined,
        }}>
          {cards.map((c) => (
            <SignalCardView key={c.id} card={c} open={openCard === c.id} fit={oneScreen} span={openCard === c.id ? { col: Math.min(2, cols), row: openSpanRows } : undefined}
              onToggle={() => setOpenCard((cur) => (cur === c.id ? null : c.id))} onOpenScreen={c.sig.go} t={t} />
          ))}
          {contentCard('latest', t('od_latest'), { label: t('od_inventory_link'), onClick: () => onGoTab('inventory') }, calBig ? {} : { gridColumn: `span ${Math.min(2, cols)}`, gridRow: 'span 2' },
            <FitList items={recentWorks.map(thumb)} contents enabled={oneScreen} showMore={false}
              style={{ flex: oneScreen ? '1 1 0' : 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 3, padding: '6px 12px', alignContent: 'start' }} />)}
          {/* À revoir: a widget with its own buttons — folded it is a clipped, untouchable glance; opened (like a card) it is whole. */}
          <section data-testid="overview-card-seeagain" data-open={openCard === 'seeagain' ? 'true' : 'false'}
            onClick={openCard === 'seeagain' ? undefined : () => setOpenCard('seeagain')}
            style={{
              gridColumn: openCard === 'seeagain' ? `span ${Math.min(2, cols)}` : undefined, gridRow: openCard === 'seeagain' ? `span ${openSpanRows}` : undefined,
              display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', borderRight: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
              boxShadow: openCard === 'seeagain' ? 'inset 0 0 0 1px var(--ac)' : undefined, cursor: openCard === 'seeagain' ? 'default' : 'pointer',
            }}>
            <button type="button" aria-expanded={openCard === 'seeagain'} aria-label={`${t('od_see_again')} — ${t(openCard === 'seeagain' ? 'card_collapse' : 'card_expand')}`}
              onClick={(e) => { e.stopPropagation(); setOpenCard((cur) => (cur === 'seeagain' ? null : 'seeagain')) }}
              style={{ ...SECTION, flex: 'none', height: 28, padding: '0 12px', background: 'var(--bg1)', border: 0, borderBottom: '1px solid var(--bd)', font: 'inherit', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{t('od_see_again')}</span>
              {openCard === 'seeagain' && <span style={{ color: 'var(--tx3)', textTransform: 'none', letterSpacing: 0 }}>▴ {t('od_less_title')}</span>}
            </button>
            <div style={{ flex: oneScreen ? '1 1 0' : 'none', minHeight: 0, overflow: 'hidden', padding: '6px 12px', pointerEvents: openCard === 'seeagain' ? undefined : 'none' }}><SeeAgainCard context="overview" /></div>
          </section>
          {contentCard('ideas', t('od_ideas'), { label: t('od_concepts_link'), onClick: () => onGoTab('concepts') }, {},
            ideasRows.length
              ? <FitList items={ideasRows} enabled={oneScreen} style={{ flex: oneScreen ? '1 1 0' : 'none' }} />
              : <Empty h={28}>{t('od_no_idea')}</Empty>)}
        </div>
      </main>

      {/* Status bar */}
      <footer style={{ flex: 'none', height: FOOTER_H, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderTop: '1px solid var(--bd)', background: 'var(--bg1)', fontSize: 11, color: 'var(--tx3)' }}>
        <span style={{ ...ELLIPSIS, flex: 1 }}>{t('od_status_hint')}</span>
        {now && <span style={{ whiteSpace: 'nowrap' }}>{fmt('od_loaded_at', { time: now.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' }) })}</span>}
      </footer>
    </div>
  )
}

// ── Building blocks (module level so they keep identity between renders) ──

const ELLIPSIS: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const SECTION: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)' }

/** One signal as a card: mark, label, the count once, a chart; the rows that fit; a click widens it in place. */
function SignalCardView({ card, open, fit, span, onToggle, onOpenScreen, t }: {
  card: Card; open: boolean; fit: boolean; span?: { col: number; row: number }
  onToggle: () => void; onOpenScreen: () => void; t: (k: string) => string
}) {
  const { sig: s } = card
  const rowEl = (r: CardRow) => {
    const interactive = open
    const label = (
      <span style={{ ...ELLIPSIS, color: r.dim ? 'var(--tx3)' : open ? 'var(--tx)' : 'var(--tx2)' }}>{r.label}</span>
    )
    return (
      <div key={r.key} style={{ display: 'grid', gridTemplateColumns: r.action ? 'minmax(0, 1fr) auto 28px' : 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center', minHeight: open ? 28 : 22, padding: open ? '0 12px' : '0 10px', borderBottom: '1px solid var(--bg2)', fontSize: open ? 13 : 12 }}>
        {interactive && r.go
          ? <button type="button" onClick={(e) => { e.stopPropagation(); r.go?.() }} style={{ ...ELLIPSIS, background: 'none', border: 0, padding: 0, font: 'inherit', textAlign: 'left', color: 'var(--tx)', cursor: 'pointer' }}>{r.label}</button>
          : label}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', color: r.kind === 'wrong' ? 'var(--rust)' : r.kind === 'attention' ? 'var(--yellow)' : 'var(--tx2)' }}>
          {r.value != null && <b style={{ fontWeight: r.dim ? 400 : 700, color: r.dim ? 'var(--tx3)' : 'var(--tx)' }}>{r.value}</b>}
        </span>
        {r.action && (
          <button type="button" data-testid={r.action.testId} title={r.action.title} aria-label={r.action.title} onClick={(e) => { e.stopPropagation(); r.action?.onClick() }}
            style={{ height: 24, background: 'none', border: 0, borderLeft: '1px solid var(--bd)', color: 'var(--tx3)', cursor: 'pointer', font: 'inherit' }}>{r.action.label}</button>
        )}
      </div>
    )
  }
  // Collapsed: the rows that fit (on a scrolling page: the first two). Opened: every row that fits, then « + n autres ».
  const nodes = (open || fit ? card.rows : card.rows.slice(0, 2)).map(rowEl)
  return (
    <div id={card.id === 'reminders' ? 'atelier-field-reminders' : undefined} data-testid={`overview-card-${card.id}`} data-open={open ? 'true' : 'false'} title={card.title}
      onClick={open ? undefined : onToggle}
      style={{
        gridColumn: span ? `span ${span.col}` : undefined, gridRow: span ? `span ${span.row}` : undefined,
        position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', scrollMarginTop: 96,
        borderTop: `2px solid ${s.kind === 'info' ? 'var(--bd2)' : SIGNAL_COLOR[s.kind]}`, borderRight: '1px solid var(--bd)', borderBottom: '1px solid var(--bd)',
        background: open ? 'var(--bg1)' : tint(s.kind) ?? 'transparent', boxShadow: open ? 'inset 0 0 0 1px var(--ac)' : undefined, cursor: open ? 'default' : 'pointer',
      }}>
      <button type="button" aria-expanded={open} aria-label={`${s.label}: ${s.value} — ${t(open ? 'card_collapse' : 'card_expand')}`} onClick={(e) => { e.stopPropagation(); onToggle() }}
        style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 10px 6px', border: 0, background: 'none', color: 'var(--tx)', font: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
          <SignalMark kind={s.kind} />{s.label}
          {open && <span style={{ marginLeft: 'auto', color: 'var(--tx3)', fontSize: 11 }}>▴ {t('od_less_title')}</span>}
        </span>
        <b style={{ fontSize: open ? 26 : 20, lineHeight: 1 }}>{s.value}</b>
        <span style={{ ...ELLIPSIS, fontSize: 11, color: 'var(--tx3)' }}>{s.detail}</span>
        {open || !card.viz ? null : card.viz}
      </button>
      {open && card.head ? <div style={{ flex: 'none', padding: '0 12px 6px', fontSize: 11, color: 'var(--tx3)' }}>{card.head}</div> : null}
      <FitList items={nodes} enabled={fit} showMore={open} testId={card.rowsTestId} style={{ flex: fit ? '1 1 0' : 'none' }} />
      {open && card.extra ? <div style={{ flex: 'none' }} onClick={(e) => e.stopPropagation()}>{card.extra}</div> : null}
      {open && !card.noScreen ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenScreen() }}
          style={{ flex: 'none', margin: '8px 12px', padding: '6px 10px', alignSelf: 'flex-start', border: '1px solid var(--bd2)', borderRadius: 4, background: 'none', color: 'var(--tx)', font: 'inherit', cursor: 'pointer' }}>
          {t('card_open_screen')}
        </button>
      ) : null}
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

function IdeaLine({ c, h, onGo, t }: { c: { id: string; titre: string; weight: string; maturity?: string }; h: number; onGo: () => void; t: (k: string) => string }) {
  return (
    <Line h={h} onClick={onGo} cols="minmax(0, 1fr) auto">
      <span style={ELLIPSIS} title={c.titre}>{c.titre}</span>
      {/* The seed is the idea's one mark (Idées 2026-11-23); weight left the screens. */}
      <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{t(c.maturity === 'mure' ? 'ideas_maturity_mure' : c.maturity === 'pousse' ? 'ideas_maturity_pousse' : 'ideas_maturity_graine')}</span>
    </Line>
  )
}
