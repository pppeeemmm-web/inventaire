// Private client link — /c/:token
// Token validation MUST use the service-role key server-side.
// Never use the anon key here.
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { thumbUrl } from '@/lib/data'

export default async function PrivateLinkPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createServiceClient()

  // Validate token
  const { data: link } = await supabase
    .from('private_link')
    .select('*, working_group(name)')
    .eq('token', token)
    .single()

  if (!link) return notFound()
  if (link.expires_at && new Date(link.expires_at) < new Date()) return notFound()

  // Log view
  await supabase
    .from('private_link')
    .update({ viewed_at: new Date().toISOString(), view_count: link.view_count + 1 })
    .eq('token', token)

  // Fetch works in the linked group
  const { data: groupWorks } = link.group_id
    ? await supabase
        .from('working_group_work')
        .select('position, Oeuvres(OeuvreID, Titre, Technique, Support, Année, Hauteur, Largeur, Profondeur, txtImageNameLink, Prix)')
        .eq('group_id', link.group_id)
        .order('position')
    : { data: [] }

  const oeuvres = (groupWorks ?? []).map((r: Record<string, unknown>) => r['Oeuvres'] as Record<string, unknown>).filter(Boolean)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0)', color: 'var(--tx)', padding: '48px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 48, borderBottom: '1px solid var(--bd)', paddingBottom: 24 }}>
        <div className="t-eyebrow" style={{ marginBottom: 12 }}>Sélection privée · Pierre Emmanuel Moulin</div>
        <div className="serif s-lg">{(link as Record<string, unknown>)['working_group'] ? ((link as Record<string, unknown>)['working_group'] as Record<string, unknown>)['name'] as string : 'Sélection'}</div>
        {link.recipient_name && (
          <div className="t-mono-sm" style={{ marginTop: 8 }}>Pour {link.recipient_name}</div>
        )}
      </div>

      {/* Works */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        {oeuvres.map((o) => (
          <div key={o['OeuvreID'] as number} style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 40, alignItems: 'start' }}>
            <div className="thumb" style={{ height: 420 }}>
              {o['txtImageNameLink']
                ? <img src={thumbUrl(o['txtImageNameLink'] as string, 750) ?? ''} alt={o['Titre'] as string ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div className="ph" />}
            </div>
            <div style={{ paddingTop: 8 }}>
              <div className="serif s-md" style={{ marginBottom: 16 }}>{o['Titre'] as string ?? '—'}</div>
              <div className="t-mono-sm" style={{ marginBottom: 8 }}>{String(o['Année'] ?? '').slice(0, 4)}</div>
              {(o['Hauteur'] || o['Largeur']) && (
                <div className="t-mono-sm">{o['Hauteur'] as string} × {o['Largeur'] as string} cm</div>
              )}
              <div className="t-mono" style={{ marginTop: 24, color: 'var(--tx3)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Prix sur demande
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 80, borderTop: '1px solid var(--bd)', paddingTop: 24, color: 'var(--tx3)', fontSize: 10, letterSpacing: 1 }}>
        <div>Pierre Emmanuel Moulin · Atelier</div>
        <div style={{ marginTop: 4 }}>Lien privé · ne pas partager</div>
      </div>
    </div>
  )
}
