'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/lib/i18n/context'

export function LoginChrome({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n()

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg0)' }}>
      <div style={{ width: 320 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, border: '1px solid var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ac)', fontSize: 14, fontFamily: "'Instrument Serif', serif", marginBottom: 20 }}>P</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <div style={{ display: 'flex', border: '1px solid var(--bd)', fontSize: 10, letterSpacing: 1 }}>
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  style={{
                    padding: '4px 10px',
                    background: lang === l ? 'var(--ac)' : 'transparent',
                    color: lang === l ? 'var(--bg0)' : 'var(--tx3)',
                    fontWeight: lang === l ? 600 : 400,
                    border: 'none',
                    borderRight: l === 'fr' ? '1px solid var(--bd)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="serif s-md" style={{ marginBottom: 8 }}>{t('atelier')}</div>
          <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>{t('login_restricted')}</div>
        </div>
        {children}
      </div>
    </div>
  )
}
