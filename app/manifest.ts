import type { MetadataRoute } from 'next'
import { dict } from '@/lib/i18n/dictionary'

const SHARE_TARGET = {
  action: '/atelier/share-receive',
  method: 'POST' as const,
  enctype: 'multipart/form-data',
  params: {
    title: 'title',
    text: 'text',
    url: 'url',
    files: [{ name: 'files', accept: ['image/*', 'application/pdf'] as string[] }],
  },
}

/** PWA install metadata — uses default atelier locale (fr). Web Share Target (Ring B.3). */
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
    share_target: SHARE_TARGET,
  } as MetadataRoute.Manifest
}
