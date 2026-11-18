import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist'
import { clearUserCaches, TODAY_CACHE_PREFIX } from '../lib/sw-install/user-caches'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Read once: the build injects the manifest at this single place.
const precacheEntries = self.__SW_MANIFEST

/**
 * « Aujourd'hui » at once (R2 speed, PhoneToday.notes.md rule 5). The last copy of `/hub` and `/hub/today`
 * (today only: no `?day=`) is shown straight from this cache, while the request the browser already sends
 * alongside (navigation preload) brings the fresh page and replaces the copy. The page then sees it was
 * rendered a while ago, says « mis à jour il y a N min » and refreshes itself (TodayCachedNote).
 * - One user only: every page cache is wiped on sign-out (AccountActions), each time /login opens (below)
 *   and as soon as the server answers this page with a redirect (signed out).
 * - One build only: the cache name carries the build revision, so a copy never points at JS files that a
 *   later deploy removed; older copies are dropped when this worker activates.
 * - Documents (GET navigations) only: Server Actions (POST) and RSC requests never come here.
 */
const BUILD =
  (precacheEntries ?? []).find((e): e is PrecacheEntry => typeof e !== 'string' && e.url === '/~offline')?.revision ?? 'dev'
const TODAY_CACHE = `${TODAY_CACHE_PREFIX}${BUILD}`
const TODAY_PATHS = new Set(['/hub', '/hub/today'])
/** A copy older than this is not shown: the page waits for the network as before. */
const TODAY_MAX_AGE_MS = 12 * 60 * 60 * 1000
const CACHED_AT = 'x-pem-cached-at'

async function storeToday(key: string, res: Response): Promise<void> {
  const type = res.headers.get('content-type') ?? ''
  if (res.ok && res.type === 'basic' && !res.redirected && type.includes('text/html')) {
    const headers = new Headers(res.headers)
    headers.set(CACHED_AT, String(Date.now()))
    const copy = new Response(await res.blob(), { status: 200, headers })
    await (await caches.open(TODAY_CACHE)).put(key, copy)
  } else if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400) || res.status === 401 || res.status === 403) {
    // Signed out (the server sends /login): nothing of the last user stays.
    await clearUserCaches()
  }
}

async function todayHandler({ request, event }: { request: Request; event: ExtendableEvent }): Promise<Response> {
  const url = new URL(request.url)
  const key = `${url.origin}${url.pathname}`
  const preload = (event as FetchEvent).preloadResponse as Promise<Response | undefined> | undefined
  const network = Promise.resolve(preload)
    .then((r) => r ?? fetch(request))
  const cached = await (await caches.open(TODAY_CACHE)).match(key, { ignoreVary: true })
  const age = cached ? Date.now() - Number(cached.headers.get(CACHED_AT) ?? 0) : Number.POSITIVE_INFINITY
  if (cached && age < TODAY_MAX_AGE_MS) {
    event.waitUntil(network.then((res) => storeToday(key, res)).catch(() => undefined))
    return cached
  }
  try {
    const res = await network
    // Copy before the browser reads the body; the page streams to the browser as before.
    event.waitUntil(storeToday(key, res.clone()).catch(() => undefined))
    return res
  } catch (err) {
    if (cached) return cached
    throw err
  }
}

const pemRuntimeCache = [
  {
    // The guide PDF (admin guide included) is built fresh on each download: never kept on the device.
    matcher: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) => sameOrigin && url.pathname === '/atelier/aide/guide.pdf',
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, url, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
      sameOrigin && request.method === 'GET' && request.mode === 'navigate' && TODAY_PATHS.has(url.pathname) && url.search === '',
    handler: todayHandler,
  },
  {
    matcher: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
      sameOrigin &&
      (request.destination === 'image' ||
        request.url.includes('/r2-proxy/') ||
        /\.(avif|webp|png|jpe?g|gif)(\?|$)/i.test(request.url)),
    handler: new CacheFirst({
      cacheName: 'pem-r2-images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    }),
  },
  {
    matcher: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
      sameOrigin && request.destination === 'document' && /^\/(hub|atelier)(\/|$)/.test(new URL(request.url).pathname),
    // Network-first: stale HTML after deploy references deleted /_next/static/chunks/* hashes.
    handler: new NetworkFirst({
      cacheName: 'pem-shell-pages',
      networkTimeoutSeconds: 8,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        }),
      ],
    }),
  },
]

const serwist = new Serwist({
  precacheEntries,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...pemRuntimeCache, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }: { request: Request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

// Every sign-in starts on /login (password, Google, reset): opening it wipes the last user's pages.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.mode !== 'navigate') return
  const { pathname } = new URL(request.url)
  if (pathname === '/login' || pathname.startsWith('/login/')) event.waitUntil(clearUserCaches())
})

// Older builds' « Aujourd'hui » copies point at JS files that are gone.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith(TODAY_CACHE_PREFIX) && n !== TODAY_CACHE).map((n) => caches.delete(n)))),
  )
})

serwist.addEventListeners()
