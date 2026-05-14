import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Open-Meteo current slice; proxied for field sessions (no API key). */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const latRaw = req.nextUrl.searchParams.get('latitude')
  const lonRaw = req.nextUrl.searchParams.get('longitude')
  const lat = latRaw != null ? Number.parseFloat(latRaw) : NaN
  const lon = lonRaw != null ? Number.parseFloat(lonRaw) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: 'bad_coords' }, { status: 400 })
  }

  const om = new URL('https://api.open-meteo.com/v1/forecast')
  om.searchParams.set('latitude', String(lat))
  om.searchParams.set('longitude', String(lon))
  om.searchParams.set(
    'current',
    'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
  )
  om.searchParams.set('wind_speed_unit', 'kmh')

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 10_000)
  let res: Response
  try {
    res = await fetch(om.toString(), { signal: ac.signal })
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) return NextResponse.json({ error: 'upstream' }, { status: 502 })

  const body = (await res.json()) as {
    current?: Record<string, unknown>
  }
  const cur = body.current
  if (!cur || typeof cur !== 'object') {
    return NextResponse.json({ error: 'schema' }, { status: 502 })
  }

  const temperature_c = typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null
  const weather_code = typeof cur.weather_code === 'number' ? cur.weather_code : null
  const wind_kmh = typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : null
  const relative_humidity_pct =
    typeof cur.relative_humidity_2m === 'number' ? cur.relative_humidity_2m : null

  return NextResponse.json({
    temperature_c,
    weather_code,
    wind_kmh,
    relative_humidity_pct,
  })
}
