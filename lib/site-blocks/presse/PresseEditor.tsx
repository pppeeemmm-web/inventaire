'use client'

import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import RowListEditor, { type RowListColumn } from '@/lib/site-blocks/shared/RowListEditor'
import type { PresseFields, PresseRow } from './PresseRenderer'

const COLUMNS: RowListColumn<PresseRow>[] = [
  { key: 'source', labelKey: 'site_presse_source', flex: 1, placeholder: 'Le Monde' },
  { key: 'date', labelKey: 'site_presse_date', flex: '110px', inputType: 'date' },
  { key: 'excerpt_fr', labelKey: 'site_presse_excerpt_fr', flex: 2, multiline: true },
  { key: 'excerpt_en', labelKey: 'site_presse_excerpt_en', flex: 2, multiline: true },
  { key: 'url', labelKey: 'site_presse_url', flex: 1, inputType: 'url', placeholder: 'https://' },
]

const DEFAULT_ROW: PresseRow = {
  source: '',
  date: '',
  excerpt_fr: '',
  excerpt_en: '',
  url: '',
}

export default function PresseEditor({ fields, onChange }: BlockEditorProps<PresseFields>) {
  return (
    <RowListEditor
      rows={fields.rows ?? []}
      columns={COLUMNS}
      defaultRow={DEFAULT_ROW}
      addLabelKey="site_presse_add"
      onChange={rows => onChange({ rows })}
    />
  )
}
