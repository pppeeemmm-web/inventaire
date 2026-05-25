'use server'

// Sale order server actions — create, update status, generate PDF order form.

import { createClient }  from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { logSystemEvent } from '@/lib/utils/logging'
import {
  appendHistoriqueForOeuvres,
  historiqueLinesForOeuvreUpdate,
} from '@/lib/oeuvre-historique'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { addCalendarDaysIso, parseSaleOrderBatchIds } from '@/lib/sale-return-window'
import { recordStorageObject } from '@/lib/storage-object-ledger'
import {
  contactDisplayName,
  contactLocation,
  fromConsignmentOrder,
  fromContact,
  fromDocument,
  fromOeuvres,
  fromPayments,
  fromSaleOrder,
  fromSupport,
  fromTechnique,
  type ConsignmentBriefRow,
  type ContactBriefRow,
  type ReturnWindowOrderRow,
  type SaleOrderDbRow,
  type SaleOrderDbUpdate,
} from '@/lib/sales/sales-client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaleOrderRow {
  id:                   string
  created_at:           string
  oeuvre_id:            number
  oeuvre_ids?:          number[] // New plural support
  buyer_id:             number | null
  prix_catalogue:       number | null
  discount_pct:         number | null
  prix_final:           number | null
  currency:             string
  deposit_pct:          number | null
  deposit_due:          string | null
  balance_due:          string | null
  payment_method:       string | null
  deposit_paid:         boolean
  balance_paid:         boolean
  delivery_address:     string | null
  shipping_method:      string | null
  delivery_date:        string | null
  delivered:            boolean
  order_ref:            string | null
  statut:               string
  notes:                string | null
  pdf_path:             string | null
  consignment_order_id: string | null
  commission_amount:    number | null
  updated_at?:          string | null
  payments?:            PaymentRow[]
  /** Cooling-off length (calendar days); 0 disables auto archive. */
  return_window_days?:        number | null
  return_window_starts_at?:  string | null
  return_window_skipped?:    boolean | null
  completed_at?:             string | null
}

export interface PaymentRow {
  id: string
  order_id: string
  amount: number
  payment_date: string
  method: string | null
  notes: string | null
  created_at: string
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

// Find the active consignment_order that best matches the works being sold.
// Returns the order id with the largest overlap, or null if none found.
async function detectActiveConsignment(supabase: Awaited<ReturnType<typeof guardTeam>>['supabase'], oeuvre_ids: number[]): Promise<string | null> {
  if (!supabase || oeuvre_ids.length === 0) return null

  const { data: consignedWorks } = await fromOeuvres(supabase)
    .select('OeuvreID')
    .in('OeuvreID', oeuvre_ids)
    .eq('statusId', 7)

  const candidateIds = (consignedWorks ?? []).map((w) => w.OeuvreID)
  if (candidateIds.length === 0) return null

  const { data: orders } = await fromConsignmentOrder(supabase)
    .select('id, notes, kind, status')
    .eq('status', 'active')
    .eq('kind', 'consignment')

  let best: { id: string; overlap: number } | null = null
  for (const o of (orders ?? [])) {
    if (!o.notes?.includes('BATCH_IDS:')) continue
    let ids: number[] = []
    try {
      const m = o.notes.match(/BATCH_IDS: (\[.*?\])/)
      if (m) ids = JSON.parse(m[1])
    } catch { continue }
    const overlap = ids.filter((id: number) => candidateIds.includes(id)).length
    if (overlap > 0 && (!best || overlap > best.overlap)) {
      best = { id: o.id, overlap }
    }
  }
  return best?.id ?? null
}

const BUCKET       = process.env.R2_VAULT_BUCKET ?? 'vault'
const IMAGE_BUCKET = process.env.R2_BUCKET       ?? 'paintings'

let _s3: S3Client | null = null
function r2Client() {
  if (_s3) return _s3
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  return _s3
}

async function r2Get(key: string, bucketName: string = BUCKET): Promise<Buffer | null> {
  try {
    const accountId = process.env.R2_ACCOUNT_ID ?? ''
    const accessKey = process.env.R2_ACCESS_KEY_ID ?? ''
    const secretKey = process.env.R2_SECRET_ACCESS_KEY ?? ''
    const host      = `${accountId}.eu.r2.cloudflarestorage.com`
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    const pathname  = `/${bucketName}/${encodedKey}`
    const url       = `https://${host}${pathname}`

    const amzDate   = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z'
    const dateStamp = amzDate.slice(0, 8)
    const crypto    = await import('crypto')

    const headers: Record<string, string> = {
      'host':       host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty body
    }

    const sortedKeys       = Object.keys(headers).sort()
    const canonicalHeaders = sortedKeys.map(k => `${k}:${headers[k]}\n`).join('')
    const signedHeaderStr  = sortedKeys.join(';')
    const canonicalRequest = ['GET', pathname, '', canonicalHeaders, signedHeaderStr, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'].join('\n')

    const credScope = `${dateStamp}/auto/s3/aws4_request`
    const strToSign = ['AWS4-HMAC-SHA256', amzDate, credScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')

    const hmac = (key: Buffer | string, data: string) => crypto.createHmac('sha256', key).update(data).digest()
    const sigKey = hmac(hmac(hmac(hmac('AWS4' + secretKey, dateStamp), 'auto'), 's3'), 'aws4_request')
    const sig    = crypto.createHmac('sha256', sigKey).update(strToSign).digest('hex')

    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credScope}, SignedHeaders=${signedHeaderStr}, Signature=${sig}`

    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.error(`[PDF] Fetch FAILED ${res.status} for ${key}`)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    return buf
  } catch (e) {
    console.error(`[PDF] R2 Get failed: ${key}`, e)
    return null
  }
}

async function r2UploadPdf(key: string, body: Buffer, rowId?: string | null) {
  const s3 = r2Client()
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        body,
    ContentType: 'application/pdf',
  }))
  await recordStorageObject({
    bucket: BUCKET,
    objectKey: key,
    sizeBytes: body.length,
    contentType: 'application/pdf',
    source: 'sale_order_pdf',
    classification: 'linked',
    linkedRefs: [
      { table: 'sale_order', column: 'pdf_path', row_id: rowId ?? null },
      { table: 'document', column: 'storage_path' },
    ],
  })
}

// ── Create order ──────────────────────────────────────────────────────────────

export async function createSaleOrder(formData: FormData): Promise<OrderResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const oeuvre_ids      = formData.getAll('oeuvre_ids').map(Number)
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

  if (oeuvre_ids.length === 0) return { error: 'Œuvre(s) requise(s)' }

  // Auto-detect a parent consignment_order so we can compute the gallery commission
  // at completion. We pick the active consignment (kind='consignment') that covers
  // the largest subset of works currently in statusId 7. Loans (statusId 8) and works
  // outside any consignment are ignored.
  const consignment_order_id = await detectActiveConsignment(supabase, oeuvre_ids)

  const { data: order, error: dbErr } = await fromSaleOrder(supabase)
    .insert({
      oeuvre_id: oeuvre_ids[0], 
      buyer_id,
      prix_catalogue, discount_pct, prix_final,
      deposit_pct, deposit_due, balance_due, payment_method,
      delivery_address, shipping_method, delivery_date,
      notes: `BATCH_IDS: ${JSON.stringify(oeuvre_ids)}\n${notes || ''}`,
      statut: 'draft',
      consignment_order_id,
    })
    .select()
    .single()

  if (dbErr || !order) return { error: dbErr?.message ?? 'Insert failed' }
  
  await logSystemEvent({
    eventType: 'ORDER_CREATED',
    tableName: 'sale_order',
    rowId: order.id,
    metadata: { ref: order.order_ref, amount: prix_final, works: oeuvre_ids }
  })

  // Attach the list to the object for the PDF builder
  const orderWithIds = { ...order, oeuvre_ids } as SaleOrderRow

  // Update works: mark as Reserved (pending payment). Ownership transfers only on completion.
  await fromOeuvres(supabase)
    .update({
      statusId:      4,   // Réservé — payment not yet cleared
      AcheteurID:    buyer_id,
      DateLivraison: delivery_date,
    })
    .in('OeuvreID', oeuvre_ids)

  // Generate PDF and store in vault
  try {
    const pdf = await buildOrderPdf(orderWithIds, supabase)
    const key = `orders/ORDER_${order.order_ref}.pdf`
    await r2UploadPdf(key, pdf, order.id)
    
    // Update order record
    await fromSaleOrder(supabase).update({ pdf_path: key }).eq('id', order.id)
    ;(order as SaleOrderRow).pdf_path = key

    // ALSO register in the central 'document' table so it appears in the Vault Tab
    await fromDocument(supabase).insert({
      name:         `Commercial Bond ${order.order_ref}`,
      kind:         'facture',
      notes:        `Generated for order ${order.order_ref}`,
      doc_date:     new Date().toISOString().slice(0, 10),
      oeuvre_id:    oeuvre_ids[0],
      oeuvre_ids:   oeuvre_ids,
      storage_path: key,
      file_size:    pdf.length,
      mime_type:    'application/pdf',
    })
  } catch (err) {
    await logError('Sale order PDF generation failed', err, {
      source: 'sales.createSaleOrder',
      metadata: { orderId: order.id, orderRef: order.order_ref },
    })
  }

  return { ok: true, order: order as SaleOrderRow }
}

// ── Update order status ───────────────────────────────────────────────────────

export async function addPayment(order_id: string, amount: number, method: string, notes?: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await fromPayments(supabase).insert({
    order_id,
    amount,
    method,
    notes: notes ?? null,
  })

  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'PAYMENT_GRAIN',
    tableName: 'payments',
    rowId: order_id,
    newValue: amount,
    metadata: { method, notes }
  })
  
  return { ok: true }
}

export async function updateOrderStatut(id: string, statut: string, toggleField?: 'deposit_paid' | 'balance_paid' | 'delivered'): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: before, error: bfErr } = await fromSaleOrder(supabase).select('*').eq('id', id).single()
  if (bfErr || !before) return { error: bfErr?.message ?? 'Order not found' }

  const payload: SaleOrderDbUpdate = { statut }
  if (toggleField) payload[toggleField] = true

  const b = before as SaleOrderDbRow
  if (b.statut !== 'completed' && statut === 'completed') {
    payload.completed_at = new Date().toISOString()
  }

  if (toggleField === 'delivered') {
    payload.delivered = true
    if (!b.return_window_starts_at) {
      const deliv = b.delivery_date
      const ymd =
        deliv && String(deliv).length >= 10 ? String(deliv).slice(0, 10) : new Date().toISOString().slice(0, 10)
      payload.return_window_starts_at = ymd
    }
  }

  const { error } = await fromSaleOrder(supabase).update(payload).eq('id', id)
  if (error) return { error: error.message }

  // On completion: transfer ownership — statusId 6 (Vendu) or 11 (Gift) per work
  if (statut === 'completed') {
    const { data: order } = await fromSaleOrder(supabase)
      .select('oeuvre_id, notes, buyer_id, prix_final, consignment_order_id')
      .eq('id', id)
      .single()

    if (order) {
      let ids: number[] = []
      if (order.notes?.includes('BATCH_IDS:')) {
        try {
          const match = order.notes.match(/BATCH_IDS: (\[.*?\])/)
          if (match) ids = JSON.parse(match[1])
        } catch { ids = [order.oeuvre_id] }
      }
      if (ids.length === 0) ids = [order.oeuvre_id]

      const { data: works } = await fromOeuvres(supabase)
        .select('OeuvreID, is_gift, statusId, ContactID, LocalisationID')
        .in('OeuvreID', ids)

      const giftIds = (works ?? []).filter(w => w.is_gift).map(w => w.OeuvreID)
      const saleIds = (works ?? []).filter(w => !w.is_gift).map(w => w.OeuvreID)

      if (saleIds.length > 0) {
        await fromOeuvres(supabase).update({
          statusId:      6,   // Vendu
          ContactID:     order.buyer_id,
          LocalisationID: order.buyer_id,
        }).in('OeuvreID', saleIds)
      }
      if (giftIds.length > 0) {
        await fromOeuvres(supabase).update({
          statusId:      11,  // Gift
          ContactID:     order.buyer_id,
          LocalisationID: order.buyer_id,
        }).in('OeuvreID', giftIds)
      }

      if (order.buyer_id && (works ?? []).length > 0) {
        const histItems: { oeuvreId: number; lines: string[] }[] = []
        for (const w of works ?? []) {
          const toStatus = w.is_gift ? 11 : 6
          const lines = await historiqueLinesForOeuvreUpdate(
            supabase,
            {
              statusId: w.statusId,
              ContactID: w.ContactID,
              LocalisationID: w.LocalisationID,
            },
            {
              statusId: toStatus,
              contactId: order.buyer_id,
              localisationId: order.buyer_id,
            },
          )
          if (lines.length) histItems.push({ oeuvreId: w.OeuvreID, lines })
        }
        await appendHistoriqueForOeuvres(supabase, histItems)
      }

      // Compute & stamp gallery commission when sale was routed through a consignment.
      if (order.consignment_order_id) {
        const { data: consignment } = await fromConsignmentOrder(supabase)
          .select('commission_pct, order_ref')
          .eq('id', order.consignment_order_id)
          .single()

        const pct = Number(consignment?.commission_pct ?? 0)
        if (pct > 0 && order.prix_final) {
          const commission_amount = Math.round(order.prix_final * pct) / 100
          await fromSaleOrder(supabase).update({ commission_amount }).eq('id', id)

          await logSystemEvent({
            eventType: 'PAYMENT_GRAIN',
            tableName: 'sale_order',
            rowId: id,
            newValue: commission_amount,
            metadata: {
              commission_pct: pct,
              consignment_order_id: order.consignment_order_id,
              consignment_ref: consignment?.order_ref,
            },
          })
        }
      }
    }
  }

  await logSystemEvent({
    eventType: 'STATUS_CHANGE',
    tableName: 'sale_order',
    rowId: id,
    newValue: statut,
    metadata: { toggleField }
  })

  return { ok: true }
}

export async function skipSaleReturnWindow(orderId: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await fromSaleOrder(supabase)
    .update({ return_window_skipped: true })
    .eq('id', orderId)

  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'STATUS_CHANGE',
    tableName: 'sale_order',
    rowId: orderId,
    newValue: 'return_window_skipped',
    metadata: { trigger: 'manual_skip' },
  })
  return { ok: true }
}

export async function updateSaleReturnFields(
  orderId: string,
  fields: { return_window_days?: number; return_window_starts_at?: string | null },
): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const patch: SaleOrderDbUpdate = {}
  if (fields.return_window_days !== undefined) patch.return_window_days = fields.return_window_days
  if (fields.return_window_starts_at !== undefined) patch.return_window_starts_at = fields.return_window_starts_at

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await fromSaleOrder(supabase).update(patch).eq('id', orderId)
  if (error) return { error: error.message }

  await logSystemEvent({
    eventType: 'SYSTEM_CONFIG',
    tableName: 'sale_order',
    rowId: orderId,
    metadata: patch,
  })
  return { ok: true }
}

export type SaleReturnHint = {
  orderId: string
  daysTotal: number
  startsAt: string | null
  expiresOn: string | null
  daysLeft: number | null
  skipped: boolean
  delivered: boolean
  statut: string
}

export async function getReturnWindowHintForOeuvre(oeuvreId: number): Promise<SaleReturnHint | null> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return null

  const { data: orders } = await fromSaleOrder(supabase)
    .select('id, statut, notes, oeuvre_id, delivered, return_window_days, return_window_starts_at, return_window_skipped')
    .eq('statut', 'completed')
    .order('created_at', { ascending: false })
    .limit(120)

  const today = new Date().toISOString().slice(0, 10)

  for (const row of (orders ?? []) as ReturnWindowOrderRow[]) {
    const ids = parseSaleOrderBatchIds(row.notes, row.oeuvre_id)
    if (!ids.includes(oeuvreId)) continue

    const daysTotal = Number(row.return_window_days ?? 14)
    const skipped = Boolean(row.return_window_skipped)
    const start: string | null = row.return_window_starts_at ?? null
    const delivered = Boolean(row.delivered)

    if (skipped || daysTotal <= 0) {
      return {
        orderId: row.id,
        daysTotal,
        startsAt: start,
        expiresOn: null,
        daysLeft: null,
        skipped: true,
        delivered,
        statut: row.statut,
      }
    }

    if (!start) {
      return {
        orderId: row.id,
        daysTotal,
        startsAt: null,
        expiresOn: null,
        daysLeft: null,
        skipped: false,
        delivered,
        statut: row.statut,
      }
    }

    const expiresOn = addCalendarDaysIso(start, daysTotal)
    const ms = new Date(`${expiresOn}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()
    const daysLeft = Math.max(0, Math.ceil(ms / 86400000))

    return {
      orderId: row.id,
      daysTotal,
      startsAt: start,
      expiresOn,
      daysLeft,
      skipped: false,
      delivered,
      statut: row.statut,
    }
  }

  return null
}

export async function fetchPayments(order_id: string): Promise<PaymentRow[]> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return []

  const { data } = await fromPayments(supabase)
    .select('*')
    .eq('order_id', order_id)
    .order('payment_date', { ascending: true })

  return (data ?? []) as PaymentRow[]
}

export async function deleteSaleOrder(id: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // 1. Get the order to find the works and pdf path
  const { data: order, error: fetchErr } = await fromSaleOrder(supabase)
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !order) return { error: fetchErr?.message ?? 'Order not found' }

  // Extract IDs from notes
  let ids: number[] = []
  if (order.notes?.includes('BATCH_IDS:')) {
    try {
      const match = order.notes.match(/BATCH_IDS: (\[.*?\])/)
      if (match) ids = JSON.parse(match[1])
    } catch { ids = [order.oeuvre_id] }
  }
  if (ids.length === 0) ids = [order.oeuvre_id]

  // 2. Delete the order record
  const { error: delErr } = await fromSaleOrder(supabase).delete().eq('id', id)
  if (delErr) return { error: delErr.message }

  // 3. Revert works status
  await fromOeuvres(supabase)
    .update({
      statusId:      1,    // Atelier
      AcheteurID:    null,
      DateLivraison: null,
      ContactID:     13,   // Pem Atelier
      LocalisationID: 13,
    })
    .in('OeuvreID', ids)

  // 4. Cleanup document record
  if (order.pdf_path) {
    await fromDocument(supabase).delete().eq('storage_path', order.pdf_path)
  }

  return { ok: true }
}

export async function regenerateOrderPdf(id: string): Promise<SimpleResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data: order, error: fetchErr } = await fromSaleOrder(supabase).select('*').eq('id', id).single()
  if (fetchErr || !order) return { error: 'Order not found' }

  try {
    const pdf = await buildOrderPdf(order as SaleOrderRow, supabase)
    const key = `orders/ORDER_${order.order_ref}.pdf`
    await r2UploadPdf(key, pdf, id)
    await fromSaleOrder(supabase).update({ pdf_path: key }).eq('id', id)
    return { ok: true }
  } catch (err) {
    return { error: String(err) }
  }
}

// ── Fetch orders ──────────────────────────────────────────────────────────────

export async function fetchOrders(): Promise<SaleOrderRow[]> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return []

  const { data } = await fromSaleOrder(supabase)
    .select('*')
    .order('created_at', { ascending: false })

  return (data ?? []) as SaleOrderRow[]
}

// ── PDF builder ───────────────────────────────────────────────────────────────

export async function buildOrderPdf(order: SaleOrderRow, supabase: NonNullable<Awaited<ReturnType<typeof guardTeam>>['supabase']>): Promise<Buffer> {
  // Extract IDs from notes if not provided in order.oeuvre_ids
  let ids = order.oeuvre_ids || []
  if (ids.length === 0 && order.notes?.includes('BATCH_IDS:')) {
    try {
      const match = order.notes.match(/BATCH_IDS: (\[.*?\])/)
      if (match) ids = JSON.parse(match[1])
    } catch { ids = [order.oeuvre_id] }
  }
  if (ids.length === 0) ids = [order.oeuvre_id]

  // Fetch all works
  const { data: works } = await fromOeuvres(supabase)
    .select('OeuvreID, Titre, "Année", Technique, Support, Hauteur, Largeur, Profondeur, txtImageNameLink, Prix')
    .in('OeuvreID', ids)

  const { data: buyer } = order.buyer_id
    ? await fromContact(supabase).select('Nom, "Prénom", NomInstitution, Ville, Pays').eq('ContactID', order.buyer_id).single()
    : { data: null }

  const { data: consignment } = order.consignment_order_id
    ? await fromConsignmentOrder(supabase).select('commission_pct, order_ref, partner_id').eq('id', order.consignment_order_id).single()
    : { data: null }
  const commissionPct = Number((consignment as ConsignmentBriefRow | null)?.commission_pct ?? 0)
  const commissionAmount = (commissionPct > 0 && order.prix_final)
    ? Math.round(order.prix_final * commissionPct) / 100
    : 0
  const netArtiste = (order.prix_final ?? 0) - commissionAmount

  // Fetch techniques/supports for all works to avoid repeated calls or just use names if available
  // To keep it simple and fast, we'll fetch them once if possible
  type OrderWorkRow = {
    OeuvreID: number
    Technique: number | null
    Support: number | null
    txtImageNameLink: string | null
  }
  const workList = (works ?? []) as OrderWorkRow[]
  const techIds = [...new Set(workList.map((w) => w.Technique).filter((x): x is number => x != null))]
  const suppIds = [...new Set(workList.map((w) => w.Support).filter((x): x is number => x != null))]
  
  const [{ data: techs }, { data: supps }] = await Promise.all([
    techIds.length > 0 ? fromTechnique(supabase).select('TechniqueID, Technique').in('TechniqueID', techIds) : Promise.resolve({ data: [] as { TechniqueID: number; Technique: string }[] }),
    suppIds.length > 0 ? fromSupport(supabase).select('SupportID, Support').in('SupportID', suppIds) : Promise.resolve({ data: [] as { SupportID: number; Support: string }[] }),
  ])

  const tM = Object.fromEntries((techs ?? []).map((t) => [t.TechniqueID, t.Technique]))
  const sM = Object.fromEntries((supps ?? []).map((s) => [s.SupportID, s.Support]))

  const buyerName = contactDisplayName(buyer as ContactBriefRow | null)
  const buyerLocation = contactLocation(buyer as ContactBriefRow | null)

  const PDFDocument = (await import('pdfkit')).default
  const chunks: Buffer[] = []
  const workImages: Record<number, Buffer> = {}
  const sharp = (await import('sharp')).default
  
  await Promise.all(workList.map(async (w) => {
    if (w.txtImageNameLink) {
      const thumbName = `thumbs/${w.txtImageNameLink.replace(/\.[^.]+$/, '')}.avif`
      let buf = await r2Get(thumbName, IMAGE_BUCKET)
      if (!buf) buf = await r2Get(w.txtImageNameLink, IMAGE_BUCKET)

      if (buf) {
        try {
          workImages[w.OeuvreID] = await sharp(buf).png().toBuffer()
        } catch {
          workImages[w.OeuvreID] = buf
        }
      }
    }
  }))

  const formatPrice = (v: number | null) => {
    if (v === null || v === 0) return '0'
    return v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true })
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 80 
    const ac = '#c8a86e'
    const tx2 = '#888'
    const isPaid = order.statut === 'completed' || order.balance_paid
    const footerY = 800

    // --- Content Generation ---
    let y = 115 

    const col1 = 40
    const col2 = 320
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
      const desc = [
        w.Technique != null ? tM[w.Technique] ?? '' : '',
        w.Support != null ? sM[w.Support] ?? '' : '',
      ].filter(Boolean).join(' sur ')
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

    const rows: [string, string, boolean][] = [
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

    // Commission breakdown — only when routed through a consignment with a non-zero rate.
    if (commissionPct > 0) {
      const breakdown: [string, string, boolean][] = [
        [`Commission galerie (${commissionPct}%)`, `– € ${formatPrice(commissionAmount)}`, false],
        ['Net artiste', `€ ${formatPrice(netArtiste)}`, false],
      ]
      for (const [l, v, bold] of breakdown) {
        const cy = doc.y
        doc.fontSize(8).fillColor(tx2).text(l, totalX, cy)
        doc.fontSize(9).fillColor('#000').text(v, totalX, cy, { width: totalW, align: 'right' })
        doc.moveDown(1)
      }
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

      doc.fontSize(7).fillColor(tx2).text('THE PEM WORKSHOP', 40, 40)
      doc.fontSize(16).fillColor('#222').text(`Bon de commande`, 40, 54)
      doc.fontSize(9).fillColor(ac).text(`${order.order_ref} · PAGE ${i + 1} / ${pages.count}`, 40, 74)
      doc.fontSize(7).fillColor(tx2).text(`Date : ${new Date(order.created_at || '').toLocaleDateString('fr-FR')}`, 40 + W - 100, 40, { align: 'right' })
      doc.fontSize(7).fillColor('#bbb').text(`Ce document fait office de bordereau de vente et de facture.`, 40, footerY, { width: W, align: 'center', lineBreak: false })
    }

    doc.end()
  })
}
