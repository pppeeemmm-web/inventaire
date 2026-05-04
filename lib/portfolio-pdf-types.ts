// Shared types and constants for portfolio PDF export.
// Importable from both client and server without 'use server' restriction.

import type { Lang } from '@/lib/i18n/dictionary'

export const MAX_WORKS = 16

// ── Format definitions ─────────────────────────────────────────────────────

export type PdfFormat = 'a4p' | 'a4l' | 'usl' | 'a3l'

export const FORMATS: Record<PdfFormat, {
  label:  string
  size:   [number, number]
  pdfkit: string
  layout: 'portrait' | 'landscape'
}> = {
  a4p: { label: 'A4 Portrait', size: [595.28, 841.89], pdfkit: 'A4',     layout: 'portrait'  },
  a4l: { label: 'A4 Paysage',  size: [841.89, 595.28], pdfkit: 'A4',     layout: 'landscape' },
  usl: { label: 'US Letter',   size: [612,    792   ], pdfkit: 'LETTER', layout: 'portrait'  },
  a3l: { label: 'A3 Paysage',  size: [1190.55, 841.89], pdfkit: 'A3',   layout: 'landscape' },
}

// ── Preset definitions ─────────────────────────────────────────────────────

export type PdfPreset = 'galerie' | 'collectionneur' | 'presse' | 'custom'

export interface PresetConfig {
  preset:           PdfPreset
  format:           PdfFormat
  lang:             Lang
  includeCover:     boolean
  includeApproach:  boolean
  includeEnquiry:   boolean
  maxWorks:         number | null
  collectionFilter: string | null
}

export const PRESET_DEFAULTS: Record<Exclude<PdfPreset, 'custom'>, Omit<PresetConfig, 'lang' | 'collectionFilter'>> = {
  galerie: {
    preset: 'galerie', format: 'a4p',
    includeCover: true, includeApproach: true, includeEnquiry: true,
    maxWorks: null,
  },
  collectionneur: {
    preset: 'collectionneur', format: 'a4p',
    includeCover: true, includeApproach: false, includeEnquiry: true,
    maxWorks: 8,
  },
  presse: {
    preset: 'presse', format: 'a4p',
    includeCover: true, includeApproach: false, includeEnquiry: false,
    maxWorks: 3,
  },
}

// ── Data types ─────────────────────────────────────────────────────────────

export interface PdfWork {
  OeuvreID:         number
  Titre:            string | null
  Annee:            string | null
  Hauteur:          string | null
  Largeur:          string | null
  Profondeur:       string | null
  txtImageNameLink: string | null
  techniqueName:    string | null
  themes:           string[]
  statutId:         number | null
}

export interface PdfPortfolioConfig {
  artist_name:      string
  contact_email:    string
  instagram:        string
  phone:            string
  media_tagline_fr: string
  media_tagline_en: string
  intro_fr:         string
  intro_en:         string
}

export type PortfolioPdfResult =
  | { ok: true; base64: string; filename: string; warned: boolean; warningMsg?: string }
  | { error: string }
