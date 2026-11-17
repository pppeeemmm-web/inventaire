'use client'

// House rule (Pem 2026-11-17, docs/LEGAL_POLICY.md decision 6): sale money stays « en attente »
// until the sale is delivered and its 14-day return period is over; the year totals count only
// definitive money. This line says so and shows what is apart (lib/sales/sale-money.ts).

import { useI18n } from '@/lib/i18n/context'

export function MoneyApart({ held, toRefund, fmtEur }: { held: number; toRefund: number; fmtEur: (n: number) => string }) {
  const { t } = useI18n()
  return (
    <div data-testid="fiscal-money-apart" style={{ border: '1px solid var(--bd)', padding: '10px 14px', marginBottom: 20, background: 'var(--bg1)', fontSize: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 24px' }}>
        <span>{t('fiscal_money_held')} <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEur(held)}</strong></span>
        {toRefund > 0 && (
          <span style={{ color: 'var(--rust)' }}>{t('fiscal_money_refund')} <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtEur(toRefund)}</strong></span>
        )}
      </div>
      <div style={{ color: 'var(--tx3)', marginTop: 4, lineHeight: 1.4 }}>{t('fiscal_money_definitive_hint')}</div>
    </div>
  )
}
