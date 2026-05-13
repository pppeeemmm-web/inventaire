/**
 * Shared column definitions + filtering for Atelier Reports tab and PDF export.
 */
import type { DictKey } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import { formatInventoryDims, statusOf, type StatusKey, yearOf } from '@/lib/data'

/** Serverless-friendly cap for pdfkit table export */
export const REPORT_PDF_MAX_ROWS = 1200

export type ReportColumnId =
  | 'id'
  | 'title'
  | 'year'
  | 'technique'
  | 'support'
  | 'format'
  | 'dimensions'
  | 'price'
  | 'status'
  | 'contact'
  | 'buyer'
  | 'location'
  | 'themes'
  | 'groups'
  | 'catalogued'
  | 'exposable'
  | 'notes'

export const REPORT_COLUMN_ORDER: ReportColumnId[] = [
  'id',
  'title',
  'year',
  'technique',
  'support',
  'format',
  'dimensions',
  'price',
  'status',
  'contact',
  'buyer',
  'location',
  'themes',
  'groups',
  'catalogued',
  'exposable',
  'notes',
]

export const REPORT_COLUMN_HEADER_KEY: Record<ReportColumnId, DictKey> = {
  id: 'report_col_id',
  title: 'report_col_title',
  year: 'report_col_year',
  technique: 'report_col_technique',
  support: 'report_col_support',
  format: 'report_col_format',
  dimensions: 'report_col_dimensions',
  price: 'report_col_price',
  status: 'report_col_status',
  contact: 'report_col_contact',
  buyer: 'report_col_buyer',
  location: 'report_col_location',
  themes: 'report_col_themes',
  groups: 'report_col_groups',
  catalogued: 'report_col_catalogued',
  exposable: 'report_col_exposable',
  notes: 'report_col_notes',
}

export const DEFAULT_VISIBLE_REPORT_COLUMNS: ReportColumnId[] = [
  'id',
  'title',
  'year',
  'technique',
  'support',
  'dimensions',
  'price',
  'status',
  'themes',
]

export function parseIdRanges(input: string): Set<number> {
  const ids = new Set<number>()
  const parts = input.split(/[,\s\n]+/)
  parts.forEach((p) => {
    const clean = p.trim().replace(/^#/, '')
    if (!clean) return
    const range = clean.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const a = parseInt(range[1], 10)
      const b = parseInt(range[2], 10)
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) ids.add(i)
    } else if (/^\d+$/.test(clean)) {
      ids.add(parseInt(clean, 10))
    }
  })
  return ids
}

export function looksLikeIdOnlyQuery(s: string): boolean {
  return /[\d]/.test(s) && /^[\d\s,\n\-–#]+$/.test(s)
}

export type ReportMaps = {
  tM: Record<number, string>
  sM: Record<number, string>
  fM: Record<number, string>
  cM: Record<number, string>
  pM: Record<number, string>
  locMap: Record<number, string>
  statusLabelMap: Record<number, string>
  thM: Record<number, string>
  groupNameMap: Record<string, string>
  oeuvreThemeMap: Map<number, number[]>
  oeuvreGroupMap: Map<number, string[]>
}

export type ReportFilterState = {
  q: string
  tech: string
  support: string
  /** `statusOf` key or `all` */
  status: StatusKey | 'all'
  filterTheme: string
  filterGroup: string
  selectionOnly: boolean
  selection: Set<number>
}

export function filterWorksForReport(
  oeuvres: Oeuvre[],
  maps: ReportMaps,
  f: ReportFilterState,
): Oeuvre[] {
  const trimmedQ = f.q.trim()
  const sq = trimmedQ.toLowerCase()

  let idSet: Set<number> | null = null
  if (trimmedQ.startsWith('#') && trimmedQ.length > 1) {
    idSet = parseIdRanges(trimmedQ)
  } else if (looksLikeIdOnlyQuery(trimmedQ)) {
    const parsed = parseIdRanges(trimmedQ)
    if (parsed.size > 0) idSet = parsed
  }

  return oeuvres.filter((o) => {
    if (idSet) {
      if (!idSet.has(o.OeuvreID)) return false
    } else if (sq) {
      const themeNames = (maps.oeuvreThemeMap.get(o.OeuvreID) ?? [])
        .map((tid) => maps.thM[tid] ?? '')
        .join(' ')
      const groupNames = (maps.oeuvreGroupMap.get(o.OeuvreID) ?? [])
        .map((gid) => maps.groupNameMap[gid] ?? '')
        .join(' ')
      const bag =
        `${o.Titre ?? ''} #${o.OeuvreID} ${o.Technique != null ? maps.tM[o.Technique] ?? '' : ''} ${o.Support != null ? maps.sM[o.Support] ?? '' : ''} ${themeNames} ${groupNames}`.toLowerCase()
      if (!bag.includes(sq)) return false
    }

    if (f.tech !== 'all' && String(o.Technique ?? '') !== f.tech) return false
    if (f.support !== 'all' && String(o.Support ?? '') !== f.support) return false
    if (f.status !== 'all' && statusOf(o, maps.statusLabelMap) !== f.status) return false

    if (f.filterTheme !== 'all') {
      const tids = maps.oeuvreThemeMap.get(o.OeuvreID) ?? []
      if (!tids.includes(Number(f.filterTheme))) return false
    }
    if (f.filterGroup !== 'all') {
      const gids = maps.oeuvreGroupMap.get(o.OeuvreID) ?? []
      if (!gids.includes(f.filterGroup)) return false
    }

    if (f.selectionOnly && f.selection.size > 0 && !f.selection.has(o.OeuvreID)) return false

    return true
  })
}

export function sortWorksForReport(
  rows: Oeuvre[],
  sortKey: 'OeuvreID' | 'Titre' | 'year' | 'PrixFinal',
  dir: 'asc' | 'desc',
): Oeuvre[] {
  const m = dir === 'asc' ? 1 : -1
  const out = [...rows]
  out.sort((a, b) => {
    let va: string | number = 0
    let vb: string | number = 0
    if (sortKey === 'OeuvreID') {
      va = a.OeuvreID
      vb = b.OeuvreID
    } else if (sortKey === 'Titre') {
      va = (a.Titre ?? '').toLowerCase()
      vb = (b.Titre ?? '').toLowerCase()
    } else if (sortKey === 'year') {
      va = yearOf(a.Année) ?? 0
      vb = yearOf(b.Année) ?? 0
    } else {
      va = Number(a.PrixFinal ?? a.Prix ?? 0)
      vb = Number(b.PrixFinal ?? b.Prix ?? 0)
    }
    if (va < vb) return -1 * m
    if (va > vb) return 1 * m
    return (a.OeuvreID - b.OeuvreID) * m
  })
  return out
}

function fmtPrice(n: number | null | undefined, locale: string): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    Number(n),
  )
}

function locationLine(
  o: Oeuvre,
  cM: Record<number, string>,
  locMap: Record<number, string>,
): string {
  const locId = o.LocalisationID
  const contact = locId != null ? cM[locId] ?? '' : ''
  const geo = locId != null ? locMap[locId] ?? '' : ''
  const detail = (o.LocalisationDetail ?? '').trim()
  const parts = [contact, geo, detail].filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

/** One cell as plain string for HTML / XLSX / PDF */
export function formatReportCell(o: Oeuvre, col: ReportColumnId, maps: ReportMaps, locale: string): string {
  const supLabel = o.Support != null ? maps.sM[o.Support] ?? '' : ''
  switch (col) {
    case 'id':
      return String(o.OeuvreID)
    case 'title':
      return (o.Titre ?? '').trim() || '—'
    case 'year':
      return yearOf(o.Année) != null ? String(yearOf(o.Année)) : '—'
    case 'technique':
      return o.Technique != null ? maps.tM[o.Technique] ?? '—' : '—'
    case 'support':
      return o.Support != null ? maps.sM[o.Support] ?? '—' : '—'
    case 'format':
      return o.Format != null ? maps.fM[o.Format] ?? '—' : '—'
    case 'dimensions':
      return formatInventoryDims(o.Hauteur, o.Largeur, supLabel || null, o.Profondeur) || '—'
    case 'price': {
      const p = o.PrixFinal ?? o.Prix
      return fmtPrice(p, locale)
    }
    case 'status': {
      const sid = o.statusId
      return sid != null ? maps.statusLabelMap[sid] ?? '—' : '—'
    }
    case 'contact':
      return o.ContactID != null ? maps.cM[o.ContactID] ?? '—' : '—'
    case 'buyer':
      return o.AcheteurID != null ? maps.cM[o.AcheteurID] ?? '—' : '—'
    case 'location':
      return locationLine(o, maps.cM, maps.locMap)
    case 'themes': {
      const names = (maps.oeuvreThemeMap.get(o.OeuvreID) ?? []).map((tid) => maps.thM[tid] ?? '').filter(Boolean)
      return names.length ? names.join(', ') : '—'
    }
    case 'groups': {
      const names = (maps.oeuvreGroupMap.get(o.OeuvreID) ?? []).map((gid) => maps.groupNameMap[gid] ?? '').filter(Boolean)
      return names.length ? names.join(', ') : '—'
    }
    case 'catalogued':
      return o.Catalogué ? '✓' : '—'
    case 'exposable':
      return o.Exposable ? '✓' : '—'
    case 'notes':
      return (o.Commentaires ?? '').replace(/\s+/g, ' ').trim().slice(0, 500) || '—'
    default:
      return '—'
  }
}

export function buildReportRows(
  works: Oeuvre[],
  columns: ReportColumnId[],
  maps: ReportMaps,
  locale: string,
): string[][] {
  return works.map((o) => columns.map((c) => formatReportCell(o, c, maps, locale)))
}
