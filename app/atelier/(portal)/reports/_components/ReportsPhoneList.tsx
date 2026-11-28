'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { PhoneListToolbar, PhoneChip } from '@/components/shared/phone/PhoneListToolbar'
import { PhoneListRow } from '@/components/shared/phone/PhoneListRow'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'

export type ReportPhoneRow = { key: string; title: string; sub: string; value?: string }

/**
 * Rapports on the phone (PhonePattern.md): count line + « … », the shared search toolbar with the source chip
 * (6 sources → a sheet), one row per report row. Report state stays in Reports.tsx; rows are the same formatted
 * cells as the desk table. Desk rows do nothing on click, so neither do these.
 */
export function ReportsPhoneList({
  sources, source, onSource, query, onQuery, rows, total, loading, activeFilters, onClearFilters,
  pivotOn, onTogglePivot, fieldsCount, onToggleFields, onPrint, onXlsx, onCsv, onPdf, pdfPending, cap,
}: {
  sources: { id: string; label: string }[]
  source: string
  onSource: (id: string) => void
  query: string
  onQuery: (q: string) => void
  rows: ReportPhoneRow[]
  total: number
  loading: boolean
  activeFilters: number
  onClearFilters: () => void
  pivotOn: boolean
  onTogglePivot: () => void
  fieldsCount: number
  onToggleFields: () => void
  onPrint: () => void
  onXlsx: () => void
  onCsv: () => void
  onPdf: () => void
  pdfPending: boolean
  cap: number
}) {
  const { t } = useI18n()
  const [sheet, setSheet] = useState<'source' | 'more' | null>(null)
  const current = sources.find((s) => s.id === source)?.label ?? ''
  const act = (fn: () => void) => () => { setSheet(null); fn() }
  const btn = { width: '100%', minHeight: 48, justifyContent: 'flex-start' } as const

  const chips = (
    <>
      <PhoneChip label={`${t('report_source_label')} : ${current}`} onClick={() => setSheet('source')} testId="report-phone-source">
        <span aria-hidden="true">▾</span>
      </PhoneChip>
      {activeFilters > 0 ? (
        <PhoneChip label={t('report_filters_active_fmt').replace('{n}', String(activeFilters))} active onClick={onClearFilters} />
      ) : null}
    </>
  )

  return (
    <div data-testid="report-phone">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="t-mono-sm" data-testid="report-row-count" style={{ flex: 1, minWidth: 0, color: 'var(--tx3)' }}>
          {loading ? t('report_loading_source') : t('report_phone_count_fmt').replace('{shown}', String(rows.length)).replace('{total}', String(total))}
        </div>
        <button type="button" className="btn ghost sm" aria-label={t('phone_more_actions')} onClick={() => setSheet('more')} style={{ minWidth: 44, minHeight: 44 }}>…</button>
      </div>

      <PhoneListToolbar query={query} onQuery={onQuery} placeholder={t('report_search_ph')} chips={chips} testId="report-phone-toolbar" />

      {!loading && rows.length === 0 ? (
        <p className="t-mono-sm" style={{ padding: '24px 0', textAlign: 'center', color: 'var(--tx3)' }}>{t('shell_empty')}</p>
      ) : null}
      <ul data-testid="report-table" style={{ margin: 0, padding: 0 }}>
        {rows.slice(0, cap).map((r) => (
          <PhoneListRow key={r.key} title={r.title} sub={r.sub} value={r.value} />
        ))}
      </ul>
      {rows.length > cap ? <p style={{ padding: 12, fontSize: 12, color: 'var(--tx3)' }}>{t('report_preview_cap_fmt').replace('{n}', String(cap))}</p> : null}

      {sheet === 'source' ? (
        <PhoneSheet title={t('report_source_label')} onClose={() => setSheet(null)} testId="report-phone-sources">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sources.map((s) => (
              <PhoneChip key={s.id} label={s.label} active={source === s.id} testId={`report-source-${s.id}`} onClick={() => { setSheet(null); if (source !== s.id) onSource(s.id) }} />
            ))}
          </div>
        </PhoneSheet>
      ) : null}

      {sheet === 'more' ? (
        <PhoneSheet title={t('phone_more_actions')} onClose={() => setSheet(null)} testId="report-phone-more">
          <button type="button" className="btn ghost" onClick={act(onToggleFields)} style={btn}>{t('report_fields_toggle_fmt').replace('{n}', String(fieldsCount))}</button>
          <button type="button" className="btn ghost" aria-pressed={pivotOn} data-testid="report-pivot-toggle" onClick={act(onTogglePivot)} style={btn}>{pivotOn ? t('report_pivot_hide') : t('report_pivot_toggle')}</button>
          <button type="button" className="btn ghost" data-testid="report-print" onClick={act(onPrint)} style={btn}>{t('report_print')}</button>
          <button type="button" className="btn ghost" onClick={act(onXlsx)} style={btn}>{t('report_export_xlsx')}</button>
          <button type="button" className="btn ghost" data-testid="report-csv" onClick={act(onCsv)} style={btn}>{t('report_export_csv')}</button>
          <button type="button" className="btn ghost" disabled={pdfPending} onClick={act(onPdf)} style={btn}>{pdfPending ? t('generating') : t('report_export_pdf')}</button>
        </PhoneSheet>
      ) : null}
    </div>
  )
}
