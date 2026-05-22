import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { dict } from '@/lib/i18n/dictionary'
import { ShareTriageClient } from '@/components/atelier/ShareTriageClient'
import { listShareInboxForUser } from '@/app/atelier/share-inbox-actions'
import { listRecentWorksForShareAttach } from '@/app/atelier/share-triage/actions'
import type { ShareInboxRow } from '@/lib/types/database'

type ShareTriageDetailRow = Pick<ShareInboxRow, 'id' | 'created_at' | 'expires_at' | 'payload'>

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: dict.fr.share_triage_meta_title,
    description: dict.fr.share_triage_meta_description,
    robots: { index: false, follow: false },
  }
}

export default async function ShareTriagePage({
  searchParams,
}: {
  searchParams: Promise<{ inbox?: string; err?: string }>
}) {
  const sp = await searchParams
  const err = sp.err ?? null
  const inboxQ = sp.inbox?.trim() || null

  const sb = await createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent('/atelier/share-triage')}`)
  }

  let detail: ShareTriageDetailRow | null = null

  if (inboxQ) {
    const { data } = await (sb.from('share_inbox') as any)
      .select('id, created_at, expires_at, payload')
      .eq('id', inboxQ)
      .eq('user_id', user.id)
      .maybeSingle()
    detail = (data as ShareTriageDetailRow | null) ?? null
  }

  const recent = await listShareInboxForUser()
  const recentWorksRes = await listRecentWorksForShareAttach(5)
  const recentWorks = 'works' in recentWorksRes ? recentWorksRes.works : []

  return (
    <ShareTriageClient
      err={err}
      requestedInboxId={inboxQ}
      detail={detail}
      recent={recent}
      recentWorks={recentWorks}
    />
  )
}
