'use server'

import { createClient } from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import PDFDocument from 'pdfkit'

const BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

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

export async function vaultStudioBible() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // 1. Build PDF Buffer
  const pdfBuffer = await buildBiblePdf()

  // 2. Upload to R2
  const filename = `Atelier_Studio_Bible_${new Date().toISOString().slice(0, 10)}.pdf`
  const s3 = r2Client()
  
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: filename,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }))
  } catch (e) {
    return { error: `R2 Upload failed: ${String(e)}` }
  }

  // 3. Update Database (Upsert current bible)
  // We mark it with a specific kind so we can find the latest one easily
  const { error: dbErr } = await supabase
    .from('document')
    .insert({
      name: 'Atelier Studio Bible',
      kind: 'bible',
      storage_path: filename,
      file_size: pdfBuffer.length,
      mime_type: 'application/pdf',
      notes: 'Official Studio Operating Manual - PDF Edition',
      doc_date: new Date().toISOString().slice(0, 10),
    })

  if (dbErr) return { error: dbErr.message }

  return { ok: true, filename }
}

async function buildBiblePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 100 // Usable width
    const accent = '#c8a86e'
    const text   = '#1a1a1d'
    const gray   = '#888888'

    // --- Content Generation ---
    // Start after header space
    let y = 100 

    // ── Title ───────────────────────────────────────────────────
    doc.fontSize(32).fillColor(text).text('The Studio Bible', 50, y, { charSpacing: -1 })
    doc.fontSize(12).fillColor(gray).text('The Comprehensive Operating Manual for the PEM Hub Infrastructure.', { lineGap: 10 })
    
    doc.moveDown(2)

    // ── 01. Architecture ───────────────────────────────────────
    section(doc, '01. The Grand Architecture', accent)
    doc.fontSize(10).fillColor(text).text(
      'The Hub is designed as a high-density executive dashboard. It is split into four distinct "Surfaces," redistributed into a balanced 4-column matrix for optimal space utilization.',
      { width: W, align: 'justify', lineGap: 4 }
    )
    doc.moveDown()
    bullet(doc, 'The Atelier (Internal)', 'The nerve center. Used for inventory, sales, and logistics.')
    bullet(doc, 'Collectionneurs (Private)', 'A gated portal for VIP clients. Secure selection sharing.')
    bullet(doc, 'Galeries (Partner)', 'A collaborative surface for partners. Management of consignments.')
    bullet(doc, 'Portfolio (Public)', 'The editorial face. Features the "Polaroid" layout system.')

    // ── 02. Tabs ───────────────────────────────────────────────
    doc.addPage()
    section(doc, '02. The Atelier Portal: 16 Tabs of Power', accent)
    
    doc.fontSize(11).fillColor(text).font('Helvetica-Bold').text('Overview (Tableau de Bord)')
    doc.font('Helvetica').fontSize(10).text('Displays "Live Intelligence"—counts of works, technique breakdowns, and urgent pipeline deadlines.', { lineGap: 2 })
    
    doc.moveDown()
    doc.fontSize(11).font('Helvetica-Bold').text('Inventory (Inventaire)')
    doc.font('Helvetica').fontSize(10).text('The master list of every artwork. Use the search bar to find works by Title or ID. Click a row to open the Work Drawer.', { lineGap: 2 })
    
    doc.moveDown()
    doc.fontSize(11).font('Helvetica-Bold').text('Constellation')
    doc.font('Helvetica').fontSize(10).text('A visual map where X = Time and Y = Technique. Use the Lasso to curate selections.', { lineGap: 2 })

    doc.moveDown()
    doc.fontSize(11).font('Helvetica-Bold').text('Production (Kanban)')
    doc.font('Helvetica').fontSize(10).text('Tracks works in progress. Drag cards from Idée to Encadrement.', { lineGap: 2 })

    // ── 03. Workflows ──────────────────────────────────────────
    doc.moveDown(2)
    section(doc, '03. Core Operational Workflows', accent)
    
    doc.fontSize(10).text('1. Selection: Choose works in the Inventory or Constellation.')
    doc.text('2. The Dock: A black bar appears at the bottom for bulk actions.')
    doc.text('3. Export PDF: Click to generate museum-standard checklists.')
    doc.text('4. Private Link: Generate secret URLs for collectors.')

    // ── 04. Data Standard ──────────────────────────────────────
    doc.addPage()
    section(doc, '04. The Data Standard (Non-Negotiable)', accent)
    doc.fontSize(10).text('The system is only as good as the data entered. Follow these rules strictly:', { lineGap: 8 })
    
    doc.font('Helvetica-Bold').text('Typography:').font('Helvetica')
    doc.text('• Capitalize proper nouns: "Oil on Canvas".')
    doc.text('• Dimensions: Use × (multiplication), not x.')
    doc.text('• Metric: cm only.')
    
    doc.moveDown()
    doc.font('Helvetica-Bold').text('Imagery:').font('Helvetica')
    doc.text('• Format: .avif (Primary) or .webp.')
    doc.text('• Resolution: Minimum 2000px on the long edge.')

    // ── 05. UI Standards ───────────────────────────────────────
    doc.moveDown(2)
    section(doc, '05. UI Standards & Aesthetics', accent)
    doc.fontSize(10).font('Helvetica-Bold').text('The Polaroid System:').font('Helvetica')
    doc.text('A stable, column-based architecture. Works are framed with equal 24px margins (Top, Left, Right) to simulate the physical Polaroid look.', { lineGap: 4 })
    
    doc.moveDown()
    doc.fontSize(10).font('Helvetica-Bold').text('Stable Header Rule:').font('Helvetica')
    doc.text('The wordmark and navigation must remain static. No dynamic height shifts or sticky toolbars.', { lineGap: 4 })

    // ── Global Headers & Footers ────────────────────────────────
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      
      // Header
      doc.fontSize(8).fillColor(gray).text('ATELIER PIERRE EMMANUEL MOULIN', 50, 40)
      doc.text('SYSTEM DOCUMENTATION v1.0 — 2026', 50, 40, { align: 'right' })
      doc.moveTo(50, 55).lineTo(50 + W, 55).lineWidth(0.5).strokeColor('#e0e0e0').stroke()

      // Footer
      doc.fontSize(8).fillColor(gray).text(
        `Confidential. Property of Atelier Pierre Emmanuel Moulin. Page ${i + 1} of ${pages.count}`,
        50, 780, { align: 'center' }
      )
    }

    doc.end()
  })
}

function section(doc: any, title: string, color: string) {
  doc.moveDown()
  doc.fontSize(14).fillColor(color).font('Helvetica-Bold').text(title.toUpperCase(), { characterSpacing: 1 })
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.x + 50, doc.y + 2).lineWidth(2).strokeColor(color).stroke()
  doc.moveDown(1.5)
}

function bullet(doc: any, label: string, desc: string) {
  doc.fontSize(10).fillColor('#1a1a1d').font('Helvetica-Bold').text(`• ${label}: `, { continued: true })
     .font('Helvetica').text(desc, { lineGap: 4 })
}
