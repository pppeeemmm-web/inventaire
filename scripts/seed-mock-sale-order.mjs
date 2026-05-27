/**
 * Dev helper: insert a draft sale_order + generate/upload the commercial bond PDF.
 * Does not change Oeuvres status (unlike createSaleOrder in the UI).
 *
 * Usage: node scripts/seed-mock-sale-order.mjs
 */
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { createRequire } from 'module'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

config({ path: path.join(root, '.env.local') })

const require = createRequire(import.meta.url)
const jiti = require('jiti')(import.meta.url, {
  alias: {
    '@': root,
    'server-only': path.join(root, 'scripts/stubs/server-only-stub.cjs'),
  },
})

const { buildOrderPdf } = jiti(path.join(root, 'app/atelier/(portal)/sales/actions.ts'))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

const OEUVRE_IDS = [4, 5]
const BUYER_ID = 674
const PRIX_CATALOGUE = 2500
const PRIX_FINAL = 2500

const notes = `MOCKUP PDF preview — safe to delete\nBATCH_IDS: ${JSON.stringify(OEUVRE_IDS)}`

const { data: order, error: insertErr } = await sb
  .from('sale_order')
  .insert({
    oeuvre_id: OEUVRE_IDS[0],
    buyer_id: BUYER_ID,
    prix_catalogue: PRIX_CATALOGUE,
    discount_pct: 0,
    prix_final: PRIX_FINAL,
    deposit_pct: 30,
    deposit_due: '2026-06-01',
    balance_due: '2026-07-01',
    payment_method: 'Virement bancaire',
    delivery_address: '12 rue de la Paix, 75002 Paris',
    shipping_method: 'Transporteur art',
    delivery_date: '2026-06-15',
    notes,
    statut: 'draft',
  })
  .select()
  .single()

if (insertErr || !order) {
  console.error('Insert failed:', insertErr?.message ?? 'no row')
  process.exit(1)
}

const orderWithIds = { ...order, oeuvre_ids: OEUVRE_IDS }
const pdf = await buildOrderPdf(orderWithIds, sb)
const pdfKey = `orders/ORDER_${order.order_ref}.pdf`
const bucket = process.env.R2_VAULT_BUCKET ?? 'vault'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
})

await s3.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: pdfKey,
    Body: pdf,
    ContentType: 'application/pdf',
  }),
)

await sb.from('sale_order').update({ pdf_path: pdfKey }).eq('id', order.id)

await sb.from('document').insert({
  name: `Commercial Bond ${order.order_ref}`,
  kind: 'facture',
  notes: `MOCKUP for order ${order.order_ref}`,
  doc_date: new Date().toISOString().slice(0, 10),
  oeuvre_id: OEUVRE_IDS[0],
  oeuvre_ids: OEUVRE_IDS,
  storage_path: pdfKey,
  file_size: pdf.length,
  mime_type: 'application/pdf',
})

console.log(
  JSON.stringify(
    {
      ok: true,
      id: order.id,
      order_ref: order.order_ref,
      pdf_path: pdfKey,
      pdf_bytes: pdf.length,
      view: 'http://localhost:3000/atelier/sales',
    },
    null,
    2,
  ),
)
