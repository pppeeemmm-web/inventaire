import { NextRequest, NextResponse } from 'next/server'
import { readJournalScale, readJournalStreamDay, readJournalStreamPage, readWorkMentions, type JournalGrain } from '@/lib/journal/stream'

// The Journal stream's next pages, as the list is scrolled (design 2026-11-22, Step A). A route and not
// a Server Action because reads must not queue behind saves (BuildingPrinciples commandment 6).
// GET ?before=YYYY-MM-DD&days=5 → a page of days with their cards.
// GET ?grain=day|month|year&before=…&limit=… → the « Mois » / « Années » lines (counts only).
// GET ?work=<id> → that work and every day that mentions it (the desk rail).
// GET ?day=YYYY-MM-DD → that one day again (after an action on one of its cards).
// Signed-in users; each table's RLS applies (a team member reads what they may read).
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const before = q.get('before') || null
  const oneDay = q.get('day')
  if (oneDay) {
    const res = await readJournalStreamDay(oneDay)
    if ('error' in res) return NextResponse.json(res, { status: res.error === 'auth' ? 401 : 400 })
    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } })
  }
  const work = q.get('work')
  if (work) {
    const res = await readWorkMentions(Number(work))
    if ('error' in res) return NextResponse.json(res, { status: res.error === 'auth' ? 401 : 400 })
    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } })
  }
  const grain = q.get('grain') as JournalGrain | null
  if (grain) {
    if (grain !== 'day' && grain !== 'month' && grain !== 'year') return NextResponse.json({ error: 'grain' }, { status: 400 })
    const rows = await readJournalScale(grain, before, Number(q.get('limit')) || 62)
    if ('error' in rows) return NextResponse.json(rows, { status: rows.error === 'auth' ? 401 : 400 })
    return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const page = await readJournalStreamPage(before, Number(q.get('days')) || 5)
  if ('error' in page) return NextResponse.json(page, { status: page.error === 'auth' ? 401 : 400 })
  return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } })
}
