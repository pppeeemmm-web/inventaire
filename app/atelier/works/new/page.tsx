// /atelier/works/new — create a new work
import { ADDRESS_LINE_COLS } from '@/components/atelier/contact-editor-types'
import { createClient } from '@/lib/supabase/server'
import { WorkForm } from '@/components/atelier/WorkForm'
import { NewWorkPageShell } from '@/components/atelier/NewWorkPageShell'
import { saveWork } from '@/app/atelier/works/actions'
import { getShareInboxWorkPrefill } from '@/app/atelier/share-triage/actions'
import type { ShareInboxWorkPrefill } from '@/app/atelier/share-triage/actions'

export default async function NewWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ shareInbox?: string; record?: string }>
}) {
  const sp = await searchParams
  const shareInboxId = sp.shareInbox?.trim() || null
  // R2 Œuvre sheet: `?record=reprise` opens the phone recording screen on « Reprise ».
  const recordMode = sp.record === 'reprise' ? 'reprise' : 'new'

  const supabase = await createClient()
  // « Privé » contacts are not offered to the team in pickers (Pem 2026-11-19): a new work has no tie to keep.
  const { data: isAdmin } = await supabase.rpc('is_admin')
  const contactsQ = supabase.from('Contact').select('ContactID, NomInstitution, Nom, "Prénom", Role, Ville, Pays, archived_at').order('NomInstitution', { ascending: true })

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
    isAdmin ? contactsQ : contactsQ.not('is_private', 'is', true),
    supabase.from('contact_place_lines').select(ADDRESS_LINE_COLS),
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
    <NewWorkPageShell>
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
        recordMode={recordMode}
      />
    </NewWorkPageShell>
  )
}
