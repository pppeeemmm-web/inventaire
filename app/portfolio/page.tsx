// /portfolio — public-facing portfolio (no auth required)
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import { createClient } from '@/lib/supabase/server'
import PortfolioClient from '@/components/portfolio/PortfolioClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portfolio d\'Artiste',
  description: "Portfolio de l'artiste. Peinture, dessin, sculpture, photographie.",
  robots: { index: true, follow: true },
}

export default async function PortfolioPage() {
  const supabase = await createClient()

  const [
    { data: rawWorks }, 
    { data: rawTech },
    { data: rawThemes },
    { data: rawOeuvreThemes }
  ] = await Promise.all([
    supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink, Technique, statutId')
      .eq('is_public', true)
      .order('Année', { ascending: false }) as any,
    supabase.from('Technique').select('TechniqueID, Technique') as any,
    supabase.from('tblTheme').select('ThemeID, Nom') as any,
    supabase.from('OeuvreTheme').select('OeuvreID, ThemeID') as any,
  ])

  const tMap: Record<number, string> = {}
  for (const t of (rawTech ?? []) as any[]) {
    if (t.TechniqueID != null && t.Technique) tMap[t.TechniqueID] = t.Technique
  }

  const thMap: Record<number, string> = {}
  for (const th of (rawThemes ?? []) as any[]) {
    thMap[th.ThemeID] = th.Nom
  }

  const oeuvreThemeMap = new Map<number, string[]>()
  for (const ot of (rawOeuvreThemes ?? []) as any[]) {
    if (!oeuvreThemeMap.has(ot.OeuvreID)) oeuvreThemeMap.set(ot.OeuvreID, [])
    const name = thMap[ot.ThemeID]
    if (name) oeuvreThemeMap.get(ot.OeuvreID)!.push(name)
  }

  const works = ((rawWorks ?? []) as any[])
    .map((o: any) => ({
      OeuvreID:         o.OeuvreID         as number,
      Titre:            o.Titre             as string | null,
      Année:            o.Année             as string | null,
      Hauteur:          o.Hauteur           as string | null,
      Largeur:          o.Largeur           as string | null,
      Profondeur:       o.Profondeur        as string | null,
      UniteDimension:   null,
      txtImageNameLink: o.txtImageNameLink  as string | null,
      themes:           oeuvreThemeMap.get(o.OeuvreID) ?? [],
      techniqueName:    o.Technique != null ? (tMap[o.Technique as number] ?? null) : null,
      statutId:         o.statutId          as number | null,
    }))

  // Load config from R2 via server action
  const cfgResult = await loadPortfolioConfig()
  const config = 'ok' in cfgResult ? cfgResult.config : { 
    general: { artist_name: 'Pierre Emmanuel Moulin', about_intro: '', contact_email: '', instagram: '' },
    sections: [], 
    works_collections: [],
    statement_doc_id: null, 
    cv_doc_id: null 
  }

  // Fetch Statement and CV signed URLs
  let statementUrl = null
  let cvUrl = null
  const supabaseForDocs = await createClient()

  if (config.statement_doc_id || config.cv_doc_id) {
    const ids = [config.statement_doc_id, config.cv_doc_id].filter(Boolean)
    const { data: docs } = await (supabaseForDocs.from('document') as any).select('id, storage_path').in('id', ids)
    
    if (docs) {
      const sDoc = docs.find((d: any) => d.id === config.statement_doc_id)
      if (sDoc) {
        const { data } = await supabaseForDocs.storage.from('vault').createSignedUrl(sDoc.storage_path, 3600)
        statementUrl = data?.signedUrl || null
      }
      const cDoc = docs.find((d: any) => d.id === config.cv_doc_id)
      if (cDoc) {
        const { data } = await supabaseForDocs.storage.from('vault').createSignedUrl(cDoc.storage_path, 3600)
        cvUrl = data?.signedUrl || null
      }
    }
  }

  return (
    <PortfolioClient 
      works={works} 
      config={config}
      statementUrl={statementUrl}
      cvUrl={cvUrl}
    />
  )
}
