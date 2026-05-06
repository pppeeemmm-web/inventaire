// Collector portal — /collection/:collector_id
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PortalLayout from '@/components/portals/PortalLayout'

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ collector_id: string }>
}) {
  const { collector_id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: contact } = await supabase
    .from('Contact')
    .select('ContactID, NomInstitution, Nom, Prénom, Role')
    .eq('ContactID', parseInt(collector_id))
    .eq('auth_user_id', user.id)
    .single()

  if (!contact) return notFound()

  const { data: works } = await supabase
    .from('Oeuvres')
    .select('OeuvreID, Titre, Année, Hauteur, Largeur, Profondeur, txtImageNameLink')
    .eq('AcheteurID', parseInt(collector_id))
    .order('Année', { ascending: false }) as any

  return (
    <PortalLayout 
      title="Collection Privée"
      subtitle={`${contact.Prénom} ${contact.Nom}`}
      userName={user.email || 'Collectionneur'}
      works={works || []}
    />
  )
}
