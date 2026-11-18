import type { AideGuideId } from './types'

/**
 * Which Aide chapter answers « help for this screen » (the « ? » panel on the computer, « Aide pour cet écran »
 * in the phone ☰ menu). Keyed by the first path segment after /atelier (or /hub). A screen with no chapter of
 * its own opens « Premiers pas ». Admin-only screens open the admin guide when the viewer is an admin.
 */
const TEAM: Record<string, string> = {
  overview: 'start',
  inventory: 'works',
  themes: 'works',
  chronologie: 'works',
  map: 'works',
  constellation: 'works',
  slideshows: 'works',
  works: 'works',
  production: 'production',
  pipeline: 'production',
  journal: 'day',
  notes: 'day',
  hub: 'day',
  today: 'day',
  concepts: 'ideas',
  sales: 'orders',
  fiscal: 'orders',
  logistics: 'logistics',
  exhibitions: 'events',
  contacts: 'contacts',
  stock: 'supplies',
  'stock-take': 'supplies',
  reports: 'reports',
  site: 'public',
  portfolio: 'public',
  analytics: 'public',
  vault: 'start',
  'kaizen-ops': 'scope',
  kaizen: 'scope',
}

const ADMIN: Record<string, string> = {
  audit: 'admin-audit',
  ai: 'admin-ai',
  broadcast: 'admin-broadcast',
  fil: 'admin-fil',
  session: 'admin-session',
}

/** `/atelier/inventory` → { guide: 'team', ch: 'works' }. */
export function aideChapterForPath(pathname: string, isAdmin: boolean): { guide: AideGuideId; ch: string } {
  const parts = pathname.split('/').filter(Boolean)
  const seg = parts[0] === 'atelier' || parts[0] === 'hub' ? (parts[1] ?? parts[0]) : (parts[0] ?? '')
  if (isAdmin && ADMIN[seg]) return { guide: 'admin', ch: ADMIN[seg] }
  return { guide: 'team', ch: TEAM[seg] ?? 'start' }
}
