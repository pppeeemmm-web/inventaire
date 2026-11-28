import { NextRequest, NextResponse } from 'next/server'
import { IDEA_STAGES, readIdeaDesk, readIdeaList, readLabBook, type IdeaStage } from '@/lib/ideas/read'

// Idées reads (design docs/design/2026-11-23/IdeasDesign.md). A route and not a Server Action because reads must
// not queue behind saves (BuildingPrinciples commandment 6) — same reason as /api/journal/stream.
// GET ?book=<uuid> → a Laboratoire field's book (its ideas in order, recipes and grids; Laboratoire.md step 4).
// GET ?id=<uuid> → one idea's desk (its moments newest first, history, documents, works, branches, linked ideas).
// GET ?stage=graine|pousse|mure&offset=n → the list by last moment, one page (counts from `idea_list`).
// Signed-in users; each table's RLS applies.
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const book = q.get('book')
  if (book) {
    const res = await readLabBook(book)
    if ('error' in res) return NextResponse.json(res, { status: res.error === 'auth' ? 401 : res.error === 'not_found' ? 404 : 400 })
    return NextResponse.json(res, { headers: noStore })
  }
  const id = q.get('id')
  if (id) {
    const res = await readIdeaDesk(id)
    if ('error' in res) return NextResponse.json(res, { status: res.error === 'auth' ? 401 : res.error === 'not_found' ? 404 : 400 })
    return NextResponse.json(res, { headers: noStore })
  }
  const stageRaw = q.get('stage')
  const stage = stageRaw && IDEA_STAGES.includes(stageRaw as IdeaStage) ? (stageRaw as IdeaStage) : null
  const res = await readIdeaList(stage, Number(q.get('offset')) || 0)
  if ('error' in res) return NextResponse.json(res, { status: res.error === 'auth' ? 401 : 400 })
  return NextResponse.json(res, { headers: noStore })
}
