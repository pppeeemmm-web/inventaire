'use client'

// Rapports (owner 2026-11-02, Access-style): pick a source (Œuvres, Production, Kaizen, Ventes,
// Contacts), tick / order / filter its fields, optional pivot, then print or export. Each section's
// "Rapport" button opens this tab on its source (`?source=`). Reports can be saved by name.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { useI18n } from '@/lib/i18n/context'
import { EmptyState } from '@/components/shared/EmptyState'
import type { DictKey, Lang } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import { statusOf } from '@/lib/data'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { createClient } from '@/lib/supabase/client'
import { isInProduction } from '@/lib/production-scope'
import { loadPendingActionsMap } from '@/lib/reports/pending-actions'
import { REPORT_PDF_MAX_ROWS, type ReportMaps } from '@/lib/reports/works-table'
import { cellText, cleanConfig, isActiveFilter, runReport, type ReportConfig } from '@/lib/reports/engine'
import { REPORT_SOURCES, parseReportSource, type ReportSource, type SavedReport } from '@/lib/reports/saved-report'
import type { KaizenItem } from '@/lib/kaizen'
import type { Agg, Dim } from '@/lib/pivot'
import { PivotPanel } from '@/components/atelier/PivotPanel'
import { generateTablePdf } from '@/app/atelier/(portal)/reports/actions'
import { deleteSavedReport, listSavedReports, saveReport } from '@/app/atelier/(portal)/reports/saved-actions'
import { listReportContacts, type ReportContactRow } from '@/app/atelier/(portal)/reports/source-actions'
import { listKaizen } from '@/app/atelier/(portal)/kaizen/actions'
import { fetchOrders, type SaleOrderRow } from '@/app/atelier/(portal)/sales/actions'
import { PivotAtlasPanel } from '@/app/atelier/(portal)/reports/_components/PivotAtlasPanel'
import { ReportFieldsPanel } from '@/app/atelier/(portal)/reports/_components/ReportFieldsPanel'
import { SOURCE_HINT, SOURCE_LABEL, buildSource, type SaleRow, type SourceCtx } from '@/app/atelier/(portal)/reports/_components/report-sources'

const PREVIEW_CAP = 300
const SALE_STATUSES = new Set(['sold', 'reserved', 'consigned', 'gift'])

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function csvCell(v: string, sep: string): string {
  return v.includes(sep) || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
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

type Loaded = {
  pendingActions?: Map<number, string[]>
  kaizen?: { items: KaizenItem[]; names: Record<string, string> }
  orders?: SaleOrderRow[]
  contacts?: ReportContactRow[]
}

export function Reports({
  oeuvres,
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
  oeuvresLoadedCount,
  oeuvresCatalogueTotal,
  isAdmin = false,
}: Props) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR'
  const tk = (key: string) => t(key as DictKey)

  const searchParams = useSearchParams()
  const urlSource = parseReportSource(searchParams.get('source'))
  const [source, setSource] = useState<ReportSource>(urlSource ?? 'works')
  const [cfg, setCfg] = useState<ReportConfig | null>(null)
  const [loaded, setLoaded] = useState<Loaded>({})
  const [loadErr, setLoadErr] = useState<ReportSource | null>(null)
  const [fieldsOpen, setFieldsOpen] = useState(!narrow)
  const [reportMode, setReportMode] = useState<'table' | 'atlas'>('table')
  const [pdfPending, startPdf] = useTransition()
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [savedMe, setSavedMe] = useState('')
  const [savedAdmin, setSavedAdmin] = useState(false)
  const [savedId, setSavedId] = useState<number | null>(null)
  const [savingReport, setSavingReport] = useState(false)

  // ── Lookups shared by the works-based sources ──
  const maps: ReportMaps = useMemo(() => {
    const oeuvreThemeMap = new Map<number, number[]>()
    for (const [k, arr] of Object.entries(oeuvreThemeIdsByOeuvre)) oeuvreThemeMap.set(Number(k), arr)
    const oeuvreGroupMap = new Map<number, string[]>()
    for (const [k, arr] of Object.entries(oeuvreGroupIdsByOeuvre)) oeuvreGroupMap.set(Number(k), arr)
    return {
      tM,
      sM,
      fM: Object.fromEntries(formats.map((f) => [f.FormatID, f.Format ?? ''])),
      cM,
      pM,
      locMap,
      statusLabelMap,
      thM: Object.fromEntries(themes.map((x) => [x.id, x.name])),
      groupNameMap: Object.fromEntries(groups.map((g) => [g.id, g.name])),
      oeuvreThemeMap,
      oeuvreGroupMap,
    }
  }, [tM, sM, cM, pM, locMap, statusLabelMap, formats, themes, groups, oeuvreThemeIdsByOeuvre, oeuvreGroupIdsByOeuvre])

  const worksByBuyer = useMemo(() => {
    const m = new Map<number, number>()
    for (const o of oeuvres) if (o.AcheteurID != null) m.set(o.AcheteurID, (m.get(o.AcheteurID) ?? 0) + 1)
    return m
  }, [oeuvres])
  const worksAtLocation = useMemo(() => {
    const m = new Map<number, number>()
    for (const o of oeuvres) if (o.LocalisationID != null) m.set(o.LocalisationID, (m.get(o.LocalisationID) ?? 0) + 1)
    return m
  }, [oeuvres])

  const ctx: SourceCtx = useMemo(
    () => ({
      t,
      locale,
      maps,
      pendingActions: loaded.pendingActions ?? new Map(),
      kaizenNames: loaded.kaizen?.names ?? {},
      worksByBuyer,
      worksAtLocation,
    }),
    [t, locale, maps, loaded.pendingActions, loaded.kaizen, worksByBuyer, worksAtLocation],
  )
  const def = useMemo(() => buildSource(source, ctx), [source, ctx])
  const config = cfg ?? def.defaults

  // ── Data each source needs beyond the shell's works ──
  const needs = useMemo(() => {
    const showsSteps = source === 'production'
    return {
      pendingActions: showsSteps,
      kaizen: source === 'kaizen',
      orders: source === 'sales',
      contacts: source === 'contacts',
    }
  }, [source])
  useEffect(() => {
    let live = true
    const fail = () => { if (live) setLoadErr(source) }
    setLoadErr(null)
    if (needs.pendingActions && !loaded.pendingActions) {
      loadPendingActionsMap(createClient(), t)
        .then((m) => { if (live) setLoaded((p) => ({ ...p, pendingActions: m })) })
        .catch(fail)
    }
    if (needs.kaizen && !loaded.kaizen) {
      listKaizen()
        .then((r) => {
          if (!live) return
          if ('error' in r) fail()
          else setLoaded((p) => ({ ...p, kaizen: { items: r.items, names: r.names } }))
        })
        .catch(fail)
    }
    if (needs.orders && !loaded.orders) {
      fetchOrders()
        .then((r) => { if (live) setLoaded((p) => ({ ...p, orders: r })) })
        .catch(fail)
    }
    if (needs.contacts && !loaded.contacts) {
      listReportContacts()
        .then((r) => {
          if (!live) return
          if ('error' in r) fail()
          else setLoaded((p) => ({ ...p, contacts: r.rows }))
        })
        .catch(fail)
    }
    return () => { live = false }
  }, [needs, loaded, source, t])

  const sourceRows: unknown[] | null = useMemo(() => {
    switch (source) {
      case 'works':
        return oeuvres
      case 'production': {
        if (!loaded.pendingActions) return null
        const withSteps = new Set(loaded.pendingActions.keys())
        return oeuvres.filter((o) => isInProduction(o, statusLabelMap, withSteps))
      }
      case 'kaizen':
        return loaded.kaizen?.items ?? null
      case 'contacts':
        return loaded.contacts ?? null
      case 'sales': {
        if (!loaded.orders) return null
        // Latest order per work (orders arrive newest first; one order may carry several works).
        const orderOf = new Map<number, SaleOrderRow>()
        for (const ord of loaded.orders) {
          const ids = ord.oeuvre_ids?.length ? ord.oeuvre_ids : [ord.oeuvre_id]
          for (const id of ids) if (!orderOf.has(id)) orderOf.set(id, ord)
        }
        const rows: SaleRow[] = []
        for (const o of oeuvres) {
          const order = orderOf.get(o.OeuvreID) ?? null
          if (order || SALE_STATUSES.has(statusOf(o, statusLabelMap))) rows.push({ o, order })
        }
        return rows
      }
    }
  }, [source, oeuvres, loaded, statusLabelMap])
  const sourceLoading = sourceRows == null && loadErr !== source

  const result = useMemo(
    () => (sourceRows ? runReport(sourceRows, def.fields, config, locale) : []),
    [sourceRows, def.fields, config, locale],
  )
  const shownFields = useMemo(() => {
    const byId = new Map(def.fields.map((f) => [f.id, f]))
    return config.fields.map((id) => byId.get(id)).filter((f): f is NonNullable<typeof f> => !!f)
  }, [def.fields, config.fields])
  const headers = useMemo(() => shownFields.map((f) => f.label), [shownFields])
  const matrix = useMemo(() => result.map((r) => shownFields.map((f) => cellText(f, r))), [result, shownFields])
  const activeFilters = Object.values(config.filters).filter(isActiveFilter).length

  // ── Source switching (picker, "Rapport" buttons via ?source=, saved reports) ──
  const startSource = useCallback((next: ReportSource) => {
    setSource(next)
    setCfg(null)
    setSavedId(null)
  }, [])
  const appliedUrlSource = useRef(urlSource)
  useEffect(() => {
    if (!urlSource || urlSource === appliedUrlSource.current) return
    appliedUrlSource.current = urlSource
    startSource(urlSource)
  }, [urlSource, startSource])

  useEffect(() => {
    void listSavedReports().then((res) => {
      if ('error' in res) return
      setSaved(res.reports)
      setSavedMe(res.me)
      setSavedAdmin(res.isAdmin)
    })
  }, [])
  const savedCurrent = saved.find((r) => r.id === savedId) ?? null
  const canEditSaved = !!savedCurrent && (savedAdmin || savedCurrent.owner_id === savedMe)

  const applySaved = (r: SavedReport) => {
    const target = buildSource(r.source, ctx)
    setSource(r.source)
    setCfg(cleanConfig(r.config, target.fields, target.defaults))
    setSavedId(r.id)
  }

  const persistReport = async (asNew: boolean) => {
    let name = savedCurrent?.name ?? ''
    if (asNew || !savedCurrent) {
      const typed = window.prompt(t('report_save_name_prompt'), savedCurrent?.name ?? t(SOURCE_LABEL[source]))
      if (!typed?.trim()) return
      name = typed
    }
    setSavingReport(true)
    const res = await saveReport({ id: asNew ? undefined : savedCurrent?.id, name, source, config })
    setSavingReport(false)
    if ('error' in res) {
      toast.error(`${t('error_prefix')} ${res.error}`)
      return
    }
    setSaved((prev) =>
      [...prev.filter((r) => r.id !== res.report.id), res.report].sort((a, b) => a.name.localeCompare(b.name, locale)),
    )
    setSavedId(res.report.id)
    toast.success(t('report_saved_ok'))
  }

  const removeSaved = async () => {
    if (!savedCurrent) return
    if (!window.confirm(t('report_delete_saved_confirm').replace('{name}', savedCurrent.name))) return
    const res = await deleteSavedReport(savedCurrent.id)
    if ('error' in res) {
      toast.error(`${t('error_prefix')} ${res.error}`)
      return
    }
    setSaved((prev) => prev.filter((r) => r.id !== savedCurrent.id))
    setSavedId(null)
    toast.success(t('report_deleted_ok'))
  }

  const sortBy = (id: string) =>
    setCfg({
      ...config,
      sort: { field: id, dir: config.sort.field === id && config.sort.dir === 'asc' ? 'desc' : 'asc' },
    })

  // ── Pivot: list-like shown fields as dimensions, summable shown fields as totals ──
  const pivotDims: Dim<unknown>[] = useMemo(
    () =>
      shownFields
        .filter((f) => f.kind === 'enum' || f.kind === 'multi' || f.kind === 'bool' || f.kind === 'date' || f.id === 'year')
        .map((f) => ({
          id: f.id,
          label: f.label,
          get: (r: unknown) => {
            if (f.kind === 'date') {
              const v = f.value(r)
              return typeof v === 'string' && v.length >= 7 ? v.slice(0, 7) : '—'
            }
            return cellText(f, r)
          },
        })),
    [shownFields],
  )
  const pivotValues: Agg<unknown>[] = useMemo(
    () => [
      { id: 'count', label: t('report_pivot_count'), kind: 'count' },
      ...shownFields
        .filter((f) => f.sum)
        .map((f) => ({
          id: `sum_${f.id}`,
          label: t('report_pivot_sum_fmt').replace('{field}', f.label),
          kind: 'sum' as const,
          get: (r: unknown) => Number(f.value(r) ?? 0) || 0,
        })),
    ],
    [shownFields, t],
  )

  // ── Exports: all four use the same formatted cells as the preview ──
  const reportName = savedCurrent?.name ?? `${t('report_page_title')} · ${t(SOURCE_LABEL[source])}`
  const fileStem = `${source}_report_${new Date().toISOString().slice(0, 10)}`
  const guardExport = (): boolean => {
    if (!result.length) {
      toast.error(t('report_pdf_empty'))
      return false
    }
    return true
  }
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  const exportXlsx = () => {
    if (!guardExport()) return
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...matrix]), t(SOURCE_LABEL[source]).slice(0, 31))
    XLSX.writeFile(wb, `${fileStem}.xlsx`)
  }
  const exportCsv = () => {
    if (!guardExport()) return
    // French Excel reads ";" as the column separator; the BOM keeps accents intact.
    const sep = lang === 'fr' ? ';' : ','
    const lines = [headers, ...matrix].map((row) => row.map((c) => csvCell(c, sep)).join(sep))
    downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${fileStem}.csv`)
  }
  const printReport = () => {
    if (!guardExport()) return
    const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')
    const trs = matrix.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('\n')
    const sub = `${new Date().toLocaleDateString(locale)} · ${t('report_row_count_fmt').replace('{n}', String(result.length))}`
    const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/><title>${escapeHtml(reportName)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#111}
h1{font-size:18px;margin:0 0 4px}
p{font-size:12px;color:#555;margin:0 0 14px}
table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#f4f4f4}
thead{display:table-header-group}
tr{page-break-inside:avoid}
@page{size:landscape;margin:12mm}
</style></head><body><h1>${escapeHtml(reportName)}</h1><p>${escapeHtml(sub)}</p><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`
    const w = window.open('', '_blank')
    if (!w) {
      toast.error(t('report_pdf_fail'))
      return
    }
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
    w.print()
  }
  const exportPdf = () => {
    if (!guardExport()) return
    if (result.length > REPORT_PDF_MAX_ROWS) {
      toast.error(t('report_pdf_too_many').replace('{max}', String(REPORT_PDF_MAX_ROWS)))
      return
    }
    startPdf(async () => {
      const res = await generateTablePdf({ title: reportName, headers, rows: matrix, fileStem, lang: lang as Lang })
      if ('error' in res) {
        if (res.error === 'auth') toast.error(t('report_pdf_auth'))
        else if (res.error === 'empty') toast.error(t('report_pdf_empty'))
        else if (res.error === 'too_many') toast.error(t('report_pdf_too_many').replace('{max}', String(REPORT_PDF_MAX_ROWS)))
        else if (res.error === 'no_columns') toast.error(t('report_pdf_no_columns'))
        else toast.error(t('report_pdf_fail'))
        return
      }
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), res.filename)
    })
  }

  // ── Layout ──
  const panelPad: CSSProperties = narrow ? { padding: '10px 12px' } : { padding: '12px 16px' }
  const inputH: CSSProperties = { minHeight: narrow ? 44 : 36 }
  const safeBottom = 'max(12px, env(safe-area-inset-bottom))'
  const worksBased = source === 'works' || source === 'production' || source === 'sales'

  if (reportMode === 'atlas') {
    return (
      <div data-testid="reports-root" style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', paddingBottom: narrow ? 12 : 0 }}>
        <div className="panel" style={{ flexShrink: 0, marginBottom: 8, ...panelPad }}>
          <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="serif" style={{ fontSize: 20, color: 'var(--tx)', lineHeight: 1.25 }}>{t('report_page_title')}</div>
            <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setReportMode('table')}>
              {tk('report_mode_table')}
            </button>
          </div>
        </div>
        <PivotAtlasPanel isAdmin={isAdmin} />
      </div>
    )
  }

  const sourceTab = (s: ReportSource) => (
    <button
      key={s}
      type="button"
      role="tab"
      aria-selected={source === s}
      data-testid={`report-source-${s}`}
      onClick={() => startSource(s)}
      className="serif"
      style={{
        padding: '6px 2px 8px',
        marginRight: 18,
        minHeight: 44,
        fontSize: 16,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: 'transparent',
        color: source === s ? 'var(--tx)' : 'var(--tx3)',
        borderBottom: source === s ? '2px solid var(--ac)' : '2px solid transparent',
      }}
    >
      {t(SOURCE_LABEL[s])}
    </button>
  )

  return (
    <div
      data-testid="reports-root"
      style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: narrow ? 88 : 0 }}
    >
      {/* Header: title, source, saved reports */}
      <div className="panel" style={{ flexShrink: 0, marginBottom: 8, ...panelPad }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="serif" style={{ fontSize: 22, color: 'var(--tx)', lineHeight: 1.25 }}>
            {savedCurrent?.name ?? t('report_page_title')}
          </div>
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={() => setReportMode('atlas')} data-testid="reports-open-atlas">
            {tk('report_mode_atlas')}
          </button>
        </div>
        <div role="tablist" aria-label={t('report_source_label')} style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--bd)', marginTop: 6 }}>
          {REPORT_SOURCES.map(sourceTab)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--tx3)', maxWidth: 760, lineHeight: 1.4, marginTop: 8 }}>{t(SOURCE_HINT[source])}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <label className="t-label" htmlFor="report-saved">{t('report_saved_label')}</label>
          <select
            id="report-saved"
            className="input"
            data-testid="report-saved"
            value={savedId ?? ''}
            onChange={(e) => {
              const r = saved.find((x) => x.id === Number(e.target.value))
              if (r) applySaved(r)
              else setSavedId(null)
            }}
            style={{ ...inputH, width: narrow ? '100%' : 240 }}
          >
            <option value="">{t('report_saved_pick')}</option>
            {saved.map((r) => (
              <option key={r.id} value={r.id}>{`${r.name} · ${t(SOURCE_LABEL[r.source])}`}</option>
            ))}
          </select>
          {canEditSaved ? (
            <button type="button" className="btn sm" style={{ minHeight: 44 }} disabled={savingReport} onClick={() => void persistReport(false)}>
              {t('report_save_update')}
            </button>
          ) : null}
          <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} disabled={savingReport} onClick={() => void persistReport(true)} data-testid="report-save">
            {t('report_save')}
          </button>
          {canEditSaved ? (
            <button type="button" className="btn ghost sm" style={{ minHeight: 44, color: 'var(--rust)' }} onClick={() => void removeSaved()}>
              {t('report_delete_saved')}
            </button>
          ) : null}
        </div>
        {worksBased && oeuvresLoadedCount != null && oeuvresCatalogueTotal != null && oeuvresLoadedCount < oeuvresCatalogueTotal ? (
          <div className="t-mono-sm" data-testid="reports-subset-note" style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 8 }}>
            {t('report_loaded_subset_fmt').replace('{loaded}', String(oeuvresLoadedCount)).replace('{total}', String(oeuvresCatalogueTotal))}
          </div>
        ) : null}
      </div>

      {/* Body: fields on the left, preview on the right (stacked on phone). Never collapses: on a
          short window the page scrolls instead of squeezing the table. */}
      <div style={{ flex: 1, minHeight: narrow ? undefined : 'min(560px, 80vh)', display: 'flex', flexDirection: narrow ? 'column' : 'row', gap: 8 }}>
        <div
          className="panel"
          style={{
            ...panelPad,
            flexShrink: 0,
            width: narrow ? undefined : 300,
            overflowY: narrow ? undefined : 'auto',
            minHeight: 0,
          }}
        >
          <div className="row between" style={{ gap: 8, marginBottom: fieldsOpen ? 8 : 0 }}>
            <button
              type="button"
              onClick={() => setFieldsOpen((o) => !o)}
              aria-expanded={fieldsOpen}
              className="t-label"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, minHeight: narrow ? 44 : 28, color: 'var(--tx)' }}
            >
              {t('report_fields_toggle_fmt').replace('{n}', String(shownFields.length))} {fieldsOpen ? '▾' : '▸'}
            </button>
            <button type="button" className="btn ghost sm" style={{ minHeight: narrow ? 44 : 28 }} onClick={() => setCfg(null)} data-testid="report-reset">
              {t('report_reset')}
            </button>
          </div>
          {fieldsOpen ? (
            <ReportFieldsPanel fields={def.fields} rows={sourceRows ?? []} cfg={config} onChange={setCfg} locale={locale} narrow={narrow} />
          ) : null}
        </div>

        <div className="panel" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: narrow ? 100 : 8, ...panelPad }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="t-mono-sm" data-testid="report-row-count" style={{ color: 'var(--tx2)' }}>
              {sourceLoading ? t('report_loading_source') : t('report_row_count_fmt').replace('{n}', String(result.length))}
            </span>
            {activeFilters > 0 ? (
              <button type="button" className="btn ghost sm" style={{ minHeight: 32, color: 'var(--ac)' }} onClick={() => setCfg({ ...config, filters: {} })}>
                {t('report_filters_active_fmt').replace('{n}', String(activeFilters))} · {t('report_filters_clear_all')}
              </button>
            ) : null}
            <input
              className="input"
              value={config.q}
              onChange={(e) => setCfg({ ...config, q: e.target.value })}
              placeholder={t('report_search_ph')}
              aria-label={t('report_search_ph')}
              style={{ ...inputH, flex: 1, minWidth: 160, maxWidth: 320, marginLeft: narrow ? 0 : 'auto' }}
            />
            <button
              type="button"
              className={config.pivot ? 'btn sm' : 'btn ghost sm'}
              aria-pressed={config.pivot}
              data-testid="report-pivot-toggle"
              onClick={() => setCfg({ ...config, pivot: !config.pivot })}
              style={{ minHeight: 36 }}
            >
              {config.pivot ? t('report_pivot_hide') : t('report_pivot_toggle')}
            </button>
          </div>

          {loadErr === source ? <div className="t-mono-sm" style={{ color: 'var(--rust)' }}>{t('report_load_error')}</div> : null}

          {config.pivot && result.length > 0 ? (
            pivotDims.length ? (
              <div style={{ flexShrink: 0, marginBottom: 10 }}>
                <PivotPanel<unknown>
                  key={`${source}-${pivotDims.map((d) => d.id).join(',')}-${pivotValues.length}`}
                  rows={result}
                  availableDims={pivotDims}
                  availableValues={pivotValues}
                  defaultRowDimId={pivotDims[0].id}
                  defaultValueIds={['count']}
                  exportFileName={`${fileStem}_pivot`}
                />
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 10 }}>{t('report_pivot_no_dims')}</div>
            )
          ) : null}

          {!sourceLoading && result.length === 0 && loadErr !== source ? <EmptyState title={t('shell_empty')} /> : null}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch', display: result.length === 0 ? 'none' : undefined }}>
            <table data-testid="report-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {shownFields.map((f) => {
                    const on = config.sort.field === f.id
                    return (
                      <th
                        key={f.id}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 1,
                          background: 'var(--bg1)',
                          borderBottom: '1px solid var(--bd)',
                          borderRight: '1px solid var(--bd)',
                          textAlign: 'left',
                          padding: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => sortBy(f.id)}
                          title={t('report_sort_column_title')}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '6px 8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            color: on ? 'var(--tx)' : 'var(--tx2)',
                          }}
                        >
                          {f.label}
                          {on ? (config.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                          {isActiveFilter(config.filters[f.id]) ? ' ●' : ''}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {result.slice(0, PREVIEW_CAP).map((r, i) => (
                  <tr key={String(def.rowKey(r))} style={{ borderBottom: '1px solid var(--bd)' }}>
                    {matrix[i].map((c, ci) => (
                      <td
                        key={shownFields[ci].id}
                        style={{
                          padding: '4px 8px',
                          verticalAlign: 'top',
                          maxWidth: 260,
                          wordBreak: 'break-word',
                          whiteSpace: ['number', 'date', 'bool'].includes(shownFields[ci].kind) ? 'nowrap' : undefined,
                          borderRight: '1px solid var(--bd)',
                        }}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.length > PREVIEW_CAP ? (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--tx3)' }}>{t('report_preview_cap_fmt').replace('{n}', String(PREVIEW_CAP))}</div>
            ) : null}
          </div>
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
        <button type="button" className="btn secondary" style={{ minHeight: 44, padding: '10px 16px' }} onClick={printReport} data-testid="report-print">{t('report_print')}</button>
        <button type="button" className="btn secondary" style={{ minHeight: 44, padding: '10px 16px' }} onClick={exportXlsx}>{t('report_export_xlsx')}</button>
        <button type="button" className="btn secondary" style={{ minHeight: 44, padding: '10px 16px' }} onClick={exportCsv} data-testid="report-csv">{t('report_export_csv')}</button>
        <button type="button" className="btn" style={{ minHeight: 44, padding: '10px 16px' }} disabled={pdfPending} onClick={exportPdf}>{pdfPending ? t('generating') : t('report_export_pdf')}</button>
      </div>
    </div>
  )
}
