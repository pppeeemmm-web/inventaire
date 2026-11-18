import type { DictKey } from '@/lib/i18n/dictionary'

/**
 * Enquiry reasons (R8). `supabase/sql/enquiry_categories.sql` widens `inquiry_category_check` to
 * buy / commission / show / press. Until it runs (flag false), the public form stores those four as
 * `general` with « Motif : … » as the message's first line (the CHECK would refuse the row otherwise).
 * SQL applied live 2026-11-18 (flag on).
 */
export const ENQUIRY_CATEGORIES_SQL_LIVE = true

export const PROSPECT_REASONS = ['buy', 'commission', 'show', 'press'] as const
export type ProspectReason = (typeof PROSPECT_REASONS)[number]

export const PROSPECT_REASON_KEYS: Record<ProspectReason, DictKey> = {
  buy: 'enquiry_reason_buy',
  commission: 'enquiry_reason_commission',
  show: 'enquiry_reason_show',
  press: 'enquiry_reason_press',
}

export function isProspectReason(v: string): v is ProspectReason {
  return (PROSPECT_REASONS as readonly string[]).includes(v)
}

const OTHER_KEYS: Record<string, DictKey> = {
  general: 'enquiry_category_general',
  question: 'enquiry_category_question',
  complaint: 'enquiry_category_complaint',
  shipping: 'enquiry_category_shipping',
  other: 'enquiry_category_other',
}

/** Label key of a stored `inquiry.category` (null for an unknown value). */
export function enquiryCategoryKey(category: string): DictKey | null {
  return isProspectReason(category) ? PROSPECT_REASON_KEYS[category] : OTHER_KEYS[category] ?? null
}
