import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import WorksClient from '@/components/public/WorksClient'

export const metadata: Metadata = {
  title: 'Works — Pierre Emmanuel Moulin',
  description: 'Selected works by Pierre Emmanuel Moulin.',
  robots: { index: true, follow: true },
}

function normalizeTheme(s: string | null | undefined): string {
  if (!s) return ''
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'

export default async function WorksPage() {
  const supabase = await createClient()
  // 1. Config
  let collections: any[] = []
  const result = await loadPortfolioConfig()
  
  if ('ok' in result) {
    const parsed = result.config
    // Handle new nested schema first, then old flat array
    const raw = parsed.works_collections || (Array.isArray(parsed) ? parsed : [])
    collections = raw.filter((c: any) => c.is_active)
  }

  // FALLBACK: If no collections are configured, show all public works in a single section
  const hasConfig = collections.length > 0

  // 2. Themes
  const { data: themeRecords } = await (supabase.from('tblTheme') as any).select('ThemeID, Nom')
  const { data: oeuvreThemes } = await (supabase.from('OeuvreTheme') as any).select('OeuvreID, ThemeID')
  const oeuvreIds = [...new Set((oeuvreThemes || []).map((ot: any) => ot.OeuvreID))]

  // 3. Works
  const { data: rawWorks } = await (supabase.from('Oeuvres') as any)
    .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink')
    .eq('is_public', true)
    .in('OeuvreID', oeuvreIds)
    .order('Année', { ascending: false })

  // Build OeuvreID -> theme names map
  const oeuvreThemeMap = new Map<number, string[]>()
  if (themeRecords && oeuvreThemes) {
    const idToName = Object.fromEntries((themeRecords as any[]).map(r => [r.ThemeID, r.Nom]))
    ;(oeuvreThemes as any[]).forEach(ot => {
      if (!oeuvreThemeMap.has(ot.OeuvreID)) oeuvreThemeMap.set(ot.OeuvreID, [])
      const name = idToName[ot.ThemeID]
      if (name) oeuvreThemeMap.get(ot.OeuvreID)!.push(name)
    })
  }

  const works = ((rawWorks || []) as any[]).map(w => ({
    OeuvreID:         w.OeuvreID as number,
    Titre:            w.Titre as string | null,
    Annee:            w['Année'] as string | null,
    Hauteur:          w.Hauteur as string | null,
    Largeur:          w.Largeur as string | null,
    txtImageNameLink: w.txtImageNameLink as string | null,
    themes:           oeuvreThemeMap.get(w.OeuvreID) ?? [],
  }))

  if (!hasConfig && works.length > 0) {
    collections = [{
      id: 'default',
      title: 'Selected Works',
      theme: null,
      is_active: true
    }]
  }

  return <WorksClient works={works} collections={collections} />
}
