/**
 * A contact's links as one clickable row (TODO §1 social links, option A, 2026-11-19): the website is one of
 * the links (Pem). Stores: `contact_websites` (url) and `contact_socials` (platform + handle). The old
 * `Contact.Website / Instagram / LinkedIn / Facebook / Twitter` columns are no longer read
 * (copied by supabase/sql/contact_links_from_columns.sql).
 */

export type ContactLink = { kind: 'site' | string; label: string; href: string }

const PROFILE_BASE: Record<string, string> = {
  Instagram: 'https://www.instagram.com/',
  LinkedIn: 'https://www.linkedin.com/in/',
  Facebook: 'https://www.facebook.com/',
  X: 'https://x.com/',
  Behance: 'https://www.behance.net/',
  Vimeo: 'https://vimeo.com/',
  Pinterest: 'https://www.pinterest.com/',
}

/** Short glyph shown in the round button; the full name is the button's accessible label. */
export const LINK_GLYPH: Record<string, string> = {
  site: '🌐',
  Instagram: 'IG',
  LinkedIn: 'in',
  Facebook: 'f',
  X: 'X',
  Behance: 'Bē',
  Vimeo: 'V',
  Pinterest: 'P',
}

/** `https://…` kept; a bare domain gets `https://`; anything else (spaces, no dot) → null. */
export function webHref(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (/\s/.test(v) || !/\.[a-z]{2,}/i.test(v)) return null
  return `https://${v.replace(/^\/+/, '')}`
}

/** A handle (`@name`, `name`) or a full URL → the profile URL; null when it cannot be opened. */
export function socialHref(platform: string, handle: string | null | undefined): string | null {
  const v = (handle ?? '').trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  if (/^(www\.)?[a-z0-9-]+\.[a-z]{2,}\//i.test(v)) return `https://${v}`
  const base = PROFILE_BASE[platform]
  if (!base) return webHref(v)
  const name = v.replace(/^@/, '')
  return /^[\w.\-]+$/.test(name) ? base + name : null
}

export function contactLinks(
  websites: { url: string; label?: string | null }[],
  socials: { platform: string; handle: string }[],
): ContactLink[] {
  const out: ContactLink[] = []
  for (const w of websites) {
    const href = webHref(w.url)
    if (href) out.push({ kind: 'site', label: w.label?.trim() || href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, ''), href })
  }
  for (const s of socials) {
    const href = socialHref(s.platform, s.handle)
    if (href) out.push({ kind: s.platform, label: `${s.platform === 'X' ? 'X' : s.platform} · ${s.handle.trim()}`, href })
  }
  return out
}
