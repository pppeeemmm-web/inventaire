import type { Metadata } from 'next'
import './globals.css'
import { I18nProvider } from '@/lib/i18n/context'

export const metadata: Metadata = {
  title: 'PEM · Atelier',
  description: 'Outil d\'atelier interne — accès restreint',
  robots: { index: false, follow: false }, // never public
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        {/* Self-host fonts in production — for now load from Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ height: '100dvh', overflow: 'hidden' }}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  )
}
