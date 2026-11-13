'use client'

import { useEffect, useMemo, useState } from 'react'
import { listUnreadSuiviReminders, markSuiviReminderRead } from '@/app/atelier/reminders-actions'
import { useI18n } from '@/lib/i18n/context'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { EmbeddingIndexCard } from '@/components/atelier/overview/EmbeddingIndexCard'
import { SeeAgainCard } from '@/components/atelier/SeeAgainCard'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import { yearOf } from '@/lib/data'
import { daysUntil } from '@/lib/pipeline-deadlines'
import { filterEventsInDateKeyRange } from '@/lib/pipeline-calendar'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { Lang } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'
import {
  queueInventoryFilter,
  type InventoryHandoffCriterion,
} from '@/lib/atelier/inventory-filter-handoff'

// ── Overview tab ─────────────────────────────────────────────────────

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

export function OverviewTab({
  oeuvres, tM, t, lang, onGoTab, initialReminders, initialOverviewBootstrap, isAdmin, conflicts,
  oeuvresCataloguePartial,
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
  const thisYear   = new Date().getFullYear()
  const yearPrefix = String(thisYear)
  let byYear = 0
  let withPrice = 0
  let available = 0
  let exposable = 0
  let missingDims = 0
  let missingImages = 0
  let missingLoc = 0
  /** Custodian known but no address (docs/WORK_CUSTODY_MODEL.md). */
  let missingAddress = 0
  let missingTech = 0
  let missingSupport = 0
  let missingYear = 0
  let missingTitle = 0
  /** Photo shot but not yet validated — `addWorkImage` never clears NeedsPhotograph,
   *  so a work falls back here after a session until the artist validates it. */
  let needsPhotoValidation = 0
  let notCatalogued = 0
  for (const o of oeuvres) {
    if (o.Année?.startsWith(yearPrefix)) byYear++
    if (o.Prix && o.Prix > 0) withPrice++
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
    if (!o.Catalogué) notCatalogued++
  }

  const backlog = initialOverviewBootstrap.backlog
  const needsYouTotal =
    needsPhotoValidation +
    notCatalogued +
    (isAdmin ? backlog.pendingApprovals : 0) +
    backlog.openFieldTasks +
    backlog.openLedger +
    backlog.sessionsToApply

  /** Hand a filter to the Inventory tab, then switch to it. */
  const goInventory = (label: string, criteria: InventoryHandoffCriterion[]) => {
    queueInventoryFilter({ label, criteria })
    onGoTab('inventory')
  }

  const recentWorks = [...oeuvres].sort((a, b) => b.OeuvreID - a.OeuvreID).slice(0, 6)

  // Whole unread list (scrolls), refetched on every visit: the shell snapshot goes stale
  // when notes add reminders after the Atelier was opened.
  const [reminderRows, setReminderRows] = useState<SuiviReminderListRow[]>(initialReminders)
  useEffect(() => {
    let cancelled = false
    void listUnreadSuiviReminders(200).then((rows) => {
      if (!cancelled) setReminderRows(rows)
    })
    return () => { cancelled = true }
  }, [])
  const reminders = reminderRows
  const markReminderDone = async (id: string) => {
    setReminderRows((rows) => rows.filter((r) => r.id !== id))
    const res = await markSuiviReminderRead(id)
    if (!res.ok) setReminderRows(await listUnreadSuiviReminders(200))
  }

  const { expenseTotalTtc, salesIncomeTtc, upcomingPulse: upcoming, overviewCalendarEvents, burningConcepts } =
    initialOverviewBootstrap
  const expenseTotal = expenseTotalTtc
  /** Financial Pulse income: sale orders + payments this year (`fetchSalesIncome`), not `Oeuvres` status. */
  const soldIncomeThisYear = salesIncomeTtc ?? 0

  const ovNarrow = useMediaQuery('(max-width: 767px)')
  /** ~768–1199px: the 300px right column leaves the main column too narrow for 6 tiles / 3 panels. */
  const ovMid = useMediaQuery('(max-width: 1199px)')
  const localeTagOv = lang === 'en' ? 'en-GB' : 'fr-FR'

  const weekEvents = useMemo(() => {
    const start = mondayStartOfWeek(new Date())
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const sk = localDateKeyFromDate(start)
    const ek = localDateKeyFromDate(end)
    return filterEventsInDateKeyRange(overviewCalendarEvents, sk, ek)
  }, [overviewCalendarEvents])

  const byTech = oeuvres.reduce<Record<string, number>>((acc, o) => {
    const k = String(o.Technique ?? 'unknown')
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const topTechs = Object.entries(byTech).sort((a, b) => b[1] - a[1]).slice(0, 5)

  function urgencyColor(days: number) {
    if (days < 0)   return '#c06060'
    if (days <= 7)  return '#c08040'
    if (days <= 21) return '#a0a040'
    return 'var(--tx3)'
  }

  return (
    <div
      style={{
        padding: ovNarrow ? '20px 16px' : '14px 24px',
        display: 'grid',
        gridTemplateColumns: ovNarrow ? '1fr' : 'minmax(0, 1fr) 300px',
        gap: ovNarrow ? 28 : 28,
        alignItems: 'start',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >

      {/* Left Column: Dashboard Pulse */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: ovNarrow ? 28 : 16 }}>
        
        {/* Row 1: Executive Stats */}
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 12, opacity: 0.6 }} data-testid="atelier-overview-executive">{t('ov_executive_summary')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'repeat(2, minmax(0, 1fr))' : ovMid ? 'repeat(3, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))', gap: 1, border: '1px solid var(--bd)', background: 'var(--bd)' }}>
            {[
              {
                l: t('works_cap'),
                v: oeuvresCatalogueTotal ?? oeuvres.length,
                hint:
                  oeuvresCataloguePartial && oeuvresCatalogueTotal != null
                    ? t('ov_works_loaded_hint').replace('{loaded}', String(oeuvres.length))
                    : undefined,
              },
              { l: `${t('thisYear')} (${thisYear})`,  v: byYear },
              { l: t('ov_stat_available'),              v: available },
              { l: t('exposable'),                    v: exposable },
              { l: t('priced'),                       v: withPrice },
              { l: t('ov_stat_total_value'),           v: `€ ${Math.round(oeuvres.reduce((s,o) => s+(o.Prix||0), 0)/1000)}k` },
            ].map(({ l, v, hint }) => (
              <div key={l} style={{ padding: ovNarrow ? '20px 24px' : '14px 18px', background: 'var(--bg1)' }}>
                <div className="stat">
                  <span className="l" style={{ fontSize: 9, letterSpacing: 1.5 }}>{l}</span>
                  <span className="v" style={{ fontSize: ovNarrow ? 24 : 20, whiteSpace: 'nowrap' }}>{v}</span>
                  {hint ? (
                    <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 4, display: 'block' }}>
                      {hint}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 1.5: Financial Pulse */}
        <div>
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>{t('ov_financial_pulse_fmt').replace(/\{year\}/g, String(thisYear))}</div>
            <button className="t-mono-sm" onClick={() => onGoTab('fiscal')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>{t('ov_manage_revenues')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)', gap: ovNarrow ? 20 : 28, padding: ovNarrow ? 20 : 16, background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="t-label" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ov_income_vs_expenses')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>{t('ov_income_sales')}</span>
                  <span style={{ color: 'var(--green)' }}>€ {Math.round(soldIncomeThisYear).toLocaleString(localeTagOv)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: '100%', background: 'var(--green)', borderRadius: 2 }} />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span>{t('ov_expenses')}</span>
                  <span style={{ color: 'var(--rust)' }}>€ {Math.round(expenseTotal).toLocaleString(localeTagOv)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (expenseTotal / Math.max(1, soldIncomeThisYear)) * 100)}%`, background: 'var(--rust)', borderRadius: 2 }} />
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderLeft: ovNarrow ? 'none' : '1px solid var(--bd)', paddingLeft: ovNarrow ? 0 : 40, paddingTop: ovNarrow ? 12 : 0, borderTop: ovNarrow ? '1px solid var(--bd)' : 'none' }}>
              <div className="t-label" style={{ fontSize: 10, color: 'var(--tx3)' }}>{t('ov_cash_health')}</div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 12 }}>
                <div style={{ fontSize: 32, fontWeight: 700 }}>
                  € {Math.round(soldIncomeThisYear - expenseTotal).toLocaleString(localeTagOv)}
                </div>
                <div className="t-mono-sm" style={{ marginBottom: 8, color: 'var(--tx3)' }}>{t('ov_net_bnc')}</div>
              </div>
              <div style={{ fontSize: 9, color: 'var(--tx3)', fontStyle: 'italic' }}>
                {t('ov_financial_note_fmt').replace(/\{year\}/g, String(thisYear))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Visual Grid (Recent Documentation) */}
        <div>
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>{t('ov_recent_docs')}</div>
            <button className="t-mono-sm" onClick={() => onGoTab('inventory')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>{t('ov_view_all')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'repeat(3, minmax(0, 1fr))' : 'repeat(6, minmax(0, 96px))', gap: ovNarrow ? 12 : 10 }}>
            {recentWorks.map((o) => (
              <div key={o.OeuvreID} style={{ aspectRatio: '1', background: 'var(--bg1)', border: '1px solid var(--bd2)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                {o.txtImageNameLink ? (
                  <WorkThumb file={o.txtImageNameLink} size={256} alt="" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)', fontSize: 10 }}>{t('ov_no_image_placeholder')}</div>
                )}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, color-mix(in srgb, var(--bg0) 80%, transparent))', color: 'var(--tx)', fontSize: 8, fontFamily: 'var(--font-mono)' }}>
                  #{o.OeuvreID}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Technique & Distribution */}
        <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? '1fr' : ovMid ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr)', gap: ovNarrow ? 28 : 20, alignItems: 'start' }}>
          {/* Technique breakdown */}
          <div>
            <div className="t-label" style={{ marginBottom: 16, opacity: 0.8 }}>{t('byTechnique')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topTechs.map(([techId, count]) => {
                const pct = Math.round((count / oeuvres.length) * 100)
                return (
                  <div key={techId} style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'minmax(0,1fr) minmax(0,2fr) 28px' : '120px 1fr 30px', alignItems: 'center', gap: 12 }}>
                    <div className="t-mono-sm" style={{ color: 'var(--tx2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tM[Number(techId)] ?? '—'}</div>
                    <div style={{ height: 3, background: 'var(--bg2)', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'var(--ac)' }} />
                    </div>
                    <div className="t-mono-sm" style={{ color: 'var(--tx3)', textAlign: 'right', fontSize: 9 }}>{count}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Needs you + Studio health — every row targets the items behind it */}
          <div style={{ display: ovNarrow ? 'grid' : 'contents', gridTemplateColumns: '1fr', gap: 20, alignContent: 'start' }}>
             <div style={{ padding: '16px', background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
                <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 4, color: 'var(--tx3)' }}>{t('ov_needs_you')}</div>
                <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 12 }}>{t('ov_needs_you_hint')}</div>
                {needsYouTotal === 0 ? (
                  <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)' }}>{t('ov_needs_all_clear')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <ConsoleRow
                      label={t('ov_needs_photo_validation')}
                      count={needsPhotoValidation}
                      onGo={() => goInventory(t('ov_needs_photo_validation'), [{ field: 'NeedsPhotograph', op: '= vrai' }])}
                    />
                    <ConsoleRow
                      label={t('ov_needs_not_catalogued')}
                      count={notCatalogued}
                      onGo={() => goInventory(t('ov_needs_not_catalogued'), [{ field: 'Catalogué', op: '= faux' }])}
                    />
                    {isAdmin && (
                      <ConsoleRow
                        label={t('ov_needs_approvals')}
                        count={backlog.pendingApprovals}
                        onGo={() => onGoTab('audit')}
                      />
                    )}
                    <ConsoleRow
                      label={t('ov_needs_field_tasks')}
                      count={backlog.openFieldTasks}
                      onGo={() => onGoTab('production')}
                    />
                    <ConsoleRow
                      label={t('ov_needs_ledger')}
                      count={backlog.openLedger}
                      onGo={() => onGoTab('kaizen-ops')}
                    />
                    <ConsoleRow
                      label={t('ov_needs_sessions')}
                      count={backlog.sessionsToApply}
                      onGo={() => onGoTab('journal')}
                    />
                  </div>
                )}
             </div>
             <div style={{ padding: '16px', background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
                <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 4, color: 'var(--tx3)' }}>{t('ov_studio_health')}</div>
                <div className="t-mono-sm" style={{ fontSize: 8, color: 'var(--tx3)', marginBottom: 12 }}>{t('ov_health_hint')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <ConsoleRow
                    label={t('ov_health_missing_dims')}
                    count={missingDims}
                    onGo={() => goInventory(t('ov_health_missing_dims'), [{ field: 'Hauteur', op: 'est vide' }])}
                  />
                  <ConsoleRow
                    label={t('ov_health_missing_photos')}
                    count={missingImages}
                    onGo={() => goInventory(t('ov_health_missing_photos'), [{ field: '_hasImage', op: 'est vide' }])}
                  />
                  <ConsoleRow
                    label={t('ov_health_missing_loc')}
                    count={missingLoc}
                    onGo={() => goInventory(t('ov_health_missing_loc'), [{ field: 'LocalisationID', op: 'est vide' }])}
                  />
                  <ConsoleRow
                    label={t('ov_health_missing_address')}
                    count={missingAddress}
                    onGo={() => goInventory(t('ov_health_missing_address'), [{ field: 'localisation_address_id', op: 'est vide' }])}
                  />
                  <ConsoleRow
                    label={t('ov_health_missing_tech')}
                    count={missingTech}
                    onGo={() => goInventory(t('ov_health_missing_tech'), [{ field: 'Technique', op: 'est vide' }])}
                  />
                  <ConsoleRow
                    label={t('ov_health_missing_support')}
                    count={missingSupport}
                    onGo={() => goInventory(t('ov_health_missing_support'), [{ field: 'Support', op: 'est vide' }])}
                  />
                  <ConsoleRow
                    label={t('ov_health_missing_year')}
                    count={missingYear}
                    onGo={() => goInventory(t('ov_health_missing_year'), [{ field: 'Année', op: 'est vide' }])}
                  />
                  <ConsoleRow
                    label={t('ov_health_missing_title')}
                    count={missingTitle}
                    onGo={() => goInventory(t('ov_health_missing_title'), [{ field: 'Titre', op: 'est vide' }])}
                  />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Right Column: Deadlines & Concepts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: ovNarrow ? 28 : 20, minWidth: 0 }}>
        <SeeAgainCard context="overview" />
        <div>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => onGoTab('pipeline')}
            style={{ minHeight: 44, width: '100%', justifyContent: 'center' }}
          >
            {t('ov_pipeline_calendar_cta')}
          </button>
          <div className="t-eyebrow" style={{ marginTop: 16, marginBottom: 10 }}>
            {t('ov_this_week')}
          </div>
          {weekEvents.length === 0 ? (
            <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 11 }}>{t('ov_no_deadlines')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weekEvents.slice(0, 12).map((ev) => {
                const d = new Date(`${ev.dateKey}T12:00:00`)
                const dayLine = d.toLocaleDateString(localeTagOv, { weekday: 'short', day: 'numeric', month: 'short' })
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onGoTab('pipeline')}
                    style={{
                      minHeight: 44,
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: 'var(--bg1)',
                      border: '1px solid var(--bd2)',
                      cursor: 'pointer',
                      borderLeft: `2px solid ${ev.kind === 'reminder' ? 'var(--ac)' : 'var(--tx3)'}`,
                    }}
                  >
                    <div className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)', marginBottom: 4 }}>{dayLine}</div>
                    <div style={{ fontSize: 11, color: 'var(--tx)', lineHeight: 1.35 }}>{ev.label}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Integrity Sentry (Admin Only) */}
        {isAdmin && conflicts.length > 0 && (
          <div style={{ padding: 16, background: 'var(--rust)11', border: '1px solid var(--rust)44' }}>
            <div className="t-eyebrow" style={{ color: 'var(--rust)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>⚠</span> {t('ov_integrity_title')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {conflicts.map(c => (
                <div key={c.id} style={{ fontSize: 11, color: 'var(--tx2)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--tx)' }}>{t('ov_integrity_collision')}</strong><br/>
                  {t('ov_integrity_match_line').replace(
                    /\{name\}/g,
                    String(c.public?.NomInstitution || c.public?.Nom || ''),
                  )}
                  <button 
                    onClick={() => onGoTab('contacts')}
                    style={{ display: 'block', marginTop: 4, background: 'none', border: 'none', color: 'var(--ac)', padding: 0, fontSize: 10, cursor: 'pointer' }}
                  >
                    {t('ov_integrity_resolve')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reminders Pulse — scroll target for Ring B mobile bar */}
        <div id="atelier-field-reminders" style={{ scrollMarginTop: 96 }}>
        {reminders.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              {t('ov_reminders_title')}
              {reminders.length > 0 && <span style={{ background: 'var(--ac)', color: 'var(--bg0)', padding: '1px 6px', borderRadius: 10, fontSize: 8 }}>{reminders.length}</span>}
            </div>
            <div data-testid="overview-reminders" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>
              {reminders.map((r) => {
                const days = daysUntil(r.remind_at)
                const openTitle = r.process_id ? t('ov_reminder_open_project') : t('ov_reminder_open_notes')
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'stretch', background: 'var(--bg1)', border: '1px solid var(--bd2)', borderLeft: `2px solid var(--ac)` }}>
                    <button
                      type="button"
                      onClick={() => onGoTab(r.process_id ? 'pipeline' : 'notes')}
                      title={openTitle}
                      style={{ flex: 1, minWidth: 0, textAlign: 'left', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                    >
                      <div style={{ fontSize: 10, color: 'var(--tx)', lineHeight: 1.4 }}>{r.message}</div>
                      <div style={{ fontSize: 8, color: urgencyColor(days), marginTop: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {days === 0
                          ? t('ov_reminder_today')
                          : days === 1
                            ? t('ov_reminder_tomorrow')
                            : days < 0
                              ? t('ov_reminder_days_ago_fmt').replace(/\{days\}/g, String(Math.abs(days)))
                              : t('ov_reminder_in_days_fmt').replace(/\{days\}/g, String(days))}
                      </div>
                    </button>
                    <button
                      type="button"
                      data-testid="overview-reminder-done"
                      onClick={() => void markReminderDone(r.id)}
                      title={t('ov_reminder_done')}
                      aria-label={t('ov_reminder_done')}
                      style={{ minWidth: 44, background: 'none', border: 'none', borderLeft: '1px solid var(--bd)', cursor: 'pointer', color: 'var(--tx3)', fontSize: 14 }}
                    >
                      ✓
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </div>

        {/* Pipeline Pulse */}
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => onGoTab('pipeline')}>
            {t('ov_active_pipeline')}
          </div>
          {upcoming.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map((p) => {
                const days = daysUntil(p.date)
                const col = urgencyColor(days)
                return (
                  <div
                    key={`${p.processId}-${p.etapeId ?? 'fin'}-${p.date}`}
                    onClick={() => onGoTab('pipeline')}
                    style={{
                    padding: '10px 12px', background: 'var(--bg1)',
                    border: '1px solid var(--bd2)', cursor: 'pointer',
                    borderLeft: `2px solid ${col}`,
                  }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--tx)' }}>{p.label}</div>
                    <div style={{ fontSize: 8, color: col, marginTop: 4, letterSpacing: 0.5 }}>
                      {days < 0
                        ? t('ov_pulse_deadline_overdue_fmt').replace(/\{days\}/g, String(Math.abs(days)))
                        : days === 0
                          ? t('ov_pulse_deadline_due_today')
                          : t('ov_pulse_deadline_in_days_fmt').replace(/\{days\}/g, String(days))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="t-mono-sm" style={{ opacity: 0.4, padding: 12, border: '1px dashed var(--bd2)', textAlign: 'center' }}>{t('ov_no_deadlines')}</div>
          )}
        </div>

        {/* Burning Concepts */}
        {burningConcepts.length > 0 && (
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 16, cursor: 'pointer' }} onClick={() => onGoTab('concepts')}>
              {t('ov_burning_ideas')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {burningConcepts.map((c) => (
                <div key={c.id} onClick={() => onGoTab('concepts')} style={{
                  padding: '10px 12px', background: 'var(--bg1)',
                  border: '1px solid var(--bd2)', cursor: 'pointer',
                  borderLeft: `2px solid var(--ac)`,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--tx)' }}>{c.titre}</div>
                  <div style={{ fontSize: 8, color: 'var(--tx3)', marginTop: 4, letterSpacing: 1 }}>
                    {'●'.repeat(c.energie)} <span style={{ marginLeft: 4 }}>{[t('ov_energy_1'), t('ov_energy_2'), t('ov_energy_3'), t('ov_energy_4'), t('ov_energy_5')][c.energie - 1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Local jobs (transcription + search indexing) — admin maintenance, kept below the day-to-day items (owner 2026-11-03) */}
        {isAdmin && (
          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
            <EmbeddingIndexCard t={t} narrow={ovNarrow} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * A console row: label + count, clickable through to the items behind it.
 * A zero count stays visible but is not actionable — the absence is the signal.
 */
function ConsoleRow({ label, count, onGo }: { label: string; count: number; onGo: () => void }) {
  const active = count > 0
  const color = active ? 'var(--rust)' : 'var(--tx3)'
  if (!active) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
        <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx3)' }}>{label}</span>
        <span className="t-mono-sm" style={{ fontSize: 10, color }}>{count}</span>
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onGo}
      className="ov-console-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '4px 6px',
        margin: '0 -6px',
        border: 'none',
        borderRadius: 2,
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        minHeight: 28,
      }}
    >
      <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx2)' }}>{label}</span>
      <span className="t-mono-sm" style={{ fontSize: 10, color, fontWeight: 700, whiteSpace: 'nowrap' }}>
        {count} <span aria-hidden="true" style={{ opacity: 0.5 }}>›</span>
      </span>
    </button>
  )
}

//
 
