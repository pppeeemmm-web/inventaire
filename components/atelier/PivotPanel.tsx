'use client'

import { useMemo, useState, useCallback, type CSSProperties } from 'react'
import * as XLSX from 'xlsx'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { Agg, Dim } from '@/lib/pivot'
import { buildPivot } from '@/lib/pivot'

const EMPTY = '—'

export type PivotPanelProps<R> = {
  rows: R[]
  availableDims: Dim<R>[]
  availableValues: Agg<R>[]
  defaultRowDimId: string
  defaultColDimId?: string
  defaultValueIds?: string[]
  title?: string
  exportFileName?: string
  /** When true, dimension controls start hidden (compact bar + table). */
  initialToolbarCollapsed?: boolean
  /** When true (requires `title`), user can hide/show the summary line + data table. */
  collapsibleSection?: boolean
  /** Initial state for the section toggle; only used when `collapsibleSection` is true. */
  initialSectionCollapsed?: boolean
  /** Optional note under the title row (e.g. subset scope). */
  footnote?: string
}

export function PivotPanel<R>({
  rows,
  availableDims,
  availableValues,
  defaultRowDimId,
  defaultColDimId = '',
  defaultValueIds,
  title,
  exportFileName = 'pivot',
  initialToolbarCollapsed = false,
  collapsibleSection = false,
  initialSectionCollapsed = false,
  footnote,
}: PivotPanelProps<R>) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const [rowDimId, setRowDimId] = useState(defaultRowDimId)
  const [colDimId, setColDimId] = useState(defaultColDimId)
  const [valueIds, setValueIds] = useState<string[]>(
    () => defaultValueIds ?? availableValues.map((v) => v.id),
  )
  const [toolbarCollapsed, setToolbarCollapsed] = useState(initialToolbarCollapsed)
  const [sectionExpanded, setSectionExpanded] = useState(
    () => !(collapsibleSection && initialSectionCollapsed),
  )
  const [bodyCollapsed, setBodyCollapsed] = useState(Boolean(title) && initialSectionCollapsed)

  const fmt = useCallback(
    (n: number | null, kind: string) => {
      if (n == null) return '—'
      if (kind === 'count') return String(Math.round(n))
      return n.toLocaleString(loc, { maximumFractionDigits: 2 })
    },
    [loc],
  )

  const pivot = useMemo(() => {
    const rowD = availableDims.find((d) => d.id === rowDimId)
    const vals = availableValues.filter((v) => valueIds.includes(v.id))
    if (!rowD || vals.length === 0 || rows.length === 0) return null
    const colD = colDimId ? availableDims.find((d) => d.id === colDimId) : undefined
    return buildPivot(rows, { rowDims: [rowD], colDim: colD, values: vals }, EMPTY)
  }, [rows, availableDims, availableValues, rowDimId, colDimId, valueIds])

  const colD = colDimId ? availableDims.find((d) => d.id === colDimId) : undefined
  const singleColMode = !colD && pivot && pivot.cols.length <= 1
  const vals = availableValues.filter((v) => valueIds.includes(v.id))
  const rowDim = availableDims.find((d) => d.id === rowDimId)

  const exportXlsx = useCallback(() => {
    if (!pivot) return
    const { rows: rws, cols: cls, cells, rowTotals, colTotals, grand } = pivot
    const aoa: (string | number)[][] = []
    const valLabels = vals.map((v) => v.label)
    if (singleColMode) {
      aoa.push([t('pivotGroupBy'), ...valLabels])
      for (let ri = 0; ri < rws.length; ri++) {
        const row: (string | number)[] = [rws[ri]]
        for (let vi = 0; vi < vals.length; vi++) row.push(cells[ri][0][vi] ?? '')
        aoa.push(row)
      }
      const foot: (string | number)[] = [t('pivotGrandTotal')]
      for (let vi = 0; vi < vals.length; vi++) foot.push(grand[vi] ?? '')
      aoa.push(foot)
    } else {
      const head: (string | number)[] = [t('pivotGroupBy')]
      for (const ck of cls) {
        for (const l of valLabels) head.push(`${ck} — ${l}`)
      }
      for (const l of valLabels) head.push(`${t('pivotTotal')} — ${l}`)
      aoa.push(head)
      for (let ri = 0; ri < rws.length; ri++) {
        const row: (string | number)[] = [rws[ri]]
        for (let ci = 0; ci < cls.length; ci++) {
          for (let vi = 0; vi < vals.length; vi++) row.push(cells[ri][ci][vi] ?? '')
        }
        for (let vi = 0; vi < vals.length; vi++) row.push(rowTotals[ri][vi] ?? '')
        aoa.push(row)
      }
      const foot: (string | number)[] = [t('pivotGrandTotal')]
      for (let ci = 0; ci < cls.length; ci++) {
        for (let vi = 0; vi < vals.length; vi++) foot.push(colTotals[ci][vi] ?? '')
      }
      for (let vi = 0; vi < vals.length; vi++) foot.push(grand[vi] ?? '')
      aoa.push(foot)
    }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(wb, ws, 'Pivot')
    XLSX.writeFile(wb, `${exportFileName}.xlsx`)
  }, [pivot, singleColMode, vals, t, exportFileName])

  const toggleValue = (id: string) => {
    setValueIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const selStyle: CSSProperties = {
    minHeight: 36,
    padding: '0 32px 0 12px',
    fontSize: 13,
    background: 'var(--bg0)',
    border: '1px solid var(--bd)',
    color: 'var(--tx)',
    borderRadius: 8,
    width: narrow ? '100%' : 'auto',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
  }

  const summaryParts = [
    rowDim?.label ?? '—',
    colD ? colD.label : t('pivotNoColumn'),
    vals.map((v) => v.label).join(', '),
  ]
  const summaryLine = summaryParts.join(' · ')

  const sectionTotalsHint = useMemo(() => {
    if (!pivot || pivot.rows.length === 0) return ''
    return vals
      .map((v, vi) => `${v.label}: ${fmt(pivot.grand[vi], v.kind)}`)
      .join(' · ')
  }, [pivot, vals, fmt])

  const numCell: CSSProperties = {
    width: '4.25rem',
    maxWidth: '6rem',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  }

  const bodyOpen = !bodyCollapsed

  return (
    <div className="panel pad-sm" style={{ marginTop: title ? 8 : 0 }}>
      {title && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            marginBottom: bodyCollapsed ? 0 : toolbarCollapsed ? 8 : 10,
          }}
        >
          <button
            type="button"
            onClick={() => setBodyCollapsed((c) => !c)}
            aria-expanded={bodyOpen}
            aria-label={bodyCollapsed ? t('pivotPanel_toggle_expand') : t('pivotPanel_toggle_collapse')}
            title={bodyCollapsed ? t('pivotPanel_toggle_expand') : t('pivotPanel_toggle_collapse')}
            style={{
              minHeight: 44,
              minWidth: 44,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              fontSize: 14,
              lineHeight: 1,
              cursor: 'pointer',
              background: 'var(--bg1)',
              border: '1px solid var(--bd)',
              borderRadius: 4,
              color: 'var(--tx)',
            }}
          >
            {bodyCollapsed ? '▶' : '▼'}
          </button>
          <div className="t-label" style={{ color: 'var(--ac)', flex: '1 1 auto', minWidth: 0 }}>
            {title}
          </div>
          {bodyOpen && (
            <button
              type="button"
              className="btn sm"
              onClick={() => setToolbarCollapsed((c) => !c)}
              aria-expanded={!toolbarCollapsed}
              style={{ minHeight: 44, flexShrink: 0 }}
            >
              {toolbarCollapsed ? `▶ ${t('pivotToolbar_expand')}` : `▼ ${t('pivotToolbar_collapse')}`}
            </button>
          )}
          <button
            type="button"
            className="btn sm"
            onClick={exportXlsx}
            disabled={!pivot}
            style={{ minHeight: 44, flexShrink: 0 }}
          >
            {t('pivotExportXlsx')}
          </button>
        </div>
      )}

      {title && footnote && bodyOpen && (
        <div
          className="t-mono-sm"
          style={{
            fontSize: 10,
            color: 'var(--tx3)',
            marginBottom: toolbarCollapsed ? 8 : 10,
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {footnote}
        </div>
      )}

      {bodyOpen && toolbarCollapsed && (
        <div
          className="t-mono-sm"
          style={{
            color: 'var(--tx3)',
            marginBottom: 8,
            lineHeight: 1.35,
            wordBreak: 'break-word',
          }}
        >
          {summaryLine}
        </div>
      )}

      {bodyOpen && !toolbarCollapsed && (
        <div
          style={{
            display: 'flex',
            flexDirection: narrow ? 'column' : 'row',
            flexWrap: 'wrap',
            rowGap: 12,
            columnGap: narrow ? 12 : 14,
            alignItems: narrow ? 'stretch' : 'flex-end',
            justifyContent: 'flex-start',
            marginBottom: 10,
          }}
        >
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              width: narrow ? '100%' : 'auto',
              minWidth: narrow ? undefined : 160,
              flexShrink: 0,
            }}
          >
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pivotGroupBy')}</span>
            <select value={rowDimId} onChange={(e) => setRowDimId(e.target.value)} style={selStyle}>
              {availableDims.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              width: narrow ? '100%' : 'auto',
              minWidth: narrow ? undefined : 160,
              flexShrink: 0,
            }}
          >
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pivotCrossBy')}</span>
            <select value={colDimId} onChange={(e) => setColDimId(e.target.value)} style={selStyle}>
              <option value="">{t('pivotNoColumn')}</option>
              {availableDims.filter((d) => d.id !== rowDimId).map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              flex: narrow ? undefined : '1 1 auto',
            }}
          >
            <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pivotValues')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {availableValues.map((v) => {
                const isActive = valueIds.includes(v.id)
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleValue(v.id)}
                    style={{
                      minHeight: 36,
                      padding: '0 16px',
                      fontSize: 13,
                      borderRadius: 18,
                      border: '1px solid',
                      borderColor: isActive ? 'var(--ac)' : 'var(--bd)',
                      background: isActive ? 'var(--ac)' : 'var(--bg0)',
                      color: isActive ? 'var(--bg0)' : 'var(--tx)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {v.label}
                  </button>
                )
              })}
            </div>
          </div>
          {!title && (
            <button
              type="button"
              className="btn sm"
              onClick={exportXlsx}
              disabled={!pivot}
              style={{ minHeight: 36, alignSelf: narrow ? 'stretch' : 'flex-end', marginLeft: narrow ? 0 : 'auto', borderRadius: 8 }}
            >
              {t('pivotExportXlsx')}
            </button>
          )}
        </div>
      )}

      {bodyOpen && (!pivot || pivot.rows.length === 0 ? (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', paddingBottom: 2 }}>{t('pivotEmpty')}</div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table
            className="tbl"
            style={{
              width: '100%',
              minWidth: narrow ? 260 : 320,
              tableLayout: 'fixed',
              fontSize: 12,
            }}
          >
            <thead>
              {!singleColMode && vals.length === 1 ? (
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 1, width: '38%', maxWidth: 220 }}>{t('pivotGroupBy')}</th>
                  {pivot.cols.map((colKey) => (
                    <th key={colKey} className="num" style={numCell}>{colKey}</th>
                  ))}
                  <th className="num" style={numCell}>{t('pivotTotal')}</th>
                </tr>
              ) : !singleColMode ? (
                <>
                  <tr>
                    <th rowSpan={2} style={{ position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 1, verticalAlign: 'bottom', width: '34%', maxWidth: 200 }}>
                      {t('pivotGroupBy')}
                    </th>
                    {pivot.cols.map((colKey) => (
                      <th key={colKey} colSpan={vals.length} className="num" style={{ borderBottom: '1px solid var(--bd)' }}>
                        {colKey}
                      </th>
                    ))}
                    <th colSpan={vals.length} className="num" style={{ borderBottom: '1px solid var(--bd)' }}>{t('pivotTotal')}</th>
                  </tr>
                  <tr>
                    {pivot.cols.flatMap((ck) =>
                      vals.map((v) => (
                        <th key={`${ck}-${v.id}`} className="num" style={{ ...numCell, fontSize: 10, color: 'var(--tx3)' }}>{v.label}</th>
                      )),
                    )}
                    {vals.map((v) => (
                      <th key={`tot-${v.id}`} className="num" style={{ ...numCell, fontSize: 10, color: 'var(--tx3)' }}>{v.label}</th>
                    ))}
                  </tr>
                </>
              ) : (
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 1, width: '42%', maxWidth: 240 }}>{t('pivotGroupBy')}</th>
                  {vals.map((v) => (
                    <th key={v.id} className="num" style={numCell}>{v.label}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {pivot.rows.map((rk, ri) => (
                <tr key={rk}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--bg1)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rk}>
                    {rk}
                  </td>
                  {singleColMode ? (
                    vals.map((v, vi) => (
                      <td key={v.id} className="num" style={numCell}>{fmt(pivot.cells[ri][0][vi], v.kind)}</td>
                    ))
                  ) : (
                    <>
                      {pivot.cols.flatMap((_, ci) =>
                        vals.map((v, vi) => (
                          <td key={`${ci}-${v.id}`} className="num" style={numCell}>{fmt(pivot.cells[ri][ci][vi], v.kind)}</td>
                        )),
                      )}
                      {vals.map((v, vi) => (
                        <td key={`rt-${v.id}`} className="num" style={{ ...numCell, fontWeight: 600 }}>{fmt(pivot.rowTotals[ri][vi], v.kind)}</td>
                      ))}
                    </>
                  )}
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--bd)' }}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--bg2)', fontWeight: 700 }}>{t('pivotGrandTotal')}</td>
                {singleColMode ? (
                  vals.map((v, vi) => (
                    <td key={v.id} className="num" style={{ ...numCell, fontWeight: 700 }}>{fmt(pivot.grand[vi], v.kind)}</td>
                  ))
                ) : (
                  <>
                    {pivot.cols.flatMap((_, ci) =>
                      vals.map((v, vi) => (
                        <td key={`${ci}-${v.id}`} className="num" style={{ ...numCell, fontWeight: 700 }}>{fmt(pivot.colTotals[ci][vi], v.kind)}</td>
                      )),
                    )}
                    {vals.map((v, vi) => (
                      <td key={`g-${v.id}`} className="num" style={{ ...numCell, fontWeight: 700 }}>{fmt(pivot.grand[vi], v.kind)}</td>
                    ))}
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
