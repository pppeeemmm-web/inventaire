// Gallery portal — /galerie/:gallery_id
// Auth enforced by middleware. Galleries see only their own consigned works.
// TODO: Implement from source/portals-stubs.jsx (galleries section)
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

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
    .select('*, Oeuvres(OeuvreID, Titre, Année, Hauteur, Largeur, txtImageNameLink)')
    .eq('gallery_contact_id', parseInt(gallery_id))
    .is('ended_at', null)
    .order('since', { ascending: false })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', color: 'var(--tx)', padding: '48px 40px' }}>
      <div className="t-eyebrow" style={{ marginBottom: 12 }}>Galerie</div>
      <div className="serif s-lg" style={{ marginBottom: 32 }}>{contact.NomInstitution}</div>
      <div className="t-label" style={{ marginBottom: 16 }}>Consignations en cours</div>
      {/* TODO: Full gallery portal from source/portals-stubs.jsx */}
      <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
        {consignments?.length ?? 0} œuvres en consignation.
        Implement full gallery portal from <code>source/portals-stubs.jsx</code>.
      </div>
    </div>
  )
}
