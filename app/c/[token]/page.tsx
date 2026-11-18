// Collector kit — /c/<token> (TODO 11b, Pem build GO 2026-11-18).
// Token validation MUST use the service-role key server-side (kit-data.ts). Never the anon key here.
// Unknown, revoked and expired links all get the same neutral page: no name, no works, a way back to the atelier.
// Opens are counted on the server (at most once per 30 min; not for link-preview robots, prefetches or a signed-in
// team member previewing it); no cookie is set or read for the collector.
import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/server'
import { PRIVATE_LINK_SELECTION_CSS } from '@/lib/private-link-layout-css'
import { flattenMessages } from '@/lib/i18n/message-core'
import { collectorKitPageMessages } from '@/lib/i18n/messages/collector-kit.messages'
import { isPreviewOrPrefetch } from '@/lib/collector-kit'
import { CollectorKitView } from '@/components/public/CollectorKitView'
import { logWarn } from '@/lib/error-reporter/server'
import { isTeamViewer, kitLang, readKitLink, readKitWorks } from './kit-data'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { token } = await params
  const sp = await searchParams
  const link = await readKitLink(token)
  const lang = link && link !== 'inactive' ? kitLang(link, sp['lang']) : (sp['lang'] === 'en' ? 'en' : 'fr')
  // The title only: a link preview must not show the collector's name.
  return {
    title: flattenMessages(collectorKitPageMessages, lang).ckp_title,
    robots: { index: false, follow: false, nocache: true },
    referrer: 'no-referrer',
  }
}

export default async function CollectorKitPage({ params, searchParams }: PageProps) {
  const { token } = await params
  const sp = await searchParams
  const link = await readKitLink(token)
  const lang = link && link !== 'inactive' ? kitLang(link, sp['lang']) : (sp['lang'] === 'en' ? 'en' : 'fr')
  const copy = flattenMessages(collectorKitPageMessages, lang)

  if (!link || link === 'inactive') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: PRIVATE_LINK_SELECTION_CSS }} />
        <main className="ck-root" style={{ paddingBottom: 0 }}>
          <div className="ck-center">
            <div className="ck-eyebrow">{copy.ckp_eyebrow}</div>
            <h1 className="ck-h1">{copy.ckp_inactive_title}</h1>
            <p className="ck-line" style={{ maxWidth: 420 }}>{copy.ckp_inactive_body}</p>
            <Link className="ck-btn" href="/enquiry">{copy.ckp_write}</Link>
          </div>
        </main>
      </>
    )
  }

  const works = await readKitWorks(link.token)

  if (!isPreviewOrPrefetch(await headers()) && !(await isTeamViewer())) {
    const { error } = await createServiceClient().rpc('private_link_count_open', { p_token: link.token })
    if (error) await logWarn('Collector kit open not counted', error, { source: 'c.page' })
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRIVATE_LINK_SELECTION_CSS }} />
      <CollectorKitView
        token={link.token}
        lang={lang}
        copy={copy}
        name={link.recipient_name}
        message={link.message}
        expiresAt={link.expires_at}
        works={works}
        hasPdf={Boolean(link.pdf_key)}
      />
    </>
  )
}
