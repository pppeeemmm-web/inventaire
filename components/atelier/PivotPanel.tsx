'use client'

import { useMemo, useState, useCallback } from 'react'
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
}: PivotPanelProps<R>) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const [rowDimId, setRowDimId] = useState(defaultRowDimId)
  const [colDimId, setColDimId] = useState(defaultColDimId)
  const [valueIds, setValueIds] = useState<string[]>(
    () => defaultValueIds ?? availableValues.map((v) => v.id),
  )

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

  const selStyle: React.CSSProperties = {
    minHeight: 44,
    padding: '8px 12px',
    fontSize: 13,
    background: 'var(--bg0)',
    border: '1px solid var(--bd)',
    color: 'var(--tx)',
    borderRadius: 4,
    width: narrow ? '100%' : 'auto',
  }

  return (
    <div className="panel pad-md" style={{ marginTop: title ? 16 : 0 }}>
      {title && (
        <div className="t-label" style={{ marginBottom: 12, color: 'var(--ac)' }}>
          {title}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: narrow ? 'stretch' : 'flex-end',
          marginBottom: 16,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: narrow ? undefined : 1, minWidth: narrow ? undefined : 140 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{t('pivotGroupBy')}</span>
          <select value={rowDimId} onChange={(e) => setRowDimId(e.target.value)} style={selStyle}>
            {availableDims.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: narrow ? undefined : 1, minWidth: narrow ? undefined : 140 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{t('pivotCrossBy')}</span>
          <select value={colDimId} onChange={(e) => setColDimId(e.target.value)} style={selStyle}>
            <option value="">{t('pivotNoColumn')}</option>
            {availableDims.filter((d) => d.id !== rowDimId).map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: narrow ? undefined : 2, minWidth: 200 }}>
          <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{t('pivotValues')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {availableValues.map((v) => (
              <label key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 44 }}>
                <input
                  type="checkbox"
                  checked={valueIds.includes(v.id)}
                  onChange={() => toggleValue(v.id)}
                />
                <span style={{ fontSize: 13 }}>{v.label}</span>
              </label>
            ))}
          </div>
        </div>
        <button type="button" className="btn sm" onClick={exportXlsx} disabled={!pivot} style={{ minHeight: 44, alignSelf: narrow ? 'stretch' : 'center' }}>
          {t('pivotExportXlsx')}
        </button>
      </div>

      {!pivot || pivot.rows.length === 0 ? (
        <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('pivotEmpty')}</div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="tbl" style={{ minWidth: narrow ? 320 : 480, fontSize: 12 }}>
            <thead>
              {!singleColMode ? (
                <>
                  <tr>
                    <th rowSpan={2} style={{ position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 1, verticalAlign: 'bottom' }}>
                      {t('pivotGroupBy')}
                    </th>
                    {pivot.cols.map((colKey) => (
                      <th key={colKey} colSpan={vals.length} className="num" style={{ borderBottom: '1px solid var(--bd)' }}>
                        {colKey}
                      </th>
                    ))}
                    <th colSpan={vals.length} className="num">{t('pivotTotal')}</th>
                  </tr>
                  <tr>
                    {pivot.cols.flatMap((ck) =>
                      vals.map((v) => (
                        <th key={`${ck}-${v.id}`} className="num" style={{ fontSize: 10, color: 'var(--tx3)' }}>{v.label}</th>
                      )),
                    )}
                    {vals.map((v) => (
                      <th key={`tot-${v.id}`} className="num" style={{ fontSize: 10, color: 'var(--tx3)' }}>{v.label}</th>
                    ))}
                  </tr>
                </>
              ) : (
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg1)', zIndex: 1 }}>{t('pivotGroupBy')}</th>
                  {vals.map((v) => (
                    <th key={v.id} className="num">{v.label}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {pivot.rows.map((rk, ri) => (
                <tr key={rk}>
                  <td style={{ position: 'sticky', left: 0, background: 'var(--bg1)', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={rk}>
                    {rk}
                  </td>
                  {singleColMode ? (
                    vals.map((v, vi) => (
                      <td key={v.id} className="num">{fmt(pivot.cells[ri][0][vi], v.kind)}</td>
                    ))
                  ) : (
                    <>
                      {pivot.cols.flatMap((_, ci) =>
                        vals.map((v, vi) => (
                          <td key={`${ci}-${v.id}`} className="num">{fmt(pivot.cells[ri][ci][vi], v.kind)}</td>
                        )),
                      )}
                      {vals.map((v, vi) => (
                        <td key={`rt-${v.id}`} className="num" style={{ fontWeight: 600 }}>{fmt(pivot.rowTotals[ri][vi], v.kind)}</td>
                      ))}
                    </>
                  )}
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid var(--bd)' }}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--bg2)', fontWeight: 700 }}>{t('pivotGrandTotal')}</td>
                {singleColMode ? (
                  vals.map((v, vi) => (
                    <td key={v.id} className="num" style={{ fontWeight: 700 }}>{fmt(pivot.grand[vi], v.kind)}</td>
                  ))
                ) : (
                  <>
                    {pivot.cols.flatMap((_, ci) =>
                      vals.map((v, vi) => (
                        <td key={`${ci}-${v.id}`} className="num" style={{ fontWeight: 700 }}>{fmt(pivot.colTotals[ci][vi], v.kind)}</td>
                      )),
                    )}
                    {vals.map((v, vi) => (
                      <td key={`g-${v.id}`} className="num" style={{ fontWeight: 700 }}>{fmt(pivot.grand[vi], v.kind)}</td>
                    ))}
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
