'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateCOA } from '@/app/atelier/vault/actions'
import { logSystemEvent } from '@/lib/utils/logging'

export type FieldDocType = 'coa' | 'consignment' | 'invoice'

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null }
  return { error: null, supabase }
}

async function simpleFieldPdf(title: string, body: string): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.fontSize(18).text(title, { align: 'center' })
    doc.moveDown()
    doc.fontSize(11).text(body, { align: 'left' })
    doc.end()
  })
}

export async function generateFieldDocument(
  docType: FieldDocType,
  oeuvreId: number,
): Promise<{ ok: true; href: string } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }
  if (!Number.isFinite(oeuvreId) || oeuvreId <= 0) return { error: 'invalid_oeuvre' }

  if (docType === 'coa') {
    const res = await generateCOA(oeuvreId)
    if ('error' in res) return { error: res.error }
    await logSystemEvent({
      eventType: 'VAULT_UPLOAD',
      tableName: 'document',
      rowId: res.doc?.id,
      metadata: { source: 'documents_new', type: 'coa', oeuvreId },
    })
    revalidatePath('/atelier/documents/new')
    return { ok: true, href: '/atelier?tab=vault' }
  }

  const { data: w } = await g.supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre')
    .eq('OeuvreID', oeuvreId)
    .maybeSingle()
  if (!w) return { error: 'not_found' }

  const label = docType === 'consignment' ? 'Consignment' : 'Invoice'
  const pdfBuf = await simpleFieldPdf(
    `${label} — ${w.Titre ?? `Work ${oeuvreId}`}`,
    `Field-generated ${label.toLowerCase()} draft for work #${oeuvreId}.\nGenerated ${new Date().toISOString()}.`,
  )

  const dateStr = new Date().toISOString().slice(0, 10)
  const path = `${dateStr}_${docType}_W${oeuvreId}_${Date.now()}.pdf`

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  const bucket = process.env.R2_VAULT_BUCKET ?? 'vault'
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: path, Body: pdfBuf, ContentType: 'application/pdf' }))

  const { error: docErr } = await (g.supabase.from('document') as any).insert({
    name: `${label} W${oeuvreId}`,
    kind: docType,
    storage_path: path,
    file_size: pdfBuf.length,
    mime_type: 'application/pdf',
    oeuvre_id: oeuvreId,
    oeuvre_ids: [oeuvreId],
  })
  if (docErr) return { error: docErr.message }

  await logSystemEvent({
    eventType: 'VAULT_UPLOAD',
    tableName: 'Oeuvres',
    rowId: oeuvreId,
    metadata: { source: 'documents_new', type: docType, path },
  })

  revalidatePath('/atelier/documents/new')
  return { ok: true, href: '/atelier?tab=vault' }
}
