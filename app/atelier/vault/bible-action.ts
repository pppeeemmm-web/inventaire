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
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 100 // Usable width
    const accent = '#c8a86e'
    const text   = '#1a1a1d'
    const gray   = '#888888'

    // ── Title ───────────────────────────────────────────────────
    doc.fontSize(32).fillColor(text).text('The Studio Bible', 50, 100, { charSpacing: -1 })
    doc.fontSize(12).fillColor(gray).text('The Comprehensive Operating Manual for the PEM Hub Infrastructure.', { lineGap: 10 })
    
    doc.moveDown(2)

    // ── 01. Architecture ───────────────────────────────────────
    section(doc, '01. The Grand Architecture', accent)
    doc.fontSize(10).fillColor(text).text(
      'The Hub is designed as a high-density executive dashboard. It is split into four distinct "Surfaces," redistributed into a balanced 4-column matrix for optimal space utilization.',
      { width: W, align: 'justify', lineGap: 4 }
    )
    doc.moveDown()
    bullet(doc, 'The Atelier (Internal)', 'The nerve center. Inventory, pipeline, CRM, vault, diffusion controls.')
    bullet(doc, 'Collectionneurs (Private)', 'A gated portal for VIP clients. Secure selection sharing.')
    bullet(doc, 'Galeries (Partner)', 'A collaborative surface for partners. Management of consignments.')
    bullet(doc, 'Portfolio (Public)', 'The editorial face. Features the "Polaroid" layout system.')

    doc.addPage()
    section(doc, '02. Atelier portal — tab map', accent)
    doc.fontSize(10).fillColor(text).font('Helvetica').text(
      'All tabs live under /atelier with ?tab=<id>. Mobile sidebar prioritises Field: inventory, production, stock-take, overview. Desktop groups: Management, Operations, Vision, Commercial, Diffusion, Config.',
      { width: W, align: 'justify', lineGap: 4 },
    )
    doc.moveDown()
    doc.font('Helvetica-Bold').fontSize(10).text('Terrain / Field & core:')
    doc.font('Helvetica').text(
      'overview · inventory (WorkDrawer) · production · stock-take · constellation (?map=) · logistics · stock (SupplierHub)',
      { width: W, lineGap: 3 },
    )
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').text('CRM & catalogue:')
    doc.font('Helvetica').text('contacts · vault · themes · map (world) · sales · exhibitions', { width: W, lineGap: 3 })
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').text('Commercial & studio output:')
    doc.font('Helvetica').text('pipeline · fiscal · concepts · portfolio (PDF + public ordering)', { width: W, lineGap: 3 })
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').text('Config & governance:')
    doc.font('Helvetica').text('system (ledger + Bible + QA checklist download) · audit (admin) · broadcast (admin)', { width: W, lineGap: 3 })
    doc.moveDown()
    doc.fontSize(9).fillColor(gray).text(
      'Deep links: ?work=<OeuvreID> opens WorkDrawer; ?exhibition=<suivi_process id> opens Exhibitions; /atelier/scan and /maps support field and constellation map index.',
      { width: W, lineGap: 3 },
    )

    doc.addPage()
    section(doc, '03. Exhibition projects vs pipeline', accent)
    doc.fontSize(10).fillColor(text).font('Helvetica').text(
      'Pipeline processes live in suivi_process (types include vente, exposition, residence, expedition, consignment, …). An exhibition PROJECT is a dedicated suivi_process row with type = exposition, carrying its own suivi_etape checklist, calendar export, and floor plans in the Exhibitions tab.',
      { width: W, align: 'justify', lineGap: 4 },
    )
    doc.moveDown()
    doc.text(
      'When a commercial pipeline row needs a full exhibition workstream (more than a single step), create the exposition from the Pipeline process modal: a new exposition row is inserted, and the current pipeline row stores exhibition_process_id pointing to it. The Pipeline drawer exposes "Open exhibition project" → /atelier?tab=exhibitions&exhibition=<id>. Deleting an exhibition clears exhibition_process_id on referencing rows before removing the exposition.',
      { width: W, align: 'justify', lineGap: 4 },
    )

    doc.addPage()
    section(doc, '04. Site map, QA checklist, integrations', accent)
    doc.fontSize(10).fillColor(text).font('Helvetica').text(
      'Authoritative route list and Mermaid diagrams: docs/SITE_MAP.md in the repository. QA smoke checklist PDF: Atelier → System → download button (generated on demand, not vaulted).',
      { width: W, align: 'justify', lineGap: 4 },
    )
    doc.moveDown()
    bullet(doc, 'Broadcast API', 'Bearer INVENTORY_BROADCAST_SECRET — feed, queue, confirm, event under /api/inventory/broadcast/.')
    bullet(doc, 'Geocode', '/api/geocode for address tooling.')
    bullet(doc, 'Calendar OAuth', '/api/calendar/google|microsoft/callback for exhibition calendar push.')
    bullet(doc, 'Studio Bible URL', '/Atelier_Studio_Bible.pdf serves latest vaulted document kind=bible.')

    doc.addPage()
    section(doc, '05. Core operational workflows', accent)
    doc.fontSize(10).fillColor(text).font('Helvetica')
    doc.text('1. Selection: Choose works in Inventory or Constellation.')
    doc.text('2. The Dock: bulk actions bar for the active selection.')
    doc.text('3. Export PDF: Portfolio tab — museum-style PDF presets.')
    doc.text('4. Private link: tokenised selections for external viewers (/c/:token).')
    doc.text('5. Field capture: /atelier/scan resolves a work id into WorkDrawer.')

    doc.addPage()
    section(doc, '06. The data standard (non-negotiable)', accent)
    doc.fontSize(10).text('The system is only as good as the data entered. Follow these rules strictly:', { lineGap: 8 })
    
    doc.font('Helvetica-Bold').text('Typography:').font('Helvetica')
    doc.text('• Capitalize proper nouns: "Oil on Canvas".')
    doc.text('• Dimensions: Use × (multiplication), not x.')
    doc.text('• Metric: cm only.')
    
    doc.moveDown()
    doc.font('Helvetica-Bold').text('Imagery:').font('Helvetica')
    doc.text('• Format: .avif (Primary) or .webp.')
    doc.text('• Resolution: Minimum 2000px on the long edge.')

    doc.addPage()
    section(doc, '07. UI standards & aesthetics', accent)
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
      doc.text('SYSTEM DOCUMENTATION v1.1 — 2026', 50, 40, { align: 'right' })
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
