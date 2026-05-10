import { NextRequest, NextResponse } from 'next/server'
import { lookupGeocode } from '@/lib/geocode-nominatim'

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city') ?? ''
  const country = req.nextUrl.searchParams.get('country') ?? ''
  const coords = await lookupGeocode(city, country)
  if (!coords) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(coords)
}
