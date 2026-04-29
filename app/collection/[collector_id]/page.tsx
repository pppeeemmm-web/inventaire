// Collector portal — /collection/:collector_id
// Auth enforced by middleware. Collectors see only their own works.
// TODO: Implement from source/portals-stubs.jsx (clients section)
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', color: 'var(--tx)', padding: '48px 40px' }}>
      <div className="t-eyebrow" style={{ marginBottom: 12 }}>Collection privée</div>
      <div className="serif s-lg" style={{ marginBottom: 32 }}>
        {contact.Prénom} {contact.Nom}
      </div>
      <div className="t-mono-sm" style={{ color: 'var(--tx3)' }}>
        Implement full collector portal from <code>source/portals-stubs.jsx</code>.
      </div>
    </div>
  )
}
