import { createClient } from '@/lib/supabase/server'
import { dict } from '@/lib/i18n/dictionary'
import { SaleNewClient, type MobileSaleContact, type MobileSaleGroup, type MobileSaleGroupLink, type MobileSaleStatusRow, type MobileSaleWork } from '@/components/atelier/sale/SaleNewClient'

export const dynamic = 'force-dynamic'

export default async function SaleNewPage() {
  const supabase = await createClient()
  const { data: isTeam } = await supabase.rpc('is_team')

  if (!isTeam) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="panel pad" style={{ maxWidth: 420 }}>
          <div className="t-label" style={{ marginBottom: 8 }}>Atelier</div>
          <h1 className="serif" style={{ fontSize: 24, margin: 0 }}>{dict.fr.sale_mobile_forbidden_title}</h1>
          <p style={{ color: 'var(--tx2)' }}>{dict.fr.sale_mobile_forbidden_body}</p>
        </div>
      </main>
    )
  }

  const [worksRes, contactsRes, statusesRes, techniquesRes, groupsRes] = await Promise.all([
    supabase
      .from('Oeuvres')
      .select('OeuvreID, Titre, Technique, "Année", Prix, PrixFinal, Discount, statusId, "Catalogué", NeedsPhotograph, txtImageNameLink')
      .is('deleted_at', null)
      .order('OeuvreID', { ascending: false })
      .limit(300),
    supabase
      .from('Contact')
      .select('ContactID, NomInstitution, Nom, "Prénom", Ville, Pays')
      .order('NomInstitution', { ascending: true, nullsFirst: false })
      .order('Nom', { ascending: true, nullsFirst: false }),
    supabase.from('OeuvreStatus').select('id, label').order('id'),
    supabase.from('Technique').select('TechniqueID, Technique').order('TechniqueID'),
    supabase.from('working_group').select('id, name, created_at').order('created_at', { ascending: false }).limit(100),
  ])

  ;[
    ['Oeuvres', worksRes],
    ['Contact', contactsRes],
    ['OeuvreStatus', statusesRes],
    ['Technique', techniquesRes],
    ['working_group', groupsRes],
  ].forEach(([label, res]) => {
    if (typeof label === 'string' && res && typeof res === 'object' && 'error' in res && res.error) {
      console.error(`[mobile sale] ${label}:`, res.error.message)
    }
  })

  const groupIds = (groupsRes.data ?? []).map((g) => g.id)
  const groupLinksRes = groupIds.length > 0
    ? await supabase.from('working_group_work').select('group_id, oeuvre_id').in('group_id', groupIds).range(0, 4999)
    : { data: [] as MobileSaleGroupLink[], error: null }

  if (groupLinksRes.error) console.error('[mobile sale] working_group_work:', groupLinksRes.error.message)

  return (
    <SaleNewClient
      contacts={(contactsRes.data ?? []) as MobileSaleContact[]}
      groups={(groupsRes.data ?? []) as MobileSaleGroup[]}
      groupLinks={(groupLinksRes.data ?? []) as MobileSaleGroupLink[]}
      statuses={(statusesRes.data ?? []) as MobileSaleStatusRow[]}
      techniques={(techniquesRes.data ?? []) as { TechniqueID: number; Technique: string | null }[]}
      works={(worksRes.data ?? []) as MobileSaleWork[]}
    />
  )
}
