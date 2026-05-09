// /atelier/works/[id]/edit — edit an existing work
import { notFound }     from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkForm }     from '@/components/atelier/WorkForm'
import { saveWork }     from '@/app/atelier/works/actions'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditWorkPage({ params }: Props) {
  const { id } = await params
  const oid    = parseInt(id, 10)
  if (isNaN(oid)) notFound()

  const supabase = await createClient()

  const results = await Promise.all([
    supabase.from('Oeuvres').select('*').eq('OeuvreID', oid).single(),
    supabase.from('OeuvreTheme').select('ThemeID').eq('OeuvreID', oid),
    supabase.from('Technique').select('TechniqueID, Technique').order('Technique', { ascending: true }),
    supabase.from('Support').select('SupportID, Support').order('Support', { ascending: true }),
    supabase.from('Format').select('FormatID, Format').order('Format', { ascending: true }),
    supabase.from('tblTheme').select('ThemeID, Nom').order('Nom', { ascending: true }),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, Prénom, Role, Ville, Pays').order('NomInstitution', { ascending: true }),
    supabase.from('OeuvreStatus').select('id, label').order('id'),
    supabase.from('tblImage').select('*').eq('OeuvreID', oid).order('SeqNo', { ascending: true }),
    supabase.from('contact_addresses').select('*'),
    supabase.from('working_group').select('*').order('name', { ascending: true }),
    supabase.from('working_group_work').select('group_id').eq('oeuvre_id', oid),
    supabase.from('consignment').select('*, Contact(NomInstitution, Nom, Prénom, Ville, Pays)').eq('oeuvre_id', oid).order('created_at', { ascending: false }).limit(1),
  ])

  const oeuvre       = results[0]?.data
  const themeRows    = results[1]?.data
  const techniques   = results[2]?.data
  const supports     = results[3]?.data
  const formats      = results[4]?.data
  const themes       = results[5]?.data
  const contacts     = results[6]?.data
  const statuses     = results[7]?.data
  const images       = results[8]?.data
  const addresses    = results[9]?.data
  const groups       = results[10]?.data
  const workGroups   = results[11]?.data
  const consignments = results[12]?.data

  if (!oeuvre) notFound()

  const currentThemeIds = (themeRows ?? []).map((r) => r.ThemeID)

  return (
    <WorkForm
      oeuvre={oeuvre}
      currentThemeIds={currentThemeIds}
      techniques={techniques ?? []}
      supports={supports ?? []}
      formats={formats ?? []}
      themes={themes ?? []}
      contacts={contacts ?? []}
      statuses={statuses ?? []}
      initialImages={images ?? []}
      addresses={addresses ?? []}
      groups={groups ?? []}
      currentGroupIds={(workGroups ?? []).map(g => g.group_id)}
      activeConsignment={consignments?.[0] ?? null}
      action={saveWork}
    />
  )
}
