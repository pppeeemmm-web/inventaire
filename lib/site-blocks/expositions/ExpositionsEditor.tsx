'use client'

import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import RowListEditor, { type RowListColumn } from '@/lib/site-blocks/shared/RowListEditor'
import type { ExpositionRow, ExpositionsFields } from './ExpositionsRenderer'

const COLUMNS: RowListColumn<ExpositionRow>[] = [
  { key: 'year', labelKey: 'site_expositions_year', flex: '70px', placeholder: '2024' },
  { key: 'title', labelKey: 'site_expositions_title', flex: 2 },
  { key: 'venue', labelKey: 'site_expositions_venue', flex: 2 },
]

const DEFAULT_ROW: ExpositionRow = { year: '', title: '', venue: '' }

export default function ExpositionsEditor({ fields, onChange }: BlockEditorProps<ExpositionsFields>) {
  return (
    <RowListEditor
      rows={fields.rows ?? []}
      columns={COLUMNS}
      defaultRow={DEFAULT_ROW}
      addLabelKey="site_expositions_add"
      onChange={rows => onChange({ rows })}
    />
  )
}
