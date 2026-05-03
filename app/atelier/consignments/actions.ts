
'use server'

import { createClient }  from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export interface ConsignmentOrderRow {
  id:               string
  created_at:       string
  oeuvre_id:        number
  partner_id:       number | null
  start_date:       string | null
  end_date:         string | null
  insurance_value:  number | null
  catalog_price:    number | null
  status:           string
  order_ref:        string | null
  pdf_path:         string | null
  notes:            string | null
}

export type ConsignmentResult = { error: string } | { ok: true; order: ConsignmentOrderRow }

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié', supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé', supabase: null }
  return { error: null, supabase }
}

async function r2UploadPdf(key: string, body: Buffer) {
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
}

export async function createConsignmentOrder(formData: FormData): Promise<ConsignmentResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const oeuvre_ids     = formData.getAll('oeuvre_ids').map(Number)
  const partner_id     = formData.get('partner_id')     ? Number(formData.get('partner_id')) : null
  const start_date     = (formData.get('start_date')     as string | null) || null
  const end_date       = (formData.get('end_date')       as string | null) || null
  const notes          = (formData.get('notes')          as string | null) || null

  if (oeuvre_ids.length === 0) return { error: 'Au moins une œuvre est requise' }

  // 1. Create the formal consignment record
  const { data: order, error: dbErr } = await supabase
    .from('consignment_order')
    .insert({
      partner_id,
      start_date, end_date,
      notes: `BATCH_IDS: ${JSON.stringify(oeuvre_ids)}\n${notes || ''}`,
      status: 'active',
      order_ref: `CNSG-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    })
    .select()
    .single()

  if (dbErr || !order) return { error: 'Database error: Ensure the consignment_order table exists. SQL: ' + dbErr?.message }

  // 2. LOGISTICS AUTOMATION: Multi-work update
  await supabase
    .from('Oeuvres')
    .update({
      statusId:       7,   // Consigned
      ContactID:      partner_id,
      LocalisationID: partner_id, 
      ReturnDate:     end_date,
    })
    .in('OeuvreID', oeuvre_ids)

    // 3. Generate Bordereau de Dépôt (Multi-work PDF)
  try {
    const pdf = await buildConsignmentPdf(order as ConsignmentOrderRow, oeuvre_ids, supabase)
    const key = `consignments/BORDEREAU_${order.order_ref}.pdf`
    await r2UploadPdf(key, pdf)
    
    // Update order record
    await supabase.from('consignment_order').update({ pdf_path: key }).eq('id', order.id)
    ;(order as ConsignmentOrderRow).pdf_path = key

    // ALSO register in the central 'document' table so it appears in the Vault Tab
    await supabase.from('document').insert({
      name:         `Bordereau de Dépôt ${order.order_ref}`,
      kind:         'contrat',
      notes:        `Generated for consignment ${order.order_ref}`,
      doc_date:     new Date().toISOString().slice(0, 10),
      oeuvre_id:    oeuvre_ids[0],
      oeuvre_ids:   oeuvre_ids,
      storage_path: key,
      file_size:    pdf.length,
      mime_type:    'application/pdf',
    })
  } catch (e) {
    console.error('PDF Error:', e)
  }

  return { ok: true, order: order as ConsignmentOrderRow }
}

export async function regenerateConsignmentPdf(id: string): Promise<{ error?: string; ok?: boolean }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: order, error: fetchErr } = await supabase.from('consignment_order').select('*').eq('id', id).single()
  if (fetchErr || !order) return { error: 'Order not found' }

  // Extract IDs from notes
  let oeuvre_ids: number[] = []
  if (order.notes?.includes('BATCH_IDS:')) {
    try {
      const match = order.notes.match(/BATCH_IDS: (\[.*?\])/)
      if (match) oeuvre_ids = JSON.parse(match[1])
    } catch {}
  }
  
  if (oeuvre_ids.length === 0) return { error: 'No artworks linked to this consignment in notes.' }

  try {
    const pdf = await buildConsignmentPdf(order as ConsignmentOrderRow, oeuvre_ids, supabase)
    const key = `consignments/BORDEREAU_${order.order_ref}.pdf`
    await r2UploadPdf(key, pdf)
    await supabase.from('consignment_order').update({ pdf_path: key }).eq('id', id)
    return { ok: true }
  } catch (e) {
    return { error: String(e) }
  }
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

    doc.fontSize(9).fillColor(tx2).text('DÉPOSITAIRE / PARTNER', 56, y)
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
    doc.fontSize(8).fillColor(tx2).text('Conditions de dépôt :', 56)
    doc.fontSize(8).fillColor(tx2).text('Les œuvres listées ci-dessus sont confiées en dépôt pour une durée déterminée. L\'assurance est à la charge du dépositaire pendant toute la durée du dépôt.', 56, doc.y + 4, { width: W, align: 'justify' })

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
      doc.fontSize(7).fillColor(tx2).text('PIERRE EMMANUEL MOULIN', 56, 40)
      doc.fontSize(16).fillColor('#000').text('Bordereau de Dépôt', 56, 54)
      doc.fontSize(9).fillColor(ac).text(`${order.order_ref} · PAGE ${i + 1} / ${pages.count}`, 56, 74)
      
      // Footer
      doc.fontSize(6).fillColor('#ccc').text('ARTIST ATELIER MANAGEMENT SYSTEM · CONFIDENTIEL', 56, PH_RAW - 45, { width: W, align: 'center', lineBreak: false })
    }

    doc.end()
  })
}
