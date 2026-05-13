'use client'

import { useI18n } from '@/lib/i18n/context'
import { useRouter } from 'next/navigation'

const TILES = [
  { key: 'hub_launcher_field',      subKey: 'hub_launcher_field_sub',      tab: 'inventory' },
  { key: 'hub_launcher_studio',     subKey: 'hub_launcher_studio_sub',     tab: 'overview' },
  { key: 'hub_launcher_commercial', subKey: 'hub_launcher_commercial_sub', tab: 'pipeline' },
  { key: 'hub_launcher_admin',      subKey: 'hub_launcher_admin_sub',      tab: 'contacts' },
] as const

export function HubLauncherClient() {
  const { t } = useI18n()
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="t-label" style={{ fontSize: 11, letterSpacing: 2, opacity: 0.5 }}>{t('hub_launcher_subtitle')}</div>
        <div className="serif s-lg" style={{ marginTop: 8 }}>{t('hub_launcher_title')}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, width: '100%', maxWidth: 480 }}>
        {TILES.map(({ key, subKey, tab }) => (
          <button
            key={key}
            type="button"
            className="btn ghost"
            onClick={() => router.push(`/atelier?tab=${tab}`)}
            style={{
              minHeight: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '16px 18px',
              gap: 6,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t(key)}</span>
            <span style={{ fontSize: 10, opacity: 0.5, letterSpacing: 0.5 }}>{t(subKey)}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn primary"
        onClick={() => router.push('/atelier')}
        style={{ minHeight: 44, fontSize: 12, letterSpacing: 1 }}
      >
        {t('hub_launcher_enter_atelier')}
      </button>
    </div>
  )
}
