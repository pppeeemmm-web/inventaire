import type { Metadata, Viewport } from 'next'
import './globals.css'
import { I18nProvider } from '@/lib/i18n/context'
import { ThemePathSync } from '@/components/ThemePathSync'
import { ToastHost } from '@/components/ui/ToastHost'
import { RouteProgress } from '@/components/ui/RouteProgress'
import { Analytics } from '@vercel/analytics/react'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'PEM · Atelier',
  description: 'Outil d\'atelier interne — accès restreint',
  robots: { index: false, follow: false }, // never public
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="light">
      <head>
        <link rel="apple-touch-icon" href="/pwa-icon-192.png" />
        {/* Self-host fonts in production — for now load from Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var p = location.pathname || '';
                  var internal = /^\\/(atelier|hub|galerie)(\\/|$)/.test(p);
                  var raw = localStorage.getItem('pem_theme');
                  var normalized = (raw === 'dark' || raw === 'light' || raw === 'standard') ? raw : 'light';
                  var theme = internal ? normalized : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body style={{ minHeight: '100dvh' }} suppressHydrationWarning>
        <RouteProgress />
        <ThemePathSync />
        <I18nProvider>
          {children}
        </I18nProvider>
        <ToastHost />
        {/* Only on Vercel deployments — avoids 404 + console noise on localhost */}
        {process.env.VERCEL === '1' ? <Analytics /> : null}
      </body>
    </html>
  )
}
