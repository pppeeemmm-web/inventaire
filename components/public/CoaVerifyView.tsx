'use client'

import { useI18n } from '@/lib/i18n/context'
import type { CoaVerifyOutcome } from '@/lib/types/coa-verify'

export function CoaVerifyView({ outcome }: { outcome: CoaVerifyOutcome }) {
  const { t, lang } = useI18n()

  const fmtDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return iso
    }
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: 'clamp(24px, 6vw, 48px) clamp(16px, 4vw, 32px)',
        fontFamily: 'var(--font-ui, Sofia Sans, system-ui, sans-serif)',
        color: 'var(--tx, #2a2824)',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--tx3, #8a8580)' }}>
        {t('coa_verify_kicker')}
      </div>
      <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', fontWeight: 600, marginTop: 8, marginBottom: 24 }}>
        {t('coa_verify_title')}
      </h1>

      {!outcome.ok && outcome.reason === 'invalid_id' && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)' }}>{t('coa_verify_invalid_id')}</p>
      )}
      {!outcome.ok && outcome.reason === 'not_found' && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)' }}>{t('coa_verify_not_found')}</p>
      )}
      {!outcome.ok && outcome.reason === 'tampered' && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--rust, #a44)' }}>{t('coa_verify_tampered')}</p>
      )}
      {!outcome.ok && outcome.reason === 'config' && (
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--tx2)' }}>{t('coa_verify_config')}</p>
      )}

      {outcome.ok && (
        <div
          style={{
            border: '1px solid var(--bd, #e6e2dc)',
            borderRadius: 12,
            padding: 24,
            background: 'var(--bg1, #faf8f5)',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--sage, #3d6)',
              border: '1px solid var(--sage, #3d6)',
              padding: '4px 10px',
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            {t('coa_verify_badge_valid')}
          </div>
          <dl style={{ margin: 0, display: 'grid', gap: 12, fontSize: 14 }}>
            <div>
              <dt style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>{t('coa_verify_field_work')}</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{outcome.titre}</dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>{t('coa_verify_field_year')}</dt>
              <dd style={{ margin: 0 }}>{outcome.anneeDisplay}</dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>{t('coa_verify_field_cert_id')}</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{outcome.certId}</dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: 'var(--tx3)', marginBottom: 4 }}>{t('coa_verify_field_issued')}</dt>
              <dd style={{ margin: 0 }}>{fmtDate(outcome.issuedAt)}</dd>
            </div>
          </dl>
          <p style={{ marginTop: 20, fontSize: 12, lineHeight: 1.5, color: 'var(--tx3)' }}>{t('coa_verify_disclaimer')}</p>
        </div>
      )}
    </div>
  )
}
