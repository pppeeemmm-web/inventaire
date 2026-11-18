import { spawnSync } from 'node:child_process'
import path from 'node:path'
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const swRevision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  `build-${Date.now()}`

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  cacheOnNavigation: true,
  // `/hub` is not precached (R2 speed): a precached copy was fetched with whoever was signed in when the
  // worker installed and then served first to anyone on the phone. app/sw.ts keeps today's copy per user.
  // The '/~offline' revision also names that cache (one build per copy): keep it the build revision.
  additionalPrecacheEntries: [{ url: '/~offline', revision: swRevision }],
})

/** Origin of an env URL, or '' when unset / malformed. */
function originOf(raw: string | undefined): string {
  try {
    return raw ? new URL(raw).origin : ''
  } catch {
    return ''
  }
}

/**
 * Content security policy, ENFORCED since 2026-11-18 (TODO 8, Pem « go »; report-only 2026-11-16 → 18: no violation
 * on the live site as admin — work panel + full image, Expositions, Commandes, hub, Journal + audio, Carte Création,
 * /works; Vault, PDF preview, Constellation on 11-16). A source not listed here is now blocked: add it here first.
 * Every source the site loads, listed from the code:
 * Supabase (REST + realtime), R2 public images + signed uploads/previews, Google fonts (portal / card / selection
 * export), Leaflet CSS + marker icons (unpkg) + OpenStreetMap tiles (Carte), address lookups (api-adresse,
 * zippopotam) in the contact editor, the QR image on /card, Vercel analytics (same origin in prod).
 * Next.js inline scripts need 'unsafe-inline' (no nonce yet); dev also needs 'unsafe-eval'.
 * Not yet seen live under it: an image upload, the contact address lookup (both sources are listed).
 */
const supabaseOrigin = originOf(process.env.NEXT_PUBLIC_SUPABASE_URL)
const r2Origin = originOf(process.env.NEXT_PUBLIC_R2_PUBLIC_URL)
const isDev = process.env.NODE_ENV === 'development'
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${r2Origin} ${supabaseOrigin} https://*.tile.openstreetmap.org https://unpkg.com https://api.qrserver.com`,
  `media-src 'self' data: blob: ${r2Origin}`,
  // The service worker fetches cross-origin files itself (Serwist's default rules: any .png, Google fonts, …), and
  // inside the worker that is `connect-src`, not img-src / font-src: the map tiles, Google fonts and the QR image
  // must be listed here too, or the worker's fetch is blocked (map tiles blank on the live site, 2026-11-18).
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, 'wss:')} ${r2Origin} https://*.r2.cloudflarestorage.com https://api-adresse.data.gouv.fr https://api.zippopotam.us https://vitals.vercel-insights.com https://*.tile.openstreetmap.org https://unpkg.com https://fonts.googleapis.com https://fonts.gstatic.com https://api.qrserver.com${isDev ? ' ws: wss:' : ''}`,
  `frame-src 'self' blob: ${r2Origin} https://*.r2.cloudflarestorage.com`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
]
  .map((d) => d.replace(/\s+/g, ' ').trim())
  .join('; ')

/** Set by `npm run dev` → scripts/run-dev.mjs (LAN IP for phone testing). */
const lanDevHost = process.env.DEV_LAN_HOST?.trim()

const nextConfig: NextConfig = {
  /** The PDF guide reads its font files at run time (lib/aide/pdf.ts): ship them with that route. */
  outputFileTracingIncludes: {
    '/atelier/aide/guide.pdf': ['./lib/aide/pdf/fonts/**'],
  },
  /** Phone opens http://<LAN>:3000 — allow dev chunks/HMR from that origin (Next 15+). */
  ...(lanDevHost ? { allowedDevOrigins: [lanDevHost] } : {}),
  /** Dev: slow disk/AV can hit webpack’s default chunk fetch timeout → ChunkLoadError on `app/layout`. */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.output = { ...config.output, chunkLoadTimeout: 300_000 }
    }
    /**
     * Production browser build: lib/i18n/catalog/{fr,en}.ts become one language's JSON each, computed at build time
     * (scripts/i18n-catalog-loader.cjs), so a page ships French only and English is its own chunk. Dev and the server
     * run the modules as they are (both languages: same text, just bigger).
     */
    if (!dev && !isServer) {
      config.module.rules.push({
        test: /[\\/]lib[\\/]i18n[\\/]catalog[\\/](fr|en)\.ts$/,
        resourceQuery: { not: [/i18n-catalog-eval/] },
        enforce: 'pre',
        use: [{ loader: path.join(__dirname, 'scripts', 'i18n-catalog-loader.cjs') }],
      })
    }
    return config
  },

  /** Deploy check: `curl -sI <url>` shows which commit is live (Vercel sets VERCEL_GIT_COMMIT_SHA). */
  async headers() {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA || swRevision
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'x-build-sha', value: sha },
          // Hardening (2026-11-13): no framing by other sites, no MIME sniffing, short referrer.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },

  /** Browsers still request /favicon.ico by default */
  async redirects() {
    return [{ source: '/favicon.ico', destination: '/favicon.svg', permanent: false }]
  },

  /** Dev: same-origin proxy so R2 images don’t trip CORS when ConstellationCanvas sets img.crossOrigin */
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
    if (!base) return []
    try {
      const { origin } = new URL(base)
      return [{ source: '/r2-proxy/:path*', destination: `${origin}/:path*` }]
    } catch {
      return []
    }
  },

  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  // pdfkit → fontkit uses decorators incompatible with Turbopack's @swc/helpers.
  // Keep them as native Node.js requires instead of bundling.
  serverExternalPackages: ['pdfkit', 'fontkit', 'qrcode', 'sharp'],

  turbopack: {
    // Silence "multiple lockfiles" workspace root warning
    root: __dirname,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mcrzsxrcoexnlwmaunte.supabase.co',
        pathname: '/storage/v1/**',
      },
      {
        protocol: 'https',
        hostname: 'pub-a352e674a992412fa243598ffd6b659c.r2.dev',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default withSerwist(nextConfig)
