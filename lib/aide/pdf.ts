import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import type { Lang } from '@/lib/i18n/dictionary'
import { resolveMessage } from '@/lib/i18n/resolve-message'
import { aidePdfMessages } from '@/lib/i18n/messages/aide-pdf.messages'
import { parseAideBlocks, parseAideInline } from './markdown'
import type { AideChapter, AideGuideId } from './types'

/**
 * The downloadable guide (Pem GO 2026-11-18): one PDF per guide and language, built on demand from the same
 * chapters as the in-app Aide (`lib/aide/*`) and read with the same parser (`markdown.ts`) — so the site and
 * the PDF never disagree, and no stored copy can go stale. Cover, contents with page numbers (clickable),
 * a page per chapter start, running header (guide · chapter) and page numbers.
 *
 * Fonts (SIL Open Font License, files + licences in `lib/aide/pdf/fonts/`): Sofia Sans (body) and Instrument Serif
 * (titles) — the site's two faces — plus Noto Sans Symbols 2 as a per-character fallback (⌘ ☰ ✓ …). A character
 * no font has prints as « ? ». Sofia Sans is one variable file: pdfkit/fontkit subsets a NAMED instance with
 * broken glyphs (accented / composite letters drop out — tested 2026-11-18), so only its default instance
 * (Regular) is embedded and semibold / bold are drawn as Regular + a thin outline in the same ink.
 */

type FontName = 'body' | 'bodySemi' | 'bodyBold' | 'serif' | 'sym'
/** Embedded faces; bodySemi / bodyBold draw with `body` + an outline (see above). */
type FaceName = 'body' | 'serif' | 'sym'
const FACE: Record<FontName, FaceName> = { body: 'body', bodySemi: 'body', bodyBold: 'body', serif: 'serif', sym: 'sym' }
const OUTLINE: Record<FontName, number> = { body: 0, bodySemi: 0.022, bodyBold: 0.04, serif: 0, sym: 0 }
type GlyphFont = { hasGlyphForCodePoint(cp: number): boolean }

const FONT_DIR = path.join(process.cwd(), 'lib', 'aide', 'pdf', 'fonts')
let fontFiles: { sofia: Buffer; serif: Buffer; sym: Buffer } | null = null
function fonts() {
  fontFiles ??= {
    sofia: fs.readFileSync(path.join(FONT_DIR, 'SofiaSans-Variable.ttf')),
    serif: fs.readFileSync(path.join(FONT_DIR, 'InstrumentSerif-Regular.ttf')),
    sym: fs.readFileSync(path.join(FONT_DIR, 'NotoSansSymbols2-Regular.ttf')),
  }
  return fontFiles
}

/** Characters no font carries, replaced by a near equivalent. */
const SUBSTITUTE: Record<string, string> = { '📅': '🗓', '⋮': '···' }

const INK = '#1c1b19'
const TEXT = '#34322e'
const GREY = '#8a857c'
const GOLD = '#9a7420'
const RULE = '#d9d3c7'
const PAPER = '#f4f1eb'

const A4 = { w: 595.28, h: 841.89 }
const M = { top: 82, bottom: 72, left: 68, right: 68 }
const TOC_PER_PAGE = 22

type Options = { guide: AideGuideId; lang: Lang; chapters: AideChapter[]; siteOrigin: string; today: string }

export function aideGuideFileName(guide: AideGuideId, lang: Lang, today: string): string {
  return `PEM_${guide === 'admin' ? 'Guide_admin' : lang === 'fr' ? 'Guide_equipe' : 'Team_guide'}_${lang.toUpperCase()}_${today}.pdf`
}

export async function buildAideGuidePdf(opts: Options): Promise<Buffer> {
  const tocPages = Math.max(1, Math.ceil(opts.chapters.length / TOC_PER_PAGE))
  // Pass 1 finds the page each chapter starts on; pass 2 writes the contents with those numbers.
  const first = await render(opts, tocPages, null)
  const second = await render(opts, tocPages, first.starts)
  return second.buffer
}

async function render(opts: Options, tocPages: number, knownStarts: number[] | null) {
  const { guide, lang, chapters, siteOrigin, today } = opts
  const t = (key: Parameters<typeof resolveMessage>[1]) => resolveMessage(lang, key)
  const tp = (key: keyof typeof aidePdfMessages) => aidePdfMessages[key][lang]
  const guideTitle = t(guide === 'admin' ? 'aide_guide_admin' : 'aide_guide_team')

  const doc = new PDFDocument({
    size: 'A4',
    margins: M,
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: `${guideTitle} — PEM Studio`, Author: 'PEM Studio', Subject: guideTitle },
  })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<void>((resolve) => doc.on('end', () => resolve()))

  const f = fonts()
  doc.registerFont('body', f.sofia)
  doc.registerFont('serif', f.serif)
  doc.registerFont('sym', f.sym)
  const faceGlyphs = {} as Record<FaceName, GlyphFont>
  for (const name of ['body', 'serif', 'sym'] as FaceName[]) {
    doc.font(name)
    faceGlyphs[name] = (doc as unknown as { _font: { font: GlyphFont } })._font.font
  }
  const glyphs = Object.fromEntries(
    (Object.keys(FACE) as FontName[]).map((n) => [n, faceGlyphs[FACE[n]]]),
  ) as Record<FontName, GlyphFont>
  /** Set face, size-relative outline (faux semibold / bold) and ink; returns the text options to pass. */
  const paintFont = (name: FontName, size: number, color: string) => {
    doc.font(FACE[name]).fontSize(size).fillColor(color)
    const w = OUTLINE[name] * size
    if (w > 0) doc.lineWidth(w).strokeColor(color)
    return w > 0 ? { stroke: true, fill: true } : { stroke: false, fill: true }
  }

  // Which chapter each page belongs to (running header); '' for cover and contents.
  const pageChapter: string[] = []
  let currentChapter = ''
  doc.on('pageAdded', () => pageChapter.push(currentChapter))

  const width = A4.w - M.left - M.right
  const bottomLimit = () => doc.page.height - M.bottom
  const ensureSpace = (h: number) => {
    if (doc.y + h > bottomLimit()) doc.addPage()
  }

  /** Split text into runs, each in a font that has its glyphs: base → body → symbols → « ? ». */
  const runs = (text: string, base: FontName): { font: FontName; text: string }[] => {
    const out: { font: FontName; text: string }[] = []
    for (const raw of text) {
      const ch = SUBSTITUTE[raw] ?? raw
      for (const c of ch) {
        const cp = c.codePointAt(0)!
        const font: FontName = glyphs[base].hasGlyphForCodePoint(cp)
          ? base
          : glyphs.body.hasGlyphForCodePoint(cp)
            ? 'body'
            : glyphs.sym.hasGlyphForCodePoint(cp)
              ? 'sym'
              : base
        const shown = font === base && !glyphs[base].hasGlyphForCodePoint(cp) && cp > 32 ? '?' : c
        const last = out[out.length - 1]
        if (last && last.font === font) last.text += shown
        else out.push({ font, text: shown })
      }
    }
    return out
  }

  /** One wrapped paragraph of inline markdown at (x, current y). */
  const rich = (
    text: string,
    o: { x: number; width: number; size: number; color: string; base?: FontName; bold?: FontName; lineGap?: number; align?: 'left' | 'center' },
  ) => {
    const base = o.base ?? 'body'
    const parts: { font: FontName; text: string; link?: string; color: string }[] = []
    for (const seg of parseAideInline(text)) {
      const segBase: FontName = seg.kind === 'bold' ? (o.bold ?? 'bodySemi') : base
      const link = seg.kind === 'link' ? `${siteOrigin}${seg.href}` : undefined
      for (const r of runs(seg.text, segBase)) parts.push({ ...r, link, color: link ? GOLD : seg.kind === 'bold' ? INK : o.color })
    }
    if (parts.length === 0) return
    parts.forEach((p, i) => {
      const paint = paintFont(p.font, o.size, p.color)
      const common = { ...paint, continued: i < parts.length - 1, link: p.link ?? null, underline: false, lineGap: o.lineGap ?? 3.2, align: o.align ?? 'left' }
      if (i === 0) doc.text(p.text, o.x, doc.y, { ...common, width: o.width })
      else doc.text(p.text, common)
    })
  }

  // ── Cover ────────────────────────────────────────────────────────────────
  doc.addPage({ margins: { top: 0, bottom: 0, left: 0, right: 0 } })
  doc.rect(0, 0, A4.w, A4.h).fill(PAPER)
  doc.rect(M.left, 300, 42, 2).fill(GOLD)
  doc.text(tp('aide_pdf_cover_kicker').toUpperCase(), M.left, 270, { ...paintFont('bodySemi', 9, GOLD), characterSpacing: 1.6, width })
  doc.font('serif').fontSize(46).fillColor(INK).text(guideTitle, M.left, 320, { width })
  doc.font('body').fontSize(13).fillColor(TEXT).text(lang === 'fr' ? 'Français' : 'English', M.left, doc.y + 6, { width })
  doc.moveDown(2.2)
  rich(tp('aide_pdf_cover_note').replace('{d}', today), { x: M.left, width: width - 60, size: 10.5, color: TEXT })
  if (guide === 'admin') {
    doc.moveDown(0.8)
    rich(tp('aide_pdf_admin_note'), { x: M.left, width: width - 60, size: 10.5, color: TEXT, base: 'bodySemi' })
  }
  doc.font('body').fontSize(9).fillColor(GREY).text('thepemworkshop.com', M.left, A4.h - 70, { width })

  // ── Contents ─────────────────────────────────────────────────────────────
  for (let p = 0; p < tocPages; p++) {
    doc.addPage()
    if (p === 0) {
      doc.font('serif').fontSize(28).fillColor(INK).text(t('aide_contents'), M.left, M.top, { width })
      doc.moveDown(0.8)
    }
    const slice = chapters.slice(p * TOC_PER_PAGE, (p + 1) * TOC_PER_PAGE)
    slice.forEach((ch, j) => {
      const n = p * TOC_PER_PAGE + j
      const y = doc.y
      const page = knownStarts ? String(knownStarts[n] + 1) : ''
      doc.font('body').fontSize(11).fillColor(GREY).text(String(n + 1).padStart(2, ' '), M.left, y, { width: 24 })
      doc.font('body').fontSize(11.5).fillColor(INK).text(ch.title, M.left + 28, y, { width: width - 80, goTo: `ch-${ch.id}`, lineBreak: false })
      doc.font('body').fontSize(11).fillColor(GREY).text(page, M.left, y, { width, align: 'right', goTo: `ch-${ch.id}` })
      doc.moveTo(M.left + 28, y + 17).lineTo(M.left + width, y + 17).lineWidth(0.4).strokeColor(RULE).stroke()
      doc.y = y + 24
    })
  }

  // ── Chapters ─────────────────────────────────────────────────────────────
  const starts: number[] = []
  chapters.forEach((ch, i) => {
    currentChapter = ch.title
    doc.addPage()
    starts.push(doc.bufferedPageRange().count - 1)
    doc.text(tp('aide_pdf_chapter').replace('{n}', String(i + 1)).toUpperCase(), M.left, M.top, {
        ...paintFont('bodySemi', 9, GOLD),
        characterSpacing: 1.4,
        width,
        destination: `ch-${ch.id}`, // the contents' goTo target
      } as PDFKit.Mixins.TextOptions)
    doc.moveDown(0.3)
    rich(ch.title, { x: M.left, width, size: 30, color: INK, base: 'serif', lineGap: 2 })
    doc.moveDown(0.25)
    doc.font('body').fontSize(9).fillColor(GREY).text(t('aide_verified').replace('{d}', ch.verified), M.left, doc.y, { width })
    doc.moveDown(0.6)
    doc.moveTo(M.left, doc.y).lineTo(M.left + 42, doc.y).lineWidth(1.2).strokeColor(GOLD).stroke()
    doc.moveDown(1)

    for (const b of parseAideBlocks(ch.md)) {
      switch (b.kind) {
        case 'h2':
          ensureSpace(70)
          doc.moveDown(0.7)
          rich(b.text, { x: M.left, width, size: 17, color: INK, base: 'serif', bold: 'serif', lineGap: 2 })
          doc.moveDown(0.35)
          break
        case 'h3':
          ensureSpace(50)
          doc.moveDown(0.45)
          rich(b.text, { x: M.left, width, size: 11.5, color: INK, base: 'bodyBold', bold: 'bodyBold' })
          doc.moveDown(0.2)
          break
        case 'quote': {
          ensureSpace(40)
          doc.moveDown(0.3)
          const y0 = doc.y
          const page0 = doc.bufferedPageRange().count
          rich(b.text, { x: M.left + 16, width: width - 16, size: 12.5, color: INK, base: 'serif', bold: 'serif' })
          if (doc.bufferedPageRange().count === page0) {
            doc.moveTo(M.left + 2, y0 + 1).lineTo(M.left + 2, doc.y - 2).lineWidth(1.4).strokeColor(GOLD).stroke()
          }
          doc.moveDown(0.5)
          break
        }
        case 'ul':
        case 'ol':
          doc.moveDown(0.15)
          b.items.forEach((item, j) => {
            ensureSpace(30)
            const y = doc.y
            const mark = b.kind === 'ol' ? `${j + 1}.` : '•'
            doc.font('body').fontSize(10.5).fillColor(b.kind === 'ol' ? GOLD : GREY).text(mark, M.left + 4, y, { width: 18 })
            doc.y = y
            rich(item, { x: M.left + 22, width: width - 22, size: 10.5, color: TEXT })
            doc.moveDown(0.25)
          })
          doc.moveDown(0.3)
          break
        default:
          ensureSpace(28)
          rich(b.text, { x: M.left, width, size: 10.5, color: TEXT })
          doc.moveDown(0.55)
      }
    }
  })

  // ── Running header + page numbers (every page but the cover) ─────────────
  const range = doc.bufferedPageRange()
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(i)
    const saved = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc.font('body').fontSize(8).fillColor(GREY)
    doc.text(`${guideTitle} · PEM Studio`, M.left, 40, { width: width / 2, lineBreak: false })
    if (pageChapter[i]) {
      const head = runs(pageChapter[i], 'body').map((r) => r.text).join('')
      doc.text(head, M.left + width / 2, 40, { width: width / 2, align: 'right', lineBreak: false })
    }
    doc.moveTo(M.left, 54).lineTo(M.left + width, 54).lineWidth(0.4).strokeColor(RULE).stroke()
    doc.font('body').fontSize(8).fillColor(GREY)
      .text(tp('aide_pdf_page').replace('{n}', String(i + 1)).replace('{t}', String(range.count)), M.left, A4.h - 44, { width, align: 'right', lineBreak: false })
    doc.page.margins.bottom = saved
  }

  doc.end()
  await done
  return { buffer: Buffer.concat(chunks), starts: knownStarts ?? starts }
}
