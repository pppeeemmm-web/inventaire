// /portfolio — public-facing portfolio (no auth required)
import { createClient } from '@/lib/supabase/server'
import PortfolioClient from '@/components/portfolio/PortfolioClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pierre Emmanuel Moulin — Peinture, dessin, sculpture, photographie',
  description: "Portfolio de l'artiste Pierre Emmanuel Moulin. Peinture, dessin, sculpture, photographie.",
  robots: { index: true, follow: true },
}

const EXCLUDE_STATUT = [1, 9, 10]

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
      .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink, Technique, statusId, Exposable')
      .eq('is_public', true)
      .eq('Exposable', true)
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
    .filter((o: any) => o.statusId == null || !EXCLUDE_STATUT.includes(o.statusId))
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
      statutId:         o.statusId          as number | null,
    }))

  // Fetch config
  let config: any = { sections: [], statement_doc_id: null, cv_doc_id: null }
  const { data: configDoc } = await supabase
    .from('document')
    .select('storage_path')
    .eq('name', 'portfolio_sections.json')
    .single()

  if (configDoc?.storage_path) {
    const { data: fileData } = await supabase.storage.from('documents').download(configDoc.storage_path)
    if (fileData) {
      try {
        const parsed = JSON.parse(await fileData.text())
        config = Array.isArray(parsed) ? { ...config, sections: parsed } : parsed
      } catch (e) {}
    }
  }

  // Fetch Statement and CV
  let statementUrl = null
  let cvUrl = null

  if (config.statement_doc_id || config.cv_doc_id) {
    const ids = [config.statement_doc_id, config.cv_doc_id].filter(Boolean)
    const { data: docs } = await supabase.from('document').select('id, storage_path').in('id', ids)
    
    if (docs) {
      const sDoc = docs.find(d => d.id === config.statement_doc_id)
      if (sDoc) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(sDoc.storage_path, 3600)
        statementUrl = data?.signedUrl || null
      }
      const cDoc = docs.find(d => d.id === config.cv_doc_id)
      if (cDoc) {
        const { data } = await supabase.storage.from('documents').createSignedUrl(cDoc.storage_path, 3600)
        cvUrl = data?.signedUrl || null
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', color: 'var(--tx)' }}>
      <PortfolioClient 
        works={works} 
        sections={config.sections || []} 
        statementUrl={statementUrl}
        cvUrl={cvUrl}
      />
    </div>
  )
}
