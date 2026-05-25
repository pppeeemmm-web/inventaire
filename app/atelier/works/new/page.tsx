// /atelier/works/new — create a new work
import { createClient } from '@/lib/supabase/server'
import { WorkForm } from '@/components/atelier/WorkForm'
import { saveWork } from '@/app/atelier/works/actions'
import { getShareInboxWorkPrefill } from '@/app/atelier/share-triage/actions'
import type { ShareInboxWorkPrefill } from '@/app/atelier/share-triage/actions'

export default async function NewWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ shareInbox?: string }>
}) {
  const sp = await searchParams
  const shareInboxId = sp.shareInbox?.trim() || null

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
    supabase.from('theme').select('id, name').order('name', { ascending: true }),
    supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom", Role, Ville, Pays').order('NomInstitution', { ascending: true }),
    supabase.from('contact_addresses').select('*'),
    supabase.from('working_group').select('*').order('name', { ascending: true }),
  ])

  const catalogThemes = (themes ?? []).map((r) => ({
    id: (r as { id: number }).id,
    name: (r as { name: string }).name,
  }))

  let shareInboxPrefill: ShareInboxWorkPrefill | null = null
  if (shareInboxId) {
    const pre = await getShareInboxWorkPrefill(shareInboxId)
    if ('prefill' in pre) shareInboxPrefill = pre.prefill
  }

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
      shareInboxPrefill={shareInboxPrefill}
    />
  )
}
