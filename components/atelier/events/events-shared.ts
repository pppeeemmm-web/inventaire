// R6 — small helpers shared by the event screens (desktop + phone).

import type { CSSProperties } from 'react'
import type { DictKey, Lang } from '@/lib/i18n/dictionary'
import { contactListLabel } from '@/lib/contacts/contact-display'

export type EventContact = {
  ContactID: number
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Ville?: string | null
}

export function contactName(c: EventContact | undefined | null, id?: number | null): string {
  if (!c) return id != null ? `#${id}` : '—'
  return contactListLabel(c)
}

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'fr-FR')

export function fmtDay(iso: string | null | undefined, lang: Lang, withYear = false): string {
  if (!iso) return '—'
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return d.toLocaleDateString(locale(lang), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export function fmtMoney(n: number | null | undefined, lang: Lang): string {
  if (n == null) return '—'
  return `${n.toLocaleString(locale(lang), { maximumFractionDigits: 0 })} €`
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Days from today to an ISO day (negative = past). */
export function daysUntil(iso: string): number {
  const a = new Date(`${todayIso()}T12:00:00Z`).getTime()
  const b = new Date(`${iso.slice(0, 10)}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

export const chipStyle = (bg: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 20, padding: '0 4px',
  fontSize: 11, fontWeight: 600, borderRadius: 3, background: bg, color: 'var(--bg0)', flexShrink: 0,
})

export const EVENT_CHIP_BG: Record<string, string> = { exposition: 'var(--ac)', collaboration: '#6080c0', edition: '#a060a0' }
export const ORDER_CHIP_BG: Record<string, string> = { loan: '#60a0a0', consignment: '#c8a86e', sale: '#4caf82', entrusted: '#a060a0', gift: '#c06060' }

/** « 1 œuvre » / « {n} œuvres »: the `_one` key for 1, the `_fmt` key otherwise. */
export function countText(t: (k: DictKey) => string, n: number, fmtKey: DictKey, oneKey: DictKey): string {
  return n === 1 ? t(oneKey) : t(fmtKey).replace('{n}', String(n))
}
