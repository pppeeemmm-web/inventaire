// The downloadable guide (Pem GO 2026-11-18): GET /atelier/aide/guide.pdf?g=team|admin&lang=fr|en → a PDF built
// on demand from the Aide's chapters (`lib/aide/pdf.ts`). A route handler because the answer is a file, not a page
// (SITE_MAP §4). Team guide: team members; admin guide: admins only — checked here, not only in the UI.
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aideChapters } from '@/lib/aide/guides'
import { aideGuideFileName, buildAideGuidePdf } from '@/lib/aide/pdf'
import { getMetadataBase } from '@/lib/seo/site-url'
import { parisToday } from '@/lib/sales/sale-money'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guide = req.nextUrl.searchParams.get('g') === 'admin' ? 'admin' : 'team'
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'fr'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Sign in first.', { status: 401 })
  const { data: allowed } = await supabase.rpc(guide === 'admin' ? 'is_admin' : 'is_team')
  if (allowed !== true) return new NextResponse('Not allowed.', { status: 403 })

  const chapters = aideChapters(guide, lang)
  if (chapters.length === 0) return new NextResponse('No chapter yet.', { status: 404 })

  const today = parisToday()
  const pdf = await buildAideGuidePdf({ guide, lang, chapters, siteOrigin: getMetadataBase().origin, today })
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${aideGuideFileName(guide, lang, today)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
