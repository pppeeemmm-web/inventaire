
'use server'

import { createClient }  from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { logError } from '@/lib/error-reporter/server'
import { logSystemEvent } from '@/lib/utils/logging'
import {
  appendHistoriqueForOeuvres,
  historiqueLinesForOeuvreUpdate,
} from '@/lib/oeuvre-historique'
import { recordStorageObject } from '@/lib/storage-object-ledger'

export interface ConsignmentOrderRow {
  id:               string
  created_at:       string
  oeuvre_id:        number
  partner_id:       number | null
  start_date:       string | null
  end_date:         string | null
  insurance_value:  number | null
  catalog_price:    number | null
  commission_pct:   number | null
  status:           string
  kind:             'consignment' | 'loan'
  order_ref:        string | null
  pdf_path:         string | null
  notes:            string | null
}

export type ConsignmentResult = { error: string } | { ok: true; order: ConsignmentOrderRow }
export type CloseResult = { error: string } | { ok: true; reverted: number[]; skipped: number[] }

const PEM_CONTACT_ID = 13

function extractBatchIds(notes: string | null | undefined): number[] {
  if (!notes?.includes('BATCH_IDS:')) return []
  try {
    const match = notes.match(/BATCH_IDS: (\[.*?\])/)
    if (match) return JSON.parse(match[1])
  } catch {}
  return []
}

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié', supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé', supabase: null }
  return { error: null, supabase }
}

async function r2UploadPdf(key: string, body: Buffer, rowId?: string | null) {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  const bucket = process.env.R2_VAULT_BUCKET ?? 'vault'
  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        body,
    ContentType: 'application/pdf',
  }))
  await recordStorageObject({
    bucket,
    objectKey: key,
    sizeBytes: body.length,
    contentType: 'application/pdf',
    source: 'consignment_pdf',
    classification: 'linked',
    linkedRefs: [
      { table: 'consignment_order', column: 'pdf_path', row_id: rowId ?? null },
      { table: 'document', column: 'storage_path' },
    ],
  })
}

export async function createConsignmentOrder(formData: FormData): Promise<ConsignmentResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const oeuvre_ids     = formData.getAll('oeuvre_ids').map(Number)
  const partner_id     = formData.get('partner_id')     ? Number(formData.get('partner_id')) : null
  const start_date     = (formData.get('start_date')     as string | null) || null
  const end_date       = (formData.get('end_date')       as string | null) || null
  const notes          = (formData.get('notes')          as string | null) || null
  const kind           = (formData.get('kind') as 'consignment' | 'loan' | null) === 'loan' ? 'loan' : 'consignment'
  const commissionRaw  = formData.get('commission_pct')
  const commission_pct = commissionRaw != null && commissionRaw !== '' ? Number(commissionRaw) : 0

  if (oeuvre_ids.length === 0) return { error: 'Au moins une œuvre est requise' }

  const refPrefix  = kind === 'loan' ? 'LOAN' : 'CNSG'
  const statusId   = kind === 'loan' ? 8 : 7   // Prêt vs Consigné

  // 1. Create the formal order record
  const { data: order, error: dbErr } = await supabase
    .from('consignment_order')
    .insert({
      partner_id,
      start_date, end_date,
      kind,
      commission_pct: kind === 'consignment' ? commission_pct : 0,
      notes: `BATCH_IDS: ${JSON.stringify(oeuvre_ids)}\n${notes || ''}`,
      status: 'active',
      order_ref: `${refPrefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    })
    .select()
    .single()

  if (dbErr || !order) return { error: 'Database error: ' + dbErr?.message }

  // 2. LOGISTICS AUTOMATION: update work status + location
  const { data: worksBefore } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, statusId, ContactID, LocalisationID')
    .in('OeuvreID', oeuvre_ids)

  await supabase
    .from('Oeuvres')
    .update({
      statusId,
      ContactID:      partner_id,
      LocalisationID: partner_id,
      ReturnDate:     end_date,
    })
    .in('OeuvreID', oeuvre_ids)

  if (partner_id && (worksBefore ?? []).length > 0) {
    const histItems: { oeuvreId: number; lines: string[] }[] = []
    for (const w of worksBefore ?? []) {
      const lines = await historiqueLinesForOeuvreUpdate(
        supabase,
        {
          statusId: w.statusId,
          ContactID: w.ContactID,
          LocalisationID: w.LocalisationID,
        },
        {
          statusId,
          contactId: partner_id,
          localisationId: partner_id,
        },
      )
      if (lines.length) histItems.push({ oeuvreId: w.OeuvreID, lines })
    }
    await appendHistoriqueForOeuvres(supabase, histItems)
  }

  // 3. Generate PDF (Bordereau de Dépôt or Bordereau de Prêt)
  try {
    const pdf     = await buildConsignmentPdf(order as ConsignmentOrderRow, oeuvre_ids, supabase)
    const folder  = kind === 'loan' ? 'loans' : 'consignments'
    const docName = kind === 'loan' ? 'BORDEREAU_PRET' : 'BORDEREAU'
    const key     = `${folder}/${docName}_${order.order_ref}.pdf`
    await r2UploadPdf(key, pdf, order.id)

    await supabase.from('consignment_order').update({ pdf_path: key }).eq('id', order.id)
    ;(order as ConsignmentOrderRow).pdf_path = key

    await supabase.from('document').insert({
      name:         kind === 'loan'
                      ? `Bordereau de Prêt ${order.order_ref}`
                      : `Bordereau de Dépôt ${order.order_ref}`,
      kind:         'contrat',
      notes:        `Generated for ${kind} ${order.order_ref}`,
      doc_date:     new Date().toISOString().slice(0, 10),
      oeuvre_id:    oeuvre_ids[0],
      oeuvre_ids:   oeuvre_ids,
      storage_path: key,
      file_size:    pdf.length,
      mime_type:    'application/pdf',
    })
  } catch (e) {
    await logError('Consignment PDF generation failed', e, {
      source: 'consignments.createConsignmentOrder',
      metadata: { orderId: order.id, orderRef: order.order_ref },
    })
  }

  return { ok: true, order: order as ConsignmentOrderRow }
}

export async function regenerateConsignmentPdf(id: string): Promise<{ error?: string; ok?: boolean }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: order, error: fetchErr } = await supabase.from('consignment_order').select('*').eq('id', id).single()
  if (fetchErr || !order) return { error: 'Order not found' }

  const oeuvre_ids = extractBatchIds(order.notes)
  if (oeuvre_ids.length === 0) return { error: 'No artworks linked to this consignment in notes.' }

  const oldPath = order.pdf_path as string | null
  const folder  = order.kind === 'loan' ? 'loans' : 'consignments'
  const docName = order.kind === 'loan' ? 'BORDEREAU_PRET' : 'BORDEREAU'
  const key     = `${folder}/${docName}_${order.order_ref}.pdf`

  try {
    const pdf = await buildConsignmentPdf(order as ConsignmentOrderRow, oeuvre_ids, supabase)
    await r2UploadPdf(key, pdf, id)
    await supabase.from('consignment_order').update({ pdf_path: key }).eq('id', id)

    // Re-point the document row at the new key so vault links keep working
    if (oldPath && oldPath !== key) {
      await supabase.from('document').update({ storage_path: key }).eq('storage_path', oldPath)
    }
    return { ok: true }
  } catch (e) {
    return { error: String(e) }
  }
}

// ── Close (return) consignment / loan ─────────────────────────────────────────
//
// Stamps the order as 'returned'. Reverts each work to Disponible (statusId=2)
// + Pem location ONLY if the work is still in the consignment-owned states
// (7 or 8). Works that have moved on into the sale lifecycle (4, 6, 11) are
// left untouched — those are owned by the parallel sale flow.

export async function closeConsignmentOrder(id: string): Promise<CloseResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: order, error: fetchErr } = await supabase
    .from('consignment_order')
    .select('id, kind, status, end_date, order_ref, notes')
    .eq('id', id)
    .single()
  if (fetchErr || !order) return { error: 'Order not found' }

  if (order.status === 'returned') return { error: 'Déjà clôturée' }

  const oeuvre_ids = extractBatchIds(order.notes)
  const today = new Date().toISOString().slice(0, 10)

  // Look up which works are still in consignment-owned states
  let reverted: number[] = []
  let skipped: number[] = []
  if (oeuvre_ids.length > 0) {
    const { data: works } = await supabase
      .from('Oeuvres')
      .select('OeuvreID, statusId, ContactID, LocalisationID')
      .in('OeuvreID', oeuvre_ids)

    const revertRows = (works ?? []).filter(w => w.statusId === 7 || w.statusId === 8)
    reverted = revertRows.map(w => w.OeuvreID)
    skipped  = (works ?? []).filter(w => w.statusId !== 7 && w.statusId !== 8).map(w => w.OeuvreID)

    if (reverted.length > 0) {
      await supabase
        .from('Oeuvres')
        .update({
          statusId:       2,
          ContactID:      PEM_CONTACT_ID,
          LocalisationID: PEM_CONTACT_ID,
          ReturnDate:     null,
        })
        .in('OeuvreID', reverted)

      const histItems: { oeuvreId: number; lines: string[] }[] = []
      for (const w of revertRows) {
        const lines = await historiqueLinesForOeuvreUpdate(
          supabase,
          {
            statusId: w.statusId,
            ContactID: w.ContactID,
            LocalisationID: w.LocalisationID,
          },
          {
            statusId: 2,
            contactId: PEM_CONTACT_ID,
            localisationId: PEM_CONTACT_ID,
          },
        )
        if (lines.length) histItems.push({ oeuvreId: w.OeuvreID, lines })
      }
      await appendHistoriqueForOeuvres(supabase, histItems)
    }
  }

  const closeUpdate: Record<string, any> = { status: 'returned' }
  // Only stamp end_date if it was missing or in the future (don't rewrite history)
  if (!order.end_date || order.end_date > today) closeUpdate.end_date = today

  await supabase.from('consignment_order').update(closeUpdate).eq('id', id)

  await logSystemEvent({
    eventType: 'STATUS_CHANGE',
    tableName: 'consignment_order',
    rowId: id,
    oldValue: order.status,
    newValue: 'returned',
    metadata: { kind: order.kind, order_ref: order.order_ref, reverted, skipped },
  })

  return { ok: true, reverted, skipped }
}

// Convenience wrapper: PipelineTab tracks consignments via suivi_process and
// only stores the consignment_order's pdf_path on it. Look the order up by
// that path then delegate to closeConsignmentOrder.
export async function closeConsignmentByPdfPath(pdfPath: string): Promise<CloseResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: order, error } = await supabase
    .from('consignment_order')
    .select('id')
    .eq('pdf_path', pdfPath)
    .maybeSingle()
  if (error || !order) return { error: 'Consignation introuvable pour ce PDF' }
  return closeConsignmentOrder(order.id)
}

async function buildConsignmentPdf(order: ConsignmentOrderRow, oeuvre_ids: number[], supabase: any): Promise<Buffer> {
  const { data: works } = await supabase.from('Oeuvres').select('*').in('OeuvreID', oeuvre_ids)
  const { data: partner } = await supabase.from('Contact').select('*').eq('ContactID', order.partner_id).single()

  const PDFDocument = (await import('pdfkit')).default
  const chunks: Buffer[] = []

  const formatPrice = (v: number | null) => {
    if (v === null || v === 0) return '0'
    return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  }

  // Pre-fetch image buffers for batch (Outside the promise executor)
  const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''
  const workImages: Record<number, Buffer> = {}
  await Promise.all((works ?? []).map(async (w: any) => {
    if (w.txtImageNameLink) {
      try {
        const thumbName = `thumbs/${w.txtImageNameLink.replace(/\.[^.]+$/, '')}.avif`
        const res = await fetch(`${R2}/${encodeURIComponent(thumbName)}`)
        if (res.ok) {
          workImages[w.OeuvreID] = Buffer.from(await res.arrayBuffer())
        } else {
          const resOrig = await fetch(`${R2}/${encodeURIComponent(w.txtImageNameLink)}`)
          if (resOrig.ok) workImages[w.OeuvreID] = Buffer.from(await resOrig.arrayBuffer())
        }
      } catch(e) { console.error("Consignment PDF Image fetch failed", w.OeuvreID, e) }
    }
  }))

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 })
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const PW_RAW = 595
    const PH_RAW = 842
    const W = PW_RAW - 112
    const ac = '#c8a86e'
    const tx2 = '#888'

    // --- Content Generation ---
    let y = 140 

    const isLoan = order.kind === 'loan'
    doc.fontSize(9).fillColor(tx2).text(isLoan ? 'EMPRUNTEUR / BORROWER' : 'DÉPOSITAIRE / PARTNER', 56, y)
    doc.moveDown(0.4)
    doc.fontSize(11).fillColor('#000').text(partner?.NomInstitution || `${partner?.Prénom} ${partner?.Nom}`)
    doc.fontSize(9).fillColor(tx2).text(`${partner?.Ville || ''}, ${partner?.Pays || ''}`)
    
    doc.fontSize(9).fillColor(tx2).text('ŒUVRES EN DÉPÔT', 56, 200)
    doc.moveDown(0.5)

    // Table Header
    doc.fontSize(8).fillColor(tx2).text('ID', 56, doc.y, { width: 30 })
    doc.text('TITRE', 90, doc.y, { width: 200 })
    doc.text('ANNÉE', 300, doc.y, { width: 50 })
    doc.text('VALEUR', 360, doc.y, { width: 80, align: 'right' })
    doc.moveDown(0.3)
    doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).strokeColor('#ddd').stroke()
    doc.moveDown(0.5)

    works?.forEach((w: any) => {
      if (doc.y > 700) {
        doc.addPage()
        doc.y = 115
      }
      const rowY = doc.y
      const imgBuf = workImages[w.OeuvreID]
      if (imgBuf) {
        try { doc.image(imgBuf, 56, rowY, { width: 32, height: 32, fit: [32, 32] }) } catch {}
      }

      const textX = imgBuf ? 100 : 90
      doc.fontSize(9).fillColor('#000').text(`#${w.OeuvreID}`, 56, rowY, { width: 30 })
      doc.text(w.Titre || 'Sans titre', textX, rowY, { width: 190 })
      doc.text(String(w.Année || '').slice(0,4), 300, rowY, { width: 50 })
      doc.text(`€ ${formatPrice(w.Prix)}`, 360, rowY, { width: 80, align: 'right' })
      
      doc.y = Math.max(doc.y, rowY + 36)
      doc.moveDown(0.4)
      doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).strokeColor('#eee').stroke()
      doc.moveDown(0.5)
    })

    // --- Summary & Signatures Block ---
    const summaryNeeded = 180
    if (doc.y > (PH_RAW - 56 - summaryNeeded)) {
      doc.addPage()
      doc.y = 115
    } else {
      doc.moveDown(2)
    }

    // Conditions
    doc.fontSize(8).fillColor(tx2).text(isLoan ? 'Conditions de prêt :' : 'Conditions de dépôt :', 56)
    const conditionsText = isLoan
      ? 'Les œuvres listées ci-dessus sont prêtées pour une durée déterminée. L\'emprunteur s\'engage à en assurer la conservation et la protection durant toute la période de prêt.'
      : 'Les œuvres listées ci-dessus sont confiées en dépôt pour une durée déterminée. L\'assurance est à la charge du dépositaire pendant toute la durée du dépôt.'
    doc.fontSize(8).fillColor(tx2).text(conditionsText, 56, doc.y + 4, { width: W, align: 'justify' })

    // Commission line — only for consignments with a non-zero rate.
    const commissionPct = Number(order.commission_pct ?? 0)
    if (!isLoan && commissionPct > 0) {
      doc.moveDown(1)
      doc.fontSize(8).fillColor(tx2).text(
        `Commission galerie : ${commissionPct}% du prix de vente net (hors taxes), prélevée à la vente.`,
        56, doc.y, { width: W, align: 'justify' }
      )
    }

    doc.moveDown(2)
    doc.fontSize(9).fillColor(tx2).text('PÉRIODE', 56, doc.y)
    doc.fontSize(10).fillColor('#000').text(`Du ${order.start_date || '—'} au ${order.end_date || '—'}`)

    // Signatures
    const sigY = 740
    doc.fontSize(8).fillColor(tx2).text('POUR L\'ARTISTE', 56, sigY)
    doc.moveTo(56, sigY + 40).lineTo(56 + 180, sigY + 40).lineWidth(0.5).strokeColor('#ccc').stroke()
    doc.fontSize(8).fillColor(tx2).text('POUR LE DÉPOSITAIRE', 300, sigY)
    doc.moveTo(300, sigY + 40).lineTo(300 + 180, sigY + 40).stroke()

    // --- Global Headers & Footers ---
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.fontSize(7).fillColor(tx2).text('THE PEM WORKSHOP', 56, 40)
      doc.fontSize(16).fillColor('#000').text(isLoan ? 'Bordereau de Prêt' : 'Bordereau de Dépôt', 56, 54)
      doc.fontSize(9).fillColor(ac).text(`${order.order_ref} · PAGE ${i + 1} / ${pages.count}`, 56, 74)
      
      // Footer
      doc.fontSize(6).fillColor('#ccc').text('ARTIST ATELIER MANAGEMENT SYSTEM · CONFIDENTIEL', 56, PH_RAW - 45, { width: W, align: 'center', lineBreak: false })
    }

    doc.end()
  })
}
