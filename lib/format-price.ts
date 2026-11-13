// Prices in narrow table cells (owner 2026-11-13): above 4 digits, short form (K / M / Md·B) so a big
// amount never runs into the next column; the exact amount goes in the hover title.
import type { Lang } from '@/lib/i18n/dictionary'

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR')

export function formatPriceFull(n: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export function formatPriceCompact(n: number, lang: Lang): string {
  if (Math.abs(n) < 10_000) return formatPriceFull(n, lang)
  return new Intl.NumberFormat(locale(lang), {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}
