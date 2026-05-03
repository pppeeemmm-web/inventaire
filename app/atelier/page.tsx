// Team portal — loads all reference data server-side, hands off to the
// fully-interactive client shell (tabs, constellation, drawer, etc.)
import { createClient } from '@/lib/supabase/server'
import { TeamPortalClient } from '@/components/atelier/TeamPortalClient'

export default async function AtelierPage() {
  const supabase = await createClient()

  const [
    { data: oeuvres },
    { data: techniques },
    { data: supports },
    { data: formats },
    { data: themes },
    { data: contacts },
    { data: statuses },
    { data: groups },
    { data: presentations },
    { data: exhibitions },
    _themes_link,
    _groups_link,
    { data: addresses },
  ] = await Promise.all([
    supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, Technique, Support, Année, Format, Hauteur, Largeur, Profondeur, Exposable, Prix, PrixFinal, Discount, statusId, commercial_status, Catalogué, txtImageNameLink, ContactID, Commentaires, Historique, LocalisationID, LocalisationDetail, is_public, theme, Encadree, IsCommission, PresentationID, ReturnDate, DateLivraison, AcheteurID, StageProduction, NeedsPhotograph, anonymity_level')
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

  // Build a flat id→label map for fast status lookups on the client
  const statusLabelMap: Record<number, string> = {}
  for (const s of (statuses ?? []) as { id: number; label: string }[]) statusLabelMap[s.id] = s.label

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
    />
  )
}
