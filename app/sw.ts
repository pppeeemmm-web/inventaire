import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const pemRuntimeCache = [
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
  precacheEntries: self.__SW_MANIFEST,
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

serwist.addEventListeners()
