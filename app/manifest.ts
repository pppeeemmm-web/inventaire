import type { MetadataRoute } from 'next'
import { dict } from '@/lib/i18n/dictionary'

/** PWA install metadata — uses default atelier locale (fr). */
export default function manifest(): MetadataRoute.Manifest {
  const m = dict.fr
  return {
    name: m.pwa_manifest_name,
    short_name: m.pwa_manifest_short_name,
    description: m.pwa_manifest_description,
    start_url: '/hub',
    display: 'standalone',
    background_color: '#101011',
    theme_color: '#101011',
    icons: [
      { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
