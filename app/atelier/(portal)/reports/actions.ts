'use server'

import PDFDocument from 'pdfkit'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import type { Lang } from '@/lib/i18n/dictionary'
import { REPORT_PDF_MAX_ROWS } from '@/lib/reports/works-table'

export type TablePdfResult =
  | { error: string }
  | { ok: true; base64: string; filename: string }

const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' }
const MAX_COLS = 30
const MAX_CELL = 200

/**
 * PDF of the table a report shows (any source): the client sends the headers and the cells
 * it already formatted, so the PDF matches the preview, XLSX and CSV exactly.
 */
export async function generateTablePdf(input: {
  title: string
  headers: string[]
  rows: string[][]
  fileStem: string
  lang: Lang
}): Promise<TablePdfResult> {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return { error: 'auth' }

  const headers = input.headers.slice(0, MAX_COLS).map((h) => String(h ?? '').slice(0, 60))
  if (!headers.length) return { error: 'no_columns' }
  if (!input.rows.length) return { error: 'empty' }
  if (input.rows.length > REPORT_PDF_MAX_ROWS) return { error: 'too_many' }
  const body = input.rows.map((r) => headers.map((_, i) => String(r[i] ?? '—').slice(0, MAX_CELL)))
  const locale = LOCALE[input.lang] ?? 'fr-FR'
  const title = input.title.slice(0, 160)
  const stem = input.fileStem.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'report'

  try {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 32,
      bufferPages: true,
      info: { Title: title },
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))

    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    const m = doc.page.margins
    const pageW = doc.page.width - m.left - m.right
    const colW = pageW / Math.max(headers.length, 1)
    const rowH = 14
    const headerH = 18
    let y = m.top
    const left0 = m.left

    const drawHeader = () => {
      doc.fillOpacity(1).fillColor('#000000')
      doc.font('Helvetica-Bold').fontSize(8)
      let x = left0
      for (const h of headers) {
        doc.text(h, x + 2, y + 3, { width: colW - 4, ellipsis: true })
        x += colW
      }
      doc.moveTo(left0, y + headerH).lineTo(left0 + pageW, y + headerH).strokeColor('#cccccc').lineWidth(0.5).stroke()
      y += headerH
    }

    doc.font('Helvetica').fontSize(9)
    doc.text(`${title} — ${new Date().toLocaleDateString(locale)} — ${body.length}`, left0, y, { width: pageW })
    y += 22

    drawHeader()
    doc.font('Helvetica').fontSize(7)

    for (const row of body) {
      if (y + rowH > doc.page.height - m.bottom) {
        doc.addPage()
        y = doc.page.margins.top
        drawHeader()
        doc.font('Helvetica').fontSize(7)
      }
      let x = left0
      for (const cell of row) {
        doc.fillColor('#222222').text(cell, x + 2, y + 2, { width: colW - 4, ellipsis: true })
        x += colW
      }
      y += rowH
    }

    doc.end()
    const buf = await done
    return { ok: true, base64: buf.toString('base64'), filename: `${stem}.pdf` }
  } catch (e) {
    await logError('Report PDF failed', e, { source: 'generateTablePdf' })
    return { error: 'fail' }
  }
}
