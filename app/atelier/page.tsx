// Team portal — loads all reference data server-side, hands off to the
// fully-interactive client shell (tabs, constellation, drawer, etc.)
import { createClient } from '@/lib/supabase/server'
import { TeamPortalClient } from '@/components/atelier/TeamPortalClient'

export default async function AtelierPage() {
  const supabase = await createClient()

  const results = await Promise.all([
    supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, Technique, Support, Année, Format, Hauteur, Largeur, Profondeur, Exposable, Prix, PrixFinal, Discount, statusId, Catalogué, txtImageNameLink, ContactID, Commentaires, Historique, LocalisationID, LocalisationDetail, is_public, theme, Encadree, IsCommission, PresentationID, ReturnDate, DateLivraison, AcheteurID, NeedsPhotograph, anonymity_level')
      .order('OeuvreID', { ascending: false })
      .range(0, 4999),
    supabase.from('Technique').select('TechniqueID, Technique').order('TechniqueID'),
    supabase.from('Support').select('SupportID, Support').order('SupportID'),
    supabase.from('Format').select('FormatID, Format').order('FormatID'),
    supabase.from('tblTheme').select('ThemeID, Nom').order('ThemeID'),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, Prénom, Role, Ville, Pays').order('ContactID'),
    supabase.from('OeuvreStatus').select('id, label').order('id'),
    supabase.from('working_group').select('id, name, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('tblPresentation').select('PresentationID, Nom').order('PresentationID'),
    supabase.from('exhibition').select('*').order('date_debut', { ascending: false }),
    supabase.from('OeuvreTheme').select('OeuvreID, ThemeID'),
    supabase.from('working_group_work').select('group_id, oeuvre_id'),
    supabase.from('contact_addresses').select('*'),
  ])

  const oeuvres        = results[0]?.data
  const techniques     = results[1]?.data
  const supports       = results[2]?.data
  const formats        = results[3]?.data
  const themes         = results[4]?.data
  const contacts       = results[5]?.data
  const statuses       = results[6]?.data
  const groups         = results[7]?.data
  const presentations  = results[8]?.data
  const exhibitions    = results[9]?.data
  const themesLink     = results[10]
  const _groups_link   = results[11]
  const addresses      = results[12]?.data

  // Build a flat id→label map for fast status lookups on the client
  const statusLabelMap: Record<number, string> = {}
  for (const s of (statuses ?? []) as { id: number; label: string }[]) statusLabelMap[s.id] = s.label

  // Build per-theme public/total counts for the Public tab warning
  const oeuvreIsPublic: Record<number, boolean> = {}
  for (const o of (oeuvres ?? []) as { OeuvreID: number; is_public: boolean }[])
    oeuvreIsPublic[o.OeuvreID] = o.is_public ?? false

  // name → ThemeID lookup for the deprecated theme text fallback
  const themeNameToId: Record<string, number> = {}
  for (const t of (themes ?? []) as { ThemeID: number; Nom: string }[])
    themeNameToId[t.Nom] = t.ThemeID

  type ThemeWork = { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }
  const themePublicStats: Record<number, { total: number; pub: number }> = {}
  const themeAllWorks: Record<number, ThemeWork[]> = {}

  // OeuvreID → work shape for quick lookup
  const oeuvreMap: Record<number, ThemeWork> = {}
  for (const o of (oeuvres ?? []) as { OeuvreID: number; txtImageNameLink: string | null; is_public: boolean }[])
    oeuvreMap[o.OeuvreID] = { OeuvreID: o.OeuvreID, txtImageNameLink: o.txtImageNameLink, isPublic: o.is_public ?? false }

  // Primary: canonical OeuvreTheme junction
  const inOeuvreTheme = new Set<number>()
  for (const row of (themesLink?.data ?? []) as { OeuvreID: number; ThemeID: number }[]) {
    if (!themePublicStats[row.ThemeID]) themePublicStats[row.ThemeID] = { total: 0, pub: 0 }
    themePublicStats[row.ThemeID].total++
    if (oeuvreIsPublic[row.OeuvreID]) themePublicStats[row.ThemeID].pub++
    if (!themeAllWorks[row.ThemeID]) themeAllWorks[row.ThemeID] = []
    if (oeuvreMap[row.OeuvreID]) themeAllWorks[row.ThemeID].push(oeuvreMap[row.OeuvreID])
    inOeuvreTheme.add(row.OeuvreID)
  }

  // Fallback: deprecated theme text field for works not yet migrated to OeuvreTheme
  for (const o of (oeuvres ?? []) as { OeuvreID: number; is_public: boolean; theme?: string | null; txtImageNameLink: string | null }[]) {
    if (inOeuvreTheme.has(o.OeuvreID) || !o.theme) continue
    const themeId = themeNameToId[o.theme]
    if (!themeId) continue
    if (!themePublicStats[themeId]) themePublicStats[themeId] = { total: 0, pub: 0 }
    themePublicStats[themeId].total++
    if (oeuvreIsPublic[o.OeuvreID]) themePublicStats[themeId].pub++
    if (!themeAllWorks[themeId]) themeAllWorks[themeId] = []
    themeAllWorks[themeId].push({ OeuvreID: o.OeuvreID, txtImageNameLink: o.txtImageNameLink, isPublic: o.is_public ?? false })
  }

  return (
    <TeamPortalClient
      oeuvres={oeuvres ?? []}
      techniques={techniques ?? []}
      supports={supports ?? []}
      formats={formats ?? []}
      themes={themes ?? []}
      contacts={contacts ?? []}
      addresses={(addresses ?? []) as any[]}
      statusLabelMap={statusLabelMap}
      initialGroups={(groups ?? [] as { id: string; name: string; created_at: string }[]).map((g) => ({ id: g.id, name: g.name }))}
      presentations={presentations ?? []}
      exhibitions={exhibitions ?? []}
      themePublicStats={themePublicStats}
      themePrivateWorks={themeAllWorks}
    />
  )
}
