'use server'

// Vault server actions — upload, delete, generate COA.
// COA uses pdfkit + qrcode (run: npm install pdfkit qrcode @types/pdfkit @types/qrcode)

import { createClient } from '@/lib/supabase/server'
import { nanoid }       from 'nanoid'
import { createHash }   from 'crypto'

const BUCKET = 'vault'

export type VaultResult = { error: string } | { ok: true }
export type UploadResult = { error: string } | { ok: true; doc: VaultDoc }
export type CoaResult    = { error: string } | { ok: true; doc: VaultDoc }

export interface VaultDoc {
  id:           string
  kind:         string | null
  name:         string
  storage_path: string | null
  oeuvre_id:    number | null
  contact_id:   number | null
  created_at:   string
  notes:        string | null
  file_size:    number | null
  mime_type:    string | null
  doc_date:     string | null
  cert_id:      string | null
  cert_hash:    string | null
}

// ── Auth guard helper ─────────────────────────────────────────────────────

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
  return { error: null, supabase }
}

// ── Upload document ───────────────────────────────────────────────────────

export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const file      = formData.get('file') as File | null
  const name      = (formData.get('name') as string | null)?.trim()      || null
  const kind      = (formData.get('kind') as string | null)?.trim()      || null
  const notes     = (formData.get('notes') as string | null)?.trim()     || null
  const doc_date  = (formData.get('doc_date') as string | null)?.trim()  || null
  const oeuvre_id = formData.get('oeuvre_id') ? Number(formData.get('oeuvre_id')) : null
  const contact_id = formData.get('contact_id') ? Number(formData.get('contact_id')) : null

  if (!file || file.size === 0) return { error: 'Aucun fichier sélectionné' }

  const ext     = file.name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() ?? 'bin'
  const slug    = nanoid(12)
  const path    = `${slug}.${ext}`
  const docName = name || file.name

  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) return { error: `Upload : ${upErr.message}` }

  const { data: doc, error: dbErr } = await supabase
    .from('document')
    .insert({
      name:         docName,
      kind,
      notes,
      doc_date:     doc_date || null,
      oeuvre_id,
      contact_id,
      storage_path: path,
      file_size:    file.size,
      mime_type:    file.type,
    })
    .select()
    .single()

  if (dbErr) {
    // cleanup orphaned storage object
    await supabase.storage.from(BUCKET).remove([path])
    return { error: dbErr.message }
  }

  return { ok: true, doc: doc as VaultDoc }
}

// ── Delete document ───────────────────────────────────────────────────────

export async function deleteDocument(id: string, storagePath: string | null): Promise<VaultResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath])
  }

  const { error } = await supabase.from('document').delete().eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── Generate signed download URL ──────────────────────────────────────────

export async function getSignedUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error || !data) return { error: error?.message ?? 'Signed URL failed' }
  return { url: data.signedUrl }
}

// ── Generate Certificate of Authenticity ─────────────────────────────────

export async function generateCOA(oeuvreId: number): Promise<CoaResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  // Fetch work data
  const { data: o, error: fetchErr } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, Technique, Support, Hauteur, Largeur, Profondeur, txtImageNameLink')
    .eq('OeuvreID', oeuvreId)
    .single()

  if (fetchErr || !o) return { error: 'Œuvre introuvable' }

  // Fetch technique / support labels
  const [{ data: techRow }, { data: suppRow }] = await Promise.all([
    o.Technique ? supabase.from('Technique').select('Technique').eq('TechniqueID', o.Technique).single() : Promise.resolve({ data: null }),
    o.Support   ? supabase.from('Support').select('Support').eq('SupportID', o.Support).single()         : Promise.resolve({ data: null }),
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

  // Fetch work image if available
  let imageBuffer: Buffer | null = null
  if (o.txtImageNameLink) {
    try {
      const SB   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
      const BKT  = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'paintings'
      const STR  = `${SB}/storage/v1/object/public/${BKT}`
      const imgUrl = `${STR}/${encodeURIComponent(o.txtImageNameLink)}`
      const res = await fetch(imgUrl)
      if (res.ok) imageBuffer = Buffer.from(await res.arrayBuffer())
    } catch { /* skip image on error */ }
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

  // Upload to vault
  const filename = `COA_${certId}.pdf`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(filename, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upErr) return { error: `Upload COA : ${upErr.message}` }

  // Insert document record
  const { data: doc, error: dbErr } = await supabase
    .from('document')
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

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 60 })
    const chunks: Buffer[] = []
    doc.on('data',  (c: Buffer) => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W   = 595 - 120  // usable width
    const col = 60          // left margin

    // ── Header ──────────────────────────────────────────────────
    doc.fontSize(9).fillColor('#999999')
       .text('CERTIFICAT D\'AUTHENTICITÉ', col, 60, { characterSpacing: 2 })

    doc.fontSize(22).fillColor('#1a1a1a')
       .text('Pierre Emmanuel Moulin', col, 76)

    doc.moveTo(col, 110).lineTo(col + W, 110).lineWidth(0.5).strokeColor('#cccccc').stroke()

    // ── Work image ───────────────────────────────────────────────
    let y = 126
    if (imageBuffer) {
      try {
        const imgW = 200, imgH = 150
        doc.image(imageBuffer, col, y, { fit: [imgW, imgH], align: 'left' })
        // metadata beside image
        doc.fontSize(18).fillColor('#1a1a1a')
           .text(titre, col + imgW + 20, y, { width: W - imgW - 20 })
        y += 4
        doc.fontSize(10).fillColor('#555555')
           .text(année, col + imgW + 20, y + 28, { width: W - imgW - 20 })
        if (technique) {
          doc.fontSize(9).fillColor('#888888')
             .text(technique + (support ? `, ${support}` : ''), col + imgW + 20, y + 46, { width: W - imgW - 20 })
        }
        if (dims) {
          doc.fontSize(9).fillColor('#888888')
             .text(dims, col + imgW + 20, y + 62, { width: W - imgW - 20 })
        }
        y += imgH + 24
      } catch { y += 4 }
    } else {
      doc.fontSize(18).fillColor('#1a1a1a').text(titre, col, y)
      y += 30
      doc.fontSize(10).fillColor('#555555').text(année, col, y)
      y += 20
      if (technique) { doc.fontSize(9).fillColor('#888888').text(technique, col, y); y += 16 }
      if (dims)      { doc.fontSize(9).fillColor('#888888').text(dims, col, y);      y += 16 }
      y += 10
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
    doc.fontSize(9).fillColor('#888888').text('Paris, ' + today, col, y)
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

    // ── QR code (verification) ────────────────────────────────────
    const qrText = `https://pem.studio/verify/${certId}`
    QRCode.toBuffer(qrText, { type: 'png', width: 72, margin: 1 })
      .then((qrBuf: Buffer) => {
        try { doc.image(qrBuf, col + W - 72, y - 14, { width: 72 }) } catch {}
        doc.fontSize(6).fillColor('#aaaaaa').font('Helvetica')
           .text('Vérification', col + W - 72, y + 60, { width: 72, align: 'center' })

        // footer rule
        doc.moveTo(col, 780).lineTo(col + W, 780).lineWidth(0.3).strokeColor('#e0e0e0').stroke()
        doc.fontSize(7).fillColor('#cccccc').font('Helvetica')
           .text('Ce document est un certificat d\'authenticité officiel. Toute falsification est un délit.', col, 788, { width: W, align: 'center' })

        doc.end()
      })
      .catch(() => {
        doc.end()
      })
  })
}
