/**
 * Sun and moon position for the visitor's own sky.
 *
 * **No permission prompt, no network, no server work.** Latitude/longitude come
 * from `Intl.DateTimeFormat().resolvedOptions().timeZone` (an IANA zone such as
 * `Europe/Paris`) via a representative-coordinate table, falling back to a
 * region guess and then to the UTC offset for longitude. A few hundred km of
 * error moves sunset by minutes — below the resolution of the 60s tick.
 *
 * Deliberately NOT `navigator.geolocation`: that fires a permission dialog on
 * first paint of the public landing page. Deliberately NOT Vercel's
 * `x-vercel-ip-*` headers: reading a request header would force `app/page.tsx`
 * out of static rendering.
 *
 * Algorithms: low-precision NOAA solar position and a truncated Meeus lunar
 * series. Accurate to a fraction of a degree, which is far more than a
 * background gradient needs.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type GeoGuess = {
  latitude: number
  longitude: number
  /** How the coordinates were obtained — useful when debugging a wrong sky. */
  source: 'zone' | 'region' | 'offset'
}

export type SkyPosition = {
  /** Degrees above the horizon; negative when below. */
  elevationDeg: number
  /** Degrees clockwise from true north. */
  azimuthDeg: number
}

export type MoonState = SkyPosition & {
  /** Lit fraction of the disc, 0 (new) … 1 (full). */
  illuminatedFraction: number
}

// ── Angle helpers ──────────────────────────────────────────────────────────

const DEG = Math.PI / 180
const sin = (deg: number) => Math.sin(deg * DEG)
const cos = (deg: number) => Math.cos(deg * DEG)

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function norm180(deg: number): number {
  return norm360(deg + 180) - 180
}

/** Days since J2000.0 (2000-01-01 12:00 UTC), fractional. */
function daysSinceJ2000(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545.0
}

/** Greenwich mean sidereal time, degrees. */
function gmstDeg(n: number): number {
  return norm360(280.46061837 + 360.98564736629 * n)
}

/** Mean obliquity of the ecliptic, degrees. */
function obliquityDeg(n: number): number {
  return 23.439291 - 3.56e-7 * n
}

/**
 * Ecliptic (lambda, beta) → horizontal (elevation, azimuth) for an observer.
 * Shared by the sun (beta = 0) and the moon.
 */
function eclipticToHorizontal(
  lambdaDeg: number,
  betaDeg: number,
  n: number,
  latitude: number,
  longitude: number,
): SkyPosition {
  const eps = obliquityDeg(n)

  // → equatorial
  const raDeg = norm360(
    Math.atan2(
      sin(lambdaDeg) * cos(eps) - Math.tan(betaDeg * DEG) * sin(eps),
      cos(lambdaDeg),
    ) / DEG,
  )
  const decDeg =
    Math.asin(sin(betaDeg) * cos(eps) + cos(betaDeg) * sin(eps) * sin(lambdaDeg)) / DEG

  // → horizontal
  const hourAngle = norm180(gmstDeg(n) + longitude - raDeg)
  const elevationDeg =
    Math.asin(
      sin(latitude) * sin(decDeg) + cos(latitude) * cos(decDeg) * cos(hourAngle),
    ) / DEG
  const azimuthDeg = norm360(
    Math.atan2(
      -sin(hourAngle),
      Math.tan(decDeg * DEG) * cos(latitude) - sin(latitude) * cos(hourAngle),
    ) / DEG,
  )

  return { elevationDeg, azimuthDeg }
}

// ── Sun ────────────────────────────────────────────────────────────────────

/** Apparent ecliptic longitude of the sun, degrees. */
function sunLongitudeDeg(n: number): number {
  const meanLongitude = norm360(280.460 + 0.9856474 * n)
  const meanAnomaly = norm360(357.528 + 0.9856003 * n)
  return norm360(meanLongitude + 1.915 * sin(meanAnomaly) + 0.020 * sin(2 * meanAnomaly))
}

export function sunPosition(date: Date, latitude: number, longitude: number): SkyPosition {
  const n = daysSinceJ2000(date)
  return eclipticToHorizontal(sunLongitudeDeg(n), 0, n, latitude, longitude)
}

// ── Moon ───────────────────────────────────────────────────────────────────

export function moonState(date: Date, latitude: number, longitude: number): MoonState {
  const n = daysSinceJ2000(date)

  // Truncated Meeus — the dominant periodic terms only.
  const meanLongitude = norm360(218.316 + 13.176396 * n)
  const meanAnomaly = norm360(134.963 + 13.064993 * n)
  const argOfLatitude = norm360(93.272 + 13.229350 * n)

  const lambda = norm360(meanLongitude + 6.289 * sin(meanAnomaly))
  const beta = 5.128 * sin(argOfLatitude)

  const position = eclipticToHorizontal(lambda, beta, n, latitude, longitude)

  // Illuminated fraction from sun/moon elongation.
  const elongation = norm360(lambda - sunLongitudeDeg(n))
  const illuminatedFraction = (1 - cos(elongation)) / 2

  return { ...position, illuminatedFraction }
}

// ── Timezone → approximate coordinates ─────────────────────────────────────

/**
 * Representative coordinates per IANA zone. One point per zone is plenty: the
 * sky only needs latitude to within a few degrees, and longitude is corrected
 * by the UTC offset anyway for zones that are missing here.
 */
const ZONE_COORDS: Record<string, [number, number]> = {
  'Africa/Abidjan': [5.3, -4.0],       'Africa/Algiers': [36.8, 3.1],
  'Africa/Cairo': [30.0, 31.2],        'Africa/Casablanca': [33.6, -7.6],
  'Africa/Johannesburg': [-26.2, 28.0],'Africa/Lagos': [6.5, 3.4],
  'Africa/Nairobi': [-1.3, 36.8],      'Africa/Tunis': [36.8, 10.2],
  'America/Anchorage': [61.2, -149.9], 'America/Argentina/Buenos_Aires': [-34.6, -58.4],
  'America/Bogota': [4.7, -74.1],      'America/Chicago': [41.9, -87.6],
  'America/Denver': [39.7, -105.0],    'America/Halifax': [44.6, -63.6],
  'America/Lima': [-12.0, -77.0],      'America/Los_Angeles': [34.1, -118.2],
  'America/Mexico_City': [19.4, -99.1],'America/New_York': [40.7, -74.0],
  'America/Phoenix': [33.4, -112.1],   'America/Santiago': [-33.4, -70.7],
  'America/Sao_Paulo': [-23.6, -46.6], 'America/Toronto': [43.7, -79.4],
  'America/Vancouver': [49.3, -123.1],
  'Asia/Bangkok': [13.8, 100.5],       'Asia/Dubai': [25.2, 55.3],
  'Asia/Hong_Kong': [22.3, 114.2],     'Asia/Jakarta': [-6.2, 106.8],
  'Asia/Jerusalem': [31.8, 35.2],      'Asia/Kolkata': [22.6, 88.4],
  'Asia/Karachi': [24.9, 67.0],        'Asia/Manila': [14.6, 121.0],
  'Asia/Riyadh': [24.7, 46.7],         'Asia/Seoul': [37.6, 127.0],
  'Asia/Shanghai': [31.2, 121.5],      'Asia/Singapore': [1.4, 103.8],
  'Asia/Taipei': [25.0, 121.6],        'Asia/Tehran': [35.7, 51.4],
  'Asia/Tokyo': [35.7, 139.7],         'Asia/Istanbul': [41.0, 29.0],
  'Atlantic/Reykjavik': [64.1, -21.9],
  'Australia/Adelaide': [-34.9, 138.6],'Australia/Brisbane': [-27.5, 153.0],
  'Australia/Melbourne': [-37.8, 145.0],'Australia/Perth': [-31.9, 115.9],
  'Australia/Sydney': [-33.9, 151.2],
  'Europe/Amsterdam': [52.4, 4.9],     'Europe/Athens': [38.0, 23.7],
  'Europe/Barcelona': [41.4, 2.2],     'Europe/Berlin': [52.5, 13.4],
  'Europe/Brussels': [50.8, 4.4],      'Europe/Bucharest': [44.4, 26.1],
  'Europe/Budapest': [47.5, 19.0],     'Europe/Copenhagen': [55.7, 12.6],
  'Europe/Dublin': [53.3, -6.3],       'Europe/Helsinki': [60.2, 24.9],
  'Europe/Kyiv': [50.5, 30.5],         'Europe/Lisbon': [38.7, -9.1],
  'Europe/London': [51.5, -0.1],       'Europe/Madrid': [40.4, -3.7],
  'Europe/Moscow': [55.8, 37.6],       'Europe/Oslo': [59.9, 10.8],
  'Europe/Paris': [48.9, 2.4],         'Europe/Prague': [50.1, 14.4],
  'Europe/Rome': [41.9, 12.5],         'Europe/Stockholm': [59.3, 18.1],
  'Europe/Vienna': [48.2, 16.4],       'Europe/Warsaw': [52.2, 21.0],
  'Europe/Zurich': [47.4, 8.5],
  'Pacific/Auckland': [-36.9, 174.8],  'Pacific/Honolulu': [21.3, -157.9],
}

/** Latitude guess by continent prefix — keeps the hemisphere (and so the season) right. */
const REGION_LATITUDE: Record<string, number> = {
  Africa: 2, America: 35, Antarctica: -70, Asia: 30, Atlantic: 40,
  Australia: -28, Europe: 50, Indian: -10, Pacific: -15,
}

const FALLBACK_LATITUDE = 45

/**
 * Best-effort coordinates for a visitor, from their IANA timezone plus the
 * device UTC offset. Pure — pass `timeZone`/`offsetMinutes` explicitly so this
 * stays testable and SSR-safe; use `resolveViewerGeo()` in the browser.
 *
 * @param timeZone      IANA zone name, or null when unavailable.
 * @param offsetMinutes Minutes **east** of UTC (i.e. `-date.getTimezoneOffset()`).
 */
export function geoFromTimeZone(timeZone: string | null, offsetMinutes: number): GeoGuess {
  const exact = timeZone ? ZONE_COORDS[timeZone] : undefined
  if (exact) return { latitude: exact[0], longitude: exact[1], source: 'zone' }

  // 1440 minutes / 360° = 4 minutes per degree of longitude.
  const longitude = Math.max(-180, Math.min(180, offsetMinutes / 4))

  const region = timeZone?.split('/')[0] ?? ''
  if (region in REGION_LATITUDE) {
    return { latitude: REGION_LATITUDE[region], longitude, source: 'region' }
  }
  return { latitude: FALLBACK_LATITUDE, longitude, source: 'offset' }
}

/** Browser-side convenience wrapper. Returns the fallback guess during SSR. */
export function resolveViewerGeo(now = new Date()): GeoGuess {
  if (typeof Intl === 'undefined') {
    return { latitude: FALLBACK_LATITUDE, longitude: 0, source: 'offset' }
  }
  let zone: string | null = null
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || null
  // A locked-down browser can throw here; the offset fallback is the point.
  // eslint-disable-next-line pem-i18n/no-silent-catch
  } catch {
    zone = null
  }
  return geoFromTimeZone(zone, -now.getTimezoneOffset())
}
