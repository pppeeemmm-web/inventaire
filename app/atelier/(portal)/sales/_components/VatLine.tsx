'use client'

// VAT line under a sale's final price (Pem 2026-11-18: « where is VAT »). The rate is read from the
// works (`Oeuvres.tva_rate`, set on the work card) — never invented. Pem's VAT status is still open
// with the accountant: every work holds 0 today (the card's default), so 0 / empty reads « à définir ».
// The final price is the price the buyer pays (TTC); HT = TTC / (1 + rate).

import { useI18n } from '@/lib/i18n/context'

export function vatOf(price: number, rate: number): { ht: number; vat: number } {
  const ht = Math.round((price / (1 + rate / 100)) * 100) / 100
  return { ht, vat: Math.round((price - ht) * 100) / 100 }
}

/** One rate for the order, `'mixed'` when the works disagree, or null when none is set. */
export function orderVatRate(rates: (number | null | undefined)[]): number | 'mixed' | null {
  const set = [...new Set(rates.map((r) => Number(r ?? 0)).filter((r) => r > 0))]
  if (set.length === 0) return null
  if (set.length > 1 || rates.some((r) => !(Number(r ?? 0) > 0))) return 'mixed'
  return set[0]
}

export function VatLine({ price, rates, currency = 'EUR' }: { price: number | null; rates: (number | null | undefined)[]; currency?: string }) {
  const { t, lang } = useI18n()
  const fmt = (n: number) => new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
  const rate = orderVatRate(rates)
  const text = rate === null ? t('ord_vat_tbd')
    : rate === 'mixed' ? t('ord_vat_mixed')
    : price && price > 0
      ? (() => { const v = vatOf(price, rate); return t('ord_vat_line').replace('{rate}', String(rate)).replace('{vat}', fmt(v.vat)).replace('{ht}', fmt(v.ht)).replace('{ttc}', fmt(price)) })()
      : `${t('ord_vat_line').split(':')[0]}`.replace('{rate}', String(rate))
  return (
    <div data-testid="order-vat" title={t('ord_vat_tt')} style={{ fontSize: 12, color: rate === null || rate === 'mixed' ? 'var(--yellow, var(--ac))' : 'var(--tx2)', marginTop: 6 }}>
      {text}
    </div>
  )
}
