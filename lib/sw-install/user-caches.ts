// Caches that can hold one signed-in user's pages or data (R2 speed, PhoneToday.notes.md rule 5).
// Shared by the service worker (app/sw.ts) and the page (sign-out): imported with a relative path
// there, so no `@/` alias and no browser-only code here.

/** Prefix of the « Aujourd'hui » copy; the build revision follows (`pem-today-<rev>`). */
export const TODAY_CACHE_PREFIX = 'pem-today-'

/**
 * Our page cache + Serwist's default page / data caches (`@serwist/next/worker` defaultCache, and the
 * `start-url` / `pages` caches its page-side helper fills). Images, fonts and JS files stay.
 */
export const USER_CACHE_NAMES: readonly string[] = [
  'pem-shell-pages',
  'pages',
  'pages-rsc',
  'pages-rsc-prefetch',
  'start-url',
  'apis',
  'next-data',
  'others',
  'cross-origin',
]

export function isUserCache(name: string): boolean {
  return name.startsWith(TODAY_CACHE_PREFIX) || USER_CACHE_NAMES.includes(name)
}

/** Deletes every user cache. Safe where `caches` is missing (old browser, insecure origin): does nothing. */
export async function clearUserCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  const names = await caches.keys()
  await Promise.all(names.filter(isUserCache).map((n) => caches.delete(n)))
}
