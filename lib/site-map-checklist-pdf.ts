/**
 * QA smoke checklist PDF — mirrors docs/SITE_MAP.md at a checklist granularity.
 * pdfkit: no 8-char hex; use fillOpacity + fill('#RRGGBB') + fillOpacity(1) for bands.
 */

export async function buildSiteMapChecklistPdf(): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default

  const items: { section: string; lines: string[] }[] = [
    {
      section: 'Public',
      lines: [
        'Landing /',
        'Works /works',
        'Practice /practice',
        'About /about',
        'Enquiry /enquiry',
        'Business card /card',
        'Private link /c/:token',
      ],
    },
    {
      section: 'Auth',
      lines: ['Login /login', 'OAuth callback /auth/callback'],
    },
    {
      section: 'Team pages',
      lines: [
        'Hub /hub',
        'Atelier /atelier',
        'New work /atelier/works/new',
        'Edit redirect /atelier/works/:id/edit → ?work=',
        'Field scan /atelier/scan',
        'Share receive POST /atelier/share-receive (PWA share_target + triage import form; optional title/text/url)',
        'Share triage /atelier/share-triage (inbox + device import)',
        'Ring C stubs /atelier/session/new, /capture, /documents/new, /triage (verb-specific field stub); /atelier/issue/new (maintenance task → studio_task)',
        'Maps index /maps',
      ],
    },
    {
      section: 'Atelier tabs (?tab=)',
      lines: [
        'overview',
        'inventory + WorkDrawer',
        'reports Reports XLSX/PDF',
        'constellation + ?map=',
        'production',
        'logistics',
        'sales',
        'exhibitions + ?exhibition= + calendar OAuth strip',
        'vault',
        'contacts + ContactEditorPanel',
        'map WorldMapTab',
        'pipeline + Gantt/Calendar + exhibition_process_id link',
        'fiscal',
        'concepts',
        'themes',
        'stock SupplierHub',
        'stock-take',
        'system + Studio Bible + checklist download',
        'portfolio',
        'audit admin',
        'broadcast admin',
      ],
    },
    {
      section: 'Partner portals',
      lines: ['Collection /collection/:collector_id', 'Galerie /galerie/:gallery_id'],
    },
    {
      section: 'API smoke',
      lines: [
        'GET/POST /api/geocode',
        'Bearer /api/inventory/broadcast/feed',
        'Bearer …/queue',
        'Bearer …/confirm',
        'Bearer …/event',
        'OAuth /api/calendar/google/callback',
        'OAuth /api/calendar/microsoft/callback',
      ],
    },
    {
      section: 'Static',
      lines: ['/Atelier_Studio_Bible.pdf signed redirect', '/manifest.webmanifest'],
    },
    {
      section: 'Data sanity',
      lines: [
        'suivi_process.exhibition_process_id → exposition row',
        'suivi_etape.process_id steps on exposition',
        'Delete exhibition clears FK on parent processes',
      ],
    },
  ]

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595 - 96
    const text = '#1a1a1d'
    const muted = '#666666'
    const band = '#f0ebe3'

    doc.fontSize(20).fillColor(text).text('PEM Hub — QA site checklist', 48, 48, { width: W })
    doc.fontSize(9).fillColor(muted).text(`Generated ${new Date().toISOString().slice(0, 10)} — tick boxes when smoke-tested.`, 48, 78, { width: W })

    let y = 108

    function rowBand(yy: number) {
      doc.save()
      doc.fillOpacity(0.35).rect(48, yy - 2, W, 14).fill(band).fillOpacity(1)
      doc.restore()
    }

    for (const block of items) {
      if (y > 720) {
        doc.addPage()
        y = 48
      }
      doc.fontSize(11).fillColor('#8b7355').font('Helvetica-Bold').text(block.section.toUpperCase(), 48, y, { width: W })
      y += 16

      for (const line of block.lines) {
        if (y > 740) {
          doc.addPage()
          y = 48
        }
        rowBand(y)
        doc.fontSize(10).fillColor(text).font('Helvetica').text(`☐  ${line}`, 52, y, { width: W - 8 })
        y += 16
      }
      y += 8
    }

    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i)
      doc.fontSize(8).fillColor(muted).text(
        `PEM Hub QA checklist — page ${i + 1} / ${range.count}`,
        48,
        800,
        { width: W, align: 'center' },
      )
    }

    doc.end()
  })
}
