'use server'

// Vault server actions — upload, delete, generate COA.
// Storage: Cloudflare R2 (private vault bucket) via S3-compatible API.
// COA uses pdfkit + qrcode (run: npm install pdfkit qrcode @types/pdfkit @types/qrcode)
// R2:  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

import { createClient } from '@/lib/supabase/server'
import { buildSiteMapChecklistPdf } from '@/lib/site-map-checklist-pdf'
import { nanoid }       from 'nanoid'
import { createHash }   from 'crypto'
import {
  S3Client, PutObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { markStorageObject, recordStorageObject } from '@/lib/storage-object-ledger'

const BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

// ── R2 S3 client (private vault bucket) ─────────────────────────────────────
function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

async function r2Upload(
  key: string,
  body: Buffer,
  contentType: string,
  ledger?: {
    source?: string
    classification?: 'linked' | 'unidentified' | 'transient' | 'recycle' | 'backup' | 'ignored'
    linkedRefs?: Array<{ table: string; column: string; row_id?: string | number | null; label?: string | null }>
    uploadedBy?: string | null
    metadata?: Record<string, string | number | boolean | null>
  },
) {
  const s3 = r2Client()
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }))
  await recordStorageObject({
    bucket: BUCKET,
    objectKey: key,
    sizeBytes: body.length,
    contentType,
    source: ledger?.source,
    classification: ledger?.classification,
    linkedRefs: ledger?.linkedRefs,
    uploadedBy: ledger?.uploadedBy,
    metadata: ledger?.metadata,
  })
}

async function r2Delete(key: string) {
  const s3 = r2Client()
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
  await markStorageObject({
    bucket: BUCKET,
    objectKey: key,
    status: 'deleted',
    metadata: { source: 'vault_delete' },
  })
}

async function r2SignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const s3  = r2Client()
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return awsGetSignedUrl(s3, cmd, { expiresIn })
}

export type VaultResult = { error: string } | { ok: true }
export type UploadResult = { error: string } | { ok: true; doc: VaultDoc }
export type CoaResult    = { error: string } | { ok: true; doc: VaultDoc }

export interface VaultDoc {
  id:           number
  kind:         string | null
  name:         string
  storage_path: string | null
  oeuvre_id:    number | null
  oeuvre_ids:   number[] | null
  contact_id:   number | null
  created_at:   string
  notes:        string | null
  file_size:    number | null
  mime_type:    string | null
  doc_date:     string | null
  cert_id:      string | null
  cert_hash:    string | null
  process_id:   number | null
  folder:       string | null
}

// ── Auth guard helper ─────────────────────────────────────────────────────

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null, user: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null, user: null }
  return { error: null, supabase, user }
}

/** Browser downloads PDF via base64 → Blob (no vault upload). */
export async function exportSiteMapChecklistPdf(): Promise<
  { error: string } | { ok: true; base64: string; filename: string }
> {
  const { error: authErr } = await guardTeam()
  if (authErr) return { error: authErr }
  try {
    const buf = await buildSiteMapChecklistPdf()
    return {
      ok: true,
      base64: buf.toString('base64'),
      filename: `PEM_Site_Map_QA_Checklist_${new Date().toISOString().slice(0, 10)}.pdf`,
    }
  } catch (e) {
    return { error: `Checklist PDF: ${String(e)}` }
  }
}

// ── Upload document ───────────────────────────────────────────────────────

export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const { error: authErr, supabase, user } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const file        = formData.get('file') as File | null
  const name        = (formData.get('name') as string | null)?.trim()      || null
  const kind        = (formData.get('kind') as string | null)?.trim()      || null
  const customKind  = (formData.get('custom_kind') as string | null)?.trim() || null
  const notes       = (formData.get('notes') as string | null)?.trim()     || null
  const doc_date    = (formData.get('doc_date') as string | null)?.trim()  || null
  const folder      = (formData.get('folder') as string | null)?.trim()    || null
  const oeuvre_ids_str = (formData.get('oeuvre_ids') as string | null)    || ''
  
  if (!file || file.size === 0) return { error: 'Aucun fichier sélectionné' }

  // 1. Get Uploader Name
  const { data: profile } = await (supabase.from('profiles') as any).select('full_name').eq('id', user?.id ?? '').single()
  const uploader = (profile?.full_name || user?.email?.split('@')[0] || 'User').replace(/\s+/g, '_')

  // 2. Get Next Serial Number
  const { count } = await (supabase.from('document') as any).select('*', { count: 'exact', head: true })
  const serial = (count ?? 0) + 1

  // 3. Construct Smart Filename
  const dateStr   = doc_date || new Date().toISOString().slice(0, 10)
  const typeStr   = (kind === 'custom' ? customKind : kind) || 'autre'
  const cleanDesc = (name || '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
  const cleanOrig = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  
  const finalPath = `${dateStr}_${typeStr}_${cleanDesc}_${uploader}_${serial}_${cleanOrig}`
  const docName   = name || file.name

  const buf = Buffer.from(await file.arrayBuffer())
  try {
    await r2Upload(finalPath, buf, file.type, {
      source: 'vault_upload',
      classification: 'linked',
      linkedRefs: [{ table: 'document', column: 'storage_path' }],
      uploadedBy: user?.id ?? null,
      metadata: { document_name: docName, kind: typeStr },
    })
  } catch (e) {
    return { error: `Upload R2 : ${String(e)}` }
  }

  // 4. Handle multiple oeuvre IDs
  const ids = oeuvre_ids_str.split(',').filter(Boolean).map(Number)
  const primaryOeuvreId = ids.length > 0 ? ids[0] : null

  const { data: doc, error: dbErr } = await (supabase
    .from('document') as any)
    .insert({
      name:         docName,
      kind:         typeStr,
      notes,
      doc_date:     doc_date || null,
      oeuvre_id:    primaryOeuvreId,
      oeuvre_ids:   ids, // Multi-link support
      storage_path: finalPath,
      file_size:    file.size,
      mime_type:    file.type,
      folder:       folder,
    })
    .select()
    .single()

  if (dbErr) {
    await r2Delete(finalPath).catch(() => {})
    return { error: dbErr.message }
  }

  return { ok: true, doc: doc as VaultDoc }
}

export async function updateDocument(id: number, formData: FormData): Promise<UploadResult> {
  const { error: authErr, supabase, user } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const name        = (formData.get('name') as string | null)?.trim()      || null
  const kind        = (formData.get('kind') as string | null)?.trim()      || null
  const customKind  = (formData.get('custom_kind') as string | null)?.trim() || null
  const notes       = (formData.get('notes') as string | null)?.trim()     || null
  const doc_date    = (formData.get('doc_date') as string | null)?.trim()  || null
  const folder      = (formData.get('folder') as string | null)?.trim()    || null
  const oeuvre_ids_str = (formData.get('oeuvre_ids') as string | null)    || ''

  const typeStr = (kind === 'custom' ? customKind : kind) || 'autre'
  const ids     = oeuvre_ids_str.split(',').filter(Boolean).map(Number)
  const primary = ids.length > 0 ? ids[0] : null

  const { data: doc, error: dbErr } = await (supabase
    .from('document') as any)
    .update({
      name,
      kind:      typeStr,
      notes,
      doc_date:  doc_date || null,
      oeuvre_id: primary,
      oeuvre_ids: ids,
      folder,
    })
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return { error: dbErr.message }
  return { ok: true, doc: doc as VaultDoc }
}

// ── Delete document ───────────────────────────────────────────────────────

export async function deleteDocument(id: number, storagePath: string | null): Promise<VaultResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  if (storagePath) {
    await r2Delete(storagePath).catch(() => {})
  }

  const { error } = await (supabase.from('document') as any).delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Folder Management ─────────────────────────────────────────────────────

/**
 * Renames a folder by updating the 'folder' field of all documents sharing the prefix.
 * Supports nested renames (e.g., 'Archive/2023' -> 'Archive/2024').
 */
export async function renameFolder(oldPath: string, newPath: string): Promise<VaultResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // 1. Fetch all docs in the old path (and its subfolders)
  const { data: docs, error: fetchErr } = await (supabase.from('document') as any)
    .select('id, folder')
    .or(`folder.eq.${oldPath},folder.ilike.${oldPath}/%`)

  if (fetchErr) return { error: fetchErr.message }
  if (!docs || docs.length === 0) return { ok: true }

  // 2. Prepare updates
  const updates = docs.map((d: any) => {
    let updatedFolder = newPath
    if (d.folder.startsWith(oldPath + '/')) {
      updatedFolder = newPath + d.folder.slice(oldPath.length)
    }
    return { id: d.id, folder: updatedFolder }
  })

  // 3. Batch update (Supabase handles this if we pass an array with IDs)
  // Note: Standard Supabase .upsert or multiple .update calls. 
  // For simplicity and safety, we'll do them in a single rpc if available, 
  // or a loop if the count is small. 
  // Optimal: .upsert(updates) where updates include the primary key 'id'.
  const { error: upErr } = await (supabase.from('document') as any).upsert(updates)
  
  if (upErr) return { error: upErr.message }
  return { ok: true }
}

/**
 * Creates a permanent empty folder by inserting a hidden '.keep' document.
 * This ensures the folder exists in the ramification tree even without user files.
 */
export async function createFolder(path: string): Promise<VaultResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // Check if it already exists (virtually)
  const { data: existing } = await (supabase.from('document') as any)
    .select('id')
    .eq('folder', path)
    .eq('name', '.keep')
    .maybeSingle()

  if (existing) return { ok: true }

  const { error } = await (supabase.from('document') as any)
    .insert({
      name: '.keep',
      kind: 'system',
      folder: path,
      notes: 'Folder marker',
      mime_type: 'application/x-directory'
    })

  if (error) return { error: error.message }
  return { ok: true }
}

/**
 * Moves one or more documents to a new folder.
 */
export async function moveDocuments(docIds: number[], targetFolder: string | null): Promise<VaultResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  if (!docIds.length) return { ok: true }

  const { error } = await (supabase.from('document') as any)
    .update({ folder: targetFolder })
    .in('id', docIds)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function renameDocument(id: number, newName: string): Promise<VaultResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { error } = await (supabase.from('document') as any)
    .update({ name: newName })
    .eq('id', id)

  if (error) return { error: error.message }
  return { ok: true }
}


// ── Generate signed download URL ──────────────────────────────────────────

export async function getSignedUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const { error: authErr } = await guardTeam()
  if (authErr) return { error: authErr }

  try {
    const url = await r2SignedUrl(storagePath, 3600)
    return { url }
  } catch (e) {
    return { error: `Signed URL failed: ${String(e)}` }
  }
}

// ── Generate Certificate of Authenticity ─────────────────────────────────

export async function generateCOA(oeuvreId: number): Promise<CoaResult> {
  const { error: authErr, supabase, user } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // Fetch work data
  const { data: o, error: fetchErr } = await (supabase
    .from('Oeuvres') as any)
    .select('OeuvreID, Titre, "Année", Technique, Support, Hauteur, Largeur, Profondeur, txtImageNameLink')
    .eq('OeuvreID', oeuvreId)
    .single()

  if (fetchErr || !o) return { error: 'Œuvre introuvable' }

  // Fetch technique / support labels
  const [{ data: techRow }, { data: suppRow }] = await Promise.all([
    o.Technique ? (supabase.from('Technique') as any).select('Technique').eq('TechniqueID', o.Technique).single() : Promise.resolve({ data: null }),
    o.Support   ? (supabase.from('Support') as any).select('Support').eq('SupportID', o.Support).single()         : Promise.resolve({ data: null }),
  ])

  const techLabel = (techRow as { Technique: string } | null)?.Technique ?? ''
  const suppLabel = (suppRow as { Support: string }   | null)?.Support   ?? ''

  const dims = o.Hauteur && o.Largeur
    ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm`
    : null

  // Certificate identifiers
  const certId   = `PEM-${oeuvreId}-${nanoid(8).toUpperCase()}`
  const hashData = `${certId}|${oeuvreId}|${o.Titre ?? ''}|${o.Année ?? ''}|${techLabel}|${dims ?? ''}`
  const certHash = createHash('sha256').update(hashData).digest('hex')

  // Fetch work image and convert to JPEG (pdfkit only handles JPEG/PNG/GIF, not AVIF/WebP)
  let imageBuffer: Buffer | null = null
  if (o.txtImageNameLink) {
    try {
      const base   = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/$/, '')
      const imgPath = o.txtImageNameLink.split('/').map(encodeURIComponent).join('/')
      const imgUrl  = `${base}/${imgPath}`
      const res = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const raw = Buffer.from(await res.arrayBuffer())
        // Convert any format (AVIF, WebP, etc.) to JPEG for pdfkit compatibility
        const sharp = (await import('sharp')).default
        imageBuffer = await sharp(raw).jpeg({ quality: 85 }).toBuffer()
      } else {
        console.warn(`COA image fetch failed: ${res.status} ${imgUrl}`)
      }
    } catch (e) {
      console.warn(`COA image fetch/convert error: ${e}`)
    }
  }

  // Build PDF
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await buildCoaPdf({
      certId, certHash, imageBuffer,
      titre:     o.Titre ?? 'Sans titre',
      année:     o.Année ?? '',
      technique: techLabel,
      support:   suppLabel,
      dims:      dims ?? '',
      oeuvreId,
    })
  } catch (e) {
    return { error: `Génération PDF : ${String(e)}` }
  }

  // Upload to R2 vault
  const filename = `COA_${certId}.pdf`
  try {
    await r2Upload(filename, pdfBuffer, 'application/pdf', {
      source: 'coa',
      classification: 'linked',
      linkedRefs: [
        { table: 'document', column: 'storage_path' },
        { table: 'Oeuvres', column: 'OeuvreID', row_id: oeuvreId },
      ],
      uploadedBy: user?.id ?? null,
      metadata: { cert_id: certId },
    })
  } catch (e) {
    return { error: `Upload COA R2 : ${String(e)}` }
  }

  // Insert document record
  const { data: doc, error: dbErr } = await (supabase
    .from('document') as any)
    .insert({
      name:         filename,
      kind:         'coa',
      oeuvre_id:    oeuvreId,
      storage_path: filename,
      file_size:    pdfBuffer.length,
      mime_type:    'application/pdf',
      cert_id:      certId,
      cert_hash:    certHash,
      notes:        `Certificat d'authenticité — ${o.Titre ?? 'Sans titre'} (${o.Année ?? ''})`,
    })
    .select()
    .single()

  if (dbErr) return { error: dbErr.message }
  return { ok: true, doc: doc as VaultDoc }
}

// ── PDF builder (pdfkit) ──────────────────────────────────────────────────

interface CoaData {
  certId:     string
  certHash:   string
  imageBuffer: Buffer | null
  titre:      string
  année:      string
  technique:  string
  support:    string
  dims:       string
  oeuvreId:   number
}

async function buildCoaPdf(data: CoaData): Promise<Buffer> {
  // Dynamic import so the module is only loaded server-side
  const PDFDocument = (await import('pdfkit')).default
  const QRCode      = await import('qrcode')

  const { certId, certHash, imageBuffer, titre, année, technique, support, dims } = data

  // Generate QR code synchronously BEFORE opening the PDF stream
  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://pem.studio').replace(/\/$/, '')
  const qrText = `${siteOrigin}/verify/${certId}`
  const qrBuf: Buffer = await QRCode.toBuffer(qrText, { type: 'png', width: 72, margin: 1 })

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 60 })
    const chunks: Buffer[] = []
    doc.on('data',  (c: Buffer) => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W   = 595 - 120  // usable width (A4 = 595pt, margins 60 each side)
    const col = 60          // left margin

    // ── Header ──────────────────────────────────────────────────
    doc.fontSize(9).fillColor('#999999')
       .text('CERTIFICAT D\'AUTHENTICITÉ', col, 60, { characterSpacing: 2 })

    doc.fontSize(22).fillColor('#1a1a1a')
       .text('the pem workshop', col, 76)

    doc.moveTo(col, 110).lineTo(col + W, 110).lineWidth(0.5).strokeColor('#cccccc').stroke()

    let y = 124

    // ── Work image — full-width top ──────────────────────────────
    if (imageBuffer) {
      try {
        // Cap at 200pt tall to leave room for all content on one A4 page
        const maxW = W, maxH = 200
        doc.image(imageBuffer, col, y, { fit: [maxW, maxH], align: 'center' })
        y += maxH + 14
      } catch (e) {
        console.warn('COA image embed failed:', e)
      }
    }

    // ── Work metadata ────────────────────────────────────────────
    doc.fontSize(18).fillColor('#1a1a1a').text(titre, col, y, { width: W })
    y += 28

    const metaParts: string[] = []
    if (année)     metaParts.push(année)
    if (technique) metaParts.push(technique + (support ? `, ${support}` : ''))
    if (dims)      metaParts.push(dims)

    if (metaParts.length) {
      doc.fontSize(10).fillColor('#666666').text(metaParts.join('  ·  '), col, y, { width: W })
      y += 18 + 16
    } else {
      y += 16
    }

    doc.moveTo(col, y).lineTo(col + W, y).lineWidth(0.5).strokeColor('#e0e0e0').stroke()
    y += 18

    // ── Authenticity statement ────────────────────────────────────
    doc.fontSize(9).fillColor('#333333').text(
      'Je soussigné, Pierre Emmanuel Moulin, certifie que cette œuvre est une création originale ' +
      'de ma main et qu\'elle est authentique. Ce certificat est délivré à titre de garantie ' +
      'd\'authenticité et accompagne l\'œuvre de manière permanente.',
      col, y, { width: W, align: 'justify', lineGap: 3 }
    )
    y += 64

    // ── Signature block ───────────────────────────────────────────
    const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.fontSize(9).fillColor('#888888').text('Marseille, ' + today, col, y)
    y += 30
    doc.moveTo(col, y).lineTo(col + 160, y).lineWidth(0.5).strokeColor('#bbbbbb').stroke()
    y += 8
    doc.fontSize(8).fillColor('#aaaaaa').text('Signature de l\'artiste', col, y)

    y += 40
    doc.moveTo(col, y).lineTo(col + W, y).lineWidth(0.5).strokeColor('#e0e0e0').stroke()
    y += 18

    // ── Certificate identifier block ──────────────────────────────
    doc.fontSize(8).fillColor('#aaaaaa')
       .text('RÉFÉRENCE DU CERTIFICAT', col, y, { characterSpacing: 1.5 })
    y += 14
    doc.fontSize(10).fillColor('#1a1a1a').font('Courier')
       .text(certId, col, y)
    y += 16
    doc.fontSize(7).fillColor('#aaaaaa').font('Helvetica')
       .text('EMPREINTE CRYPTOGRAPHIQUE (SHA-256)', col, y, { characterSpacing: 1 })
    y += 12
    doc.fontSize(7).fillColor('#555555').font('Courier')
       .text(certHash, col, y, { width: W - 90, lineGap: 2 })

    // ── QR code — synchronous, buffer pre-generated above ────────
    try { doc.image(qrBuf, col + W - 72, y - 14, { width: 72 }) } catch {}
    doc.fontSize(6).fillColor('#aaaaaa').font('Helvetica')
       .text('Vérification', col + W - 72, y + 60, { width: 72, align: 'center', lineBreak: false })

    // ── Footer — drawn last, anchored to bottom of page ───────────
    const pageH   = 842
    const footerY = pageH - 54
    doc.moveTo(col, footerY).lineTo(col + W, footerY).lineWidth(0.3).strokeColor('#e0e0e0').stroke()
    doc.fontSize(7).fillColor('#cccccc').font('Helvetica')
       .text(
         'Ce document est un certificat d\'authenticité officiel. Toute falsification est un délit.',
         col, footerY + 6, { width: W, align: 'center', lineBreak: false }
       )

    doc.end()
  })
}
