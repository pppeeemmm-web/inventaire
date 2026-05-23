'use client'

import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'

const btnStyle = { minHeight: 44, padding: '10px 16px' } as const

export function GraphCsvExportButtons() {
  const { t } = useI18n()
  const tk = (key: string) => t(key as DictKey)

  return (
    <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{tk('graph_csv_export_label')}</span>
      <a
        href="/api/export/csv?view=entity"
        className="btn secondary sm"
        style={btnStyle}
        data-testid="graph-csv-export-entity"
      >
        {tk('graph_csv_export_entity')}
      </a>
      <a
        href="/api/export/csv?view=edge_fact"
        className="btn secondary sm"
        style={btnStyle}
        data-testid="graph-csv-export-edges"
      >
        {tk('graph_csv_export_edges')}
      </a>
    </div>
  )
}
