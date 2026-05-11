import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import WorksClient from '@/components/public/WorksClient'
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import { trackView } from '@/lib/track'
import { resolveWorksUx } from '@/lib/worksUx'

/** Allow ?worksUx= preview without static caching */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Works — Pierre Emmanuel Moulin',
  description: 'Selected works by Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

function mapCollections(raw: any[]) {
  return raw
    /** Match atelier migrate: missing flag means active (raw JSON often omits it). */
    .filter((c: any) => c.is_active !== false)
    .slice()
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((c: any) => ({
      id:             c.id,
      title_fr:       c.title_fr  || c.title  || '',
      title_en:       c.title_en  || c.title  || '',
      description_fr: c.description_fr || c.description || '',
      description_en: c.description_en || c.description || '',
      theme:          c.theme ?? null,
      is_active:      true,
      manual_work_order: Array.isArray(c.manual_work_order)
        ? c.manual_work_order.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
        : [],
      intro_fr: c.intro_fr ?? '',
      intro_en: c.intro_en ?? '',
    }))
}

export default async function WorksPage({
  searchParams,
}: {
  searchParams?: Promise<{ worksUx?: string }>
}) {
  await trackView('/works')
  const supabase = await createClient()

  // 1. Config — same static import as portfolio/about/practice (avoids broken dynamic chunks for `use server` modules).
  let modes: any[] = []
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
        .map((m: any, i: number) => ({
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
  const { data: themeRecords } = await (supabase.from('tblTheme') as any).select('ThemeID, Nom')
  const { data: oeuvreThemes } = await (supabase.from('OeuvreTheme') as any).select('OeuvreID, ThemeID')

  // 3. Works — fetch ALL public works, not just those with a theme assignment
  const { data: rawWorks } = await (supabase.from('Oeuvres') as any)
    .select('OeuvreID, Titre, Année, Hauteur, Largeur, txtImageNameLink, Support')
    .is('deleted_at', null)
    .eq('is_public', true)
    .order('Année', { ascending: false })

  // Build OeuvreID → theme names map
  const oeuvreThemeMap = new Map<number, string[]>()
  if (themeRecords && oeuvreThemes) {
    const idToName = Object.fromEntries((themeRecords as any[]).map(r => [r.ThemeID, r.Nom]))
    ;(oeuvreThemes as any[]).forEach((ot: any) => {
      if (!oeuvreThemeMap.has(ot.OeuvreID)) oeuvreThemeMap.set(ot.OeuvreID, [])
      const name = idToName[ot.ThemeID]
      if (name) oeuvreThemeMap.get(ot.OeuvreID)!.push(name)
    })
  }

  const ROUND_SUPPORT_ID = 16
  const works = ((rawWorks || []) as any[]).map(w => ({
    OeuvreID:         w.OeuvreID         as number,
    Titre:            w.Titre             as string | null,
    Annee:            w['Année']          as string | null,
    Hauteur:          w.Hauteur           as string | null,
    Largeur:          w.Largeur           as string | null,
    txtImageNameLink: w.txtImageNameLink  as string | null,
    themes:           oeuvreThemeMap.get(w.OeuvreID) ?? [],
    isRound:          w.Support === ROUND_SUPPORT_ID,
  }))

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
