
// R7 order papers (docs/design/2026-11-17/R7_Orders.notes.md « Papers per kind »):
// one generator for the four kinds. Bon de commande (sale), bordereau de dépôt-vente
// (consignment), contrat de prêt (loan), acte de don (gift), bon de confiage (« Confié »: a framer,
// restorer, photographer — the work keeps its stage, Pem 2026-11-17). French with an English line,
// like the former papers. The wording is a plain draft for Pem to review — not legal advice.
//
// pdfkit rules (CLAUDE.md): no 8-char hex colours; text without `height` may add a page.
// Thumbnails are AVIF on R2 — pdfkit reads only JPEG / PNG, so they go through sharp first.

import { logWarn } from '@/lib/error-reporter/server'

export type PaperKind = 'sale' | 'consignment' | 'loan' | 'gift' | 'entrusted'

export interface PaperParty {
  name: string
  lines: string[] // address lines, may be empty
}

export interface PaperWork {
  id: number
  title: string | null
  year: string | null
  medium: string | null // « Huile sur toile »
  dims: string | null // « 100 × 80 cm »
  value: number | null // price, agreed price or insurance value by kind
  image: string | null // R2 key of the work image
}

export interface PaperInput {
  kind: PaperKind
  ref: string
  status: string
  createdAt: string
  artist: PaperParty
  party: PaperParty
  works: PaperWork[]
  currency: string
  priceCatalogue: number | null
  discountPct: number | null
  priceFinal: number | null
  depositPct: number | null
  commissionPct: number | null
  startDate: string | null
  endDate: string | null
  /** Gift: the hand-over date (ownership moves then — « don manuel », Pem 2026-11-17). */
  handedOverAt: string | null
  returnWindowDays: number | null
  notes: string | null
}

export const PAPER_SLUG: Record<PaperKind, string> = {
  sale: 'bon-de-commande',
  consignment: 'bordereau-depot',
  loan: 'contrat-pret',
  gift: 'acte-de-don',
  entrusted: 'bon-de-confiage',
}

export const PAPER_TITLE: Record<PaperKind, { fr: string; en: string }> = {
  sale: { fr: 'Bon de commande', en: 'Purchase order' },
  consignment: { fr: 'Bordereau de dépôt-vente', en: 'Consignment agreement' },
  loan: { fr: 'Contrat de prêt', en: 'Loan agreement' },
  gift: { fr: 'Acte de don', en: 'Deed of gift' },
  entrusted: { fr: 'Bon de confiage', en: 'Entrustment note' },
}

const PARTY_ROLE: Record<PaperKind, string> = {
  sale: 'ACHETEUR / BUYER',
  consignment: 'DÉPOSITAIRE / CONSIGNEE',
  loan: 'EMPRUNTEUR / BORROWER',
  gift: 'BÉNÉFICIAIRE / RECIPIENT',
  entrusted: 'ARTISAN / CRAFTSPERSON',
}

const SIGN_ROLE: Record<PaperKind, string> = {
  sale: "POUR L'ACHETEUR / FOR THE BUYER",
  consignment: 'POUR LE DÉPOSITAIRE / FOR THE CONSIGNEE',
  loan: "POUR L'EMPRUNTEUR / FOR THE BORROWER",
  gift: 'POUR LE BÉNÉFICIAIRE / FOR THE RECIPIENT',
  entrusted: "POUR L'ARTISAN / FOR THE CRAFTSPERSON",
}

const VALUE_HEAD: Record<PaperKind, string | null> = {
  sale: 'PRIX / PRICE',
  consignment: 'PRIX CONVENU / AGREED PRICE',
  loan: "VALEUR D'ASSURANCE / INSURANCE VALUE",
  // A gift never prints a value (Pem 2026-11-17: « the recipient should not have a price written »).
  gift: null,
  entrusted: "VALEUR D'ASSURANCE / INSURANCE VALUE",
}

const CONDITIONS: Record<PaperKind, string> = {
  sale:
    "La propriété des œuvres listées passe à l'acheteur au paiement complet du prix ; jusque-là elles restent la propriété de l'artiste. " +
    "La garde passe à l'acheteur à la livraison ou à la remise en main propre.",
  consignment:
    "Les œuvres listées sont confiées au dépositaire en vue de leur vente, aux prix convenus ci-dessus, pour la période indiquée. " +
    "L'artiste en reste propriétaire jusqu'à leur vente. Le dépositaire en assure la garde et l'assurance pendant toute la durée du dépôt, " +
    "et ne peut ni les prêter ni les céder autrement que par une vente aux conditions convenues. Les œuvres non vendues sont rendues à l'artiste à la fin du dépôt.",
  loan:
    "Les œuvres listées sont prêtées pour la période et l'objet indiqués ; elles ne sont pas à vendre et reviennent à l'artiste à la fin du prêt. " +
    "L'emprunteur les assure, à la valeur indiquée, du départ de l'atelier jusqu'à leur retour (« clou à clou »), " +
    "et s'engage à les présenter avec la mention « Collection de l'artiste / Courtesy of the artist ». Un constat d'état est fait au départ et au retour.",
  gift:
    "Le présent acte constate le don manuel, à titre gracieux, des œuvres listées au bénéficiaire désigné. Aucune contrepartie n'est due. " +
    "Le don est réalisé par la remise des œuvres : la propriété et la garde passent ensemble au bénéficiaire à la date de remise indiquée ci-dessus. " +
    "Jusqu'à cette remise, les œuvres restent la propriété de l'artiste.",
  entrusted:
    "Les œuvres listées sont confiées à l'artisan pour le travail décrit ci-dessous (encadrement, restauration, photographie…) et pour la période indiquée. " +
    "Elles restent la propriété de l'artiste et ne peuvent être ni vendues, ni prêtées, ni exposées. " +
    "L'artisan en assure la garde et l'assurance, à la valeur indiquée, jusqu'à leur retour à l'atelier.",
}

async function workImagePng(key: string | null): Promise<Buffer | null> {
  if (!key) return null
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''
  if (!base) return null
  const thumb = `thumbs/${key.replace(/\.[^.]+$/, '')}.avif`
  for (const k of [thumb, key]) {
    try {
      const res = await fetch(`${base}/${encodeURIComponent(k)}`)
      if (!res.ok) continue
      const sharpMod = await import('sharp')
      const sharp = sharpMod.default ?? sharpMod
      return await sharp(Buffer.from(await res.arrayBuffer())).resize(160, 160, { fit: 'inside' }).png().toBuffer()
    } catch (err) {
      // The paper is still made without the picture.
      await logWarn('Order paper thumbnail failed', err, { source: 'order-paper.workImagePng', metadata: { key: k } })
      continue
    }
  }
  return null
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

function fmtMoney(n: number | null, currency: string): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 })
    .format(n).replace(/ | /g, ' ')
}

export async function buildOrderPaper(p: PaperInput): Promise<Buffer> {
  const images = await Promise.all(p.works.map((w) => workImagePng(w.image)))
  const pdfkitMod = await import('pdfkit')
  const PDFDocument = pdfkitMod.default ?? pdfkitMod

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const L = 56
    const W = 595 - 112
    const PH = 842
    const ink = '#111111'
    const grey = '#888888'
    const line = '#dddddd'
    const ac = '#a68b55'
    const title = PAPER_TITLE[p.kind]
    const top = 118

    const ensure = (h: number) => {
      if (doc.y + h > PH - 80) { doc.addPage(); doc.y = top }
    }
    const label = (t: string, x = L, y?: number) => doc.fontSize(8).fillColor(grey).text(t, x, y ?? doc.y, { width: W })

    // ── Parties ──
    doc.y = top
    const colW = W / 2 - 10
    const partyY = doc.y
    label("L'ARTISTE / THE ARTIST", L, partyY)
    doc.fontSize(11).fillColor(ink).text(p.artist.name, L, partyY + 12, { width: colW })
    p.artist.lines.forEach((ln) => doc.fontSize(9).fillColor(grey).text(ln, L, doc.y, { width: colW }))
    const leftEnd = doc.y
    label(PARTY_ROLE[p.kind], L + W / 2 + 10, partyY)
    doc.fontSize(11).fillColor(ink).text(p.party.name, L + W / 2 + 10, partyY + 12, { width: colW })
    p.party.lines.forEach((ln) => doc.fontSize(9).fillColor(grey).text(ln, L + W / 2 + 10, doc.y, { width: colW }))
    doc.y = Math.max(leftEnd, doc.y) + 18

    // ── Works ──
    label(p.works.length > 1 ? `ŒUVRES / WORKS (${p.works.length})` : 'ŒUVRE / WORK')
    doc.moveDown(0.4)
    const valueHead = VALUE_HEAD[p.kind]
    if (valueHead) doc.fontSize(7).fillColor(grey).text(valueHead, L + W - 220, doc.y, { width: 220, align: 'right' })
    doc.moveTo(L, doc.y + 2).lineTo(L + W, doc.y + 2).lineWidth(0.5).strokeColor(line).stroke()
    doc.y += 8

    p.works.forEach((w, i) => {
      ensure(64)
      const y0 = doc.y
      const img = images[i]
      if (img) {
        // eslint-disable-next-line pem-i18n/no-silent-catch -- a picture pdfkit cannot read is skipped; the PNG was made by sharp just above
        try { doc.image(img, L, y0, { fit: [48, 48] }) } catch { /* no picture */ }
      }
      const x = L + 60
      const textW = W - 60 - (valueHead ? 150 : 0)
      doc.fontSize(10).fillColor(ink).text(`${w.title || 'Sans titre'}${w.year ? ` (${w.year})` : ''}`, x, y0, { width: textW })
      const meta = [w.medium, w.dims].filter(Boolean).join(' · ')
      if (meta) doc.fontSize(8.5).fillColor(grey).text(meta, x, doc.y + 1, { width: textW })
      doc.fontSize(8).fillColor(grey).text(`Réf. œuvre #${w.id}`, x, doc.y + 1, { width: textW })
      if (valueHead) doc.fontSize(10).fillColor(ink).text(fmtMoney(w.value, p.currency), L + W - 140, y0, { width: 140, align: 'right' })
      doc.y = Math.max(doc.y, y0 + 52) + 6
      doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.5).strokeColor(line).stroke()
      doc.y += 8
    })

    // ── Terms by kind ──
    const rows: [string, string][] = []
    if (p.kind === 'sale') {
      if (p.priceCatalogue != null) rows.push(['Prix catalogue / List price', fmtMoney(p.priceCatalogue, p.currency)])
      if (p.discountPct) rows.push(['Remise / Discount', `${p.discountPct} %`])
      rows.push(['Prix final / Total', fmtMoney(p.priceFinal, p.currency)])
      if (p.depositPct && p.priceFinal) rows.push([`Acompte / Deposit (${p.depositPct} %)`, fmtMoney(Math.round(p.priceFinal * p.depositPct) / 100, p.currency)])
      if (p.returnWindowDays) rows.push(['Délai de rétractation / Cooling-off', `${p.returnWindowDays} jours après la livraison`])
    }
    if (p.kind === 'consignment' && p.commissionPct != null) rows.push(['Commission du dépositaire / Commission', `${p.commissionPct} % du prix de vente`])
    if (p.kind === 'consignment' || p.kind === 'loan' || p.kind === 'entrusted') rows.push(['Période / Period', `du ${fmtDate(p.startDate)} au ${fmtDate(p.endDate)}`])
    if (p.kind === 'gift') rows.push(['Date de remise / Handover date', p.handedOverAt ? fmtDate(p.handedOverAt) : '______________________'])
    if (rows.length) {
      ensure(20 + rows.length * 16)
      doc.y += 6
      rows.forEach(([k, v]) => {
        const y = doc.y
        doc.fontSize(9).fillColor(grey).text(k, L, y, { width: W / 2 })
        doc.fontSize(10).fillColor(ink).text(v, L + W / 2, y, { width: W / 2, align: 'right' })
        doc.y = Math.max(doc.y, y + 14) + 2
      })
    }

    // ── Conditions + notes ──
    ensure(90)
    doc.y += 10
    label('CONDITIONS')
    doc.fontSize(9).fillColor(ink).text(CONDITIONS[p.kind], L, doc.y + 4, { width: W, align: 'justify' })
    if (p.notes) {
      ensure(40)
      doc.y += 10
      label(p.kind === 'loan' ? 'OBJET DU PRÊT, NOTES / PURPOSE, NOTES' : p.kind === 'entrusted' ? 'TRAVAIL DEMANDÉ, NOTES / WORK REQUESTED, NOTES' : 'NOTES')
      doc.fontSize(9).fillColor(ink).text(p.notes, L, doc.y + 4, { width: W })
    }

    // ── Signatures (on the last page, at the bottom) ──
    if (doc.y > PH - 170) { doc.addPage(); doc.y = top }
    const sigY = PH - 150
    doc.fontSize(9).fillColor(grey).text('Fait à Marseille, le ______________________', L, sigY - 26, { width: W })
    label("POUR L'ARTISTE / FOR THE ARTIST", L, sigY)
    doc.moveTo(L, sigY + 46).lineTo(L + 200, sigY + 46).lineWidth(0.5).strokeColor('#bbbbbb').stroke()
    label(SIGN_ROLE[p.kind], L + W / 2 + 10, sigY)
    doc.moveTo(L + W / 2 + 10, sigY + 46).lineTo(L + W, sigY + 46).stroke()

    // ── Header + footer on every page ──
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i)
      // Writing in the margins must not start a new page.
      const bottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.fontSize(7).fillColor(grey).text('THE PEM WORKSHOP', L, 40, { lineBreak: false })
      doc.fontSize(17).fillColor(ink).text(title.fr, L, 52, { lineBreak: false })
      doc.fontSize(9).fillColor(grey).text(title.en, L, 73, { lineBreak: false })
      doc.fontSize(9).fillColor(ac).text(`${p.ref} · ${fmtDate(p.createdAt)} · ${i + 1} / ${range.count}`, L, 86, { lineBreak: false })
      if (p.status === 'draft') doc.fontSize(9).fillColor(ac).text('BROUILLON / DRAFT', L, 52, { width: W, align: 'right', lineBreak: false })
      doc.fontSize(6.5).fillColor('#aaaaaa').text(`THE PEM WORKSHOP · ${p.ref}`, L, PH - 40, { width: W, align: 'center', lineBreak: false })
      doc.page.margins.bottom = bottom
    }
    doc.end()
  })
}
