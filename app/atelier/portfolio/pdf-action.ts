'use server'

// Portfolio PDF export — self-contained server action.
// Loads atelier config + public works server-side, builds structured PDF
// (cover → about → [section title → works] → practice → contact).
// Layout: full-bleed artwork pages with offset, texture detail crop, gold accents.
// Vercel free function timeout 60s — sufficient for ≤16 works at full quality.

import { createClient } from '@/lib/supabase/server'
import { loadPortfolioConfig } from './actions'
import {
  MAX_WORKS, FORMATS,
  type PdfRequestOptions,
  type PdfWork,
  type PdfSection,
  type PdfPortfolioConfig,
  type PortfolioPdfResult,
} from '@/lib/portfolio-pdf-types'
import type { Lang } from '@/lib/i18n/dictionary'

const R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? ''

const GOLD      = '#c8a86e'
const WHITE     = '#ffffff'
const OFF_WHITE = '#f5f3f0'
const DARK      = '#1a1816'
const GREY      = '#8a8680'

// ── Helpers ────────────────────────────────────────────────────────────────

function htmlToPlain(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim()
}

function pick(fr: string, en: string, lang: Lang): string {
  return lang === 'fr' ? (fr || en) : (en || fr)
}

function dims(w: PdfWork): string {
  const p = [w.Hauteur, w.Largeur, w.Profondeur].filter(Boolean)
  return p.length ? p.join(' × ') + ' cm' : ''
}

function yearOf(a: string | null | undefined): string {
  const y = parseInt(String(a ?? '').slice(0, 4))
  return Number.isFinite(y) && y > 1900 && y < 2100 ? String(y) : ''
}

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function workMatchesTheme(themes: string[], target: string | null | undefined): boolean {
  if (!target?.trim()) return true
  const tn = normalizeTheme(target)
  return themes.some(th => {
    const wn = normalizeTheme(th)
    return wn.includes(tn) || tn.includes(wn)
  })
}

// ── Public action ──────────────────────────────────────────────────────────

export async function generatePortfolioPdf(
  opts: PdfRequestOptions,
): Promise<PortfolioPdfResult> {
  try {
    // 1. Load atelier config + public works in parallel
    const [cfgResult, worksResult] = await Promise.all([
      loadPortfolioConfig(),
      loadPublicWorks(),
    ])

    if ('error' in cfgResult) return { error: `Config load failed: ${cfgResult.error}` }
    if ('error' in worksResult) return { error: `Works load failed: ${worksResult.error}` }

    const rawConfig = cfgResult.config
    const allWorks  = worksResult.works

    if (allWorks.length === 0) {
      return { error: 'Aucune œuvre publique disponible (vérifier statusId et images).' }
    }

    // 2. Build lang-resolved config
    const cfg = resolveConfig(rawConfig, opts.lang)

    // 3. Resolve sections (atelier-driven structure)
    let sections = resolveSections(rawConfig, allWorks, opts)

    console.log('[portfolio-pdf] final sections:',
      sections.map(s => ({ id: s.id, title: s.title || '(none)', works: s.works.length })))

    // Fallback: no atelier source produced works → emit all public works in DB order
    if (sections.length === 0) {
      console.warn('[portfolio-pdf] ⚠ no atelier source produced works — falling back to all public works in DB order')
      console.warn('[portfolio-pdf] check atelier Portfolio tab / Site public tab: section themes must match work themes (case/accent-insensitive), OR manual_work_order must reference public works with images')
      sections = [{
        id: '__all__', title: '', description: '', intro: '', outro: '',
        works: allWorks.slice(),
      }]
    }

    // 4. Apply global cap across sections
    const cap        = opts.maxWorks ?? MAX_WORKS
    const totalWorks = sections.reduce((acc, s) => acc + s.works.length, 0)
    const warned     = totalWorks > cap
    const cappedSections = capSections(sections, cap)

    // 5. Pre-fetch + process images
    const flatWorks = cappedSections.flatMap(s => s.works)
    const imageMap  = await prefetchImages(flatWorks)

    // 6. Build PDF
    const b64 = await buildPortfolioPdf(cfg, cappedSections, opts, imageMap)

    const safeName = (cfg.artist_name || 'portfolio')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const ts       = new Date().toISOString().slice(0, 10)
    const filename = `${safeName}_portfolio_${opts.preset}_${ts}.pdf`

    return {
      ok: true, base64: b64, filename, warned,
      warningMsg: warned
        ? `${totalWorks} œuvres — seules les ${cap} premières ont été exportées.`
        : undefined,
    }
  } catch (e: any) {
    console.error('[portfolio-pdf]', e)
    return { error: e?.message ?? String(e) }
  }
}

// ── Data loading ───────────────────────────────────────────────────────────

async function loadPublicWorks(): Promise<{ works: PdfWork[] } | { error: string }> {
  try {
    const sb = await createClient() as any
    const [
      { data: rawWorks, error: eWorks },
      { data: rawTech },
      { data: themeRecords },
      { data: oeuvreThemes },
    ] = await Promise.all([
      sb.from('Oeuvres')
        .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink, Technique, statusId')
        .is('deleted_at', null)
        .eq('is_public', true)
        .order('Année', { ascending: false }),
      sb.from('Technique').select('TechniqueID, Technique'),
      sb.from('tblTheme').select('ThemeID, Nom'),
      sb.from('OeuvreTheme').select('OeuvreID, ThemeID'),
    ])

    if (eWorks) return { error: eWorks.message ?? String(eWorks) }

    const tMap: Record<number, string> = {}
    for (const t of (rawTech ?? []) as any[]) {
      if (t.TechniqueID != null && t.Technique) tMap[t.TechniqueID] = t.Technique
    }

    const thMap: Record<number, string> = {}
    for (const th of (themeRecords ?? []) as any[]) thMap[th.ThemeID] = th.Nom

    const oeuvreThemeMap = new Map<number, string[]>()
    for (const ot of (oeuvreThemes ?? []) as any[]) {
      if (!oeuvreThemeMap.has(ot.OeuvreID)) oeuvreThemeMap.set(ot.OeuvreID, [])
      const name = thMap[ot.ThemeID]
      if (name) oeuvreThemeMap.get(ot.OeuvreID)!.push(name)
    }

    const works = ((rawWorks ?? []) as any[])
      .filter(o => Boolean(o.txtImageNameLink))
      .map(o => ({
        OeuvreID:         o.OeuvreID as number,
        Titre:            o.Titre as string | null,
        Annee:            o['Année'] as string | null,
        Hauteur:          o.Hauteur as string | null,
        Largeur:          o.Largeur as string | null,
        Profondeur:       o.Profondeur as string | null,
        txtImageNameLink: o.txtImageNameLink as string | null,
        themes:           oeuvreThemeMap.get(o.OeuvreID) ?? [],
        techniqueName:    o.Technique != null ? (tMap[o.Technique as number] ?? null) : null,
        statutId:         o.statusId as number | null,
      }))

    return { works }
  } catch (e: any) {
    console.error('[loadPublicWorks]', e)
    return { error: e?.message ?? String(e) }
  }
}

function resolveConfig(raw: any, lang: Lang): PdfPortfolioConfig {
  const general  = raw?.general  ?? {}
  const about    = raw?.about    ?? {}
  const practice = raw?.practice ?? {}

  return {
    artist_name:     general.artist_name   ?? '',
    contact_email:   general.contact_email ?? '',
    instagram:       general.instagram     ?? '',
    phone:           general.phone         ?? '',
    media_tagline:   pick(general.media_tagline_fr ?? '', general.media_tagline_en ?? '', lang),
    about_intro:     htmlToPlain(pick(about.intro_fr ?? general.about_intro ?? '', about.intro_en ?? '', lang)),
    practice_intro:  htmlToPlain(pick(practice.approach_fr ?? '', practice.approach_en ?? '', lang)),
  }
}

/**
 * Build sections in the order configured by the atelier.
 *
 * Multiple atelier tabs can hold collections (sections / works_modes / works_collections).
 * We try each source in priority order and KEEP THE FIRST ONE THAT ACTUALLY CLAIMS WORKS.
 * This handles the common case where the user configures works in one tab but another tab
 * holds stale/empty entries.
 *
 * Within each section, works are ordered by:
 *   1. manual_work_order[]  (atelier drag order)
 *   2. theme match (residual)
 */
function resolveSections(raw: any, allWorks: PdfWork[], opts: PdfRequestOptions): PdfSection[] {
  const lang = opts.lang

  // Build candidate source lists with their origin label
  const candidates: { label: string; list: any[] }[] = [
    { label: 'sections',                list: Array.isArray(raw?.sections)          ? raw.sections          : [] },
    { label: 'works_modes[0].collections',
      list: Array.isArray(raw?.works_modes) && raw.works_modes[0] && Array.isArray(raw.works_modes[0].collections)
        ? raw.works_modes[0].collections
        : [] },
    { label: 'works_collections',       list: Array.isArray(raw?.works_collections) ? raw.works_collections : [] },
  ]

  for (const cand of candidates) {
    if (cand.list.length === 0) continue
    const resolved = buildSectionsFrom(cand.list, allWorks, opts, lang)
    const claimed  = resolved.reduce((acc, s) => acc + s.works.length, 0)
    console.log(`[portfolio-pdf] source "${cand.label}": ${cand.list.length} collections → ${claimed} works claimed`)
    if (claimed > 0) {
      console.log(`[portfolio-pdf] using source: ${cand.label}`)
      return resolved
    }
  }

  // No source produced any works
  return []
}

function buildSectionsFrom(
  sourceList: any[],
  allWorks:   PdfWork[],
  opts:       PdfRequestOptions,
  lang:       Lang,
): PdfSection[] {
  const active = sourceList
    .filter((c: any) => c.is_active !== false)
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const filtered = opts.collectionFilter
    ? active.filter((c: any) => String(c.id) === opts.collectionFilter)
    : active

  if (filtered.length === 0) return []

  const seen = new Set<number>()
  const byId = new Map(allWorks.map(w => [w.OeuvreID, w]))

  return filtered.map((c: any): PdfSection => {
    const orderIds: number[] = Array.isArray(c.manual_work_order)
      ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
      : []

    const works: PdfWork[] = []

    for (const id of orderIds) {
      const w = byId.get(id)
      if (!w) continue
      if (seen.has(w.OeuvreID)) continue
      seen.add(w.OeuvreID)
      works.push(w)
    }

    for (const w of allWorks) {
      if (seen.has(w.OeuvreID)) continue
      if (!workMatchesTheme(w.themes, c.theme)) continue
      seen.add(w.OeuvreID)
      works.push(w)
    }

    return {
      id:          String(c.id ?? ''),
      title:       pick(c.title_fr || c.title || '', c.title_en || c.title || '', lang),
      description: htmlToPlain(pick(c.description_fr || c.description || '', c.description_en || c.description || '', lang)),
      intro:       htmlToPlain(pick(c.intro_fr || '', c.intro_en || '', lang)),
      outro:       htmlToPlain(pick(c.outro_fr || '', c.outro_en || '', lang)),
      works,
    }
  })
}

function capSections(sections: PdfSection[], cap: number): PdfSection[] {
  let remaining = cap
  return sections.map(s => {
    if (remaining <= 0) return { ...s, works: [] }
    const take = s.works.slice(0, remaining)
    remaining -= take.length
    return { ...s, works: take }
  })
}

// ── Image processing ───────────────────────────────────────────────────────

async function prefetchImages(works: PdfWork[]): Promise<Map<number, Buffer>> {
  const sharp = (await import('sharp')).default
  const imageMap = new Map<number, Buffer>()

  const CONCURRENCY = 4
  for (let i = 0; i < works.length; i += CONCURRENCY) {
    const chunk = works.slice(i, i + CONCURRENCY)
    await Promise.all(chunk.map(async (w) => {
      if (!w.txtImageNameLink) return
      try {
        const url = w.txtImageNameLink.startsWith('http')
          ? w.txtImageNameLink
          : `${R2}/${encodeURIComponent(w.txtImageNameLink)}`

        const res = await fetch(url)
        if (!res.ok) return
        const raw = Buffer.from(await res.arrayBuffer())

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
      } catch (e) {
        console.error(`[portfolio-pdf] image error #${w.OeuvreID}:`, e)
      }
    }))
  }

  return imageMap
}

// ── PDF builder ────────────────────────────────────────────────────────────

async function buildPortfolioPdf(
  cfg:      PdfPortfolioConfig,
  sections: PdfSection[],
  opts:     PdfRequestOptions,
  imageMap: Map<number, Buffer>,
): Promise<string> {
  const PDFDocument = (await import('pdfkit')).default
  const fmt = FORMATS[opts.format]
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

    const allWorksFlat = sections.flatMap(s => s.works)

    // Cover work: pick first work whose image actually loaded.
    // Then EXCLUDE it from the work pages so no image is used twice.
    const coverWork = opts.includeCover
      ? allWorksFlat.find(w => imageMap.has(w.OeuvreID)) ?? null
      : null
    const coverId = coverWork?.OeuvreID

    const sectionsForPages = coverId != null
      ? sections.map(s => ({ ...s, works: s.works.filter(w => w.OeuvreID !== coverId) }))
      : sections

    const pageWorks  = sectionsForPages.flatMap(s => s.works)
    const totalWorks = pageWorks.length

    // ── Cover ────────────────────────────────────────────────────────────
    if (opts.includeCover) {
      doc.addPage()

      if (coverWork) {
        doc.image(imageMap.get(coverWork.OeuvreID)!, -40, 0, {
          width: PW + 80, height: PH, cover: [PW + 80, PH],
        })
      } else {
        doc.rect(0, 0, PW, PH).fill(DARK)
      }

      // Slim bottom strip — let artwork breathe.
      const bandY = PH * 0.78
      const bandH = PH - bandY
      doc.fillOpacity(0.55).rect(0, bandY, PW, bandH).fill('#000000')
      doc.fillOpacity(1)

      doc.moveTo(60, bandY + 20).lineTo(140, bandY + 20)
        .lineWidth(0.75).strokeColor(GOLD).stroke()

      doc.fontSize(22).fillColor(WHITE).font('Helvetica-Bold')
        .text(cfg.artist_name || 'Artiste', 60, bandY + 32, { lineBreak: false })

      if (cfg.media_tagline) {
        doc.fontSize(7).fillColor(GOLD).font('Helvetica')
          .text(cfg.media_tagline.toUpperCase(), 60, bandY + 62, { characterSpacing: 2, lineBreak: false })
      }

      doc.fillOpacity(0.5)
      doc.fontSize(7).fillColor('#ffffff').font('Helvetica')
        .text(String(new Date().getFullYear()), PW - 80, PH - 28, { width: 60, align: 'right', characterSpacing: 1 })
      doc.fillOpacity(1)
    }

    // ── About ────────────────────────────────────────────────────────────
    if (opts.includeAbout && cfg.about_intro) {
      drawTextPage(doc, PW, PH, {
        eyebrow: (cfg.artist_name || '').toUpperCase(),
        body:    cfg.about_intro,
      })
    }

    // ── Sections + works ─────────────────────────────────────────────────
    let workCounter = 0

    for (const sec of sectionsForPages) {
      if (sec.works.length === 0) continue

      if (sec.title || sec.description || sec.intro) {
        drawTextPage(doc, PW, PH, {
          eyebrow: opts.lang === 'fr' ? 'COLLECTION' : 'COLLECTION',
          title:   sec.title,
          body:    sec.intro || sec.description,
        })
      }

      for (const w of sec.works) {
        workCounter++
        drawWorkPage(doc, PW, PH, cfg, w, workCounter, totalWorks, imageMap)
      }

      if (sec.outro) {
        drawTextPage(doc, PW, PH, { body: sec.outro })
      }
    }

    // ── Practice page (config.practice.approach) ────────────────────────
    if (opts.includePractice && cfg.practice_intro) {
      drawTextPage(doc, PW, PH, {
        eyebrow: opts.lang === 'fr' ? 'DÉMARCHE' : 'PRACTICE',
        body:    cfg.practice_intro,
      })
    }

    // ── Contact ──────────────────────────────────────────────────────────
    if (opts.includeContact) {
      doc.addPage()
      doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

      doc.moveTo(60, 72).lineTo(100, 72).lineWidth(0.75).strokeColor(GOLD).stroke()

      doc.fontSize(8).fillColor(GOLD).font('Helvetica')
        .text(opts.lang === 'fr' ? 'CONTACT' : 'ENQUIRY', 60, 82, { characterSpacing: 3 })

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

    doc.end()
  })
}

// ── Page helpers ───────────────────────────────────────────────────────────

function drawTextPage(
  doc:  any,
  PW:   number,
  PH:   number,
  opts: { eyebrow?: string; title?: string; body?: string },
) {
  doc.addPage()
  doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

  doc.moveTo(60, 72).lineTo(100, 72).lineWidth(0.75).strokeColor(GOLD).stroke()

  let y = 82
  if (opts.eyebrow) {
    doc.fontSize(8).fillColor(GREY).font('Helvetica')
      .text(opts.eyebrow, 60, y, { characterSpacing: 2 })
    y += 24
  }

  if (opts.title) {
    doc.fontSize(28).fillColor(DARK).font('Helvetica-Bold')
      .text(opts.title, 60, y, { width: PW - 120, lineGap: 2 })
    y = doc.y + 18
  }

  if (opts.body) {
    doc.fontSize(11).fillColor(DARK).font('Helvetica-Oblique')
      .text(opts.body, 60, Math.max(y, 140), { width: PW - 120, lineGap: 4 })
  }
}

/**
 * Detect artwork orientation from DB Hauteur × Largeur.
 * Defaults to portrait if dims missing.
 */
function workIsPortrait(w: PdfWork): boolean {
  const parse = (s: string | null | undefined): number | null => {
    if (s == null || String(s).trim() === '') return null
    const n = parseFloat(String(s).replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  const H = parse(w.Hauteur)
  const W = parse(w.Largeur)
  if (H == null && W == null) return true
  if (H == null) return false
  if (W == null) return true
  return H >= W
}

function drawWorkPage(
  doc:      any,
  PW:       number,
  PH:       number,
  cfg:      PdfPortfolioConfig,
  w:        PdfWork,
  index:    number,
  total:    number,
  imageMap: Map<number, Buffer>,
) {
  const pagePortrait = PH >= PW
  const artPortrait  = workIsPortrait(w)
  const fullBleed    = pagePortrait === artPortrait

  if (fullBleed) {
    drawWorkFullBleed(doc, PW, PH, cfg, w, index, total, imageMap)
  } else if (pagePortrait) {
    // portrait page + landscape art → image tucked top, text below
    drawWorkTopContained(doc, PW, PH, cfg, w, index, total, imageMap)
  } else {
    // landscape page + portrait art → image tucked left, text right
    drawWorkLeftContained(doc, PW, PH, cfg, w, index, total, imageMap)
  }
}

/** Full bleed: artwork fills page, solid white metadata band at bottom (museum-catalogue style). */
function drawWorkFullBleed(
  doc: any, PW: number, PH: number,
  cfg: PdfPortfolioConfig, w: PdfWork,
  index: number, total: number,
  imageMap: Map<number, Buffer>,
) {
  doc.addPage()

  const img = imageMap.get(w.OeuvreID)
  if (img) {
    doc.image(img, 0, 0, { width: PW, height: PH, cover: [PW, PH], align: 'center', valign: 'center' })
  } else {
    doc.rect(0, 0, PW, PH).fill('#2a2826')
  }

  // Solid white bottom band — black text on white, like a printed catalogue plate.
  const bandY = PH * 0.78
  doc.rect(0, bandY, PW, PH - bandY).fill(OFF_WHITE)

  // Gold rule + title + meta inside band
  doc.moveTo(48, bandY + 18).lineTo(128, bandY + 18)
    .lineWidth(0.5).strokeColor(GOLD).stroke()

  doc.fontSize(16).fillColor(DARK).font('Helvetica-Bold')
    .text(w.Titre || '—', 48, bandY + 26, { width: PW - 96, lineBreak: false, ellipsis: true })

  const meta = [yearOf(w.Annee), w.techniqueName ?? '', dims(w)].filter(Boolean).join('  ·  ')
  if (meta) {
    doc.fontSize(8).fillColor(GREY).font('Helvetica')
      .text(meta, 48, bandY + 50, { width: PW - 96, characterSpacing: 0.3, lineBreak: false, ellipsis: true })
  }

  // Hairline artist name top-left (white on artwork, low opacity)
  doc.fillOpacity(0.35)
  doc.fontSize(6).fillColor('#ffffff').font('Helvetica')
    .text((cfg.artist_name || '').toUpperCase(), 28, 28, { characterSpacing: 1.5, lineBreak: false })
  doc.fillOpacity(1)

  if (total > 1) {
    doc.fontSize(6).fillColor(GREY).font('Helvetica')
      .text(`${index} / ${total}`, PW - 80, PH - 18, { width: 60, align: 'right', characterSpacing: 1 })
  }
}

/** Portrait page + landscape art: image at top ~55%, off-white text panel below. */
function drawWorkTopContained(
  doc: any, PW: number, PH: number,
  cfg: PdfPortfolioConfig, w: PdfWork,
  index: number, total: number,
  imageMap: Map<number, Buffer>,
) {
  doc.addPage()
  doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

  // Image area: top portion, leaving room for text below
  const imgAreaH = PH * 0.55
  const margin   = 32
  const img = imageMap.get(w.OeuvreID)
  if (img) {
    doc.image(img, margin, margin, {
      fit:    [PW - margin * 2, imgAreaH - margin],
      align:  'center',
      valign: 'top',
    })
  } else {
    doc.rect(margin, margin, PW - margin * 2, imgAreaH - margin).fill('#2a2826')
  }

  // Text panel below
  const textY = imgAreaH + 16
  doc.moveTo(48, textY).lineTo(128, textY).lineWidth(0.5).strokeColor(GOLD).stroke()

  doc.fontSize(20).fillColor(DARK).font('Helvetica-Bold')
    .text(w.Titre || '—', 48, textY + 14, { width: PW - 96 })

  let dy = doc.y + 12
  const yr = yearOf(w.Annee)
  if (yr) { doc.fontSize(9).fillColor(GREY).font('Helvetica').text(yr, 48, dy, { characterSpacing: 0.5 }); dy += 16 }
  if (w.techniqueName) { doc.fontSize(9).fillColor(GREY).font('Helvetica').text(w.techniqueName, 48, dy, { characterSpacing: 0.3 }); dy += 14 }
  const dm = dims(w)
  if (dm) { doc.fontSize(8).fillColor('#aaaaaa').font('Helvetica').text(dm, 48, dy, { characterSpacing: 0.3 }) }

  // Hairline artist top-left
  doc.fontSize(6).fillColor('#bbbbbb').font('Helvetica')
    .text((cfg.artist_name || '').toUpperCase(), 28, 28, { characterSpacing: 1.5, lineBreak: false })

  if (total > 1) {
    doc.fontSize(6).fillColor('#bbbbbb').font('Helvetica')
      .text(`${index} / ${total}`, PW - 80, PH - 28, { width: 60, align: 'right', characterSpacing: 1 })
  }
}

/** Landscape page + portrait art: image left ~55% width, text panel right. */
function drawWorkLeftContained(
  doc: any, PW: number, PH: number,
  cfg: PdfPortfolioConfig, w: PdfWork,
  index: number, total: number,
  imageMap: Map<number, Buffer>,
) {
  doc.addPage()
  doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

  const margin    = 32
  const imgAreaW  = PW * 0.55
  const img = imageMap.get(w.OeuvreID)
  if (img) {
    doc.image(img, margin, margin, {
      fit:    [imgAreaW - margin, PH - margin * 2],
      align:  'left',
      valign: 'center',
    })
  } else {
    doc.rect(margin, margin, imgAreaW - margin, PH - margin * 2).fill('#2a2826')
  }

  const textX = imgAreaW + 16
  const textY = PH * 0.30

  doc.moveTo(textX, textY).lineTo(textX + 80, textY).lineWidth(0.5).strokeColor(GOLD).stroke()

  doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold')
    .text(w.Titre || '—', textX, textY + 14, { width: PW - textX - margin })

  let dy = doc.y + 14
  const yr = yearOf(w.Annee)
  if (yr) { doc.fontSize(10).fillColor(GREY).font('Helvetica').text(yr, textX, dy, { characterSpacing: 0.5 }); dy += 18 }
  if (w.techniqueName) { doc.fontSize(9).fillColor(GREY).font('Helvetica').text(w.techniqueName, textX, dy, { characterSpacing: 0.3 }); dy += 16 }
  const dm = dims(w)
  if (dm) { doc.fontSize(9).fillColor('#aaaaaa').font('Helvetica').text(dm, textX, dy, { characterSpacing: 0.3 }) }

  doc.fontSize(6).fillColor('#bbbbbb').font('Helvetica')
    .text((cfg.artist_name || '').toUpperCase(), 28, 28, { characterSpacing: 1.5, lineBreak: false })

  if (total > 1) {
    doc.fontSize(6).fillColor('#bbbbbb').font('Helvetica')
      .text(`${index} / ${total}`, PW - 80, PH - 28, { width: 60, align: 'right', characterSpacing: 1 })
  }
}
