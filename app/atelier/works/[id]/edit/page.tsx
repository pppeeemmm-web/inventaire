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

  const [
    { data: oeuvre },
    { data: themeRows },
    { data: techniques },
    { data: supports },
    { data: formats },
    { data: themes },
    { data: contacts },
    { data: statuses },
    { data: images },
  ] = await Promise.all([
    supabase.from('Oeuvres').select('*').eq('OeuvreID', oid).single(),
    supabase.from('OeuvreTheme').select('ThemeID').eq('OeuvreID', oid),
    supabase.from('Technique').select('TechniqueID, Technique').order('Technique'),
    supabase.from('Support').select('SupportID, Support').order('SupportID'),
    supabase.from('Format').select('FormatID, Format').order('FormatID'),
    supabase.from('tblTheme').select('ThemeID, Nom').order('ThemeID'),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, Prénom, Role, Ville, Pays').order('ContactID'),
    supabase.from('OeuvreStatus').select('id, label').order('id'),
    supabase.from('tblImage').select('*').eq('OeuvreID', oid).order('SeqNo', { ascending: true }),
  ])

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
      action={saveWork}
    />
  )
}
