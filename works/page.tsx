import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import WorksClient from '@/components/public/WorksClient'

export const metadata: Metadata = {
  title: 'Works — Pierre Emmanuel Moulin',
  description: 'Selected works by Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

export default async function WorksPage() {
  const supabase = await createClient()

  // 1. Config — pass dual-language fields so WorksClient can switch on client
  let collections: any[] = []
  const result = await loadPortfolioConfig()
  if ('ok' in result) {
    const raw = result.config.works_collections || []
    collections = raw
      .filter((c: any) => c.is_active)
      .map((c: any) => ({
        id:             c.id,
        title_fr:       c.title_fr  || c.title  || '',
        title_en:       c.title_en  || c.title  || '',
        description_fr: c.description_fr || c.description || '',
        description_en: c.description_en || c.description || '',
        theme:          c.theme ?? null,
        is_active:      true,
      }))
  }

  // 2. Themes + OeuvreTheme junction
  const { data: themeRecords } = await (supabase.from('tblTheme') as any).select('ThemeID, Nom')
  const { data: oeuvreThemes } = await (supabase.from('OeuvreTheme') as any).select('OeuvreID, ThemeID')

  // 3. Works — fetch ALL public works, not just those with a theme assignment
  const { data: rawWorks } = await (supabase.from('Oeuvres') as any)
    .select('OeuvreID, Titre, Année, Hauteur, Largeur, txtImageNameLink, Support')
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

  // Fallback: if no collections configured, show everything in one section
  if (collections.length === 0 && works.length > 0) {
    collections = [{ id: 'default', title_fr: 'Œuvres', title_en: 'Works', description_fr: '', description_en: '', theme: null, is_active: true }]
  }

  return <WorksClient works={works} collections={collections} />
}
