// Private client link — /c/:token
// Token validation MUST use the service-role key server-side.
// Never use the anon key here.
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PRIVATE_LINK_SELECTION_CSS } from '@/lib/private-link-layout-css'
import { WorkThumb } from '@/components/atelier/WorkThumb'
import { dict } from '@/lib/i18n/dictionary'
import type { Lang } from '@/lib/i18n/dictionary'

export default async function PrivateLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { token } = await params
  const sp = await searchParams
  const lang: Lang = sp['lang'] === 'en' ? 'en' : 'fr'
  const d = dict[lang]
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
    <>
      <style dangerouslySetInnerHTML={{ __html: PRIVATE_LINK_SELECTION_CSS }} />
      <div className="pl-root">
        <div className="pl-header">
          <div className="t-eyebrow" style={{ marginBottom: 12 }}>{d.pl_private_selection} · Pierre Emmanuel Moulin</div>
          <div className="serif s-lg">{(link as Record<string, unknown>)['working_group'] ? ((link as Record<string, unknown>)['working_group'] as Record<string, unknown>)['name'] as string : d.pl_private_selection}</div>
          {link.recipient_name && (
            <div className="t-mono-sm" style={{ marginTop: 8 }}>{d.pl_for} {link.recipient_name}</div>
          )}
        </div>

        <div className="pl-works">
          {oeuvres.map((o) => (
            <div key={o['OeuvreID'] as number} className="pl-row">
              <div className="thumb pl-thumb">
                {o['txtImageNameLink']
                  ? <WorkThumb file={o['txtImageNameLink'] as string} size={800} alt={o['Titre'] as string ?? ''} />
                  : <div className="ph" />}
              </div>
              <div className="pl-meta">
                <div className="serif s-md" style={{ marginBottom: 16 }}>{o['Titre'] as string ?? '—'}</div>
                <div className="t-mono-sm" style={{ marginBottom: 8 }}>{String(o['Année'] ?? '').slice(0, 4)}</div>
                {(o['Hauteur'] || o['Largeur']) && (
                  <div className="t-mono-sm">{o['Hauteur'] as string} × {o['Largeur'] as string} cm</div>
                )}
                <div className="t-mono" style={{ marginTop: 24, color: 'var(--tx3)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  {d.pl_price_on_request}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pl-footer">
          <div>Pierre Emmanuel Moulin · Atelier</div>
          <div style={{ marginTop: 4 }}>{d.pl_no_share}</div>
        </div>
      </div>
    </>
  )
}
