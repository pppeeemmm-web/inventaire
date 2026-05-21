/**
 * Auto-append rules for Oeuvres.Historique (provenance / custody log).
 * French lines match existing manual entries in the catalogue.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type HistoriqueContact = {
  NomInstitution?: string | null
  Nom?: string | null
  Prénom?: string | null
  Ville?: string | null
  Pays?: string | null
}

const STATUS_FR: Record<number, string> = {
  1: 'En production',
  2: 'Disponible',
  4: 'Réservé',
  5: 'Archive privée',
  6: 'Vendu',
  7: 'Consigné',
  8: 'Prêt',
  11: 'Don',
  3: 'Archive artiste',
}

export function historiqueDateStr(d = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '/')
}

export function contactDisplayName(c: HistoriqueContact | null | undefined): string {
  if (!c) return '—'
  const inst = c.NomInstitution?.trim()
  if (inst) return inst
  const person = `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim()
  return person || '—'
}

export function formatLocationHistoriqueLine(c: HistoriqueContact | null | undefined, date = historiqueDateStr()): string {
  const name = contactDisplayName(c)
  const loc = [c?.Ville, c?.Pays].filter(Boolean).join(', ')
  return `${date} - ${name} - ${loc || '?'}`
}

export function formatGiftHistoriqueLine(recipientName: string, date = historiqueDateStr()): string {
  return `[${date}] Don à ${recipientName}`
}

export function formatSoldHistoriqueLine(buyerName: string, date = historiqueDateStr()): string {
  return `[${date}] Vendu à ${buyerName}`
}

export function formatReservedHistoriqueLine(name: string, date = historiqueDateStr()): string {
  return `[${date}] Réservé — ${name}`
}

export function formatConsignedHistoriqueLine(name: string, date = historiqueDateStr()): string {
  return `[${date}] Consigné — ${name}`
}

export function formatLoanHistoriqueLine(name: string, date = historiqueDateStr()): string {
  return `[${date}] Prêt — ${name}`
}

export function formatReturnAtelierHistoriqueLine(date = historiqueDateStr()): string {
  return `[${date}] Retour atelier`
}

export function formatStatusTransitionHistoriqueLine(
  fromStatusId: number | null | undefined,
  toStatusId: number | null | undefined,
  date = historiqueDateStr(),
): string {
  const from = fromStatusId != null ? (STATUS_FR[fromStatusId] ?? `statut ${fromStatusId}`) : '?'
  const to = toStatusId != null ? (STATUS_FR[toStatusId] ?? `statut ${toStatusId}`) : '?'
  return `[${date}] ${from} → ${to}`
}

/** Merge new lines; skip exact duplicates already present. */
export function mergeHistoriqueLines(base: string | null | undefined, lines: string[]): string {
  const existing = (base ?? '').trim()
  const toAdd = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((line) => {
      if (!existing) return true
      return !existing.split('\n').some((row) => row.trim() === line)
    })
  if (!toAdd.length) return existing
  return existing ? `${existing}\n${toAdd.join('\n')}` : toAdd.join('\n')
}

function ownershipHistoriqueLine(
  fromStatusId: number | null | undefined,
  toStatusId: number | null | undefined,
  contact: HistoriqueContact | null | undefined,
  date: string,
): string | null {
  if (toStatusId == null || fromStatusId === toStatusId) return null
  const name = contactDisplayName(contact)
  switch (toStatusId) {
    case 11:
      return formatGiftHistoriqueLine(name, date)
    case 6:
      return formatSoldHistoriqueLine(name, date)
    case 4:
      return formatReservedHistoriqueLine(name, date)
    case 7:
      return formatConsignedHistoriqueLine(name, date)
    case 8:
      return formatLoanHistoriqueLine(name, date)
    case 2:
      if (fromStatusId === 7 || fromStatusId === 8) return formatReturnAtelierHistoriqueLine(date)
      return formatStatusTransitionHistoriqueLine(fromStatusId, toStatusId, date)
    default:
      return formatStatusTransitionHistoriqueLine(fromStatusId, toStatusId, date)
  }
}

export type OeuvreHistoriqueBefore = {
  statusId: number | null
  ContactID: number | null
  LocalisationID: number | null
  Historique?: string | null
}

export type OeuvreHistoriqueAfter = {
  statusId: number | null
  contactId: number | null
  localisationId: number | null
}

async function fetchContactsById(
  supabase: SupabaseClient,
  ids: number[],
): Promise<Map<number, HistoriqueContact>> {
  const uniq = [...new Set(ids.filter((id) => id > 0))]
  const map = new Map<number, HistoriqueContact>()
  if (!uniq.length) return map
  const { data } = await supabase
    .from('Contact')
    .select('ContactID, Nom, "Prénom", NomInstitution, Ville, Pays')
    .in('ContactID', uniq)
  for (const row of data ?? []) {
    map.set(row.ContactID as number, row as HistoriqueContact)
  }
  return map
}

/** Lines to append when ownership and/or custody location changes. */
export async function historiqueLinesForOeuvreUpdate(
  supabase: SupabaseClient,
  before: OeuvreHistoriqueBefore,
  after: OeuvreHistoriqueAfter,
): Promise<string[]> {
  const date = historiqueDateStr()
  const beforeLoc = before.LocalisationID ?? before.ContactID
  const afterLoc = after.localisationId ?? after.contactId
  const statusChanged = after.statusId != null && before.statusId !== after.statusId
  const locationChanged =
    afterLoc != null && beforeLoc !== afterLoc && !(beforeLoc == null && afterLoc == null)

  const contactIds: number[] = []
  if (locationChanged && afterLoc != null) contactIds.push(afterLoc)
  if (statusChanged && after.contactId != null && [4, 6, 7, 8, 11].includes(after.statusId!)) {
    contactIds.push(after.contactId)
  }

  const contacts = await fetchContactsById(supabase, contactIds)
  const lines: string[] = []

  if (statusChanged) {
    const c =
      after.contactId != null ? contacts.get(after.contactId) : undefined
    const own = ownershipHistoriqueLine(before.statusId, after.statusId, c, date)
    if (own) lines.push(own)
  }

  if (locationChanged && afterLoc != null) {
    lines.push(formatLocationHistoriqueLine(contacts.get(afterLoc), date))
  }

  return lines
}

/** Apply historique appends for one or many works (best-effort per row). */
export async function appendHistoriqueForOeuvres(
  supabase: SupabaseClient,
  items: { oeuvreId: number; lines: string[] }[],
): Promise<void> {
  const withLines = items.filter((i) => i.lines.length > 0)
  if (!withLines.length) return

  const ids = withLines.map((i) => i.oeuvreId)
  const { data: rows, error } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Historique')
    .in('OeuvreID', ids)
  if (error) {
    console.error('[oeuvre-historique] select:', error.message)
    return
  }

  const byId = new Map((rows ?? []).map((r) => [r.OeuvreID as number, r.Historique as string | null]))

  for (const { oeuvreId, lines } of withLines) {
    const merged = mergeHistoriqueLines(byId.get(oeuvreId), lines)
    const { error: upErr } = await supabase
      .from('Oeuvres')
      .update({ Historique: merged })
      .eq('OeuvreID', oeuvreId)
    if (upErr) console.error(`[oeuvre-historique] update #${oeuvreId}:`, upErr.message)
  }
}
