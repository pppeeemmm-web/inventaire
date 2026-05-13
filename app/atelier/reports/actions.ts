'use server'

import PDFDocument from 'pdfkit'
import { createClient } from '@/lib/supabase/server'
import { dict, type Lang } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import {
  REPORT_COLUMN_HEADER_KEY,
  REPORT_COLUMN_ORDER,
  REPORT_PDF_MAX_ROWS,
  buildReportRows,
  type ReportColumnId,
  type ReportMaps,
} from '@/lib/reports/works-table'

export type WorksTablePdfResult =
  | { error: string }
  | { ok: true; base64: string; filename: string }

function isReportColumnId(s: string): s is ReportColumnId {
  return (REPORT_COLUMN_ORDER as string[]).includes(s)
}

const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' }

export async function generateWorksTablePdf(
  ids: number[],
  columns: string[],
  lang: Lang,
): Promise<WorksTablePdfResult> {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return { error: 'auth' }

  const uniq = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0)
  if (!uniq.length) return { error: 'empty' }
  if (uniq.length > REPORT_PDF_MAX_ROWS) return { error: 'too_many' }

  const cols = columns.filter(isReportColumnId)
  if (!cols.length) return { error: 'no_columns' }

  const locale = LOCALE[lang] ?? 'fr-FR'
  const d = dict[lang]

  const [
    techRes,
    supRes,
    fmtRes,
    themeRowsRes,
    groupRowsRes,
    statusRes,
    contactRes,
    otRes,
    gwRes,
    oeuvresRes,
  ] = await Promise.all([
    session.from('Technique').select('TechniqueID, Technique'),
    session.from('Support').select('SupportID, Support'),
    session.from('Format').select('FormatID, Format'),
    session.from('theme').select('id, name'),
    session.from('working_group').select('id, name'),
    session.from('OeuvreStatus').select('id, label'),
    (session as any).from('Contact').select('ContactID, NomInstitution, Nom, Prénom, Ville, Pays'),
    session.from('oeuvre_theme').select('oeuvre_id, theme_id').in('oeuvre_id', uniq),
    session.from('working_group_work').select('oeuvre_id, group_id').in('oeuvre_id', uniq),
    (session as any)
      .from('Oeuvres')
      .select(
        'OeuvreID, Titre, Année, Technique, Support, Format, Hauteur, Largeur, Profondeur, statusId, Catalogué, NeedsPhotograph, Exposable, Commentaires, Prix, PrixFinal, Discount, ContactID, LocalisationID, LocalisationDetail, AcheteurID',
      )
      .in('OeuvreID', uniq)
      .is('deleted_at', null),
  ])

  if (oeuvresRes.error) return { error: oeuvresRes.error.message }

  const fetched = (oeuvresRes.data ?? []) as unknown as Oeuvre[]
  const orderIndex = new Map<number, number>(uniq.map((id, i) => [id, i]))
  fetched.sort((a, b) => (orderIndex.get(a.OeuvreID) ?? 0) - (orderIndex.get(b.OeuvreID) ?? 0))

  const tM: Record<number, string> = {}
  for (const r of (techRes.data ?? []) as { TechniqueID: number; Technique: string | null }[])
    tM[r.TechniqueID] = r.Technique ?? ''
  const sM: Record<number, string> = {}
  for (const r of (supRes.data ?? []) as { SupportID: number; Support: string | null }[])
    sM[r.SupportID] = r.Support ?? ''
  const fM: Record<number, string> = {}
  for (const r of (fmtRes.data ?? []) as { FormatID: number; Format: string | null }[])
    fM[r.FormatID] = r.Format ?? ''

  const cM: Record<number, string> = {}
  const locMap: Record<number, string> = {}
  for (const c of (contactRes.data ?? []) as {
    ContactID: number
    NomInstitution: string | null
    Nom: string | null
    Prénom: string | null
    Ville?: string | null
    Pays?: string | null
  }[]) {
    const label =
      c.NomInstitution || `${c.Prénom ?? ''} ${c.Nom ?? ''}`.trim() || String(c.ContactID)
    cM[c.ContactID] = label
    if (c.Ville || c.Pays) locMap[c.ContactID] = [c.Ville, c.Pays].filter(Boolean).join(', ')
  }

  const statusLabelMap: Record<number, string> = {}
  for (const s of (statusRes.data ?? []) as { id: number; label: string }[]) statusLabelMap[s.id] = s.label

  const thM: Record<number, string> = {}
  for (const t of (themeRowsRes.data ?? []) as { id: number; name: string }[]) thM[t.id] = t.name ?? ''

  const groupNameMap: Record<string, string> = {}
  for (const g of (groupRowsRes.data ?? []) as { id: string; name: string }[]) groupNameMap[g.id] = g.name ?? ''

  const oeuvreThemeMap = new Map<number, number[]>()
  for (const row of (otRes.data ?? []) as { oeuvre_id: number; theme_id: number }[]) {
    const arr = oeuvreThemeMap.get(row.oeuvre_id) ?? []
    arr.push(row.theme_id)
    oeuvreThemeMap.set(row.oeuvre_id, arr)
  }
  const oeuvreGroupMap = new Map<number, string[]>()
  for (const row of (gwRes.data ?? []) as { oeuvre_id: number; group_id: string }[]) {
    const arr = oeuvreGroupMap.get(row.oeuvre_id) ?? []
    arr.push(row.group_id)
    oeuvreGroupMap.set(row.oeuvre_id, arr)
  }

  const pM: Record<number, string> = {}

  const maps: ReportMaps = {
    tM,
    sM,
    fM,
    cM,
    pM,
    locMap,
    statusLabelMap,
    thM,
    groupNameMap,
    oeuvreThemeMap,
    oeuvreGroupMap,
  }

  const headers = cols.map((c) => d[REPORT_COLUMN_HEADER_KEY[c]])
  const body = buildReportRows(fetched, cols, maps, locale)

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 32,
    bufferPages: true,
    info: { Title: d.report_pdf_title },
  })

  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  const m = doc.page.margins
  const pageW = doc.page.width - m.left - m.right
  const colW = pageW / Math.max(cols.length, 1)
  const rowH = 14
  const headerH = 18
  let y = m.top
  const left0 = m.left

  const drawHeader = () => {
    doc.fillOpacity(1).fillColor('#000000')
    doc.font('Helvetica-Bold').fontSize(8)
    let x = left0
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].slice(0, 48)
      doc.text(h, x + 2, y + 3, { width: colW - 4, ellipsis: true })
      x += colW
    }
    doc.moveTo(left0, y + headerH).lineTo(left0 + pageW, y + headerH).strokeColor('#cccccc').lineWidth(0.5).stroke()
    y += headerH
  }

  doc.font('Helvetica').fontSize(9)
  doc.text(`${d.report_pdf_title} — ${new Date().toLocaleDateString(locale)}`, left0, y, { width: pageW })
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
    for (let i = 0; i < row.length; i++) {
      const cell = (row[i] ?? '—').slice(0, 200)
      doc.fillColor('#222222').text(cell, x + 2, y + 2, { width: colW - 4, ellipsis: true })
      x += colW
    }
    y += rowH
  }

  doc.end()
  const buf = await done
  const ts = new Date().toISOString().slice(0, 10)
  return {
    ok: true,
    base64: buf.toString('base64'),
    filename: `works_report_${ts}.pdf`,
  }
}
