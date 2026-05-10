// Team portal — loads all reference data server-side, hands off to the
// fully-interactive client shell (tabs, constellation, drawer, etc.)
import { createClient } from '@/lib/supabase/server'
import { AtelierTeamPortalLoader } from '@/components/atelier/AtelierTeamPortalLoader'

export default async function AtelierPage() {
  const supabase = await createClient()

  const results = await Promise.all([
    supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, Technique, Support, Année, Format, Hauteur, Largeur, Profondeur, Exposable, Prix, PrixFinal, Discount, statusId, Catalogué, txtImageNameLink, ContactID, Commentaires, Historique, LocalisationID, LocalisationDetail, is_public, Encadree, IsCommission, PresentationID, ReturnDate, DateLivraison, AcheteurID, NeedsPhotograph, anonymity_level')
      .order('OeuvreID', { ascending: false })
      .range(0, 4999),
    supabase.from('Technique').select('TechniqueID, Technique').order('TechniqueID'),
    supabase.from('Support').select('SupportID, Support').order('SupportID'),
    supabase.from('Format').select('FormatID, Format').order('FormatID'),
    supabase.from('theme').select('id, name').order('id'),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, Prénom, Role, Ville, Pays').order('ContactID'),
    supabase.from('OeuvreStatus').select('id, label').order('id'),
    supabase.from('working_group').select('id, name, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('tblPresentation').select('PresentationID, Nom').order('PresentationID'),
    supabase.from('exhibition').select('*').order('date_debut', { ascending: false }),
    supabase.from('oeuvre_theme').select('oeuvre_id, theme_id'),
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

  type ThemeWork = { OeuvreID: number; txtImageNameLink: string | null; isPublic: boolean }
  const themePublicStats: Record<number, { total: number; pub: number }> = {}
  const themeAllWorks: Record<number, ThemeWork[]> = {}

  // OeuvreID → work shape for quick lookup
  const oeuvreMap: Record<number, ThemeWork> = {}
  for (const o of (oeuvres ?? []) as { OeuvreID: number; txtImageNameLink: string | null; is_public: boolean }[])
    oeuvreMap[o.OeuvreID] = { OeuvreID: o.OeuvreID, txtImageNameLink: o.txtImageNameLink, isPublic: o.is_public ?? false }

  const themeWorkCount: Record<number, number> = {}
  const groupWorkCount: Record<string, number> = {}
  const themeToGroups:  Record<number, Set<string>> = {}
  const groupToThemes:  Record<string, Set<number>> = {}
  const groupAllWorks:  Record<string, ThemeWork[]> = {}

  // Canonical oeuvre_theme junction
  const oeuvreThemes: Record<number, number[]> = {}
  for (const row of (themesLink?.data ?? []) as { oeuvre_id: number; theme_id: number }[]) {
    if (!themePublicStats[row.theme_id]) themePublicStats[row.theme_id] = { total: 0, pub: 0 }
    themePublicStats[row.theme_id].total++
    themeWorkCount[row.theme_id] = (themeWorkCount[row.theme_id] ?? 0) + 1
    if (oeuvreIsPublic[row.oeuvre_id]) themePublicStats[row.theme_id].pub++
    if (!themeAllWorks[row.theme_id]) themeAllWorks[row.theme_id] = []
    if (oeuvreMap[row.oeuvre_id]) themeAllWorks[row.theme_id].push(oeuvreMap[row.oeuvre_id])
    
    if (!oeuvreThemes[row.oeuvre_id]) oeuvreThemes[row.oeuvre_id] = []
    oeuvreThemes[row.oeuvre_id].push(row.theme_id)
  }

  // Canonical working_group_work junction
  for (const row of (_groups_link?.data ?? []) as { oeuvre_id: number; group_id: string }[]) {
    groupWorkCount[row.group_id] = (groupWorkCount[row.group_id] ?? 0) + 1
    if (!groupAllWorks[row.group_id]) groupAllWorks[row.group_id] = []
    if (oeuvreMap[row.oeuvre_id]) groupAllWorks[row.group_id].push(oeuvreMap[row.oeuvre_id])

    // Cross-link relationships
    if (oeuvreThemes[row.oeuvre_id]) {
      for (const tId of oeuvreThemes[row.oeuvre_id]) {
        if (!themeToGroups[tId]) themeToGroups[tId] = new Set()
        themeToGroups[tId].add(row.group_id)
        if (!groupToThemes[row.group_id]) groupToThemes[row.group_id] = new Set()
        groupToThemes[row.group_id].add(tId)
      }
    }
  }

  // Convert Sets to arrays for transport
  const t2g: Record<number, string[]> = {}
  for (const [k, v] of Object.entries(themeToGroups)) t2g[Number(k)] = Array.from(v)
  const g2t: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(groupToThemes)) g2t[k] = Array.from(v)

  return (
    <AtelierTeamPortalLoader
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
      themeWorkCount={themeWorkCount}
      groupWorkCount={groupWorkCount}
      groupPrivateWorks={groupAllWorks}
      themeToGroups={t2g}
      groupToThemes={g2t}
    />
  )
}

