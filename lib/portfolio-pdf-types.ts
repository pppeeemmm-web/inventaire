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

/**
 * Self-contained request from the client to the server action.
 * Server action loads atelier config + works internally — no client data prep.
 */
export interface PdfRequestOptions {
  preset:           PdfPreset
  format:           PdfFormat
  lang:             Lang
  includeCover:     boolean
  includeAbout:     boolean      // about/intro page (config.about.intro)
  includePractice:  boolean      // practice/approach page (config.practice.approach)
  includeContact:   boolean      // contact / enquiry page
  /** Optional cap on works (after section ordering). null = MAX_WORKS. */
  maxWorks:         number | null
  /** Optional: limit to a single section (atelier section id). null = all sections. */
  collectionFilter: string | null
}

export const PRESET_DEFAULTS: Record<Exclude<PdfPreset, 'custom'>, Omit<PdfRequestOptions, 'lang' | 'collectionFilter' | 'format'>> = {
  galerie: {
    preset: 'galerie',
    includeCover: true, includeAbout: true, includePractice: true, includeContact: true,
    maxWorks: null,
  },
  collectionneur: {
    preset: 'collectionneur',
    includeCover: true, includeAbout: true, includePractice: false, includeContact: true,
    maxWorks: 8,
  },
  presse: {
    preset: 'presse',
    includeCover: true, includeAbout: false, includePractice: false, includeContact: true,
    maxWorks: 3,
  },
}

// ── Internal data shapes (server-side only, but kept here for type sharing) ──

/** A single artwork as consumed by the PDF builder. */
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

/** Resolved section block with works ordered as the atelier configured them. */
export interface PdfSection {
  id:           string
  title:        string
  description:  string  // plain text (HTML stripped)
  intro:        string  // plain text
  outro:        string  // plain text (rare — modes only)
  works:        PdfWork[]
}

export interface PdfPortfolioConfig {
  artist_name:      string
  contact_email:    string
  instagram:        string
  phone:            string
  media_tagline:    string  // already lang-resolved
  about_intro:      string  // already lang-resolved
  practice_intro:   string  // already lang-resolved (practice.approach)
}

export type PortfolioPdfResult =
  | { ok: true; base64: string; filename: string; warned: boolean; warningMsg?: string }
  | { error: string }
