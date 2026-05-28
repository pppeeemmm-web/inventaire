'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { WorksModesFields } from './WorksModesRenderer'

/**
 * Editor for a works_modes block.
 *
 * These blocks are auto-generated from config.works_modes; detailed editing
 * (layout, lighting, collections) lives in the legacy Diffusion section of
 * SiteEditorPanel. This card surfaces the mode identity for context and
 * directs the author to that section for deeper changes.
 */
export default function WorksModesEditor({ fields, ctx }: BlockEditorProps<WorksModesFields>) {
  const { t, lang } = useI18n()
  const label = lang === 'en'
    ? (fields.label_en || fields.label_fr || fields.mode_id)
    : (fields.label_fr || fields.label_en || fields.mode_id)
  const layout = fields.layout || '—'

  return (
    <div className="sb-wm-editor">
      <style>{`
        .sb-wm-editor {
          display: flex; flex-direction: column; gap: 8px;
          font-family: 'JetBrains Mono', monospace;
        }
        .sb-wm-row {
          display: grid; grid-template-columns: 80px 1fr; gap: 8px;
          align-items: baseline;
        }
        .sb-wm-label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3);
        }
        .sb-wm-value {
          font-size: 11px; color: var(--tx2);
        }
        .sb-wm-hint {
          margin-top: 6px;
          font-size: 9px; letter-spacing: 0.5px;
          color: var(--tx3); font-style: italic; line-height: 1.5;
        }
      `}</style>
      <div className="sb-wm-row">
        <span className="sb-wm-label">{t('site_works_modes_mode_label')}</span>
        <span className="sb-wm-value">{label}</span>
      </div>
      <div className="sb-wm-row">
        <span className="sb-wm-label">{t('site_works_modes_layout_label')}</span>
        <span className="sb-wm-value">{layout}</span>
      </div>
      <div className="sb-wm-row">
        <span className="sb-wm-label">ID</span>
        <span className="sb-wm-value" style={{ opacity: 0.45, fontSize: 9 }}>{fields.mode_id || '—'}</span>
      </div>
      <p className="sb-wm-hint">{t('site_works_modes_managed_hint')}</p>
    </div>
  )
}
