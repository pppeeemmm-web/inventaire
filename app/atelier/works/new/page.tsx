// /atelier/works/new — create a new work
import { createClient } from '@/lib/supabase/server'
import { WorkForm }     from '@/components/atelier/WorkForm'
import { saveWork }     from '@/app/atelier/works/actions'

export default async function NewWorkPage() {
  const supabase = await createClient()

    { data: statuses },
    { data: addresses },
  ] = await Promise.all([
    supabase.from('Technique').select('TechniqueID, Technique').order('Technique'),
    supabase.from('Support').select('SupportID, Support').order('SupportID'),
    supabase.from('Format').select('FormatID, Format').order('FormatID'),
    supabase.from('tblTheme').select('ThemeID, Nom').order('ThemeID'),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, Prénom, Role, Ville, Pays').order('ContactID'),
    supabase.from('OeuvreStatus').select('id, label').order('id'),
    supabase.from('contact_addresses').select('*'),
  ])

  return (
    <WorkForm
      oeuvre={null}
      currentThemeIds={[]}
      techniques={techniques ?? []}
      supports={supports ?? []}
      formats={formats ?? []}
      themes={themes ?? []}
      contacts={contacts ?? []}
      statuses={statuses ?? []}
      addresses={addresses ?? []}
      action={saveWork}
    />
  )
}
