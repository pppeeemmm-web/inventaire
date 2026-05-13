import type { DictKey } from '@/lib/i18n/dictionary'

/** Canonical option values (existing DB rows); labels come from `t(stock_cat_*)`. */
export const STOCK_CATEGORY_VALUES = [
  'Additif',
  'Autre',
  "Couleur à l'huile",
  'Liant',
  'Lin',
  'Medium à peindre',
  'Papier',
  'Pigment',
  'Pinceau',
  'Primer',
  'Solvent',
] as const

export const STOCK_CATEGORY_TO_KEY: Record<string, DictKey> = {
  Additif: 'stock_cat_additive',
  Autre: 'stock_cat_other',
  "Couleur à l'huile": 'stock_cat_oil_colour',
  Liant: 'stock_cat_binder',
  Lin: 'stock_cat_linen',
  'Medium à peindre': 'stock_cat_painting_medium',
  Papier: 'stock_cat_paper',
  Pigment: 'stock_cat_pigment',
  Pinceau: 'stock_cat_brush',
  Primer: 'stock_cat_primer',
  Solvent: 'stock_cat_solvent',
}

export function labelStockCategory(value: string, t: (k: DictKey) => string): string {
  const key = STOCK_CATEGORY_TO_KEY[value]
  return key ? t(key) : value
}
