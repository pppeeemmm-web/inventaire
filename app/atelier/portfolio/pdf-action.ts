'use server'

// Portfolio PDF export — server-side pdfkit + sharp.
// Full-bleed artwork pages (orientation-aware crop), texture strip, gold accent.
// Supports A4 portrait/landscape, US Letter portrait, A3 landscape.
// Note: maxDuration must be set on a route segment, not here.
// On Vercel free the function timeout is 60s — sufficient for ≤8 works at full quality.

import {
  MAX_WORKS, FORMATS,
  type PresetConfig,
  type PdfWork,
  type PdfPortfolioConfig,
  type PortfolioPdfResult,
} from '@/lib/portfolio-pdf-types'

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? ''

const GOLD     = '#c8a86e'
const WHITE    = '#ffffff'
const OFF_WHITE = '#f5f3f0'
const DARK     = '#1a1816'
const GREY     = '#8a8680'

/** pdfkit treats `#RRGGBBAA` as a single int → RGB channels wrong (e.g. `#000000cc` → blue). Use fillColor + opacity. */
const A = (byte: number) => byte / 255

function pageIsLandscape(pw: number, ph: number): boolean {
  return pw >= ph
}

function imageMatchesPageOrientation(imgW: number, imgH: number, pw: number, ph: number): boolean {
  const imgWide = imgW >= imgH
  const pageWide = pageIsLandscape(pw, ph)
  return imgWide === pageWide
}

function dims(w: PdfWork): string {
  const p = [w.Hauteur, w.Largeur, w.Profondeur].filter(Boolean)
  return p.length ? p.join(' × ') + ' cm' : ''
}

function yearOf(a: string | null | undefined): string {
  const y = parseInt(String(a ?? '').slice(0, 4))
  return Number.isFinite(y) && y > 1900 && y < 2100 ? String(y) : ''
}

// ── Main exported action ────────────────────────────────────────────────────

export async function generatePortfolioPdf(
  works:  PdfWork[],
  cfg:    PdfPortfolioConfig,
  preset: PresetConfig,
): Promise<PortfolioPdfResult> {
  try {
    const cap    = preset.maxWorks ?? MAX_WORKS
    const warned = works.length > cap
    const capped = warned ? works.slice(0, cap) : works

    const sharp = (await import('sharp')).default
    const imageMap   = new Map<number, Buffer>()
    const textureMap = new Map<number, Buffer>()
    const dimMap     = new Map<number, { w: number; h: number }>()

    // Fetch + process images — 4 at a time to avoid memory spikes
    const CONCURRENCY = 4
    for (let i = 0; i < capped.length; i += CONCURRENCY) {
      const chunk = capped.slice(i, i + CONCURRENCY)
      await Promise.all(chunk.map(async (w) => {
        if (!w.txtImageNameLink) return
        try {
          const url = w.txtImageNameLink.startsWith('http')
            ? w.txtImageNameLink
            : `${R2}/${encodeURIComponent(w.txtImageNameLink)}`

          const res = await fetch(url)
          if (!res.ok) return
          const raw = Buffer.from(await res.arrayBuffer())

          // Main image: resize long side to 2100px, unsharp mask, JPEG 92
          const meta   = await sharp(raw).metadata()
          const isWide = (meta.width ?? 0) >= (meta.height ?? 0)
          const resized = await sharp(raw)
            .resize(
              isWide ? 2100 : undefined,
              isWide ? undefined : 2100,
              { fit: 'inside', withoutEnlargement: true }
            )
            .sharpen({ sigma: 0.6, m1: 0.5, m2: 1.5 })
            .jpeg({ quality: 92, mozjpeg: true })
            .toBuffer()
          imageMap.set(w.OeuvreID, resized)
          const d = await sharp(resized).metadata()
          dimMap.set(w.OeuvreID, { w: d.width ?? 1, h: d.height ?? 1 })

          // Texture crop: bottom-left region, blurred + darkened
          const fw       = meta.width  ?? 400
          const fh       = meta.height ?? 400
          const cropSize = Math.min(Math.floor(Math.min(fw, fh) * 0.35), 600)
          const texture  = await sharp(raw)
            .extract({
              left:   0,
              top:    Math.max(0, fh - cropSize),
              width:  Math.min(cropSize, fw),
              height: Math.min(cropSize, fh),
            })
            .resize(800, 300, { fit: 'cover' })
            .blur(12)
            .modulate({ brightness: 0.48 })
            .jpeg({ quality: 60 })
            .toBuffer()
          textureMap.set(w.OeuvreID, texture)

        } catch (e) {
          console.error(`[portfolio-pdf] image fetch error #${w.OeuvreID}:`, e)
        }
      }))
    }

    const b64 = await buildPortfolioPdf(capped, cfg, preset, imageMap, textureMap, dimMap)

    const safeName = (cfg.artist_name || 'portfolio')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const ts       = new Date().toISOString().slice(0, 10)
    const filename = `${safeName}_portfolio_${ts}.pdf`

    return { ok: true, base64: b64, filename, warned,
      warningMsg: warned
        ? `${works.length} œuvres — seules les ${cap} premières ont été exportées.`
        : undefined,
    }
  } catch (e: any) {
    console.error('[portfolio-pdf]', e)
    return { error: e?.message ?? String(e) }
  }
}

// ── PDF builder ─────────────────────────────────────────────────────────────

async function buildPortfolioPdf(
  works:      PdfWork[],
  cfg:        PdfPortfolioConfig,
  preset:     PresetConfig,
  imageMap:   Map<number, Buffer>,
  textureMap: Map<number, Buffer>,
  dimMap:     Map<number, { w: number; h: number }>,
): Promise<string> {
  const PDFDocument = (await import('pdfkit')).default
  const fmt = FORMATS[preset.format]
  const [PW, PH] = fmt.size

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:          fmt.pdfkit,
      layout:        fmt.layout,
      margin:        0,
      autoFirstPage: false,
      bufferPages:   true,
      info: {
        Title:  `Portfolio — ${cfg.artist_name}`,
        Author: cfg.artist_name,
      },
    })

    const chunks: Buffer[] = []
    doc.on('data',  (c: Buffer) => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks).toString('base64')))
    doc.on('error', reject)

    function placeWorkImage(buf: Buffer, oeuvreId: number) {
      const dim   = dimMap.get(oeuvreId)
      const match = dim ? imageMatchesPageOrientation(dim.w, dim.h, PW, PH) : true
      const hAlign = match ? 'center' : 'left'
      doc.image(buf, 0, 0, {
        width: PW, height: PH,
        cover: [PW, PH],
        align: hAlign as 'center' | 'left',
        valign: 'center',
      })
    }

    const lang    = preset.lang
    const tagline = lang === 'fr' ? cfg.media_tagline_fr : cfg.media_tagline_en
    const intro   = lang === 'fr' ? cfg.intro_fr         : cfg.intro_en

    // ── Cover ────────────────────────────────────────────────────────────
    if (preset.includeCover) {
      doc.addPage()

      const firstImg = works.find(w => imageMap.has(w.OeuvreID))
      if (firstImg) {
        placeWorkImage(imageMap.get(firstImg.OeuvreID)!, firstImg.OeuvreID)
      } else {
        doc.rect(0, 0, PW, PH).fill(DARK)
      }

      // Overlays — lighter so artwork stays visible
      doc.save()
      doc.fillColor('#000000', A(0x38)).rect(0, 0, PW, PH).fill()
      doc.restore()
      doc.save()
      doc.fillColor('#000000', A(0x58)).rect(0, PH * 0.55, PW, PH * 0.45).fill()
      doc.restore()

      // Gold rule
      doc.moveTo(60, PH * 0.55).lineTo(180, PH * 0.55)
        .lineWidth(0.75).strokeColor(GOLD).stroke()

      // Name + tagline
      doc.fontSize(36).fillColor(WHITE).font('Helvetica-Bold')
        .text(cfg.artist_name || 'Artiste', 60, PH * 0.38, { lineBreak: false })
      if (tagline) {
        doc.fontSize(8).fillColor(GOLD).font('Helvetica')
          .text(tagline.toUpperCase(), 60, PH * 0.38 + 52, { characterSpacing: 2, lineBreak: false })
      }

      // Year
      doc.fontSize(7).fillColor(WHITE, A(0x55)).font('Helvetica')
        .text(String(new Date().getFullYear()), PW - 80, PH - 36, { width: 60, align: 'right', characterSpacing: 1 })
    }

    // ── Approach ─────────────────────────────────────────────────────────
    if (preset.includeApproach && intro) {
      doc.addPage()
      doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

      doc.moveTo(60, 72).lineTo(100, 72).lineWidth(0.75).strokeColor(GOLD).stroke()

      doc.fontSize(8).fillColor(GREY).font('Helvetica')
        .text((cfg.artist_name || '').toUpperCase(), 60, 82, { characterSpacing: 2 })

      doc.fontSize(16).fillColor(DARK).font('Helvetica-Oblique')
        .text(intro, 60, 140, { width: PW - 120, lineGap: 6 })

      doc.fontSize(7).fillColor(GREY).font('Helvetica')
        .text(`STUDIO · ${new Date().getFullYear()}`, 60, PH - 48, { characterSpacing: 1.5 })
    }

    // ── Work pages ────────────────────────────────────────────────────────
    for (const w of works) {
      doc.addPage()

      const img     = imageMap.get(w.OeuvreID)
      const texture = textureMap.get(w.OeuvreID)

      if (img) {
        placeWorkImage(img, w.OeuvreID)
      } else {
        doc.rect(0, 0, PW, PH).fill('#2a2826')
      }

      // Texture strip — bottom 32%
      const texH = PH * 0.32
      const texY = PH - texH
      if (texture) {
        doc.image(texture, 0, texY, { width: PW, height: texH, cover: [PW, texH] })
      }

      // Light vignette for text legibility (not heavy)
      doc.save()
      doc.fillColor('#000000', A(0x08)).rect(0, 0, PW, PH * 0.45).fill()
      doc.restore()
      doc.save()
      doc.fillColor('#000000', A(0x52)).rect(0, PH * 0.52, PW, PH * 0.48).fill()
      doc.restore()

      // Gold rule + metadata
      const metaY = texY + 20
      doc.moveTo(48, metaY).lineTo(128, metaY).lineWidth(0.5).strokeColor(GOLD).stroke()

      const titleY = metaY + 12
      doc.fontSize(18).fillColor(WHITE).font('Helvetica-Bold')
        .text(w.Titre || '—', 48, titleY, { width: PW * 0.6, lineBreak: false, ellipsis: true })

      let dy = titleY + 28
      const yr = yearOf(w.Annee)
      const tc = w.techniqueName ?? ''
      const dm = dims(w)

      if (yr) { doc.fontSize(8).fillColor('#cccccc').font('Helvetica').text(yr, 48, dy, { characterSpacing: 0.5 }); dy += 14 }
      if (tc) { doc.fontSize(7.5).fillColor('#aaaaaa').font('Helvetica').text(tc, 48, dy, { characterSpacing: 0.3 }); dy += 13 }
      if (dm) { doc.fontSize(7).fillColor('#888888').font('Helvetica').text(dm, 48, dy, { characterSpacing: 0.3 }) }

      // Artist hairline top-left
      doc.fontSize(6).fillColor(WHITE, A(0x44)).font('Helvetica')
        .text((cfg.artist_name || '').toUpperCase(), 48, 28, { characterSpacing: 1.5, lineBreak: false })
    }

    // ── Enquiry ───────────────────────────────────────────────────────────
    if (preset.includeEnquiry) {
      doc.addPage()
      doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

      doc.moveTo(60, 72).lineTo(100, 72).lineWidth(0.75).strokeColor(GOLD).stroke()

      doc.fontSize(8).fillColor(GOLD).font('Helvetica')
        .text(lang === 'fr' ? 'CONTACT' : 'ENQUIRY', 60, 82, { characterSpacing: 3 })

      doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold')
        .text(cfg.artist_name || 'Artiste', 60, 120)

      let cy = 168
      if (cfg.contact_email) {
        doc.fontSize(10).fillColor(DARK).font('Helvetica').text(cfg.contact_email, 60, cy); cy += 22
      }
      if (cfg.instagram) {
        doc.fontSize(9).fillColor(GREY).font('Helvetica')
          .text(`@${cfg.instagram.replace(/^@/, '')}`, 60, cy, { characterSpacing: 0.3 }); cy += 18
      }
      if (cfg.phone) {
        doc.fontSize(9).fillColor(GREY).font('Helvetica').text(cfg.phone, 60, cy)
      }

      doc.fontSize(7).fillColor('#cccccc').font('Helvetica')
        .text(`© ${new Date().getFullYear()} ${cfg.artist_name}`, 60, PH - 48, { characterSpacing: 1 })
    }

    // ── Page numbers on work pages ────────────────────────────────────────
    const range       = doc.bufferedPageRange()
    const workStart   = (preset.includeCover ? 1 : 0) + (preset.includeApproach && intro ? 1 : 0)
    const workEnd     = workStart + works.length - 1

    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i)
      if (i >= workStart && i <= workEnd) {
        const wi = i - workStart
        doc.fontSize(6).fillColor(WHITE, A(0x44)).font('Helvetica')
          .text(`${wi + 1} / ${works.length}`, PW - 80, PH - 28, { width: 60, align: 'right', characterSpacing: 1 })
      }
    }

    doc.end()
  })
}
