import { NextResponse, type NextRequest } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@/lib/supabase/server'
import { logError } from '@/lib/error-reporter/server'

// « Partager » an order's paper (R7, Pem 2026-11-18: « Send the file itself, no link »).
// Why a route and not a Server Action: the phone needs the file's bytes to hand to the share sheet;
// the Vault bucket has no CORS (the browser cannot read a signed R2 URL), and a Server Action answer
// would carry the file base64 in JSON (a 4 MB signed scan would pass the platform's 4.5 MB cap).
// Team session only; only documents linked to an order; nothing public, no storage rule changed.

export const runtime = 'nodejs'

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

/** RFC 6266 filename for names like « V-2026-001_bon-de-commande.pdf » (ASCII fallback + UTF-8). */
function disposition(name: string): string {
  const ascii = name.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'document.pdf'
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: isTeam } = await supabase.rpc('is_team')
  if (!isTeam) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const docId = req.nextUrl.searchParams.get('doc') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return NextResponse.json({ error: 'Bad document id' }, { status: 400 })
  const { data: doc, error } = await supabase
    .from('document').select('storage_path, mime_type, work_order_id').eq('id', docId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!doc?.storage_path || !doc.work_order_id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const out = await r2().send(new GetObjectCommand({ Bucket: BUCKET, Key: doc.storage_path }))
    if (!out.Body) return NextResponse.json({ error: 'Empty file' }, { status: 404 })
    const name = doc.storage_path.split('/').pop() || 'document.pdf'
    const headers: Record<string, string> = {
      'Content-Type': doc.mime_type || out.ContentType || 'application/octet-stream',
      'Content-Disposition': disposition(name),
      'Cache-Control': 'private, no-store',
    }
    if (out.ContentLength != null) headers['Content-Length'] = String(out.ContentLength)
    return new NextResponse(out.Body.transformToWebStream(), { headers })
  } catch (e) {
    await logError('Order paper not read from the Vault', e, { source: 'api.export.order-paper', metadata: { docId } })
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
