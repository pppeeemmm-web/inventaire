import type { Lang } from '@/lib/i18n/dictionary'
import { supplierDisplayName, type StockContactLike } from '@/lib/stock-item'

export type SupplierExportDetail = {
  id: number
  name: string
  role: string | null
  emails: string[]
  phones: string[]
  addressLines: string[]
  website: string | null
  notes: string | null
}

type ContactScalar = {
  ContactID: number
  NomInstitution: string | null
  Nom: string | null
  Prénom: string | null
  Role: string | null
  Email: string | null
  IndicatifPays1: string | null
  Téléphone1: string | null
  Website: string | null
  Adresse: string | null
  CodePostal: string | null
  Ville: string | null
  Pays: string | null
  Notes: string | null
}

type AddrRow = {
  contact_id: number
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  position: number
}

type EmailRow = { contact_id: number; email: string; is_primary: boolean }
type PhoneRow = {
  contact_id: number
  country_code: string | null
  phone: string
  is_primary: boolean
}

function fmtPhone(ind: string | null | undefined, num: string | null | undefined): string | null {
  if (!num?.trim()) return null
  const n = num.trim()
  return ind?.trim() ? `${ind.trim()} ${n}` : n
}

function joinCityLine(
  adresse: string | null | undefined,
  cp: string | null | undefined,
  ville: string | null | undefined,
  pays: string | null | undefined,
): string[] {
  const lines: string[] = []
  if (adresse?.trim()) lines.push(adresse.trim())
  const city = [cp?.trim(), ville?.trim()].filter(Boolean).join(' ')
  if (city) lines.push(city)
  if (pays?.trim()) lines.push(pays.trim())
  return lines
}

function addressLinesForContact(
  c: ContactScalar,
  addrs: AddrRow[],
): string[] {
  const sorted = [...addrs].sort((a, b) => a.position - b.position)
  const row = sorted[0]
  if (row) {
    const fromAddr = joinCityLine(row.adresse, row.code_postal, row.ville, row.pays)
    if (fromAddr.length) return fromAddr
  }
  return joinCityLine(c.Adresse, c.CodePostal, c.Ville, c.Pays)
}

function uniqueStrings(items: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const s = raw?.trim()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

export function buildSupplierExportDetails(
  contacts: ContactScalar[],
  addresses: AddrRow[],
  emails: EmailRow[],
  phones: PhoneRow[],
  orderIds: number[],
): SupplierExportDetail[] {
  const byId = new Map(contacts.map((c) => [c.ContactID, c]))
  const addrsBy = new Map<number, AddrRow[]>()
  for (const a of addresses) {
    const list = addrsBy.get(a.contact_id) ?? []
    list.push(a)
    addrsBy.set(a.contact_id, list)
  }
  const emailsBy = new Map<number, EmailRow[]>()
  for (const e of emails) {
    const list = emailsBy.get(e.contact_id) ?? []
    list.push(e)
    emailsBy.set(e.contact_id, list)
  }
  const phonesBy = new Map<number, PhoneRow[]>()
  for (const p of phones) {
    const list = phonesBy.get(p.contact_id) ?? []
    list.push(p)
    phonesBy.set(p.contact_id, list)
  }

  const blocks: SupplierExportDetail[] = []
  for (const id of orderIds) {
    const c = byId.get(id)
    if (!c) continue
    const emailRows = emailsBy.get(id) ?? []
    const primEmail = emailRows.find((e) => e.is_primary)?.email ?? emailRows[0]?.email
    const phoneRows = phonesBy.get(id) ?? []
    const primPhone = phoneRows.find((p) => p.is_primary) ?? phoneRows[0]
    const phoneList = uniqueStrings([
      primPhone ? fmtPhone(primPhone.country_code, primPhone.phone) : null,
      ...phoneRows.map((p) => fmtPhone(p.country_code, p.phone)),
      fmtPhone(c.IndicatifPays1, c.Téléphone1),
    ])
    blocks.push({
      id,
      name: supplierDisplayName(c as StockContactLike),
      role: c.Role,
      emails: uniqueStrings([primEmail, ...emailRows.map((e) => e.email), c.Email]),
      phones: phoneList,
      addressLines: addressLinesForContact(c, addrsBy.get(id) ?? []),
      website: c.Website?.trim() || null,
      notes: c.Notes?.trim() || null,
    })
  }
  return blocks
}

export function formatSupplierPlainBlock(
  d: SupplierExportDetail,
  labels: { contact: string; address: string; notes: string },
): string {
  const lines: string[] = [d.name]
  if (d.role?.trim()) lines.push(d.role.trim())
  const contactBits = [...d.emails, ...d.phones]
  if (d.website) contactBits.push(d.website)
  if (contactBits.length) {
    lines.push(`${labels.contact}:`)
    contactBits.forEach((b) => lines.push(`  ${b}`))
  }
  if (d.addressLines.length) {
    lines.push(`${labels.address}:`)
    d.addressLines.forEach((l) => lines.push(`  ${l}`))
  }
  if (d.notes) {
    lines.push(`${labels.notes}:`)
    lines.push(`  ${d.notes.replace(/\n/g, '\n  ')}`)
  }
  return lines.join('\n')
}

export function buildSuppliersPlainText(
  blocks: SupplierExportDetail[],
  title: string,
  date: string,
  labels: { contact: string; address: string; notes: string },
): string {
  const header = `${title} — ${date}\n${'—'.repeat(Math.max(24, title.length))}\n`
  const body = blocks
    .map((b, i) => {
      const block = formatSupplierPlainBlock(b, labels)
      return i < blocks.length - 1 ? `${block}\n` : block
    })
    .join('\n\n')
  return `${header}\n${body}\n`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildSuppliersPrintHtml(
  blocks: SupplierExportDetail[],
  title: string,
  date: string,
  lang: Lang,
  labels: {
    contact: string
    address: string
    notes: string
    generated: string
  },
): string {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const cards = blocks
    .map((d) => {
      const contactBits = [...d.emails, ...d.phones]
      if (d.website) contactBits.push(d.website)
      const contactHtml = contactBits.length
        ? `<div class="lbl">${escapeHtml(labels.contact)}</div><ul>${contactBits.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
        : ''
      const addrHtml = d.addressLines.length
        ? `<div class="lbl">${escapeHtml(labels.address)}</div><p>${d.addressLines.map((l) => escapeHtml(l)).join('<br>')}</p>`
        : ''
      const notesHtml = d.notes
        ? `<div class="lbl">${escapeHtml(labels.notes)}</div><p class="notes">${escapeHtml(d.notes).replace(/\n/g, '<br>')}</p>`
        : ''
      const roleHtml = d.role?.trim()
        ? `<div class="role">${escapeHtml(d.role.trim())}</div>`
        : ''
      return `<article class="card"><h2>${escapeHtml(d.name)}</h2>${roleHtml}${contactHtml}${addrHtml}${notesHtml}</article>`
    })
    .join('')

  return `<!DOCTYPE html><html lang="${lang}"><head>
<meta charset="utf-8">
<title>${escapeHtml(title)} ${date}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font: 11pt/1.45 Georgia, 'Times New Roman', serif; color: #111; padding: 14mm 16mm; }
  header { margin-bottom: 10mm; border-bottom: 1px solid #ccc; padding-bottom: 4mm; }
  header h1 { font-size: 14pt; font-weight: 600; letter-spacing: 0.02em; }
  header .meta { font: 9pt/1.4 ui-monospace, monospace; color: #555; margin-top: 2mm; }
  .card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 8mm; padding-bottom: 6mm; border-bottom: 1px solid #e0e0e0; }
  .card:last-child { border-bottom: none; }
  .card h2 { font-size: 12pt; font-weight: 600; margin-bottom: 2mm; }
  .role { font-size: 9pt; color: #444; margin-bottom: 3mm; text-transform: uppercase; letter-spacing: 0.06em; }
  .lbl { font: 8pt/1.3 ui-monospace, monospace; color: #666; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3mm; margin-bottom: 1mm; }
  ul { margin: 0 0 0 5mm; padding: 0; }
  li { margin-bottom: 1mm; }
  p { margin: 0; }
  .notes { color: #333; white-space: pre-wrap; }
  @page { margin: 12mm; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<header>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(labels.generated)} ${date} · ${blocks.length} · ${locale}</div>
</header>
${cards}
<script>window.onload = () => setTimeout(() => window.print(), 400)<\/script>
</body></html>`
}

export function openSuppliersPrintWindow(html: string): boolean {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (!win) {
    URL.revokeObjectURL(url)
    return false
  }
  win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true })
  return true
}

export function downloadSuppliersTxt(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function supplierLocationHint(
  c: StockContactLike & { Ville?: string | null; Pays?: string | null },
): string {
  const parts = [c.Ville?.trim(), c.Pays?.trim()].filter(Boolean)
  return parts.length ? parts.join(', ') : '\u2014'
}

export function supplierContactHint(
  c: StockContactLike & { Ville?: string | null; Pays?: string | null },
): string {
  return supplierLocationHint(c)
}
