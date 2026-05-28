// Gallery portal — /galerie/:gallery_id
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PortalLayout from '@/components/portals/PortalLayout'

export default async function GaleriePage({
  params,
}: {
  params: Promise<{ gallery_id: string }>
}) {
  const { gallery_id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  // Verify this user is the gallery in question
  const { data: contact } = await supabase
    .from('Contact')
    .select('ContactID, NomInstitution, Role')
    .eq('ContactID', parseInt(gallery_id))
    .eq('auth_user_id', user.id)
    .single()

  if (!contact || contact.Role !== 'gallery') return notFound()

  const { data: consignments } = await supabase
    .from('consignment')
    .select('*, Oeuvres(OeuvreID, Titre, "Année", Hauteur, Largeur, Profondeur, txtImageNameLink)')
    .eq('gallery_contact_id', parseInt(gallery_id))
    .is('ended_at', null)
    .order('since', { ascending: false })

  const works = (consignments || []).map((c: any) => c.Oeuvres).filter(Boolean)

  return (
    <PortalLayout 
      title="Espace Galerie"
      subtitle={contact.NomInstitution || 'Galerie Partenaire'}
      userName={user.email || 'Admin'}
      works={works}
    />
  )
}
