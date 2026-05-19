// Shared types and constants for portfolio PDF export.
// Importable from both client and server without 'use server' restriction.

import type { Lang } from '@/lib/i18n/dictionary'

export const MAX_WORKS = 16

// ── Format definitions ─────────────────────────────────────────────────────

export type PdfFormat = 'a4p' | 'a4l'

export const FORMATS: Record<PdfFormat, {
  label:  string
  size:   [number, number]
  pdfkit: string
  layout: 'portrait' | 'landscape'
}> = {
  a4p: { label: 'A4 Portrait', size: [595.28, 841.89], pdfkit: 'A4',     layout: 'portrait'  },
  a4l: { label: 'A4 Paysage',  size: [841.89, 595.28], pdfkit: 'A4',     layout: 'landscape' },
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
  includeCollectionText?: boolean // selected collection intro/description page(s)
  includePractice:  boolean      // practice/approach page (config.practice.approach)
  includeCv?:       boolean      // succinct CV page sourced from configured CV document
  includeContact:   boolean      // contact / enquiry page
  /** Optional cap on works (after section ordering). null = MAX_WORKS. */
  maxWorks:         number | null
  /** Optional: limit to a single section (atelier section id). null = all sections. */
  collectionFilter: string | null
  /** Optional explicit export order from the PDF drawer. */
  workSequence?:    number[]
  /** Optional per-work image layout overrides from the PDF drawer. */
  workLayouts?:     Record<number, PdfWorkLayout>
  /** Optional lang-resolved collection statement text from the live editor. */
  collectionStatements?: PdfCollectionStatement[]
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

export type PdfPurpose = Exclude<PdfPreset, 'custom'>

export interface PdfProfileSettings {
  collectionFilter: string | null
  workSequence: number[]
  workLayouts: Record<number, PdfWorkLayout>
  includeCollectionText: boolean
  includePractice: boolean
  includeCv: boolean
  includeContact: boolean
  maxWorks: number | null
}

export type PdfProfileMatrix = Partial<Record<PdfPurpose, Partial<Record<PdfFormat, PdfProfileSettings>>>>

export function profileFromOptions(opts: PdfRequestOptions): PdfProfileSettings {
  return {
    collectionFilter: opts.collectionFilter,
    workSequence: opts.workSequence ?? [],
    workLayouts: opts.workLayouts ?? {},
    includeCollectionText: opts.includeCollectionText ?? false,
    includePractice: opts.includePractice,
    includeCv: opts.includeCv !== false,
    includeContact: opts.includeContact,
    maxWorks: opts.maxWorks,
  }
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

/** Lightweight public work row for the PDF export sequence picker. */
export interface PdfWorkCandidate {
  OeuvreID:         number
  Titre:            string | null
  Annee:            string | null
  Hauteur:          string | null
  Largeur:          string | null
  txtImageNameLink: string | null
}

export interface PdfCollectionCandidate {
  id: string
  title: string
  worksCount: number
}

export interface PdfCollectionStatement {
  id: string
  title: string
  intro: string
  description: string
}

export type PdfWorkLayoutMode = 'auto' | 'bleed' | 'contain'
export type PdfWorkPosition = 'start' | 'center' | 'end'

export interface PdfWorkLayout {
  mode: PdfWorkLayoutMode
  x: PdfWorkPosition
  y: PdfWorkPosition
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
