'use server'

// Sale order server actions — create, update status, generate PDF order form.

import { createClient }  from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaleOrderRow {
  id:               string
  created_at:       string
  oeuvre_id:        number
  buyer_id:         number | null
  prix_catalogue:   number | null
  discount_pct:     number | null
  prix_final:       number | null
  currency:         string
  deposit_pct:      number | null
  deposit_due:      string | null
  balance_due:      string | null
  payment_method:   string | null
  deposit_paid:     boolean
  balance_paid:     boolean
  delivery_address: string | null
  shipping_method:  string | null
  delivery_date:    string | null
  delivered:        boolean
  order_ref:        string | null
  statut:           string
  notes:            string | null
  pdf_path:         string | null
}

export type OrderResult = { error: string } | { ok: true; order: SaleOrderRow }
export type SimpleResult = { error: string } | { ok: true }

// ── Auth guard ────────────────────────────────────────────────────────────────

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

// ── R2 helper (vault bucket) ──────────────────────────────────────────────────

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

// ── Create order ──────────────────────────────────────────────────────────────

export async function createSaleOrder(formData: FormData): Promise<OrderResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const oeuvre_id       = Number(formData.get('oeuvre_id'))
  const buyer_id        = formData.get('buyer_id')        ? Number(formData.get('buyer_id'))        : null
  const prix_catalogue  = formData.get('prix_catalogue')  ? Number(formData.get('prix_catalogue'))  : null
  const discount_pct    = formData.get('discount_pct')    ? Number(formData.get('discount_pct'))    : null
  const prix_final      = formData.get('prix_final')      ? Number(formData.get('prix_final'))      : null
  const deposit_pct     = formData.get('deposit_pct')     ? Number(formData.get('deposit_pct'))     : null
  const deposit_due     = (formData.get('deposit_due')    as string | null) || null
  const balance_due     = (formData.get('balance_due')    as string | null) || null
  const payment_method  = (formData.get('payment_method') as string | null) || null
  const delivery_address = (formData.get('delivery_address') as string | null) || null
  const shipping_method  = (formData.get('shipping_method')  as string | null) || null
  const delivery_date    = (formData.get('delivery_date')    as string | null) || null
  const notes            = (formData.get('notes')            as string | null) || null

  if (!oeuvre_id) return { error: 'Œuvre requise' }

  const { data: order, error: dbErr } = await supabase
    .from('sale_order')
    .insert({
      oeuvre_id, buyer_id,
      prix_catalogue, discount_pct, prix_final,
      deposit_pct, deposit_due, balance_due, payment_method,
      delivery_address, shipping_method, delivery_date,
      notes,
      statut: 'draft',
    })
    .select()
    .single()

  if (dbErr || !order) return { error: dbErr?.message ?? 'Insert failed' }

  // Update the work: mark as sold, set buyer and delivery date
  await supabase
    .from('Oeuvres')
    .update({
      statusId:      6,   // Sold
      AcheteurID:    buyer_id,
      DateLivraison: delivery_date,
      ContactID:     buyer_id,   // work now at buyer's location
      LocalisationID: buyer_id,
    })
    .eq('OeuvreID', oeuvre_id)

  // Generate PDF and store in vault
  try {
    const pdf = await buildOrderPdf(order as SaleOrderRow, supabase)
    const key = `orders/ORDER_${order.order_ref}.pdf`
    await r2UploadPdf(key, pdf)
    await supabase.from('sale_order').update({ pdf_path: key }).eq('id', order.id)
    ;(order as SaleOrderRow).pdf_path = key
  } catch { /* PDF generation is non-blocking */ }

  return { ok: true, order: order as SaleOrderRow }
}

// ── Update order status ───────────────────────────────────────────────────────

export async function updateOrderStatut(
  id: string,
  statut: string,
  field?: 'deposit_paid' | 'balance_paid' | 'delivered',
): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const update: Record<string, unknown> = { statut }
  if (field) update[field] = true

  const { error } = await supabase.from('sale_order').update(update).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Fetch orders ──────────────────────────────────────────────────────────────

export async function fetchOrders(): Promise<SaleOrderRow[]> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return []

  const { data } = await supabase
    .from('sale_order')
    .select('*')
    .order('created_at', { ascending: false })

  return (data ?? []) as SaleOrderRow[]
}

// ── PDF builder ───────────────────────────────────────────────────────────────

async function buildOrderPdf(order: SaleOrderRow, supabase: Awaited<ReturnType<typeof createClient>>): Promise<Buffer> {
  // Fetch work and buyer details for the PDF
  const { data: o } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, Technique, Support, Hauteur, Largeur, Profondeur, txtImageNameLink')
    .eq('OeuvreID', order.oeuvre_id)
    .single()

  const { data: buyer } = order.buyer_id
    ? await supabase.from('Contact').select('Nom, Prénom, NomInstitution, Ville, Pays').eq('ContactID', order.buyer_id).single()
    : { data: null }

  const [{ data: techRow }, { data: suppRow }] = await Promise.all([
    o?.Technique ? supabase.from('Technique').select('Technique').eq('TechniqueID', o.Technique).single() : Promise.resolve({ data: null }),
    o?.Support   ? supabase.from('Support').select('Support').eq('SupportID', o.Support).single()         : Promise.resolve({ data: null }),
  ])

  const buyerName = (buyer as any)?.NomInstitution
    || `${(buyer as any)?.Prénom ?? ''} ${(buyer as any)?.Nom ?? ''}`.trim()
    || 'N/A'
  const buyerLocation = [(buyer as any)?.Ville, (buyer as any)?.Pays].filter(Boolean).join(', ')
  const dims = o?.Hauteur && o?.Largeur
    ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm`
    : '—'

  // Fetch work image
  let imageBuffer: Buffer | null = null
  if (o?.txtImageNameLink) {
    try {
      const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ''
      const url = `${R2}/${encodeURIComponent(o.txtImageNameLink)}`
      const res = await fetch(url)
      if (res.ok) imageBuffer = Buffer.from(await res.arrayBuffer())
    } catch { /* skip */ }
  }

  const PDFDocument = (await import('pdfkit')).default
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Order ${order.order_ref}` } })
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 112 // usable width
    const ac = '#c8a86e'
    const tx2 = '#888'

    // Header
    doc.fontSize(9).fillColor(tx2).text('PIERRE EMMANUEL MOULIN', 56, 56)
    doc.fontSize(18).fillColor('#fff').text(`Bon de commande`, 56, 72)
    doc.fontSize(10).fillColor(ac).text(order.order_ref ?? '', 56, 96)
    doc.moveDown(0.5)

    // Date
    doc.fontSize(8).fillColor(tx2)
      .text(`Date : ${new Date(order.created_at).toLocaleDateString('fr-FR')}`, { align: 'right' })
    doc.moveDown(1)

    // Buyer block
    doc.fontSize(9).fillColor(tx2).text('ACHETEUR')
    doc.fontSize(11).fillColor('#fff').text(buyerName)
    if (buyerLocation) doc.fontSize(9).fillColor(tx2).text(buyerLocation)
    if (order.delivery_address) doc.fontSize(9).fillColor(tx2).text(order.delivery_address)
    doc.moveDown(1.5)

    // Work image (right side)
    if (imageBuffer) {
      try {
        doc.image(imageBuffer, 56 + W - 120, 130, { width: 120, height: 120, fit: [120, 120] })
      } catch { /* skip */ }
    }

    // Work details
    doc.fontSize(9).fillColor(tx2).text('ŒUVRE')
    doc.fontSize(13).fillColor('#fff').text(o?.Titre ?? 'Sans titre')
    doc.fontSize(9).fillColor(tx2)
    if (o?.Année) doc.text(`Année : ${String(o.Année).slice(0, 4)}`)
    if ((techRow as any)?.Technique) doc.text(`Technique : ${(techRow as any).Technique}`)
    if ((suppRow as any)?.Support)   doc.text(`Support : ${(suppRow as any).Support}`)
    doc.text(`Dimensions : ${dims}`)
    doc.moveDown(1.5)

    // Financial table
    doc.fontSize(9).fillColor(tx2).text('FINANCES')
    doc.moveDown(0.3)
    const rows: [string, string][] = []
    if (order.prix_catalogue) rows.push(['Prix catalogue', `€ ${Number(order.prix_catalogue).toLocaleString('fr-FR')}`])
    if (order.discount_pct)   rows.push(['Remise', `${order.discount_pct}%`])
    rows.push(['Prix final', `€ ${Number(order.prix_final ?? 0).toLocaleString('fr-FR')}`])
    if (order.deposit_pct) {
      const dep = Math.round((order.prix_final ?? 0) * (order.deposit_pct / 100))
      rows.push([`Acompte (${order.deposit_pct}%)`, `€ ${dep.toLocaleString('fr-FR')}`])
    }
    for (const [label, val] of rows) {
      const y = doc.y
      doc.fontSize(8).fillColor(tx2).text(label, 56, y)
      doc.fontSize(8).fillColor('#fff').text(val, 56 + W - 100, y, { width: 100, align: 'right' })
      doc.moveDown(0.4)
    }
    doc.moveDown(0.5)

    // Payment terms
    if (order.payment_method || order.deposit_due || order.balance_due) {
      doc.fontSize(9).fillColor(tx2).text('CONDITIONS DE PAIEMENT')
      doc.moveDown(0.3)
      if (order.payment_method) doc.fontSize(8).fillColor('#fff').text(`Mode : ${order.payment_method}`)
      if (order.deposit_due)    doc.fontSize(8).fillColor(tx2).text(`Acompte dû le : ${new Date(order.deposit_due).toLocaleDateString('fr-FR')}`)
      if (order.balance_due)    doc.fontSize(8).fillColor(tx2).text(`Solde dû le : ${new Date(order.balance_due).toLocaleDateString('fr-FR')}`)
      doc.moveDown(1)
    }

    // Delivery
    if (order.shipping_method || order.delivery_date) {
      doc.fontSize(9).fillColor(tx2).text('LIVRAISON')
      doc.moveDown(0.3)
      if (order.shipping_method) doc.fontSize(8).fillColor('#fff').text(`Mode : ${order.shipping_method}`)
      if (order.delivery_date)   doc.fontSize(8).fillColor(tx2).text(`Date estimée : ${new Date(order.delivery_date).toLocaleDateString('fr-FR')}`)
      doc.moveDown(1)
    }

    // Notes
    if (order.notes) {
      doc.fontSize(9).fillColor(tx2).text('NOTES')
      doc.fontSize(8).fillColor('#fff').text(order.notes)
      doc.moveDown(1)
    }

    // Signature lines
    const sigY = Math.min(doc.y + 20, 720)
    doc.fontSize(8).fillColor(tx2)
    doc.text('Signature acheteur', 56, sigY)
    doc.text('Signature artiste', 56 + W - 140, sigY)
    doc.moveTo(56, sigY + 30).lineTo(56 + 130, sigY + 30).strokeColor('#333').stroke()
    doc.moveTo(56 + W - 140, sigY + 30).lineTo(56 + W, sigY + 30).stroke()

    // Footer
    doc.fontSize(7).fillColor('#444')
      .text(`Référence : ${order.order_ref ?? ''}  ·  Généré le ${new Date().toLocaleDateString('fr-FR')}`, 56, 780, { width: W, align: 'center' })

    doc.end()
  })
}
