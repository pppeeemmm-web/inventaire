import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, Sofia_Sans } from 'next/font/google'
import './globals.css'
import { getMetadataBase } from '@/lib/seo/site-url'
import { I18nProvider } from '@/lib/i18n/context'
import { ThemePathSync } from '@/components/ThemePathSync'
import { ToastHost } from '@/components/ui/ToastHost'
import { RouteProgress } from '@/components/ui/RouteProgress'
import { Analytics } from '@vercel/analytics/react'

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-next',
})

const sofiaSans = Sofia_Sans({
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sofia-next',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
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
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      className={`${instrumentSerif.variable} ${sofiaSans.variable}`}
    >
      <head>
        <link rel="apple-touch-icon" href="/pwa-icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var p = location.pathname || '';
                  var internal = /^\\/(atelier|hub|galerie|maps)(\\/|$)/.test(p);
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
