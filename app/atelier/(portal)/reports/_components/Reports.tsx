'use client'

import { useCallback, useMemo, useState, useTransition, type CSSProperties } from 'react'
import * as XLSX from 'xlsx'
import { useI18n } from '@/lib/i18n/context'
import { EmptyState } from '@/components/shared/EmptyState'
import type { Lang } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import type { StatusKey } from '@/lib/data'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import {
  DEFAULT_VISIBLE_REPORT_COLUMNS,
  REPORT_COLUMN_ORDER,
  REPORT_COLUMN_HEADER_KEY,
  REPORT_PDF_MAX_ROWS,
  buildReportRows,
  filterWorksForReport,
  sortWorksForReport,
  type ReportColumnId,
  type ReportMaps,
} from '@/lib/reports/works-table'
import { generateWorksTablePdf } from '@/app/atelier/(portal)/reports/actions'
import { PivotAtlasPanel } from '@/app/atelier/(portal)/reports/_components/PivotAtlasPanel'
import type { DictKey } from '@/lib/i18n/dictionary'

const STATUS_FILTER_LABEL: Record<StatusKey, DictKey> = {
  en_production: 'prod_tab_stat_wip',
  available: 'available',
  reserved: 'wf_own_reserved_l',
  consigned: 'consigned',
  loan: 'wf_own_loan_l',
  sold: 'sold',
  gift: 'gift',
  artist_archive: 'wf_own_archive_l',
  private_archive: 'report_status_private_archive',
}

const ALL_STATUS_KEYS: StatusKey[] = [
  'en_production',
  'available',
  'reserved',
  'consigned',
  'loan',
  'sold',
  'gift',
  'artist_archive',
  'private_archive',
]

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type Props = {
  oeuvres: Oeuvre[]
  techniques: { TechniqueID: number; Technique: string | null }[]
  supports: { SupportID: number; Support: string | null }[]
  formats: { FormatID: number; Format: string | null }[]
  themes: { id: number; name: string }[]
  groups: { id: string; name: string }[]
  tM: Record<number, string>
  sM: Record<number, string>
  cM: Record<number, string>
  pM: Record<number, string>
  locMap: Record<number, string>
  statusLabelMap: Record<number, string>
  oeuvreThemeIdsByOeuvre: Record<number, number[]>
  oeuvreGroupIdsByOeuvre: Record<number, string[]>
  selection: Set<number>
  oeuvresLoadedCount?: number
  oeuvresCatalogueTotal?: number
  isAdmin?: boolean
}

export function Reports({
  oeuvres,
  techniques,
  supports,
  formats,
  themes,
  groups,
  tM,
  sM,
  cM,
  pM,
  locMap,
  statusLabelMap,
  oeuvreThemeIdsByOeuvre,
  oeuvreGroupIdsByOeuvre,
  selection,
  oeuvresLoadedCount,
  oeuvresCatalogueTotal,
  isAdmin = false,
}: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'

  const [q, setQ] = useState('')
  const [tech, setTech] = useState('all')
  const [support, setSupport] = useState('all')
  const [status, setStatus] = useState<StatusKey | 'all'>('all')
  const [filterTheme, setFilterTheme] = useState('all')
  const [filterGroup, setFilterGroup] = useState('all')
  const [selectionOnly, setSelectionOnly] = useState(false)
  const [sortKey, setSortKey] = useState<'OeuvreID' | 'Titre' | 'year' | 'PrixFinal'>('OeuvreID')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [visibleCols, setVisibleCols] = useState<Set<ReportColumnId>>(
    () => new Set(DEFAULT_VISIBLE_REPORT_COLUMNS),
  )
  const [filtersOpen, setFiltersOpen] = useState(!narrow)
  const [pending, startPdf] = useTransition()
  const [reportMode, setReportMode] = useState<'table' | 'atlas'>('table')
  const tk = (key: string) => t(key as DictKey)

  const fM = useMemo(
    () => Object.fromEntries(formats.map((f) => [f.FormatID, f.Format ?? ''])),
    [formats],
  )
  const thM = useMemo(() => Object.fromEntries(themes.map((x) => [x.id, x.name])), [themes])
  const groupNameMap = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g.name])), [groups])

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

  const maps: ReportMaps = useMemo(
    () => ({
      tM,
      sM,
      fM,
      cM,
      pM,
      locMap,
      statusLabelMap,
      thM,
      groupNameMap,
      oeuvreThemeMap,
      oeuvreGroupMap,
    }),
    [tM, sM, fM, cM, pM, locMap, statusLabelMap, thM, groupNameMap, oeuvreThemeMap, oeuvreGroupMap],
  )

  const filtered = useMemo(() => {
    const raw = filterWorksForReport(oeuvres, maps, {
      q,
      tech,
      support,
      status,
      filterTheme,
      filterGroup,
      selectionOnly,
      selection,
    })
    return sortWorksForReport(raw, sortKey, sortDir)
  }, [
    oeuvres,
    maps,
    q,
    tech,
    support,
    status,
    filterTheme,
    filterGroup,
    selectionOnly,
    selection,
    sortKey,
    sortDir,
  ])

  const columnsOrdered = useMemo(
    () => REPORT_COLUMN_ORDER.filter((c) => visibleCols.has(c)),
    [visibleCols],
  )

  const headers = useMemo(
    () => columnsOrdered.map((c) => t(REPORT_COLUMN_HEADER_KEY[c])),
    [columnsOrdered, t],
  )

  const rowsMatrix = useMemo(
    () => buildReportRows(filtered, columnsOrdered, maps, locale),
    [filtered, columnsOrdered, maps, locale],
  )

  const previewRows = useMemo(() => {
    const cap = 200
    const slice = filtered.slice(0, cap)
    const mat = rowsMatrix.slice(0, cap)
    return slice.map((o, i) => ({ o, cells: mat[i] ?? [] }))
  }, [filtered, rowsMatrix])

  const toggleCol = useCallback((c: ReportColumnId) => {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      if (next.has(c)) {
        if (next.size <= 1) return prev
        next.delete(c)
      } else next.add(c)
      return next
    })
  }, [])

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportXlsx = () => {
    if (!columnsOrdered.length) {
      toast.error(t('report_pdf_no_columns'))
      return
    }
    if (!filtered.length) {
      toast.error(t('report_pdf_empty'))
      return
    }
    const aoa: (string | number)[][] = [headers, ...rowsMatrix]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, 'Works')
    XLSX.writeFile(wb, `works_report_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const exportHtml = () => {
    if (!columnsOrdered.length) {
      toast.error(t('report_pdf_no_columns'))
      return
    }
    if (!filtered.length) {
      toast.error(t('report_pdf_empty'))
      return
    }
    const th = columnsOrdered.map((c) => `<th>${escapeHtml(t(REPORT_COLUMN_HEADER_KEY[c]))}</th>`).join('')
    const trs = rowsMatrix
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`)
      .join('\n')
    const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/><title>${escapeHtml(t('report_title'))}</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#111}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#f4f4f4}
</style></head><body><h1>${escapeHtml(t('report_title'))}</h1><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `works_report_${new Date().toISOString().slice(0, 10)}.html`)
  }

  const exportPdf = () => {
    if (!columnsOrdered.length) {
      toast.error(t('report_pdf_no_columns'))
      return
    }
    if (!filtered.length) {
      toast.error(t('report_pdf_empty'))
      return
    }
    if (filtered.length > REPORT_PDF_MAX_ROWS) {
      toast.error(t('report_pdf_too_many').replace('{max}', String(REPORT_PDF_MAX_ROWS)))
      return
    }
    const ids = filtered.map((o) => o.OeuvreID)
    startPdf(async () => {
      const res = await generateWorksTablePdf(ids, columnsOrdered, lang as Lang)
      if ('error' in res) {
        if (res.error === 'auth') toast.error(t('report_pdf_auth'))
        else if (res.error === 'empty') toast.error(t('report_pdf_empty'))
        else if (res.error === 'too_many')
          toast.error(t('report_pdf_too_many').replace('{max}', String(REPORT_PDF_MAX_ROWS)))
        else if (res.error === 'no_columns') toast.error(t('report_pdf_no_columns'))
        else toast.error(t('report_pdf_fail'))
        return
      }
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), res.filename)
    })
  }

  const sortedTechniques = useMemo(
    () => [...techniques].sort((a, b) => (a.Technique ?? '').localeCompare(b.Technique ?? '', 'fr')),
    [techniques],
  )
  const sortedSupports = useMemo(
    () => [...supports].sort((a, b) => (a.Support ?? '').localeCompare(b.Support ?? '', 'fr')),
    [supports],
  )
  const sortedThemes = useMemo(
    () => [...themes].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr')),
    [themes],
  )
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [groups],
  )

  const filterBarStyle: CSSProperties = narrow
    ? { display: 'flex', flexDirection: 'column', gap: 8 }
    : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }

  const panelPad: CSSProperties = narrow
    ? { padding: '10px 12px' }
    : { padding: '12px 16px' }

  const inputH: CSSProperties = { minHeight: narrow ? 44 : 38 }

  const safeBottom = 'max(12px, env(safe-area-inset-bottom))'

  if (reportMode === 'atlas') {
    return (
      <div
        data-testid="reports-root"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: narrow ? 12 : 0,
        }}
      >
        <div className="panel" style={{ flexShrink: 0, marginBottom: 8, ...panelPad }}>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="serif" style={{ fontSize: 20, color: 'var(--tx)', lineHeight: 1.25 }}>{t('report_title')}</div>
            <div className="row" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn ghost sm"
                style={{ minHeight: 44 }}
                onClick={() => setReportMode('table')}
              >
                {tk('report_mode_table')}
              </button>
            </div>
          </div>
        </div>
        <PivotAtlasPanel isAdmin={isAdmin} />
      </div>
    )
  }

  return (
    <div
      data-testid="reports-root"
      style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: narrow ? 88 : 0,
      }}
    >
      <div className="panel" style={{ flexShrink: 0, marginBottom: 8, ...panelPad }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
          <div className="serif" style={{ fontSize: 20, color: 'var(--tx)', lineHeight: 1.25 }}>{t('report_title')}</div>
          <button
            type="button"
            className="btn ghost sm"
            style={{ minHeight: 44 }}
            onClick={() => setReportMode('atlas')}
            data-testid="reports-open-atlas"
          >
            {tk('report_mode_atlas')}
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--tx3)', maxWidth: 720, lineHeight: 1.35 }}>{t('report_subtitle')}</div>
      </div>

      {narrow && (
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setFiltersOpen((o) => !o)}
          style={{ alignSelf: 'flex-start', marginBottom: 8, minHeight: 44, padding: '10px 14px' }}
        >
          {t('report_filters_heading')} {filtersOpen ? '▾' : '▸'}
        </button>
      )}

      {(!narrow || filtersOpen) && (
        <div className="panel" style={{ flexShrink: 0, marginBottom: 8, ...panelPad }}>
          <div className="t-label" style={{ marginBottom: 6 }}>{t('report_filters_heading')}</div>
          <div style={filterBarStyle}>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              style={{ ...inputH, ...(narrow ? {} : { gridColumn: 'span 2' }) }}
            />
            <select className="input" value={tech} onChange={(e) => setTech(e.target.value)} style={inputH}>
              <option value="all">{t('allTech')}</option>
              {sortedTechniques.map((x) => (
                <option key={x.TechniqueID} value={String(x.TechniqueID)}>{x.Technique ?? `#${x.TechniqueID}`}</option>
              ))}
            </select>
            <select className="input" value={support} onChange={(e) => setSupport(e.target.value)} style={inputH}>
              <option value="all">{t('allSupports')}</option>
              {sortedSupports.map((x) => (
                <option key={x.SupportID} value={String(x.SupportID)}>{x.Support ?? `#${x.SupportID}`}</option>
              ))}
            </select>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as StatusKey | 'all')} style={inputH}>
              <option value="all">{t('pipeline_filter_all')}</option>
              {ALL_STATUS_KEYS.map((k) => (
                <option key={k} value={k}>{t(STATUS_FILTER_LABEL[k])}</option>
              ))}
            </select>
            <select className="input" value={filterTheme} onChange={(e) => setFilterTheme(e.target.value)} style={inputH}>
              <option value="all">{t('const_allThemes')}</option>
              {sortedThemes.map((th) => (
                <option key={th.id} value={String(th.id)}>{th.name}</option>
              ))}
            </select>
            <select className="input" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)} style={inputH}>
              <option value="all">{t('const_allGroups')}</option>
              {sortedGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            {selection.size > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...inputH, cursor: 'pointer' }}>
                <input type="checkbox" checked={selectionOnly} onChange={(e) => setSelectionOnly(e.target.checked)} />
                <span style={{ fontSize: 13 }}>{t('report_selection_only').replace('{n}', String(selection.size))}</span>
              </label>
            )}
          </div>
        </div>
      )}

      <div className="panel" style={{ flexShrink: 0, marginBottom: 8, ...panelPad }}>
        <div className="t-label" style={{ marginBottom: 6 }}>{t('report_columns_heading')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {REPORT_COLUMN_ORDER.map((c) => (
            <label
              key={c}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                cursor: 'pointer',
                minHeight: narrow ? 44 : 36,
                padding: narrow ? undefined : '2px 0',
              }}
            >
              <input type="checkbox" checked={visibleCols.has(c)} onChange={() => toggleCol(c)} />
              {t(REPORT_COLUMN_HEADER_KEY[c])}
            </label>
          ))}
        </div>
      </div>

      <div
        className="panel"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: narrow ? 100 : 8, ...panelPad }}
      >
        <div className="row between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
          <div className="t-label">{t('report_preview_heading')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('report_row_count_fmt').replace('{n}', String(filtered.length))}</span>
            <label style={{ fontSize: 12, color: 'var(--tx2)' }}>{t('report_sort_label')}</label>
            <select className="input sm" value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} style={{ minHeight: 36 }}>
              <option value="OeuvreID">{t('report_sort_id')}</option>
              <option value="Titre">{t('report_sort_title')}</option>
              <option value="year">{t('report_sort_year')}</option>
              <option value="PrixFinal">{t('report_sort_price')}</option>
            </select>
            <select className="input sm" value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')} style={{ minHeight: 36 }}>
              <option value="asc">↑</option>
              <option value="desc">↓</option>
            </select>
          </div>
        </div>
        {filtered.length === 0 && <EmptyState title={t('shell_empty')} />}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch', display: filtered.length === 0 ? 'none' : undefined }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                {columnsOrdered.map((c) => (
                  <th key={c} style={{ textAlign: 'left', padding: '6px 4px', whiteSpace: 'nowrap', color: 'var(--tx2)' }}>
                    {t(REPORT_COLUMN_HEADER_KEY[c])}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map(({ o, cells }) => (
                <tr key={o.OeuvreID} style={{ borderBottom: '1px solid var(--bd)' }}>
                  {columnsOrdered.map((c, ci) => (
                    <td key={c} style={{ padding: '4px 6px', verticalAlign: 'top', maxWidth: 220, wordBreak: 'break-word' }}>
                      {cells[ci] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div style={{ padding: 12, fontSize: 12, color: 'var(--tx3)' }}>{t('report_preview_truncated')}</div>
          )}
        </div>
      </div>

      <div
        style={{
          position: narrow ? 'fixed' : 'sticky',
          bottom: narrow ? 0 : undefined,
          left: narrow ? 0 : undefined,
          right: narrow ? 0 : undefined,
          zIndex: narrow ? 120 : 1,
          padding: narrow ? `10px 12px calc(10px + ${safeBottom})` : '8px 0',
          background: 'var(--bg1)',
          borderTop: narrow ? '1px solid var(--bd)' : 'none',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'flex-end',
        }}
      >
        <button type="button" className="btn secondary" style={{ minHeight: 44, padding: '10px 16px' }} onClick={exportXlsx}>{t('report_export_xlsx')}</button>
        <button type="button" className="btn secondary" style={{ minHeight: 44, padding: '10px 16px' }} onClick={exportHtml}>{t('report_export_html')}</button>
        <button type="button" className="btn" style={{ minHeight: 44, padding: '10px 16px' }} disabled={pending} onClick={exportPdf}>{pending ? t('generating') : t('report_export_pdf')}</button>
      </div>
    </div>
  )
}
