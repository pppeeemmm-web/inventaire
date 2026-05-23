'use client'

import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import type { Oeuvre, SuiviReminderListRow } from '@/lib/types/database'
import type { AtelierOverviewBootstrap } from '@/components/atelier/team-portal-types'
import { yearOf } from '@/lib/data'
import { daysUntil } from '@/lib/pipeline-deadlines'
import { filterEventsInDateKeyRange } from '@/lib/pipeline-calendar'
import type { SegmentedAtelierTab } from '@/lib/atelier/tab-routes'
import type { Lang } from '@/lib/i18n/dictionary'
import { useMediaQuery } from '@/lib/useMediaQuery'

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
  oeuvres, tM, t, lang, onGoTab, reminderCount, initialReminders, initialOverviewBootstrap, isAdmin, conflicts,
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
  /** Sold works (status 4) with revenue attributed to this calendar year — used in Financial Pulse */
  let soldIncomeThisYear = 0
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
    if (o.statusId === 4 && o.Année?.startsWith(yearPrefix)) {
      soldIncomeThisYear += Number(o.PrixFinal ?? o.Prix ?? 0)
    }
  }

  const recentWorks = [...oeuvres].sort((a, b) => b.OeuvreID - a.OeuvreID).slice(0, 6)

  const reminders = useMemo(
    () =>
      initialReminders.slice(0, 6).map((r) => ({
        id: r.id,
        message: r.message,
        remind_at: r.remind_at,
        process_id: r.process_id,
      })),
    [initialReminders],
  )

  const { expenseTotalTtc, upcomingPulse: upcoming, overviewCalendarEvents, burningConcepts } =
    initialOverviewBootstrap
  const expenseTotal = expenseTotalTtc

  const ovNarrow = useMediaQuery('(max-width: 767px)')
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
        padding: ovNarrow ? '20px 16px' : '32px 40px',
        display: 'grid',
        gridTemplateColumns: ovNarrow ? '1fr' : '1fr 300px',
        gap: ovNarrow ? 28 : 60,
        alignItems: 'start',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >

      {/* Left Column: Dashboard Pulse */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        
        {/* Row 1: Executive Stats */}
        <div>
          <div className="t-eyebrow" style={{ marginBottom: 24, opacity: 0.6 }} data-testid="atelier-overview-executive">{t('ov_executive_summary')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, 1fr)', gap: 1, border: '1px solid var(--bd)', background: 'var(--bd)' }}>
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
              <div key={l} style={{ padding: '20px 24px', background: 'var(--bg1)' }}>
                <div className="stat">
                  <span className="l" style={{ fontSize: 9, letterSpacing: 1.5 }}>{l}</span>
                  <span className="v" style={{ fontSize: 24 }}>{v}</span>
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
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>{t('ov_financial_pulse_fmt').replace(/\{year\}/g, String(thisYear))}</div>
            <button className="t-mono-sm" onClick={() => onGoTab('fiscal')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>{t('ov_manage_revenues')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? '1fr' : '1fr 1fr', gap: ovNarrow ? 20 : 40, padding: 24, background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
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
          <div className="row gap-sm" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="t-eyebrow" style={{ opacity: 0.6 }}>{t('ov_recent_docs')}</div>
            <button className="t-mono-sm" onClick={() => onGoTab('inventory')} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', fontSize: 9, letterSpacing: 1 }}>{t('ov_view_all')}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? 'repeat(3, minmax(0, 1fr))' : 'repeat(6, 1fr)', gap: 12 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: ovNarrow ? '1fr' : '1fr 1fr', gap: 40 }}>
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

          {/* Production & Health Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
             <div style={{ padding: '16px', background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
                <div className="t-eyebrow" style={{ fontSize: 8, marginBottom: 12, color: 'var(--tx3)' }}>{t('ov_studio_health')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <HealthRow label={t('ov_health_missing_dims')} count={missingDims} color={missingDims > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                  <HealthRow label={t('ov_health_missing_photos')} count={missingImages} color={missingImages > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                  <HealthRow label={t('ov_health_missing_loc')} count={missingLoc} color={missingLoc > 0 ? 'var(--rust)' : 'var(--tx3)'} />
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Right Column: Deadlines & Concepts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, minWidth: 0 }}>
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
              {reminderCount > 0 && <span style={{ background: 'var(--ac)', color: 'var(--bg0)', padding: '1px 6px', borderRadius: 10, fontSize: 8 }}>{reminderCount}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {reminders.map((r) => {
                const days = daysUntil(r.remind_at)
                return (
                  <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg1)', border: '1px solid var(--bd2)', borderLeft: `2px solid var(--ac)` }}>
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
      </div>
    </div>
  )
}

function HealthRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="t-mono-sm" style={{ fontSize: 9, color: 'var(--tx2)' }}>{label}</span>
      <span className="t-mono-sm" style={{ fontSize: 10, color, fontWeight: count > 0 ? 700 : 400 }}>{count}</span>
    </div>
  )
}

//
 
