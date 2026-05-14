import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import WorksClient from '@/components/public/WorksClient'
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import { resolveWorksUx } from '@/lib/worksUx'
import { routeMetadata } from '@/lib/i18n/route-metadata'

/** Allow ?worksUx= preview without static caching */
export const dynamic = 'force-dynamic'

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

type WorksThemeRow = { ThemeID: number; Nom: string | null }
type WorksThemeLinkRow = { OeuvreID: number; ThemeID: number }
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
  collections: WorksCollection[]
  outro_fr: string
  outro_en: string
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

export default async function WorksPage({
  searchParams,
}: {
  searchParams?: Promise<{ worksUx?: string }>
}) {
  const supabase = await createClient()

  // 1. Config — same static import as portfolio/about/practice (avoids broken dynamic chunks for `use server` modules).
  let modes: WorksMode[] = []
  const result = await loadPortfolioConfig()
  if ('ok' in result) {
    const cfg = result.config
    /** /works modes come from Diffusion (atelier); separate from card-page section blocks. */
    const rawModes = Array.isArray(cfg.works_modes) ? cfg.works_modes : []
    if (rawModes.length > 0) {
      modes = rawModes
        .filter((m: any) => m.is_active !== false)
        .slice()
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((m: any, i: number): WorksMode => ({
          id:          m.id || `mode-${i}`,
          label_fr:    m.label_fr || m.label || (i === 0 ? 'Œuvres' : `Mode ${i + 1}`),
          label_en:    m.label_en || m.label || (i === 0 ? 'Works'  : `Mode ${i + 1}`),
          collections: mapCollections(Array.isArray(m.collections) ? m.collections : []),
          outro_fr:    m.outro_fr || '',
          outro_en:    m.outro_en || '',
        }))
    }
    if (modes.length === 0) {
      const fromLegacy = mapCollections(cfg.works_collections || [])
      const fromSections = mapCollections(Array.isArray(cfg.sections) ? cfg.sections : [])
      const cols = fromLegacy.length > 0 ? fromLegacy : fromSections
      modes = [{
        id: 'default', label_fr: 'Œuvres', label_en: 'Works',
        collections: cols,
        outro_fr: '', outro_en: '',
      }]
    }
  }

  // 2. Themes + OeuvreTheme junction
  const { data: themeRecords } = await supabase.from('tblTheme').select('ThemeID, Nom')
  const { data: oeuvreThemes } = await supabase.from('OeuvreTheme').select('OeuvreID, ThemeID')

  // 3. Works — fetch ALL public works, not just those with a theme assignment
  const { data: rawWorks } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, "Année", Hauteur, Largeur, txtImageNameLink, Support')
    .is('deleted_at', null)
    .eq('is_public', true)
    .order('Année', { ascending: false })

  // Build OeuvreID → theme names map
  const oeuvreThemeMap = new Map<number, string[]>()
  if (themeRecords && oeuvreThemes) {
    const typedThemeRecords = themeRecords as WorksThemeRow[]
    const typedOeuvreThemes = oeuvreThemes as WorksThemeLinkRow[]
    const idToName = Object.fromEntries(typedThemeRecords.map((r) => [r.ThemeID, r.Nom]))
    typedOeuvreThemes.forEach((ot) => {
      if (!oeuvreThemeMap.has(ot.OeuvreID)) oeuvreThemeMap.set(ot.OeuvreID, [])
      const name = idToName[ot.ThemeID]
      if (name) oeuvreThemeMap.get(ot.OeuvreID)!.push(name)
    })
  }

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
      collections: [{
        id: 'default', title_fr: 'Œuvres', title_en: 'Works',
        description_fr: '', description_en: '', theme: null, is_active: true, manual_work_order: [],
        intro_fr: '', intro_en: '',
      }],
      outro_fr: '', outro_en: '',
    }]
  }

  const sp = searchParams ? await searchParams : {}
  const worksUxMode = resolveWorksUx(sp.worksUx)

  return <WorksClient works={works} modes={modes} worksUxMode={worksUxMode} />
}
