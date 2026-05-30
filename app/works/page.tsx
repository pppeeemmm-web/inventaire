import type { Metadata } from 'next'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import WorksClient from '@/components/public/WorksClient'
import { loadPortfolioSectionsFromR2 } from '@/lib/portfolio-sections-from-r2'
import { fetchPublicOeuvreThemeNamesMap } from '@/lib/public-oeuvre-themes'
import {
  canonicalCollectionTheme,
  type ThemeNameRecord,
} from '@/components/public/works-utils'
import {
  migrateCollectionHeadingSource,
  migrateCollectionShowText,
} from '@/lib/collection-display'
import { hiddenNavRoutes, orderedNavRoutes } from '@/lib/site-block-visibility'
import { migrate, WORKS_LAYOUT_VALUES, type Block, type SiteBlock, type WorksLayout } from '@/lib/portfolio-config-types'
import { resolveKnobs, DEFAULT_KNOB_VALUES, type KnobValues } from '@/lib/site-blocks'
import type { ForestPin } from '@/components/public/works-utils'
import {
  LANDING_HERO_BEVEL_PX_DEFAULT,
  LANDING_HERO_BEVEL_PROFILE_DEFAULT,
  migrateHeroBevelPx,
  migrateHeroBevelProfile,
} from '@/lib/landing-hero-bevel'
import {
  WORKS_CAST_SHADOW_BLUR_DEFAULT,
  WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
  WORKS_LIGHT_DIRECTION_DEFAULT,
  WORKS_LIGHT_INTENSITY_DEFAULT,
  WORKS_LIGHT_TEMP_DEFAULT,
  migrateWorksCastShadowBlurPx,
  migrateWorksCastShadowDistancePx,
  migrateWorksLightDirectionDeg,
  migrateWorksLightIntensityPct,
  migrateWorksLightTempK,
  migrateWorksMobileFallback,
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
  heading_source: 'title' | 'theme'
  show_text: boolean
}
type WorksMode = {
  id: string
  label_fr: string
  label_en: string
  layout: WorksLayout
  collections: WorksCollection[]
  outro_fr: string
  outro_en: string
  bevel_px: number
  bevel_profile: 'smooth' | 'hard'
  light_temp_k: number
  light_direction_deg: number
  light_intensity_pct: number
  light_circadian: boolean
  cast_shadow_enabled: boolean
  cast_shadow_distance_px: number
  cast_shadow_blur_px: number
  mobile_fallback: WorksLayout | 'auto'
  forest_panorama_r2_key: string | undefined
  forest_panorama_pin_size: number | undefined
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

function mapCollections(
  raw: Array<Record<string, unknown>>,
  catalogueThemes: ReadonlyArray<ThemeNameRecord>,
): WorksCollection[] {
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
      theme:          canonicalCollectionTheme(
        {
          theme: typeof c.theme === 'string' ? c.theme : null,
          title_fr: asStr(c.title_fr ?? c.title),
          title_en: asStr(c.title_en ?? c.title),
        },
        catalogueThemes,
      ),
      is_active:      true,
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [],
      intro_fr: asStr(c.intro_fr),
      intro_en: asStr(c.intro_en),
      heading_source: migrateCollectionHeadingSource(c.heading_source),
      show_text: migrateCollectionShowText(c.show_text),
    }))
}

export default async function WorksPage() {
  const supabase = await createClient()

  const { data: themeRecords } = await supabase.from('theme').select('id, name')
  const catalogueThemes: ThemeNameRecord[] = (themeRecords ?? []).flatMap((row) => {
    if (typeof row.id !== 'number' || !row.name) return []
    return [{ id: row.id, name: row.name }]
  })

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
        layout: (WORKS_LAYOUT_VALUES as readonly string[]).includes(strOrEmpty(m.layout))
          ? (m.layout as WorksLayout)
          : ('carousel' as const),
        collections: mapCollections(asCollectionRecords(m.collections), catalogueThemes),
        outro_fr: strOrEmpty(m.outro_fr),
        outro_en: strOrEmpty(m.outro_en),
        bevel_px: migrateHeroBevelPx(m.bevel_px),
        bevel_profile: migrateHeroBevelProfile(m.bevel_profile),
        light_temp_k: migrateWorksLightTempK(m.light_temp_k),
        light_direction_deg: migrateWorksLightDirectionDeg(m.light_direction_deg),
        light_intensity_pct: migrateWorksLightIntensityPct(m.light_intensity_pct),
        light_circadian: m.light_circadian === true,
        cast_shadow_enabled: m.cast_shadow_enabled !== false,
        cast_shadow_distance_px: migrateWorksCastShadowDistancePx(m.cast_shadow_distance_px),
        cast_shadow_blur_px: migrateWorksCastShadowBlurPx(m.cast_shadow_blur_px),
        mobile_fallback: migrateWorksMobileFallback(m.mobile_fallback),
        forest_panorama_r2_key: typeof m.forest_panorama_r2_key === 'string' ? m.forest_panorama_r2_key : undefined,
        forest_panorama_pin_size: typeof m.forest_panorama_pin_size === 'number' && m.forest_panorama_pin_size > 0 ? m.forest_panorama_pin_size : undefined,
      }))
  }
  // F1: works_collections / sections fallback removed — works_modes only.
  // If rawModes is empty, use a default carousel mode with no collections (anyCol
  // fallback below will open-bucket it when there are public works to display).
  if (modes.length === 0) {
    modes = [{
      id: 'default', label_fr: 'Œuvres', label_en: 'Works',
      layout: 'carousel' as const,
      collections: [],
      outro_fr: '', outro_en: '',
      bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
      bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
      light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
      light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
      light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
      light_circadian: false,
      cast_shadow_enabled: true,
      cast_shadow_distance_px: WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
      cast_shadow_blur_px: WORKS_CAST_SHADOW_BLUR_DEFAULT,
      mobile_fallback: 'auto' as const,
      forest_panorama_r2_key: undefined,
      forest_panorama_pin_size: undefined,
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
        heading_source: 'title' as const,
        show_text: true,
      }],
      outro_fr: '', outro_en: '',
      bevel_px: LANDING_HERO_BEVEL_PX_DEFAULT,
      bevel_profile: LANDING_HERO_BEVEL_PROFILE_DEFAULT,
      light_temp_k: WORKS_LIGHT_TEMP_DEFAULT,
      light_direction_deg: WORKS_LIGHT_DIRECTION_DEFAULT,
      light_intensity_pct: WORKS_LIGHT_INTENSITY_DEFAULT,
      light_circadian: false,
      cast_shadow_enabled: true,
      cast_shadow_distance_px: WORKS_CAST_SHADOW_DISTANCE_DEFAULT,
      cast_shadow_blur_px: WORKS_CAST_SHADOW_BLUR_DEFAULT,
      mobile_fallback: 'auto' as const,
      forest_panorama_r2_key: undefined,
      forest_panorama_pin_size: undefined,
    }]
  }

  const migrated = migrate(cfg)

  // Forest pins — service role (team-only RLS on forest_pins; public page needs bypass)
  const serviceSb = await createServiceClient()
  const { data: rawPins } = await serviceSb
    .from('forest_pins')
    .select('work_id, lat, lng, z, size, rotation, label')
  const forestPins: ForestPin[] = (rawPins ?? []).map((r: Record<string, unknown>) => ({
    work_id: r.work_id as number,
    x: typeof r.lng === 'number' ? r.lng : 0,
    y: typeof r.lat === 'number' ? r.lat : 0,
    z: typeof r.z === 'number' ? r.z : 0,
    size: typeof r.size === 'number' && r.size >= 2 ? r.size : 16,
    rotation: typeof r.rotation === 'number' ? r.rotation : 0,
    label: typeof r.label === 'string' ? r.label : null,
  }))

  // Knobs cascade (site → works) is the source of truth for the works render.
  const worksKnobs: KnobValues = migrated.knobs
    ? resolveKnobs(migrated.knobs, 'works')
    : DEFAULT_KNOB_VALUES
  const worksA11y: KnobValues['a11y'] = worksKnobs.a11y

  // ── Registry-driven mode ordering + visibility ──────────────────────────
  // pages.works holds one works_modes block per active mode (auto-generated by
  // deriveDefaultPages; the artist can reorder/hide via PagesEditor).
  // Apply those blocks as a visibility + sort overlay over the already-built modes.
  // Falls back to the original modes array if no block references a known mode.
  const worksPageBlocks: Block[] = (migrated.pages?.works ?? [])
    .filter((b): b is Block => b.kind === 'works_modes' && b.visible !== false)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)

  if (worksPageBlocks.length > 0) {
    const modeById = new Map(modes.map(m => [m.id, m]))
    const driven = worksPageBlocks.flatMap(b => {
      const id = typeof b.fields.mode_id === 'string' ? b.fields.mode_id : ''
      const m = modeById.get(id)
      return m ? [m] : []
    })
    // Only switch to block-driven if we matched at least one known mode.
    if (driven.length > 0) modes = driven
  }

  const blocks = cfg.site_blocks as SiteBlock[] | undefined
  const hidden = blocks ? hiddenNavRoutes(blocks) : []
  const navOrder = blocks ? orderedNavRoutes(blocks) : ['/works', '/about', '/practice', '/enquiry']
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
      a11y={worksA11y}
      knobs={worksKnobs}
      forestPins={forestPins}
    />
  )
}
