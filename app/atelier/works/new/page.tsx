// /atelier/works/new — create a new work
import { createClient } from '@/lib/supabase/server'
import { WorkForm }     from '@/components/atelier/WorkForm'
import { saveWork }     from '@/app/atelier/works/actions'

export default async function NewWorkPage() {
  const supabase = await createClient()

  const [
    { data: techniques },
    { data: supports },
    { data: formats },
    { data: themes },
    { data: contacts },
    { data: addresses },
    { data: groups },
  ] = await Promise.all([
    supabase.from('Technique').select('TechniqueID, Technique').order('Technique', { ascending: true }),
    supabase.from('Support').select('SupportID, Support').order('Support', { ascending: true }),
    supabase.from('Format').select('FormatID, Format').order('Format', { ascending: true }),
    supabase.from('tblTheme').select('ThemeID, Nom').order('Nom', { ascending: true }),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom", Role, Ville, Pays').order('NomInstitution', { ascending: true }),
    supabase.from('contact_addresses').select('*'),
    supabase.from('working_group').select('*').order('name', { ascending: true }),
  ])

  const catalogThemes = (themes ?? []).map((r) => ({
    id: (r as { ThemeID: number }).ThemeID,
    name: (r as { Nom: string }).Nom,
  }))

  return (
    <WorkForm
      oeuvre={null}
      currentThemeIds={[]}
      techniques={techniques ?? []}
      supports={supports ?? []}
      formats={formats ?? []}
      themes={catalogThemes}
      contacts={contacts ?? []}
      addresses={(addresses ?? []) as import('@/components/atelier/contact-editor-types').ContactAddress[]}
      groups={groups ?? []}
      currentGroupIds={[]}
      activeConsignment={null}
      action={saveWork}
    />
  )
}
