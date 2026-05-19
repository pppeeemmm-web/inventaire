'use server'

// Portfolio PDF export — self-contained server action.
// Loads atelier config + public works server-side, builds structured PDF
// (title → selected works → approach → succinct CV → contact/thanks).
// Layout: one artwork per page, with orientation-aware A4 portrait handling.
// Vercel free function timeout 60s — sufficient for ≤16 works at full quality.

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { loadPortfolioConfig } from './actions'
import {
  MAX_WORKS, FORMATS,
  type PdfRequestOptions,
  type PdfWorkLayout,
  type PdfWork,
  type PdfWorkCandidate,
  type PdfCollectionCandidate,
  type PdfSection,
  type PdfPortfolioConfig,
  type PdfProfileSettings,
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

function translateTechnique(name: string | null | undefined, lang: Lang): string {
  if (!name) return ''
  if (lang === 'fr') return name
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const exact: Record<string, string> = {
    huile: 'Oil',
    'huile sur toile': 'Oil on canvas',
    acrylique: 'Acrylic',
    'acrylique sur toile': 'Acrylic on canvas',
    aquarelle: 'Watercolour',
    encre: 'Ink',
    fusain: 'Charcoal',
    pastel: 'Pastel',
    crayon: 'Pencil',
    graphite: 'Graphite',
    collage: 'Collage',
    photographie: 'Photography',
    photo: 'Photography',
    sculpture: 'Sculpture',
    installation: 'Installation',
    gravure: 'Engraving',
    dessin: 'Drawing',
    mixte: 'Mixed media',
    'technique mixte': 'Mixed media',
  }
  return exact[normalized] ?? name
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
    opts = applySavedPdfProfile(rawConfig, opts)

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

    const statementSections = opts.collectionStatements?.length
      ? opts.collectionStatements.map(s => ({
          id: s.id,
          title: htmlToPlain(s.title),
          intro: htmlToPlain(s.intro),
          description: htmlToPlain(s.description),
          outro: '',
          works: [],
        }))
      : sections

    if (Array.isArray(opts.workSequence)) {
      if (opts.workSequence.length === 0) return { error: 'Aucune œuvre sélectionnée pour le PDF.' }
      sections = resolveExplicitSequence(opts.workSequence, allWorks)
      if (sections[0]?.works.length === 0) return { error: 'Aucune œuvre sélectionnée ne correspond aux œuvres publiques disponibles.' }
    }

    // 4. Apply global cap across sections
    const cap        = opts.maxWorks ?? MAX_WORKS
    const totalWorks = sections.reduce((acc, s) => acc + s.works.length, 0)
    const warned     = totalWorks > cap
    const cappedSections = capSections(sections, cap)

    // 5. Pre-fetch + process images
    const flatWorks = cappedSections.flatMap(s => s.works)
    const { imageMap, imageAspectMap } = await prefetchImages(flatWorks)

    // 6. Build PDF
    const cvText = opts.includeCv === false ? '' : await loadCvText(rawConfig, opts.lang)
    const b64 = await buildPortfolioPdf(cfg, cappedSections, opts, imageMap, imageAspectMap, cvText, statementSections)

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

function applySavedPdfProfile(rawConfig: any, opts: PdfRequestOptions): PdfRequestOptions {
  if (Array.isArray(opts.workSequence) && opts.workSequence.length > 0) return opts
  if (opts.preset === 'custom') return opts
  const profile = rawConfig?.pdf_profiles?.[opts.preset]?.[opts.format] as PdfProfileSettings | undefined
  if (!profile) return opts
  return {
    ...opts,
    collectionFilter: profile.collectionFilter,
    workSequence: profile.workSequence,
    workLayouts: profile.workLayouts,
    includeCollectionText: profile.includeCollectionText,
    includePractice: profile.includePractice,
    includeCv: profile.includeCv,
    includeContact: profile.includeContact,
    maxWorks: profile.maxWorks,
  }
}

export async function getPortfolioPdfWorkCandidates(
  opts: Pick<PdfRequestOptions, 'lang' | 'collectionFilter'>,
): Promise<{ works: PdfWorkCandidate[]; collections: PdfCollectionCandidate[] } | { error: string }> {
  try {
    const [cfgResult, worksResult] = await Promise.all([
      loadPortfolioConfig(),
      loadPublicWorks(),
    ])

    if ('error' in cfgResult) return { error: `Config load failed: ${cfgResult.error}` }
    if ('error' in worksResult) return { error: `Works load failed: ${worksResult.error}` }

    const baseOpts: PdfRequestOptions = {
      preset: 'custom',
      format: 'a4p',
      lang: opts.lang,
      includeCover: true,
      includeAbout: false,
      includeCollectionText: false,
      includePractice: true,
      includeCv: true,
      includeContact: true,
      maxWorks: null,
      collectionFilter: null,
    }
    const allSections = resolveSections(cfgResult.config, worksResult.works, baseOpts)
    const collections = allSections.flatMap((section): PdfCollectionCandidate[] => {
      if (!section.id || section.works.length === 0) return []
      return [{
        id: section.id,
        title: section.title || section.id,
        worksCount: section.works.length,
      }]
    })

    const sections = opts.collectionFilter
      ? resolveSections(cfgResult.config, worksResult.works, { ...baseOpts, collectionFilter: opts.collectionFilter })
      : allSections

    const ordered = sections.length > 0
      ? sections.flatMap(s => s.works)
      : worksResult.works
    const seen = new Set<number>()
    const works = ordered.flatMap((w): PdfWorkCandidate[] => {
      if (seen.has(w.OeuvreID)) return []
      seen.add(w.OeuvreID)
      return [{
        OeuvreID: w.OeuvreID,
        Titre: w.Titre,
        Annee: w.Annee,
        Hauteur: w.Hauteur,
        Largeur: w.Largeur,
        txtImageNameLink: w.txtImageNameLink,
      }]
    })

    return { works, collections }
  } catch (e: any) {
    console.error('[getPortfolioPdfWorkCandidates]', e)
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
        .select('OeuvreID, Titre, "Année", Hauteur, Largeur, Profondeur, txtImageNameLink, Technique, statusId')
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

function resolveExplicitSequence(orderIds: number[], allWorks: PdfWork[]): PdfSection[] {
  const byId = new Map(allWorks.map(w => [w.OeuvreID, w]))
  const seen = new Set<number>()
  const works: PdfWork[] = []
  for (const rawId of orderIds) {
    const id = Number(rawId)
    if (!Number.isFinite(id) || seen.has(id)) continue
    const work = byId.get(id)
    if (!work) continue
    seen.add(id)
    works.push(work)
  }
  return [{ id: '__sequence__', title: '', description: '', intro: '', outro: '', works }]
}

async function loadCvText(rawConfig: any, lang: Lang): Promise<string> {
  const docId = rawConfig?.cv_doc_id
  if (!docId) return ''
  try {
    const sb = createServiceClient()
    const { data: doc, error } = await (sb.from('document') as any)
      .select('name, storage_path, mime_type')
      .eq('id', docId)
      .maybeSingle()
    if (error || !doc?.storage_path) return ''

    const { data, error: dlErr } = await sb.storage.from('vault').download(doc.storage_path)
    if (dlErr || !data) return ''

    const buf = Buffer.from(await data.arrayBuffer())
    const name = String(doc.name ?? doc.storage_path ?? '').toLowerCase()
    const mime = String(doc.mime_type ?? '').toLowerCase()
    let text = ''

    if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml({ buffer: buf })
      text = htmlToPlain(result.value)
    } else if (name.endsWith('.txt') || mime.startsWith('text/')) {
      text = buf.toString('utf-8')
    } else {
      console.warn('[portfolio-pdf] CV extraction skipped; use .txt or .docx for succinct CV text.')
      return ''
    }

    return condenseCvText(text, lang)
  } catch (e) {
    console.error('[portfolio-pdf] CV load failed:', e)
    return ''
  }
}

function condenseCvText(input: string, lang: Lang): string {
  const cleaned = htmlToPlain(input)
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(line => !/^(curriculum vitae|cv)$/i.test(line))

  const maxLines = lang === 'fr' ? 18 : 18
  const maxChars = 1400
  const lines: string[] = []
  let chars = 0
  for (const line of cleaned) {
    if (lines.length >= maxLines) break
    if (chars + line.length > maxChars) break
    lines.push(line)
    chars += line.length
  }
  return lines.join('\n')
}

// ── Image processing ───────────────────────────────────────────────────────

async function prefetchImages(works: PdfWork[]): Promise<{ imageMap: Map<number, Buffer>; imageAspectMap: Map<number, number> }> {
  const sharp = (await import('sharp')).default
  const imageMap = new Map<number, Buffer>()
  const imageAspectMap = new Map<number, number>()

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
        if (meta.width && meta.height) imageAspectMap.set(w.OeuvreID, meta.width / meta.height)
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

  return { imageMap, imageAspectMap }
}

// ── PDF builder ────────────────────────────────────────────────────────────

async function buildPortfolioPdf(
  cfg:      PdfPortfolioConfig,
  sections: PdfSection[],
  opts:     PdfRequestOptions,
  imageMap: Map<number, Buffer>,
  imageAspectMap: Map<number, number>,
  cvText:   string,
  statementSections: PdfSection[],
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

    const pageWorks  = sections.flatMap(s => s.works)
    const totalWorks = pageWorks.length

    // ── Title ────────────────────────────────────────────────────────────
    drawTitlePage(doc, PW, PH, cfg, opts.lang)

    // ── Optional collection statement(s) ─────────────────────────────────
    if (opts.includeCollectionText) {
      for (const sec of statementSections) {
        const body = sec.intro || sec.description
        if (!body) continue
        drawTextPage(doc, PW, PH, {
          eyebrow: opts.lang === 'fr' ? 'COLLECTION' : 'COLLECTION',
          title:   sec.title,
          body,
        })
      }
    }

    // ── Image sequence ───────────────────────────────────────────────────
    let workCounter = 0

    for (const sec of sections) {
      if (sec.works.length === 0) continue

      for (const w of sec.works) {
        workCounter++
        drawWorkPage(doc, PW, PH, cfg, w, workCounter, totalWorks, imageMap, imageAspectMap, opts.lang, opts.workLayouts?.[w.OeuvreID])
      }
    }

    // ── Approach page (config.practice.approach) ────────────────────────
    if (opts.includePractice && cfg.practice_intro) {
      drawTextPage(doc, PW, PH, {
        eyebrow: opts.lang === 'fr' ? 'DÉMARCHE' : 'PRACTICE',
        title:   opts.lang === 'fr' ? 'Approche' : 'Approach',
        body:    cfg.practice_intro,
      })
    }

    // ── Succinct CV page ─────────────────────────────────────────────────
    if (opts.includeCv !== false && cvText) {
      drawTextPage(doc, PW, PH, {
        eyebrow: opts.lang === 'fr' ? 'PARCOURS' : 'CV',
        title:   opts.lang === 'fr' ? 'CV succinct' : 'Selected CV',
        body:    cvText,
      })
    }

    // ── Contact + thanks ─────────────────────────────────────────────────
    if (opts.includeContact) {
      drawContactPage(doc, PW, PH, cfg, opts.lang)
    }

    doc.end()
  })
}

// ── Page helpers ───────────────────────────────────────────────────────────

function drawTitlePage(
  doc: any,
  PW: number,
  PH: number,
  cfg: PdfPortfolioConfig,
  lang: Lang,
) {
  doc.addPage()
  doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

  const name = cfg.artist_name || 'Artiste'
  const title = lang === 'fr' ? 'Portfolio' : 'Portfolio'
  const centerY = PH * 0.44

  doc.moveTo(PW / 2 - 42, centerY - 44).lineTo(PW / 2 + 42, centerY - 44)
    .lineWidth(0.75).strokeColor(GOLD).stroke()

  doc.fontSize(34).fillColor(DARK).font('Helvetica-Bold')
    .text(name, 60, centerY - 20, { width: PW - 120, align: 'center' })

  doc.fontSize(8).fillColor(GREY).font('Helvetica')
    .text(title.toUpperCase(), 60, doc.y + 12, { width: PW - 120, align: 'center', characterSpacing: 3 })

  if (cfg.media_tagline) {
    doc.fontSize(7).fillColor(GOLD).font('Helvetica')
      .text(cfg.media_tagline.toUpperCase(), 60, doc.y + 22, { width: PW - 120, align: 'center', characterSpacing: 2 })
  }

  doc.fontSize(7).fillColor('#c8c4be').font('Helvetica')
    .text(String(new Date().getFullYear()), 60, PH - 54, { width: PW - 120, align: 'center', characterSpacing: 1 })
}

function drawContactPage(
  doc: any,
  PW: number,
  PH: number,
  cfg: PdfPortfolioConfig,
  lang: Lang,
) {
  doc.addPage()
  doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

  doc.moveTo(60, 72).lineTo(100, 72).lineWidth(0.75).strokeColor(GOLD).stroke()

  doc.fontSize(8).fillColor(GOLD).font('Helvetica')
    .text(lang === 'fr' ? 'CONTACT' : 'ENQUIRY', 60, 82, { characterSpacing: 3 })

  doc.fontSize(22).fillColor(DARK).font('Helvetica-Bold')
    .text(cfg.artist_name || 'Artiste', 60, 120)

  doc.fontSize(12).fillColor(DARK).font('Helvetica')
    .text(lang === 'fr' ? 'Merci pour votre attention.' : 'Thank you for your attention.', 60, 164, {
      width: PW - 120,
      lineGap: 4,
    })

  let cy = 232
  if (cfg.contact_email) {
    doc.fontSize(10).fillColor(DARK).font('Helvetica').text(cfg.contact_email, 60, cy); cy += 24
  }
  if (cfg.instagram) {
    doc.fontSize(9).fillColor(GREY).font('Helvetica')
      .text(`@${cfg.instagram.replace(/^@/, '')}`, 60, cy, { characterSpacing: 0.3 }); cy += 20
  }
  if (cfg.phone) {
    doc.fontSize(9).fillColor(GREY).font('Helvetica').text(cfg.phone, 60, cy)
  }

  doc.fontSize(7).fillColor('#cccccc').font('Helvetica')
    .text(`© ${new Date().getFullYear()} ${cfg.artist_name}`, 60, PH - 48, { characterSpacing: 1 })
}

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

function workShape(w: PdfWork, imageAspect?: number): 'portrait' | 'landscape' | 'square' {
  const aspect = imageAspect ?? workAspect(w)
  if (aspect == null) return workIsPortrait(w) ? 'portrait' : 'landscape'
  if (Math.abs(aspect - 1) <= 0.04) return 'square'
  return aspect > 1 ? 'landscape' : 'portrait'
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
  imageAspectMap: Map<number, number>,
  lang:     Lang,
  layout?:  PdfWorkLayout,
) {
  const pagePortrait = PH >= PW
  const shape = workShape(w, imageAspectMap.get(w.OeuvreID))
  const artPortrait = shape === 'portrait'
  const forceLandscapeBleed = !pagePortrait && (shape === 'landscape' || shape === 'square')
  if (layout?.mode === 'bleed') {
    drawWorkFullBleed(doc, PW, PH, cfg, w, index, total, imageMap, lang, layout)
  } else if (layout?.mode === 'contain' && !forceLandscapeBleed) {
    drawWorkContained(doc, PW, PH, cfg, w, index, total, imageMap, lang)
  } else if (forceLandscapeBleed) {
    drawWorkFullBleed(doc, PW, PH, cfg, w, index, total, imageMap, lang, layout)
  } else if (pagePortrait && artPortrait) {
    drawWorkFullBleed(doc, PW, PH, cfg, w, index, total, imageMap, lang, layout)
  } else if (pagePortrait && !artPortrait) {
    drawWorkLandscapeOnPortrait(doc, PW, PH, cfg, w, index, total, imageMap, lang)
  } else {
    drawWorkContained(doc, PW, PH, cfg, w, index, total, imageMap, lang)
  }
}

/** Full bleed: portrait artwork fills A4 portrait page; metadata stays discreet. */
function drawWorkFullBleed(
  doc: any, PW: number, PH: number,
  cfg: PdfPortfolioConfig, w: PdfWork,
  index: number, total: number,
  imageMap: Map<number, Buffer>,
  lang: Lang,
  layout?: PdfWorkLayout,
) {
  doc.addPage()

  const img = imageMap.get(w.OeuvreID)
  if (img) {
    doc.image(img, 0, 0, {
      width: PW,
      height: PH,
      cover: [PW, PH],
      align: pdfKitAlign(layout?.x),
      valign: pdfKitValign(layout?.y),
    })
  } else {
    doc.rect(0, 0, PW, PH).fill('#2a2826')
  }

  drawWorkOverlayMeta(doc, PW, PH, w, index, total, lang)

  doc.fillOpacity(0.35)
  doc.fontSize(6).fillColor('#ffffff').font('Helvetica')
    .text((cfg.artist_name || '').toUpperCase(), 28, 28, { characterSpacing: 1.5, lineBreak: false })
  doc.fillOpacity(1)
}

/** A4 portrait + landscape artwork: image full page width, metadata below, no overlap. */
function drawWorkLandscapeOnPortrait(
  doc: any, PW: number, PH: number,
  cfg: PdfPortfolioConfig, w: PdfWork,
  index: number, total: number,
  imageMap: Map<number, Buffer>,
  lang: Lang,
) {
  doc.addPage()
  doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

  const aspect = workAspect(w) ?? 1.45
  const imgW = PW
  const imgH = Math.min(PH * 0.62, imgW / aspect)
  const imgY = Math.max(120, PH * 0.32 - imgH / 2)
  const img = imageMap.get(w.OeuvreID)
  if (img) {
    doc.image(img, 0, imgY, { width: imgW, height: imgH, cover: [imgW, imgH], align: 'center', valign: 'center' })
  } else {
    doc.rect(0, imgY, imgW, imgH).fill('#2a2826')
  }

  drawWorkMetaBlock(doc, PW, PH, imgY + imgH + 28, w, index, total, lang, 48, PW - 96, 'center')

  doc.fontSize(6).fillColor('#bbbbbb').font('Helvetica')
    .text((cfg.artist_name || '').toUpperCase(), 28, 28, { characterSpacing: 1.5, lineBreak: false })
}

function drawWorkContained(
  doc: any, PW: number, PH: number,
  cfg: PdfPortfolioConfig, w: PdfWork,
  index: number, total: number,
  imageMap: Map<number, Buffer>,
  lang: Lang,
) {
  doc.addPage()
  doc.rect(0, 0, PW, PH).fill(OFF_WHITE)

  const artPortrait = workIsPortrait(w)
  const imgAreaW  = artPortrait ? PW * 0.52 : PW * 0.62
  const img = imageMap.get(w.OeuvreID)
  if (img) {
    doc.image(img, 0, 0, {
      width: imgAreaW,
      height: PH,
      cover: [imgAreaW, PH],
      align:  'center',
      valign: 'center',
    })
  } else {
    doc.rect(0, 0, imgAreaW, PH).fill('#2a2826')
  }

  const textX = imgAreaW + 24
  const textW = PW - textX - 24
  const textY = PH / 2 - 28
  drawWorkMetaBlock(doc, PW, PH, textY, w, index, total, lang, textX, textW, 'center')

  doc.fontSize(6).fillColor('#bbbbbb').font('Helvetica')
    .text((cfg.artist_name || '').toUpperCase(), 28, 28, { characterSpacing: 1.5, lineBreak: false })
}

function workAspect(w: PdfWork): number | null {
  const parse = (s: string | null | undefined): number | null => {
    if (s == null || String(s).trim() === '') return null
    const n = parseFloat(String(s).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const H = parse(w.Hauteur)
  const W = parse(w.Largeur)
  if (!H || !W) return null
  return W / H
}

function pdfKitAlign(pos: PdfWorkLayout['x'] | undefined): 'left' | 'center' | 'right' {
  if (pos === 'start') return 'left'
  if (pos === 'end') return 'right'
  return 'center'
}

function pdfKitValign(pos: PdfWorkLayout['y'] | undefined): 'top' | 'center' | 'bottom' {
  if (pos === 'start') return 'top'
  if (pos === 'end') return 'bottom'
  return 'center'
}

function workMeta(w: PdfWork, lang: Lang): string {
  return [yearOf(w.Annee), translateTechnique(w.techniqueName, lang), dims(w)].filter(Boolean).join('  ·  ')
}

function drawWorkMetaBlock(
  doc: any,
  PW: number,
  PH: number,
  y: number,
  w: PdfWork,
  index: number,
  total: number,
  lang: Lang,
  x = 48,
  width = PW - 96,
  align: 'left' | 'center' = 'left',
) {
  const title = (w.Titre ?? '').trim()
  let metaY = y
  if (title) {
    doc.fontSize(20).fillColor(DARK).font(align === 'center' ? 'Times-Roman' : 'Helvetica-Bold')
      .text(title, x, y, { width, align, lineBreak: false, ellipsis: true })
    metaY = doc.y + 8
  }

  const meta = workMeta(w, lang)
  if (meta) {
    doc.fontSize(7).fillColor(GREY).font('Helvetica')
      .text(meta, x, metaY, { width, align, characterSpacing: 0.3, lineBreak: false, ellipsis: true })
  }

  if (total > 1) {
    doc.fontSize(6).fillColor('#bbbbbb').font('Helvetica')
      .text(`${index} / ${total}`, PW - 80, PH - 28, { width: 60, align: 'right', characterSpacing: 1 })
  }
}

function drawWorkOverlayMeta(
  doc: any,
  PW: number,
  PH: number,
  w: PdfWork,
  index: number,
  total: number,
  lang: Lang,
) {
  const bandH = 58
  const bandY = PH - bandH
  doc.fillOpacity(0.72).rect(0, bandY, PW, bandH).fill('#ffffff')
  doc.fillOpacity(1)

  doc.fontSize(11).fillColor(DARK).font('Helvetica-Bold')
    .text(w.Titre || '—', 36, bandY + 14, { width: PW - 120, lineBreak: false, ellipsis: true })

  const meta = workMeta(w, lang)
  if (meta) {
    doc.fontSize(6).fillColor(GREY).font('Helvetica')
      .text(meta, 36, bandY + 31, { width: PW - 120, characterSpacing: 0.2, lineBreak: false, ellipsis: true })
  }

  if (total > 1) {
    doc.fontSize(6).fillColor(GREY).font('Helvetica')
      .text(`${index} / ${total}`, PW - 80, PH - 20, { width: 60, align: 'right', characterSpacing: 1 })
  }
}
