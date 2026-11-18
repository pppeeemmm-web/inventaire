// R7b invoice / credit note PDF (docs/design/2026-11-18/R7b_OrderCascade.notes.md « Invoice »).
// Built from the invoice's frozen `lines` — never from the live orders — so a re-print matches the
// issued one. Wording is a draft for the accountant (LEGAL_POLICY §4), not tax advice.
// pdfkit rules (CLAUDE.md): no 8-char hex colours; text without `height` may add a page.

export interface InvoiceLine {
  /** 'work' = a work sold (price on the order total line), 'price' = the agreed price of an order,
   *  'demand' = framing / mounting / dedication charged, 'shipping' = shipping and insurance. */
  type: 'work' | 'price' | 'demand' | 'shipping'
  orderRef: string | null
  label: string
  detail?: string | null
  amount: number | null
}

export interface InvoicePaperInput {
  kind: 'invoice' | 'credit_note'
  number: string
  issuedOn: string
  creditsNumber: string | null
  artist: { name: string; lines: string[]; siret: string | null }
  party: { name: string; lines: string[] }
  lines: InvoiceLine[]
  total: number
  currency: string
  vatMention: string | null
  paid: number
}

const money = (n: number, cur: string) =>
  `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur === 'EUR' ? '€' : cur}`

export async function buildInvoicePaper(p: InvoicePaperInput): Promise<Buffer> {
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
    const rule = '#dddddd'
    const ac = '#a68b55'
    const top = 118
    const credit = p.kind === 'credit_note'
    const label = (t: string, x = L, y?: number, w = W) => doc.fontSize(8).fillColor(grey).text(t, x, y ?? doc.y, { width: w })

    // ── Parties ──
    doc.y = top
    const colW = W / 2 - 10
    const y0 = doc.y
    label('VENDEUR / SELLER', L, y0, colW)
    doc.fontSize(11).fillColor(ink).text(p.artist.name, L, y0 + 12, { width: colW })
    p.artist.lines.forEach((ln) => doc.fontSize(9).fillColor(grey).text(ln, L, doc.y, { width: colW }))
    doc.fontSize(9).fillColor(p.artist.siret ? grey : ac).text(`SIRET : ${p.artist.siret ?? 'à compléter / to complete'}`, L, doc.y, { width: colW })
    const leftEnd = doc.y
    label('CLIENT / BUYER', L + W / 2 + 10, y0, colW)
    doc.fontSize(11).fillColor(ink).text(p.party.name, L + W / 2 + 10, y0 + 12, { width: colW })
    p.party.lines.forEach((ln) => doc.fontSize(9).fillColor(grey).text(ln, L + W / 2 + 10, doc.y, { width: colW }))
    doc.y = Math.max(leftEnd, doc.y) + 18

    if (credit && p.creditsNumber) {
      doc.fontSize(10).fillColor(ink).text(`Avoir sur la facture ${p.creditsNumber} / Credit note against invoice ${p.creditsNumber}`, L, doc.y, { width: W })
      doc.y += 10
    }

    // ── Lines ──
    label('DÉSIGNATION / DESCRIPTION', L, doc.y, W - 120)
    doc.fontSize(8).fillColor(grey).text('MONTANT / AMOUNT', L + W - 120, doc.y - 10, { width: 120, align: 'right' })
    doc.moveTo(L, doc.y + 2).lineTo(L + W, doc.y + 2).lineWidth(0.5).strokeColor(rule).stroke()
    doc.y += 8
    let lastRef: string | null = null
    for (const ln of p.lines) {
      if (doc.y > PH - 160) { doc.addPage(); doc.y = top }
      if (ln.orderRef && ln.orderRef !== lastRef) {
        doc.fontSize(8).fillColor(ac).text(`Commande / Order ${ln.orderRef}`, L, doc.y + 4, { width: W })
        lastRef = ln.orderRef
      }
      const y = doc.y + 3
      const indent = ln.type === 'work' ? 12 : 0
      doc.fontSize(ln.type === 'work' ? 9 : 10).fillColor(ln.type === 'work' ? grey : ink).text(ln.label, L + indent, y, { width: W - 130 - indent })
      const yEnd = doc.y
      if (ln.amount != null) doc.fontSize(10).fillColor(ink).text(money(ln.amount, p.currency), L + W - 120, y, { width: 120, align: 'right' })
      doc.y = yEnd
      if (ln.detail) doc.fontSize(8).fillColor(grey).text(ln.detail, L + indent, doc.y, { width: W - 130 - indent })
    }
    doc.moveTo(L, doc.y + 6).lineTo(L + W, doc.y + 6).lineWidth(0.5).strokeColor(rule).stroke()
    doc.y += 12
    const totalY = doc.y
    doc.fontSize(11).fillColor(ink).text(credit ? 'TOTAL AVOIR / CREDIT TOTAL' : 'TOTAL', L, totalY, { width: W - 130 })
    doc.fontSize(12).fillColor(ink).text(money(p.total, p.currency), L + W - 160, totalY, { width: 160, align: 'right' })
    doc.y = totalY + 20
    if (!credit) {
      doc.fontSize(9).fillColor(grey).text(`Déjà réglé / Already paid : ${money(p.paid, p.currency)}`, L, doc.y, { width: W, align: 'right' })
      const due = Math.max(0, Math.round((p.total - p.paid) * 100) / 100)
      doc.fontSize(9).fillColor(due > 0 ? ink : grey).text(`Reste dû / Balance due : ${money(due, p.currency)}`, L, doc.y, { width: W, align: 'right' })
    }
    doc.y += 14
    doc.fontSize(9).fillColor(p.vatMention ? ink : ac).text(p.vatMention ?? 'Mention TVA : à définir avec le comptable / VAT mention: to settle with the accountant.', L, doc.y, { width: W })

    // ── Header + footer on every page ──
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i)
      const bottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.fontSize(7).fillColor(grey).text('THE PEM WORKSHOP', L, 40, { lineBreak: false })
      doc.fontSize(17).fillColor(ink).text(credit ? 'Avoir' : 'Facture', L, 52, { lineBreak: false })
      doc.fontSize(9).fillColor(grey).text(credit ? 'Credit note' : 'Invoice', L, 73, { lineBreak: false })
      doc.fontSize(9).fillColor(ac).text(`${p.number} · ${p.issuedOn} · ${i + 1} / ${range.count}`, L, 86, { lineBreak: false })
      doc.fontSize(6.5).fillColor('#aaaaaa').text(`THE PEM WORKSHOP · ${p.number}`, L, PH - 40, { width: W, align: 'center', lineBreak: false })
      doc.page.margins.bottom = bottom
    }
    doc.end()
  })
}
