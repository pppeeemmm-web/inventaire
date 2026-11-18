import { NextResponse, type NextRequest } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createServiceClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'
import { isPreviewOrPrefetch } from '@/lib/collector-kit'
import { isTeamViewer, readKitLink } from '../kit-data'

// The collector kit's PDF, served THROUGH the link (TODO 11b): revoking or expiring the kit stops the PDF too.
// Why a route and not a Server Action (CLAUDE.md asks): a binary download behind a token check, opened by a
// plain link on the collector's phone, cannot be a Server Action. The file lives in the private Vault bucket.
// Counts a download (service-role function) unless the request is a HEAD, a prefetch, a link-preview robot or a
// signed-in team member.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = process.env.R2_VAULT_BUCKET ?? 'vault'

function r2() {
  const accountId = process.env.R2_ACCOUNT_ID ?? ''
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  })
}

function fileName(name: string | null, day: string): string {
  const safe = (name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `the-pem-workshop_${safe || 'selection'}_${day}.pdf`
}

async function serve(req: NextRequest, token: string, count: boolean): Promise<Response> {
  const link = await readKitLink(token)
  // Same answer for unknown, revoked and expired: the page explains; the PDF just stops.
  if (!link || link === 'inactive' || !link.pdf_key) {
    // Relative Location: behind the dev server `req.url` can carry the bind address (0.0.0.0).
    return new NextResponse(null, { status: 303, headers: { Location: `/c/${encodeURIComponent(token)}` } })
  }
  try {
    const out = await r2().send(new GetObjectCommand({ Bucket: BUCKET, Key: link.pdf_key }))
    if (!out.Body) return new NextResponse(null, { status: 404 })
    if (count && !isPreviewOrPrefetch(req.headers) && !(await isTeamViewer())) {
      await createServiceClient().rpc('private_link_count_pdf', { p_token: link.token })
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName(link.recipient_name, new Date().toISOString().slice(0, 10))}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    }
    if (out.ContentLength != null) headers['Content-Length'] = String(out.ContentLength)
    if (!count) return new NextResponse(null, { headers })
    return new NextResponse(out.Body.transformToWebStream(), { headers })
  } catch (e) {
    await logError('Collector kit PDF not read from the Vault', e, { source: 'c.pdf', metadata: { token: link.token } })
    return new NextResponse(null, { status: 502 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return serve(req, token, true)
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return serve(req, token, false)
}
