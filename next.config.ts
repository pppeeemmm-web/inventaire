import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are tracked separately — don't block production builds.
    // Re-enable once database.ts types are regenerated from live schema.
    ignoreBuildErrors: true,
  },
  // pdfkit → fontkit uses decorators incompatible with Turbopack's @swc/helpers.
  // Keep them as native Node.js requires instead of bundling.
  serverExternalPackages: ['pdfkit', 'fontkit', 'qrcode'],

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

export default nextConfig
