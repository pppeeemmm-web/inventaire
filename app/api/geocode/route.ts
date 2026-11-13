import { NextRequest, NextResponse } from 'next/server'
import { lookupGeocode } from '@/lib/geocode-nominatim'
import { createClient } from '@/lib/supabase/server'

/** Signed-in only (2026-11-13): the only caller is the Atelier map; an open route would let
 *  anyone relay lookups to Nominatim through this server. */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const city = req.nextUrl.searchParams.get('city') ?? ''
  const country = req.nextUrl.searchParams.get('country') ?? ''
  const coords = await lookupGeocode(city, country)
  if (!coords) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(coords)
}
