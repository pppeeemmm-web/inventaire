'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { IdentityFields } from './IdentityRenderer'

export default function IdentityEditor({ fields }: BlockEditorProps<IdentityFields>) {
  const { t } = useI18n()
  const name = fields.artist_name || '—'

  return (
    <div className="sb-id-editor">
      <style>{`
        .sb-id-editor {
          display: flex; flex-direction: column; gap: 8px;
          font-family: 'JetBrains Mono', monospace;
        }
        .sb-id-row {
          display: grid; grid-template-columns: 80px 1fr; gap: 8px;
          align-items: baseline;
        }
        .sb-id-label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3);
        }
        .sb-id-value { font-size: 11px; color: var(--tx2); }
        .sb-id-hint {
          margin-top: 4px;
          font-size: 9px; letter-spacing: 0.5px;
          color: var(--tx3); font-style: italic; line-height: 1.5;
        }
      `}</style>
      <div className="sb-id-row">
        <span className="sb-id-label">{t('site_identity_artist_label')}</span>
        <span className="sb-id-value">{name}</span>
      </div>
      <p className="sb-id-hint">{t('site_identity_managed_hint')}</p>
    </div>
  )
}
