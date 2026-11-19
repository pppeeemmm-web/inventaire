// Collector share kit (TODO 11b, Pem build GO 2026-11-18) — shared types and pure helpers.
// Design: docs/design/2026-11-18/Collector_ShareKit.notes.md (Pem's 8 answers override the draft).
// Importable from client and server (no 'use server', no DB).

import { MAX_WORKS } from '@/lib/portfolio-pdf-types'
import { contactProseLabel } from '@/lib/contacts/contact-display'

/** Pem 2026-11-18 (answer 5): links valid 14 days by default. */
export const KIT_DEFAULT_DAYS = 14
/** Same cap as the portfolio PDF engine (one PDF page per work). */
export const KIT_MAX_WORKS = MAX_WORKS
/** ~128 bits with nanoid's 64-character alphabet; the SQL refuses shorter tokens. */
export const KIT_TOKEN_LENGTH = 22
export const KIT_MESSAGE_MAX = 1000
/** Enquiries from one kit per 24 h (a forwarded link cannot flood the Triage deck). */
export const KIT_ENQUIRIES_PER_DAY = 10
/** « expire dans 3 j » warning on the kit row. */
export const KIT_EXPIRY_WARN_DAYS = 3

export type KitLang = 'fr' | 'en'

/** Where the « Partager à un collectionneur… » sheet starts from. */
export type KitSource =
  | { kind: 'group'; groupId: string }
  | { kind: 'works'; oeuvreIds: number[] }
  | { kind: 'contact'; contactId: number }

/** One work offered in the sheet (team side). */
export interface KitDraftWork {
  oeuvreId: number
  title: string | null
  year: number | null
  size: string
  thumb: string | null
  /** Pem 2026-11-18 (answer 8): public works only — a private work is listed but cannot be ticked. */
  isPublic: boolean
  /** Catalogue price incl. tax (Prix final ?? Prix, × (1 + TVA)), null when the work has none. */
  price: number | null
  statusId: number | null
}

export interface KitDraft {
  groupName: string | null
  works: KitDraftWork[]
}

export interface KitContactHit {
  contactId: number
  name: string
  hint: string | null
}

export interface KitGroupHit {
  id: string
  name: string
  count: number
}

/** A kit row on the contact card. */
export interface KitSummary {
  token: string
  groupName: string | null
  workCount: number
  lang: KitLang
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  viewCount: number
  firstOpenedAt: string | null
  lastOpenedAt: string | null
  pdfMadeAt: string | null
  pdfDownloads: number
  enquiryCount: number
}

export type KitState = 'active' | 'expired' | 'revoked'

export function kitState(k: { expiresAt: string | null; revokedAt: string | null }, now = Date.now()): KitState {
  if (k.revokedAt) return 'revoked'
  if (k.expiresAt && new Date(k.expiresAt).getTime() <= now) return 'expired'
  return 'active'
}

/** Whole days left (ceil), or null when no expiry. */
export function kitDaysLeft(expiresAt: string | null, now = Date.now()): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000)
}

/** Availability shown to the collector. A sold work stays, greyed « Vendue » (Pem answer 7). */
export type KitAvailability = 'available' | 'reserved' | 'sold' | 'unavailable' | null

export function kitAvailability(statusId: number | null): KitAvailability {
  switch (statusId) {
    case 2: return 'available'
    case 4: return 'reserved'
    case 6: return 'sold'
    case 11: return 'unavailable' // gift: gone, like a sale
    default: return null          // consigned / lent / other: say nothing
  }
}

/** Price incl. tax from the work's catalogue fields (the app stores HT + `tva_rate`). */
export function kitPriceFromWork(w: { Prix: number | null; PrixFinal: number | null; tva_rate: number | null }): number | null {
  const base = w.PrixFinal ?? w.Prix
  if (base == null || !Number.isFinite(base) || base <= 0) return null
  const rate = w.tva_rate ?? 0
  return Math.round(base * (1 + rate / 100) * 100) / 100
}

export function formatKitPrice(price: number, lang: KitLang): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price)
}

export function kitSize(w: { Hauteur: string | null; Largeur: string | null; Profondeur: string | null }): string {
  const p = [w.Hauteur, w.Largeur, w.Profondeur].map((x) => (x ?? '').trim()).filter(Boolean)
  return p.length ? `${p.join(' × ')} cm` : ''
}

/** Full name for the page (Pem answer 4): person first (`Marie DUPONT`), else the institution. */
export function kitContactName(c: { Prénom: string | null; Nom: string | null; NomInstitution: string | null }): string {
  return contactProseLabel(c, { institution: 'none', fallback: '' })
}

/**
 * Link-preview robots and prefetches are not counted as opens (WhatsApp / iMessage / Slack fetch the page
 * when the link is pasted, before the collector looks).
 */
const PREVIEW_BOT_RE =
  /(whatsapp|facebookexternalhit|facebot|meta-externalagent|twitterbot|slackbot|slack-imgproxy|discordbot|telegrambot|linkedinbot|skypeuripreview|applebot|iframely|embedly|pinterest|redditbot|googlebot|bingbot|duckduckbot|yandex|baiduspider|bot\b|crawler|spider|preview|headless|curl\/|wget\/|python-requests|okhttp)/i

export function isPreviewOrPrefetch(h: { get(name: string): string | null }): boolean {
  const ua = h.get('user-agent') ?? ''
  if (!ua.trim()) return true
  if (PREVIEW_BOT_RE.test(ua)) return true
  // iMessage's link preview identifies as Safari + facebookexternalhit/Twitterbot (caught above).
  const purpose = `${h.get('purpose') ?? ''} ${h.get('sec-purpose') ?? ''} ${h.get('x-purpose') ?? ''}`.toLowerCase()
  if (purpose.includes('prefetch') || purpose.includes('preview')) return true
  if (h.get('next-router-prefetch') || h.get('x-middleware-prefetch')) return true
  return false
}

/** Public base URL for the link the team copies (no trailing slash). */
export function kitPublicUrl(token: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/c/${token}`
}
