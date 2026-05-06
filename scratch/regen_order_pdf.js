/**
 * Standalone script to regenerate the order PDF for PEM-2026-001.
 * Uses the same logic as the server action but runs directly with service role key.
 * 
 * Usage: node scratch/regen_order_pdf.js
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'
const IMAGE_BUCKET = process.env.R2_BUCKET ?? 'paintings'
const ORDER_REF = 'PEM-2026-001'

// ── R2 helpers ──

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

async function r2Get(key, bucketName = BUCKET) {
  try {
    const accountId  = process.env.R2_ACCOUNT_ID ?? ''
    const accessKey  = process.env.R2_ACCESS_KEY_ID ?? ''
    const secretKey  = process.env.R2_SECRET_ACCESS_KEY ?? ''
    const host       = `${accountId}.eu.r2.cloudflarestorage.com`
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    const pathname   = `/${bucketName}/${encodedKey}`
    const url        = `https://${host}${pathname}`

    const amzDate   = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
    const dateStamp = amzDate.slice(0, 8)

    const headers = {
      'host':       host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    }

    const sortedKeys       = Object.keys(headers).sort()
    const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join('')
    const signedHeaderStr  = sortedKeys.join(';')
    const canonicalRequest = ['GET', pathname, '', canonicalHeaders, signedHeaderStr, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'].join('\n')

    const credScope = `${dateStamp}/auto/s3/aws4_request`
    const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

    const hmac   = (k, d) => crypto.createHmac('sha256', k).update(d).digest()
    const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), 'auto'), 's3'), 'aws4_request')
    const sig    = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

    const res = await fetch(url, { headers })
    if (!res.ok) { console.error(`  ✗ Fetch ${res.status} for ${key}`); return null }
    const buf = Buffer.from(await res.arrayBuffer())
    console.log(`  ✓ Fetched ${buf.length} bytes: ${key}`)
    return buf
  } catch (e) {
    console.error(`  ✗ R2 Get failed: ${key}`, e.message)
    return null
  }
}

async function r2Upload(key, body) {
  const s3 = r2Client()
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        body,
    ContentType: 'application/pdf',
  }))
}

// ── Main ──

async function main() {
  console.log(`\n🔍 Fetching order ${ORDER_REF}...`)
  const { data: order, error } = await supabase
    .from('sale_order')
    .select('*')
    .eq('order_ref', ORDER_REF)
    .single()

  if (error || !order) { console.error('Order not found:', error?.message); process.exit(1) }
  console.log(`  ✓ Found order id=${order.id}  statut=${order.statut}`)

  // Extract work IDs
  let ids = []
  if (order.notes?.includes('BATCH_IDS:')) {
    try {
      const match = order.notes.match(/BATCH_IDS: (\[.*?\])/)
      if (match) ids = JSON.parse(match[1])
    } catch { ids = [order.oeuvre_id] }
  }
  if (ids.length === 0) ids = [order.oeuvre_id]
  console.log(`  ✓ ${ids.length} works: ${ids.join(', ')}`)

  // Fetch works
  const { data: works } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, Technique, Support, Hauteur, Largeur, Profondeur, txtImageNameLink, Prix')
    .in('OeuvreID', ids)

  const { data: buyer } = order.buyer_id
    ? await supabase.from('Contact').select('Nom, Prénom, NomInstitution, Ville, Pays').eq('ContactID', order.buyer_id).single()
    : { data: null }

  const techIds = [...new Set(works?.map(w => w.Technique).filter(Boolean))]
  const suppIds = [...new Set(works?.map(w => w.Support).filter(Boolean))]
  const [{ data: techs }, { data: supps }] = await Promise.all([
    techIds.length > 0 ? supabase.from('Technique').select('TechniqueID, Technique').in('TechniqueID', techIds) : Promise.resolve({ data: [] }),
    suppIds.length > 0 ? supabase.from('Support').select('SupportID, Support').in('SupportID', suppIds) : Promise.resolve({ data: [] }),
  ])

  const tM = Object.fromEntries((techs ?? []).map(t => [t.TechniqueID, t.Technique]))
  const sM = Object.fromEntries((supps ?? []).map(s => [s.SupportID, s.Support]))

  const buyerName = buyer?.NomInstitution
    || `${buyer?.Prénom ?? ''} ${buyer?.Nom ?? ''}`.trim()
    || 'N/A'
  const buyerLocation = [buyer?.Ville, buyer?.Pays].filter(Boolean).join(', ')

  console.log(`  ✓ Buyer: ${buyerName} (${buyerLocation})`)
  console.log(`  ✓ Works: ${(works ?? []).map(w => w.Titre).join(', ')}`)

  // Fetch images
  console.log(`\n🖼  Fetching work images...`)
  const workImages = {}
  await Promise.all((works ?? []).map(async (w) => {
    if (w.txtImageNameLink) {
      const thumbName = `thumbs/${w.txtImageNameLink.replace(/\.[^.]+$/, '')}.avif`
      let buf = await r2Get(thumbName, IMAGE_BUCKET)
      if (!buf) buf = await r2Get(w.txtImageNameLink, IMAGE_BUCKET)
      if (buf) {
        try { workImages[w.OeuvreID] = await sharp(buf).png().toBuffer() }
        catch { workImages[w.OeuvreID] = buf }
      }
    }
  }))

  const formatPrice = (v) => {
    if (v === null || v === 0) return '0'
    return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  }

  // ── Build PDF ──
  console.log(`\n📄 Building PDF...`)
  const pdfBuf = await new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 80
    const ac = '#c8a86e'
    const tx2 = '#888'
    const isPaid = order.statut === 'completed' || order.balance_paid
    const footerY = 800

    let y = 115
    const col1 = 40, col2 = 320

    doc.fontSize(8).fillColor(tx2).text('ACHETEUR', col1, y)
    doc.fontSize(11).fillColor('#000').text(buyerName, col1, y + 12)
    if (buyerLocation) doc.fontSize(9).fillColor(tx2).text(buyerLocation, col1, y + 26)

    doc.fontSize(8).fillColor(tx2).text('LIVRAISON', col2, y)
    doc.fontSize(9).fillColor('#000').text(order.delivery_address || '—', col2, y + 12, { width: 230 })
    if (order.shipping_method) doc.fontSize(8).fillColor(tx2).text(`Via : ${order.shipping_method}`, col2)
    if (order.delivery_date)   doc.fontSize(8).fillColor(tx2).text(`Estimée le : ${new Date(order.delivery_date).toLocaleDateString('fr-FR')}`, col2)

    doc.moveTo(40, 180).lineTo(40 + W, 180).lineWidth(0.5).strokeColor('#eee').stroke()

    doc.fontSize(8).fillColor(tx2).text('DÉTAIL DES ŒUVRES', 40, 200)
    doc.y = 215

    for (const w of (works ?? [])) {
      if (doc.y > 720) {
        doc.addPage()
        doc.y = 115
        doc.fontSize(8).fillColor(tx2).text('DÉTAIL DES ŒUVRES (SUITE)', 40, doc.y)
        doc.y += 15
      }

      const rowY = doc.y
      const imgBuf = workImages[w.OeuvreID]
      if (imgBuf) {
        try { doc.image(imgBuf, 40, rowY, { width: 36, height: 36, fit: [36, 36] }) } catch {}
      }

      const textX = 85
      doc.fontSize(9).fillColor('#000').text(`${w.Titre || 'Sans titre'} (${String(w.Année || '').slice(0,4)})`, textX, rowY)
      const desc = [tM[w.Technique] || '', sM[w.Support] || ''].filter(Boolean).join(' sur ')
      const dims = w.Hauteur && w.Largeur ? `${w.Hauteur} × ${w.Largeur}${w.Profondeur ? ` × ${w.Profondeur}` : ''} cm` : ''
      doc.fontSize(7).fillColor(tx2).text(`${desc}${desc && dims ? '  ·  ' : ''}${dims}`, textX, rowY + 12)
      doc.fontSize(9).fillColor('#000').text(`€ ${formatPrice(w.Prix)}`, 40 + W - 100, rowY, { width: 100, align: 'right' })

      doc.y = rowY + 40
      doc.moveTo(40, doc.y).lineTo(40 + W, doc.y).lineWidth(0.1).strokeColor('#f0f0f0').stroke()
      doc.y += 6
    }

    // Watermark rendered in bufferedPageRange loop below

    const summaryNeeded = 220
    if (doc.y > (841 - 40 - summaryNeeded)) {
      doc.addPage()
      doc.y = 115
    } else {
      doc.moveDown(2)
    }

    const startSummaryY = doc.y
    const totalW = 200
    const totalX = 40 + W - totalW

    const rows = [
      ['Total catalogue', `€ ${formatPrice(order.prix_catalogue)}`, false],
      ['Remise', `${order.discount_pct || 0}%`, false],
      ['NET À PAYER', `€ ${formatPrice(order.prix_final)}`, true],
    ]

    for (const [l, v, bold] of rows) {
      const cy = doc.y
      doc.fontSize(9).fillColor(tx2).text(l, totalX, cy)
      doc.fontSize(bold ? 14 : 10).fillColor(bold ? ac : '#000').text(v, totalX, cy - (bold ? 3 : 0), { width: totalW, align: 'right' })
      doc.moveDown(bold ? 1.5 : 1.2)
    }

    doc.y = startSummaryY
    if (!isPaid && (order.payment_method || order.deposit_due || order.balance_due)) {
      doc.fontSize(8).fillColor(tx2).text('RÈGLEMENT', 40, doc.y)
      doc.moveDown(0.5)
      if (order.payment_method) doc.fontSize(9).fillColor('#000').text(`Mode : ${order.payment_method}`, 40)
      if (order.deposit_pct) {
        const depAmt = Math.round((order.prix_final || 0) * (order.deposit_pct / 100))
        doc.fontSize(9).fillColor('#000').text(`Acompte (${order.deposit_pct}%) : € ${formatPrice(depAmt)}`)
      }
      if (order.deposit_due) doc.fontSize(8).fillColor(tx2).text(`Échéance acompte : ${new Date(order.deposit_due).toLocaleDateString('fr-FR')}`)
      if (order.balance_due) doc.fontSize(8).fillColor(tx2).text(`Échéance solde : ${new Date(order.balance_due).toLocaleDateString('fr-FR')}`)
    } else if (isPaid && order.payment_method) {
      doc.fontSize(8).fillColor(tx2).text('RÈGLEMENT', 40, doc.y)
      doc.moveDown(0.5)
      doc.fontSize(9).fillColor('#000').text(`Réglé par : ${order.payment_method}`, 40)
      doc.fontSize(8).fillColor(tx2).text(`Le : ${new Date(order.updated_at || order.created_at || '').toLocaleDateString('fr-FR')}`)
    }

    const sigY = footerY - 80
    doc.moveTo(40, sigY).lineTo(40 + 150, sigY).lineWidth(0.5).strokeColor('#ccc').stroke()
    doc.moveTo(40 + W - 150, sigY).lineTo(40 + W, sigY).stroke()
    doc.fontSize(7).fillColor(tx2)
    doc.text('Signature de l\'acheteur', 40, sigY + 6)
    doc.text('Signature de l\'artiste', 40 + W - 150, sigY + 6, { align: 'right' })

    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)

      // PAYÉ / PAID watermark on every page
      if (isPaid) {
        doc.save()
        doc.fontSize(80).fillColor('#72b872', 0.12).rotate(-30, { origin: [300, 450] })
        doc.text('PAYÉ / PAID', 150, 400, { characterSpacing: 5 })
        doc.restore()
      }

      doc.fontSize(7).fillColor(tx2).text('PIERRE EMMANUEL MOULIN', 40, 40)
      doc.fontSize(16).fillColor('#222').text('Bon de commande', 40, 54)
      doc.fontSize(9).fillColor(ac).text(`${order.order_ref} · PAGE ${i + 1} / ${pages.count}`, 40, 74)
      doc.fontSize(7).fillColor(tx2).text(`Date : ${new Date(order.created_at || '').toLocaleDateString('fr-FR')}`, 40 + W - 100, 40, { align: 'right' })
      doc.fontSize(7).fillColor('#bbb').text('Ce document fait office de bordereau de vente et de facture.', 40, footerY, { width: W, align: 'center', lineBreak: false })
    }

    doc.end()
  })

  console.log(`  ✓ PDF generated: ${pdfBuf.length} bytes`)

  // Save locally
  const localPath = join(__dirname, '..', 'docs', `ORDER_${ORDER_REF}.pdf`)
  fs.mkdirSync(dirname(localPath), { recursive: true })
  fs.writeFileSync(localPath, pdfBuf)
  console.log(`  ✓ Saved locally: ${localPath}`)

  // Upload to R2
  const key = `orders/ORDER_${ORDER_REF}.pdf`
  console.log(`\n☁  Uploading to R2: ${key}...`)
  await r2Upload(key, pdfBuf)
  console.log(`  ✓ Uploaded!`)

  // Update DB
  await supabase.from('sale_order').update({ pdf_path: key }).eq('id', order.id)
  console.log(`  ✓ DB updated\n\n✅ Done!\n`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
