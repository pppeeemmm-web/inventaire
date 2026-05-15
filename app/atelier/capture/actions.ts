'use server'

import crypto from 'crypto'
import sharp from 'sharp'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateWorkImageBuffer } from '@/lib/image-upload'
import { logSystemEvent } from '@/lib/utils/logging'
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

const VAULT_BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'
const MAX_SHOTS = 24
const MAX_BYTES = 12 * 1024 * 1024

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'auth' as const, supabase: null, user: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'forbidden' as const, supabase: null, user: null }
  return { error: null, supabase, user }
}

async function vaultR2Upload(key: string, body: Buffer, contentType: string): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
  await s3.send(new PutObjectCommand({ Bucket: VAULT_BUCKET, Key: key, Body: body, ContentType: contentType }))
}

async function buildScanPdf(jpegPages: Buffer[]): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, autoFirstPage: false })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    for (const pageBuf of jpegPages) {
      doc.addPage()
      doc.image(pageBuf, 36, 36, { fit: [523, 770], align: 'center', valign: 'center' })
    }
    doc.end()
  })
}

export async function submitDocScanCapture(formData: FormData): Promise<{ ok: true; href: string } | { error: string }> {
  const g = await guardTeam()
  if (g.error || !g.supabase) return { error: g.error ?? 'auth' }

  const title = ((formData.get('title') as string | null) ?? '').trim().slice(0, 200) || 'Field scan'
  const files = formData.getAll('files').filter((v): v is File => v instanceof File && v.size > 0)
  if (files.length === 0) return { error: 'empty' }
  if (files.length > MAX_SHOTS) return { error: 'too_many' }

  const jpegPages: Buffer[] = []
  for (const file of files.slice(0, MAX_SHOTS)) {
    if (file.size > MAX_BYTES) return { error: 'file_too_large' }
    const buf = Buffer.from(await file.arrayBuffer())
    const validated = await validateWorkImageBuffer(buf)
    if ('error' in validated) return { error: validated.error }
    jpegPages.push(await sharp(buf).jpeg({ quality: 88 }).toBuffer())
  }

  let pdfBuf: Buffer
  try {
    pdfBuf = await buildScanPdf(jpegPages)
  } catch (e) {
    return { error: String(e) }
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)
  const path = `${dateStr}_scan_${safeTitle}_${crypto.randomBytes(4).toString('hex')}.pdf`

  try {
    await vaultR2Upload(path, pdfBuf, 'application/pdf')
  } catch (e) {
    return { error: String(e) }
  }

  const { error: docErr } = await (g.supabase.from('document') as any).insert({
    name: title,
    kind: 'scan',
    storage_path: path,
    file_size: pdfBuf.length,
    mime_type: 'application/pdf',
    notes: `Field capture · ${files.length} page(s)`,
  })
  if (docErr) return { error: docErr.message }

  await logSystemEvent({
    eventType: 'VAULT_UPLOAD',
    tableName: 'document',
    newValue: path,
    metadata: { source: 'capture_doc', pages: files.length },
  })

  revalidatePath('/atelier')
  revalidatePath('/atelier/capture')
  return { ok: true, href: '/atelier?tab=vault' }
}
