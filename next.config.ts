import { spawnSync } from 'node:child_process'
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
  additionalPrecacheEntries: [
    { url: '/~offline', revision: swRevision },
    { url: '/hub', revision: swRevision },
  ],
})

/** Set by `npm run dev` → scripts/run-dev.mjs (LAN IP for phone testing). */
const lanDevHost = process.env.DEV_LAN_HOST?.trim()

const nextConfig: NextConfig = {
  /** Phone opens http://<LAN>:3000 — allow dev chunks/HMR from that origin (Next 15+). */
  ...(lanDevHost ? { allowedDevOrigins: [lanDevHost] } : {}),
  /** Dev: slow disk/AV can hit webpack’s default chunk fetch timeout → ChunkLoadError on `app/layout`. */
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.output = { ...config.output, chunkLoadTimeout: 300_000 }
    }
    return config
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
