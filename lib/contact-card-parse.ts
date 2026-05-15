/**
 * Deterministic business-card OCR / paste text → ImportedContact.
 */

import type { ImportedContact } from '@/lib/contact-import-types'
import { emptyImportedContact, mergeImportedContacts } from '@/lib/contact-url-enrich'

const MAX_TEXT = 8000

function splitNameLine(line: string): { prenom: string | null; nom: string | null } {
  const trimmed = line.trim().slice(0, 120)
  if (!trimmed) return { prenom: null, nom: null }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { prenom: null, nom: parts[0] ?? null }
  return {
    prenom: parts.slice(0, -1).join(' '),
    nom: parts[parts.length - 1] ?? null,
  }
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '').slice(0, 40)
}

function lineLooksLikeUrl(line: string): boolean {
  return /^https?:\/\//i.test(line.trim())
}

export function extractContactFromCardText(raw: string): { draft: ImportedContact; sources: string[] } {
  const text = raw.trim().slice(0, MAX_TEXT)
  const sources: string[] = ['carte (texte)']
  const draft = emptyImportedContact()
  draft.role = 'other'

  if (!text) {
    return { draft, sources }
  }

  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w{2,}/i)?.[0]
  if (emailMatch) {
    draft.emails.push({ email: emailMatch.toLowerCase(), label: 'Carte' })
    sources.push('email')
  }

  const phoneMatch = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim()
  if (phoneMatch) {
    const digits = normalizePhone(phoneMatch)
    if (digits) {
      draft.phones.push({ country_code: null, phone: digits, label: 'Carte' })
      sources.push('téléphone')
    }
  }

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const usedLines = new Set<string>()

  if (emailMatch) usedLines.add(emailMatch)
  if (phoneMatch) usedLines.add(phoneMatch)

  const nameLine =
    lines.find((l) => {
      if (usedLines.has(l)) return false
      if (l.includes('@')) return false
      if (/^\+?\d[\d\s().-]{7,}\d$/.test(l.replace(/\s/g, ''))) return false
      if (lineLooksLikeUrl(l)) return false
      return l.length >= 2
    }) ?? lines[0] ?? ''

  if (nameLine) {
    const { prenom, nom } = splitNameLine(nameLine)
    draft.prenom = prenom
    draft.nom = nom ?? 'Contact (carte)'
    usedLines.add(nameLine)
    sources.push('nom')
  } else {
    draft.nom = 'Contact (carte)'
  }

  const orgLine = lines.find((l) => {
    if (usedLines.has(l)) return false
    if (l.length < 4) return false
    if (l.includes('@')) return false
    if (/^\+?\d[\d\s().-]{7,}\d$/.test(l.replace(/\s/g, ''))) return false
    return true
  })
  if (orgLine) {
    draft.institution = orgLine.slice(0, 120)
    usedLines.add(orgLine)
    sources.push('institution')
  }

  for (const l of lines) {
    if (usedLines.has(l)) continue
    if (lineLooksLikeUrl(l) && !draft.websites.some((w) => w.url === l)) {
      draft.websites.push({ url: l.split(/\s/)[0]!.slice(0, 500), label: 'Carte' })
      sources.push('site')
    }
  }

  draft.notes = text
  return { draft, sources: [...new Set(sources)] }
}

/** When both OCR and paste exist, merge paste-derived fields over OCR draft gaps. */
export function mergeCardTextWithDraft(ocrDraft: ImportedContact, pastedText: string): ImportedContact {
  const paste = pastedText.trim()
  if (!paste) return ocrDraft
  const { draft: fromPaste } = extractContactFromCardText(paste)
  return mergeImportedContacts(ocrDraft, {
    prenom: ocrDraft.prenom ?? fromPaste.prenom,
    nom: (ocrDraft.nom === 'Contact (carte)' ? null : ocrDraft.nom) ?? fromPaste.nom,
    institution: ocrDraft.institution ?? fromPaste.institution,
    role: ocrDraft.role ?? fromPaste.role,
    notes: [ocrDraft.notes, fromPaste.notes].filter(Boolean).join('\n---\n').slice(0, 12_000) || null,
    emails: ocrDraft.emails.length ? ocrDraft.emails : fromPaste.emails,
    phones: ocrDraft.phones.length ? ocrDraft.phones : fromPaste.phones,
    websites: [...ocrDraft.websites, ...fromPaste.websites],
    addresses: [...ocrDraft.addresses, ...fromPaste.addresses],
  })
}

export function hasCardIdentity(c: ImportedContact): boolean {
  return Boolean(c.prenom || c.nom || c.institution)
}
