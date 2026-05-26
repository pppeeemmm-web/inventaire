import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import WorksClient from '@/components/public/WorksClient'
import { loadPortfolioSectionsFromR2 } from '@/lib/portfolio-sections-from-r2'
import { fetchPublicOeuvreThemeNamesMap } from '@/lib/public-oeuvre-themes'
import { hiddenNavRoutes, orderedNavRoutes } from '@/lib/site-block-visibility'
import { migrate, type SiteBlock } from '@/lib/portfolio-config-types'
import {
  LANDING_HERO_BEVEL_PX_DEFAULT,
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  migrateHeroBevelPx,
  migrateHeroBevelProfile,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
  migrateWorksLightDirectionDeg,
  migrateWorksLightIntensityPct,
  migrateWorksLightTempK,
} from '@/lib/works-mode-light'
import {
  resolvePublicNavBarStyle,
  resolvePublicSiteThemeForPage,
} from '@/lib/public-site-theme'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export function generateMetadata(): Metadata {
  const base = routeMetadata('works', 'en')
  return {
    ...base,
    alternates: {
      canonical: '/works',
      languages: { 'fr': '/works?lang=fr', 'en': '/works?lang=en' },
    },
  }
}

type WorksCollection = {
  id: string
  title_fr: string
  title_en: string
  description_fr: string
  description_en: string
  theme: string | null
  is_active: boolean
  manual_work_order: number[]
  intro_fr: string
  intro_en: string
}
type WorksMode = {
  id: string
  label_fr: string
  label_en: string
  layout: 'carousel' | 'grid'
  collections: WorksCollection[]
  outro_fr: string
  outro_en: string
  bevel_px: number
  bevel_profile: 'smooth' | 'hard'
  light_temp_k: number
  light_direction_deg: number
  light_intensity_pct: number
  light_circadian: boolean
}
type WorksPublicRow = {
  OeuvreID: number
  Titre: string | null
  Année: string | null
  Hauteur: string | null
  Largeur: string | null
  txtImageNameLink: string | null
  Support: number | null
}

function isWorksModeRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Portfolio JSON may omit or mistype legacy arrays — never pass non-arrays to mapCollections. */
function asCollectionRecords(v: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(v)) return []
  return v.filter(isWorksModeRecord)
}

function strOrEmpty(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return ''
}

function worksModeId(m: Record<string, unknown>, index: number): string {
  const id = m.id
  if (typeof id === 'string' && id.trim()) return id
  if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  return `mode-${index}`
}

function mapCollections(raw: Array<Record<string, unknown>>): WorksCollection[] {
  const asStr = (v: unknown) => (typeof v === 'string' ? v : String(v ?? ''))
  return raw
    /** Match atelier migrate: missing flag means active (raw JSON often omits it). */
    .filter((c) => c.is_active !== false)
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((c) => ({
      id:             asStr(c.id),
      title_fr:       asStr(c.title_fr ?? c.title),
      title_en:       asStr(c.title_en ?? c.title),
      description_fr: asStr(c.description_fr ?? c.description),
      description_en: asStr(c.description_en ?? c.description),
      theme:          typeof c.theme === 'string' ? c.theme : null,
      is_active:      true,
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [],
      intro_fr: asStr(c.intro_fr),
      intro_en: asStr(c.intro_en),
    }))
}

export default async function WorksPage() {
  const supabase = await createClient()

  // 1. Config — fresh R2 read (portfolio JSON must match last save; avoid stale unstable_cache).
  let modes: WorksMode[] = []
  const { config: cfg } = await loadPortfolioSectionsFromR2()
  /** /works modes come from Diffusion (atelier); separate from card-page section blocks. */
  const rawModes = Array.isArray(cfg.works_modes) ? cfg.works_modes : []
  if (rawModes.length > 0) {
    modes = rawModes
      .filter(isWorksModeRecord)
      .filter((m) => m.is_active !== false)
      .slice()
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((m, i): WorksMode => ({
        id: worksModeId(m, i),
        label_fr:
          strOrEmpty(m.label_fr) ||
          strOrEmpty(m.label) ||
          (i === 0 ? 'Œuvres' : `Mode ${i + 1}`),
        label_en:
          strOrEmpty(m.label_en) ||
          strOrEmpty(m.label) ||
          (i === 0 ? 'Works' : `Mode ${i + 1}`),
        layout: m.layout === 'grid' ? 'grid' as const : 'carousel' as const,
        collections: mapCollections(asCollectionRecords(m.collections)),
        outro_fr: strOrEmpty(m.outro_fr),
        outro_en: strOrEmpty(m.outro_en),
        bevel_px: migrateHeroBevelPx(m.bevel_px),
        bevel_profile: migrateHeroBevelProfile(m.bevel_profile),
        light_temp_k: migrateWorksLightTempK(m.light_temp_k),
        light_direction_deg: migrateWorksLightDirectionDeg(m.light_direction_deg),
        light_intensity_pct: migrateWorksLightIntensityPct(m.light_intensity_pct),
        light_circadian: m.light_circadian === true,
      }))
  }
  if (modes.length === 0) {
    const fromLegacy = mapCollections(asCollectionRecords(cfg.works_collections))
    const fromSections = mapCollections(asCollectionRecords(cfg.sections))
    const cols = fromLegacy.length > 0 ? fromLegacy : fromSections
    modes = [{
      id: 'default', label_fr: 'Œuvres', label_en: 'Works',
      layout: 'carousel' as const,
      collections: cols,
      outro_fr: '', outro_en: '',
      bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
      bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
      light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
      light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
      light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
      light_circadian: false,
    }]
  }

  // 2. Works — fetch ALL public works, not just those with a theme assignment
  const { data: rawWorks } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, "Année", Hauteur, Largeur, txtImageNameLink, Support')
    .is('deleted_at', null)
    .eq('is_public', true)
    .order('Année', { ascending: false })

  const oeuvreThemeMap = await fetchPublicOeuvreThemeNamesMap(supabase)

  const ROUND_SUPPORT_ID = 16
  const works = Array.isArray(rawWorks)
    ? rawWorks.flatMap((row) => {
        const w = row as Partial<WorksPublicRow>
        if (typeof w.OeuvreID !== 'number') return []
        return [{
          OeuvreID: w.OeuvreID,
          Titre: w.Titre ?? null,
          Annee: w['Année'] ?? null,
          Hauteur: w.Hauteur ?? null,
          Largeur: w.Largeur ?? null,
          txtImageNameLink: w.txtImageNameLink ?? null,
          themes: oeuvreThemeMap.get(w.OeuvreID) ?? [],
          isRound: w.Support === ROUND_SUPPORT_ID,
        }]
      })
    : []

  // Fallback: open bucket only — never substitute blocks from other site surfaces
  const anyCol = modes.some(m => m.collections.length > 0)
  if (!anyCol && works.length > 0) {
    modes = [{
      id: 'default', label_fr: 'Œuvres', label_en: 'Works',
      layout: 'carousel' as const,
      collections: [{
        id: 'default', title_fr: 'Œuvres', title_en: 'Works',
        description_fr: '', description_en: '', theme: null, is_active: true, manual_work_order: [],
        intro_fr: '', intro_en: '',
      }],
      outro_fr: '', outro_en: '',
      bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
      bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
      light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
      light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
      light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
      light_circadian: false,
    }]
  }

  const blocks = cfg.site_blocks as SiteBlock[] | undefined
  const hidden = blocks ? hiddenNavRoutes(blocks) : []
  const navOrder = blocks ? orderedNavRoutes(blocks) : ['/works', '/about', '/practice', '/enquiry']
  const migrated = migrate(cfg)
  const siteTheme = resolvePublicSiteThemeForPage('works', migrated.landing, migrated.site_blocks)
  const navTransparent = resolvePublicNavBarStyle('works', migrated.site_blocks) === 'transparent'

  return (
    <WorksClient
      works={works}
      modes={modes}
      hiddenNavRoutes={hidden}
      navOrder={navOrder}
      siteTheme={siteTheme}
      navTransparent={navTransparent}
    />
  )
}
