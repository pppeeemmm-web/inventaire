'use server'

// Direct Available -> Gift action.
// Bypasses the sale_order flow: a gift is just an ownership transfer with
// no payment. Generates a "Bordereau de Don" PDF and registers it in the vault.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { logError, logWarn } from '@/lib/error-reporter/server'
import { logSystemEvent } from '@/lib/utils/logging'
import {
  contactDisplayName,
  formatGiftHistoriqueLine,
  formatLocationHistoriqueLine,
  mergeHistoriqueLines,
  type HistoriqueContact,
} from '@/lib/oeuvre-historique'
import { recordStorageObject } from '@/lib/storage-object-ledger'

export type GiftResult = { error: string } | { ok: true; pdfPath: string }

const ALLOWED_FROM_STATUSES = new Set([2, 4, 7, 8])

async function guardTeam() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' as const, supabase: null }
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return { error: 'Accès refusé' as const, supabase: null }
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
  await recordStorageObject({
    bucket,
    objectKey: key,
    sizeBytes: body.length,
    contentType: 'application/pdf',
    source: 'gift_pdf',
    classification: 'linked',
    linkedRefs: [{ table: 'document', column: 'storage_path' }],
  })
}

export async function markAsGift(formData: FormData): Promise<GiftResult> {
  const { error: authErr, supabase } = await guardTeam()
  if (authErr || !supabase) return { error: authErr ?? 'Auth' }

  const oeuvre_id    = Number(formData.get('oeuvre_id'))
  const recipient_id = Number(formData.get('recipient_id'))
  const delivery_date = (formData.get('delivery_date') as string | null) || null
  const notes        = (formData.get('notes') as string | null) || null

  if (!oeuvre_id) return { error: 'Œuvre requise' }
  if (!recipient_id) return { error: 'Bénéficiaire requis' }

  const { data: work, error: workErr } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, "Année", Technique, Support, Hauteur, Largeur, Profondeur, txtImageNameLink, statusId, Historique')
    .eq('OeuvreID', oeuvre_id)
    .is('deleted_at', null)
    .single()
  if (workErr || !work) return { error: 'Œuvre introuvable' }

  if (!ALLOWED_FROM_STATUSES.has(work.statusId)) {
    return { error: `Statut actuel incompatible avec un don (statusId=${work.statusId}). Autorisés : 2, 4, 7, 8.` }
  }

  const { data: recipient, error: recErr } = await supabase
    .from('Contact')
    .select('ContactID, Nom, "Prénom", NomInstitution, Ville, Pays')
    .eq('ContactID', recipient_id)
    .single()
  if (recErr || !recipient) return { error: 'Bénéficiaire introuvable' }

  const recipientName = contactDisplayName(recipient as HistoriqueContact)
    || `Contact #${recipient_id}`

  const newHistorique = mergeHistoriqueLines(work.Historique, [
    formatGiftHistoriqueLine(recipientName),
    formatLocationHistoriqueLine(recipient as HistoriqueContact),
  ])

  const { error: updateErr } = await supabase
    .from('Oeuvres')
    .update({
      statusId:       11,
      ContactID:      recipient_id,
      LocalisationID: recipient_id,
      AcheteurID:     recipient_id,
      is_gift:        true,
      Prix:           0,
      PrixFinal:      0,
      Discount:       0,
      DateLivraison:  delivery_date,
      Historique:     newHistorique,
    })
    .eq('OeuvreID', oeuvre_id)
    .is('deleted_at', null)
  if (updateErr) return { error: updateErr.message }

  // Build + store the bordereau. PDF failure is logged but does not roll back
  // the ownership change — the Oeuvres update is the source of truth.
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const pdfKey = `gifts/BORDEREAU_DON_${oeuvre_id}_${today}.pdf`
  try {
    const pdf = await buildGiftPdf({
      work,
      recipient,
      recipientName,
      delivery_date,
      notes,
      orderRef: `DON-${oeuvre_id}-${today}`,
    })
    await r2UploadPdf(pdfKey, pdf)

    await supabase.from('document').insert({
      name:         `Bordereau de Don ${oeuvre_id}`,
      kind:         'contrat',
      notes:        notes || `Don à ${recipientName}`,
      doc_date:     new Date().toISOString().slice(0, 10),
      oeuvre_id,
      oeuvre_ids:   [oeuvre_id],
      storage_path: pdfKey,
      file_size:    pdf.length,
      mime_type:    'application/pdf',
    })
  } catch (e) {
    console.error('[gift] PDF generation failed:', e)
  }

  await logSystemEvent({
    eventType: 'STATUS_CHANGE',
    tableName: 'Oeuvres',
    rowId: oeuvre_id,
    oldValue: work.statusId,
    newValue: 11,
    metadata: { gift: true, recipient_id, recipient_name: recipientName, pdf_path: pdfKey },
  })

  revalidatePath('/atelier')
  return { ok: true, pdfPath: pdfKey }
}

// ── PDF builder ───────────────────────────────────────────────────────────────

async function r2GetImage(key: string): Promise<Buffer | null> {
  const r2Public = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || ''
  if (!r2Public) return null
  try {
    const res = await fetch(`${r2Public}/${encodeURIComponent(key)}`)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch (err) {
    await logWarn(`Gift PDF image fetch failed: ${key}`, err, { source: 'gift-actions.r2GetImage', metadata: { key } })
    return null
  }
}

interface BuildGiftPdfArgs {
  work:         any
  recipient:    any
  recipientName: string
  delivery_date: string | null
  notes:        string | null
  orderRef:     string
}

async function buildGiftPdf(args: BuildGiftPdfArgs): Promise<Buffer> {
  const { work, recipient, recipientName, delivery_date, notes, orderRef } = args

  // Fetch lookup labels for technique/support to print descriptive text.
  const supabase = await createClient()
  const [{ data: tech }, { data: supp }] = await Promise.all([
    work.Technique ? supabase.from('Technique').select('Technique').eq('TechniqueID', work.Technique).maybeSingle() : Promise.resolve({ data: null }),
    work.Support   ? supabase.from('Support').select('Support').eq('SupportID', work.Support).maybeSingle()      : Promise.resolve({ data: null }),
  ])
  const techLabel = (tech as any)?.Technique || ''
  const suppLabel = (supp as any)?.Support || ''

  let imageBuf: Buffer | null = null
  if (work.txtImageNameLink) {
    const thumbName = `thumbs/${work.txtImageNameLink.replace(/\.[^.]+$/, '')}.avif`
    imageBuf = await r2GetImage(thumbName)
    if (!imageBuf) imageBuf = await r2GetImage(work.txtImageNameLink)
  }

  const PDFDocument = (await import('pdfkit')).default
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, bufferPages: true })
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const PW_RAW = 595
    const PH_RAW = 842
    const W = PW_RAW - 112
    const ac = '#c8a86e'
    const tx2 = '#888'

    let y = 140
    doc.fontSize(9).fillColor(tx2).text('BÉNÉFICIAIRE / RECIPIENT', 56, y)
    doc.moveDown(0.4)
    doc.fontSize(11).fillColor('#000').text(recipientName)
    const loc = [(recipient as any).Ville, (recipient as any).Pays].filter(Boolean).join(', ')
    if (loc) doc.fontSize(9).fillColor(tx2).text(loc)

    doc.fontSize(9).fillColor(tx2).text('ŒUVRE OFFERTE', 56, 200)
    doc.moveDown(0.5)

    const rowY = doc.y
    if (imageBuf) {
      try {
        doc.image(imageBuf, 56, rowY, { width: 60, height: 60, fit: [60, 60] })
      } catch (err) {
        void logWarn('Gift PDF thumbnail embed failed', err, { source: 'gift-actions.buildGiftPdf' })
      }
    }
    const textX = imageBuf ? 130 : 56
    doc.fontSize(11).fillColor('#000').text(`${work.Titre || 'Sans titre'} (${String(work.Année || '').slice(0, 4)})`, textX, rowY)
    const desc = [techLabel, suppLabel].filter(Boolean).join(' sur ')
    const dims = work.Hauteur && work.Largeur
      ? `${work.Hauteur} × ${work.Largeur}${work.Profondeur ? ` × ${work.Profondeur}` : ''} cm`
      : ''
    doc.fontSize(9).fillColor(tx2).text(`${desc}${desc && dims ? '  ·  ' : ''}${dims}`, textX, rowY + 16)
    doc.fontSize(8).fillColor(tx2).text(`Réf. œuvre : #${work.OeuvreID}`, textX, rowY + 32)
    doc.fontSize(8).fillColor(ac).text('VALEUR MARCHANDE : —', textX, rowY + 46)

    doc.y = Math.max(doc.y, rowY + 80)
    doc.moveDown(2)

    doc.fontSize(8).fillColor(tx2).text('CONDITIONS', 56, doc.y)
    doc.moveDown(0.4)
    doc.fontSize(9).fillColor('#000').text(
      "Le présent bordereau atteste du transfert de propriété de l'œuvre listée ci-dessus, à titre gracieux, au bénéficiaire désigné. Aucune contrepartie financière n'est due. La remise est définitive et irrévocable à compter de la date de signature.",
      56, doc.y, { width: W, align: 'justify' }
    )

    if (delivery_date) {
      doc.moveDown(1.5)
      doc.fontSize(9).fillColor(tx2).text('DATE DE REMISE', 56, doc.y)
      doc.fontSize(10).fillColor('#000').text(new Date(delivery_date).toLocaleDateString('fr-FR'))
    }

    if (notes) {
      doc.moveDown(1)
      doc.fontSize(9).fillColor(tx2).text('NOTES', 56, doc.y)
      doc.fontSize(9).fillColor('#000').text(notes, 56, doc.y + 4, { width: W })
    }

    const sigY = 740
    doc.fontSize(8).fillColor(tx2).text("POUR L'ARTISTE", 56, sigY)
    doc.moveTo(56, sigY + 40).lineTo(56 + 180, sigY + 40).lineWidth(0.5).strokeColor('#ccc').stroke()
    doc.fontSize(8).fillColor(tx2).text('POUR LE BÉNÉFICIAIRE', 300, sigY)
    doc.moveTo(300, sigY + 40).lineTo(300 + 180, sigY + 40).stroke()

    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.fontSize(7).fillColor(tx2).text('THE PEM WORKSHOP', 56, 40)
      doc.fontSize(16).fillColor('#000').text('Bordereau de Don', 56, 54)
      doc.fontSize(9).fillColor(ac).text(`${orderRef} · PAGE ${i + 1} / ${pages.count}`, 56, 74)
      doc.fontSize(6).fillColor('#ccc').text(
        'ARTIST ATELIER MANAGEMENT SYSTEM · CONFIDENTIEL',
        56, PH_RAW - 45, { width: W, align: 'center', lineBreak: false }
      )
    }

    doc.end()
  })
}
