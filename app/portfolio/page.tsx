// /portfolio — public-facing portfolio (no auth required)
import { loadPortfolioConfig } from '@/app/atelier/portfolio/actions'
import { createClient } from '@/lib/supabase/server'
import PortfolioClient from '@/components/portfolio/PortfolioClient'
import type { Metadata } from 'next'
import { trackView } from '@/lib/track'

export const metadata: Metadata = {
  title: 'Portfolio d\'Artiste',
  description: "Portfolio de l'artiste. Peinture, dessin, sculpture, photographie.",
  robots: { index: true, follow: true },
}

// ── Migrate legacy config to dual-field shape ─────────────────────────────
function migrateConfig(raw: any): any {
  const general = raw.general ?? {}
  const about   = raw.about   ?? null

  return {
    general: {
      artist_name:      general.artist_name      ?? '',
      contact_email:    general.contact_email    ?? '',
      instagram:        general.instagram        ?? '',
      phone:            general.phone            ?? '',
      media_tagline_fr: general.media_tagline_fr ?? '',
      media_tagline_en: general.media_tagline_en ?? '',
      about_intro:      general.about_intro      ?? '',
    },
    about: about ?? {
      intro_fr:         general.about_intro ?? '',
      intro_en:         '',
      statement_doc_id: raw.statement_doc_id ?? null,
      cv_doc_id:        raw.cv_doc_id        ?? null,
    },
    sections: (raw.sections ?? []).map((s: any) => ({
      id:             s.id             ?? crypto.randomUUID(),
      title_fr:       s.title_fr       ?? s.title       ?? '',
      title_en:       s.title_en       ?? s.title       ?? '',
      description_fr: s.description_fr ?? s.description ?? '',
      description_en: s.description_en ?? s.description ?? '',
      theme:          s.theme          ?? null,
      sort_order:     s.sort_order     ?? 0,
      is_active:      s.is_active      ?? true,
    })),
    works_collections: (raw.works_collections ?? []).map((s: any) => ({
      id:             s.id             ?? crypto.randomUUID(),
      title_fr:       s.title_fr       ?? s.title       ?? '',
      title_en:       s.title_en       ?? s.title       ?? '',
      description_fr: s.description_fr ?? s.description ?? '',
      description_en: s.description_en ?? s.description ?? '',
      theme:          s.theme          ?? null,
      sort_order:     s.sort_order     ?? 0,
      is_active:      s.is_active      ?? true,
    })),
  }
}

export default async function PortfolioPage() {
  void trackView('/portfolio')
  const sb = await createClient() as any

  const [
    { data: rawWorks,       error: e1 },
    { data: rawTech,        error: e2 },
    { data: rawThemes,      error: e3 },
    { data: rawOeuvreThemes,error: e4 },
  ] = await Promise.all([
    sb.from('Oeuvres')
      .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink, Technique, statusId')
      .eq('is_public', true)
      .order('Année', { ascending: false }),
    sb.from('Technique').select('TechniqueID, Technique'),
    sb.from('tblTheme').select('ThemeID, Nom'),
    sb.from('OeuvreTheme').select('OeuvreID, ThemeID'),
  ])

  if (e1) console.error('[portfolio] works error:', JSON.stringify(e1))

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

  const works = ((rawWorks ?? []) as any[]).map((o: any) => ({
    OeuvreID:         o.OeuvreID        as number,
    Titre:            o.Titre            as string | null,
    Annee:            o['Année']         as string | null,
    Hauteur:          o.Hauteur          as string | null,
    Largeur:          o.Largeur          as string | null,
    Profondeur:       o.Profondeur       as string | null,
    UniteDimension:   null,
    txtImageNameLink: o.txtImageNameLink as string | null,
    themes:           oeuvreThemeMap.get(o.OeuvreID) ?? [],
    techniqueName:    o.Technique != null ? (tMap[o.Technique as number] ?? null) : null,
    statutId:         o.statusId         as number | null,
  }))

  const cfgResult = await loadPortfolioConfig()
  const rawConfig = 'ok' in cfgResult ? cfgResult.config : {
    general: { artist_name: 'Pierre Emmanuel Moulin', about_intro: '', contact_email: '', instagram: '' },
    sections: [],
    works_collections: [],
    statement_doc_id: null,
    cv_doc_id: null,
  }
  const config = migrateConfig(rawConfig)

  let statementUrl = null
  let cvUrl        = null
  const statementId = config.about?.statement_doc_id ?? rawConfig.statement_doc_id
  const cvId        = config.about?.cv_doc_id        ?? rawConfig.cv_doc_id

  if (statementId || cvId) {
    const ids = [statementId, cvId].filter(Boolean)
    const { data: docs } = await (sb as any).from('document').select('id, storage_path').in('id', ids)
    if (docs) {
      const sDoc = docs.find((d: any) => d.id === statementId)
      if (sDoc) {
        const { data } = await (await createClient()).storage.from('vault').createSignedUrl(sDoc.storage_path, 3600)
        statementUrl = data?.signedUrl || null
      }
      const cDoc = docs.find((d: any) => d.id === cvId)
      if (cDoc) {
        const { data } = await (await createClient()).storage.from('vault').createSignedUrl(cDoc.storage_path, 3600)
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
