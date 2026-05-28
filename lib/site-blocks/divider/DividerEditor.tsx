'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { DividerFields, DividerStyle } from './DividerRenderer'

const STYLES: DividerStyle[] = ['rule', 'spacer', 'ornament']

export default function DividerEditor({ fields, onChange }: BlockEditorProps<DividerFields>) {
  const { t } = useI18n()
  return (
    <div className="sb-div-editor">
      <style>{`
        .sb-div-editor { display: flex; align-items: center; gap: 6px; }
        .sb-div-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); min-width: 60px;
        }
        .sb-div-editor .opts { display: flex; gap: 2px; }
        .sb-div-editor button {
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
          letter-spacing: 1px; text-transform: uppercase;
          padding: 6px 10px;
          background: transparent; color: var(--tx2);
          border: 1px solid var(--bd2); cursor: pointer;
          transition: background 120ms ease, color 120ms ease;
        }
        .sb-div-editor button[aria-pressed="true"] {
          background: var(--bg2); color: var(--ac); border-color: var(--bd3);
        }
        .sb-div-editor button:hover { color: var(--tx); }
      `}</style>
      <label>{t('site_divider_style_label')}</label>
      <div className="opts" role="group" aria-label={t('site_divider_style_label')}>
        {STYLES.map(s => (
          <button
            key={s}
            type="button"
            aria-pressed={fields.style === s}
            onClick={() => onChange({ style: s })}
          >
            {t(s === 'rule' ? 'site_divider_style_rule'
              : s === 'spacer' ? 'site_divider_style_spacer'
                : 'site_divider_style_ornament')}
          </button>
        ))}
      </div>
    </div>
  )
}
