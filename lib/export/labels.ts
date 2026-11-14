/**
 * Label sheets for the selection export (B3 / D2, owner 2026-11-14: "Labels" tab). Browser-safe:
 * the dialog lists the presets, the server draws the PDF / HTML from the same numbers.
 * Sizes are A4 sheets in millimetres (common Avery / L-series layouts).
 */

export type LabelPresetId = 'l7160' | 'l7163' | 'l7165' | 'l7651'

export type LabelPreset = {
  id: LabelPresetId
  /** Shown in the dialog. */
  name: string
  cols: number
  rows: number
  /** Label size, mm. */
  w: number
  h: number
  /** Sheet margins to the first label, mm. */
  top: number
  left: number
  /** Distance from one label's left / top edge to the next one's, mm. */
  pitchX: number
  pitchY: number
}

export const LABEL_PRESETS: readonly LabelPreset[] = [
  { id: 'l7160', name: 'A4 · 3 × 7 · 63,5 × 38,1 mm (L7160)', cols: 3, rows: 7, w: 63.5, h: 38.1, top: 15.15, left: 7.21, pitchX: 66.04, pitchY: 38.1 },
  { id: 'l7163', name: 'A4 · 2 × 7 · 99,1 × 38,1 mm (L7163)', cols: 2, rows: 7, w: 99.1, h: 38.1, top: 15.15, left: 4.65, pitchX: 101.6, pitchY: 38.1 },
  { id: 'l7165', name: 'A4 · 2 × 4 · 99,1 × 67,7 mm (L7165)', cols: 2, rows: 4, w: 99.1, h: 67.7, top: 13.1, left: 4.65, pitchX: 101.6, pitchY: 67.7 },
  { id: 'l7651', name: 'A4 · 5 × 13 · 38,1 × 21,2 mm (L7651)', cols: 5, rows: 13, w: 38.1, h: 21.2, top: 10.7, left: 4.75, pitchX: 40.64, pitchY: 21.2 },
]

export const DEFAULT_LABEL_PRESET: LabelPresetId = 'l7160'

export function labelPreset(id: LabelPresetId | null | undefined): LabelPreset {
  return LABEL_PRESETS.find((p) => p.id === id) ?? LABEL_PRESETS[0]
}

export function labelsPerSheet(p: LabelPreset): number {
  return p.cols * p.rows
}

/** Clamp the 1-based start position (skip used labels on a partly used sheet). */
export function clampLabelStart(start: number | null | undefined, p: LabelPreset): number {
  const n = Math.floor(Number(start) || 1)
  return Math.min(Math.max(n, 1), labelsPerSheet(p))
}

/** Slot n (0-based, start offset included) → sheet index + top-left corner in mm. */
export function labelSlot(n: number, p: LabelPreset): { sheet: number; x: number; y: number } {
  const per = labelsPerSheet(p)
  const sheet = Math.floor(n / per)
  const i = n % per
  const col = i % p.cols
  const row = Math.floor(i / p.cols)
  return { sheet, x: p.left + col * p.pitchX, y: p.top + row * p.pitchY }
}

export type LabelText = { title: string; lines: string[]; ref: string | null }

type LabelWork = {
  OeuvreID: number
  Titre?: string | null
  Année?: string | null
  Technique?: number | null
  Support?: number | null
  Hauteur?: string | number | null
  Largeur?: string | number | null
  Profondeur?: string | number | null
  Prix?: number | null
  PrixFinal?: number | null
}

type LabelFields = { title: boolean; id: boolean; year: boolean; technique: boolean; support: boolean; dims: boolean; price: boolean }

/** What one label says, from the export's field ticks (image / status / notes do not apply). */
export function labelText(
  o: LabelWork,
  f: LabelFields,
  tM: Record<number, string>,
  sM: Record<number, string>,
  untitled: string,
): LabelText {
  const year = f.year && o.Année ? o.Année.slice(0, 4) : ''
  const medium = [f.technique && o.Technique != null ? tM[o.Technique] : '', f.support && o.Support != null ? sM[o.Support] : '']
    .filter(Boolean)
    .join(' · ')
  const dims = f.dims && o.Hauteur && o.Largeur ? `${o.Hauteur} × ${o.Largeur}${o.Profondeur ? ` × ${o.Profondeur}` : ''} cm` : ''
  const price = f.price && (o.PrixFinal ?? o.Prix) ? `${Math.round(Number(o.PrixFinal ?? o.Prix)).toLocaleString('fr-FR')} €` : ''
  return {
    title: f.title ? (o.Titre?.trim() || untitled) : '',
    lines: [[year, medium].filter(Boolean).join(', '), dims, price].filter(Boolean),
    ref: f.id ? `#${o.OeuvreID}` : null,
  }
}
