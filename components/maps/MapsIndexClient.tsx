'use client'

import Link from 'next/link'
import type { ConstellationMapRow } from '@/app/atelier/(portal)/constellation/actions'
import { useI18n } from '@/lib/i18n/context'

export function MapsIndexClient({
  maps,
  listError,
}: {
  maps: ConstellationMapRow[]
  listError: string | null
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--bg0)',
        color: 'var(--tx)',
        padding: 'max(20px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) 40px max(24px, env(safe-area-inset-left))',
      }}
    >
      <div className="row gap-sm" style={{ marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link href="/atelier" className="btn ghost sm" style={{ whiteSpace: 'nowrap' }}>
          {t('maps_back_atelier')}
        </Link>
      </div>
      <h1 className="t-display" style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', marginBottom: 8 }}>
        {t('maps_page_title')}
      </h1>
      <p className="t-mono-sm" style={{ color: 'var(--tx3)', marginBottom: 28, maxWidth: 560 }}>
        {t('maps_page_desc')}
      </p>

      {listError ? (
        <p className="t-mono-sm" style={{ color: 'var(--rust)' }} role="alert">
          {t('maps_error_list')} ({listError})
        </p>
      ) : maps.length === 0 ? (
        <p className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('maps_empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--bd)', borderRadius: 4, maxWidth: 720 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg1)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>{t('maps_col_title')}</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>{t('maps_col_updated')}</th>
                <th style={{ padding: '10px 12px', width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {maps.map((m) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--bd)' }}>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>{m.title}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--tx3)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    {new Date(m.updated_at).toLocaleString(locale)}
                  </td>
                  <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                    <Link
                      href={`/atelier/constellation?map=${encodeURIComponent(m.id)}`}
                      className="btn sm"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {t('maps_openInAtelier')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
