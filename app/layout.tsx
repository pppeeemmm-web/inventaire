import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, Sofia_Sans } from 'next/font/google'
import './globals.css'
import { getMetadataBase } from '@/lib/seo/site-url'
import { I18nProvider } from '@/lib/i18n/context'
import { ThemePathSync } from '@/components/ThemePathSync'
import { ToastHost } from '@/components/ui/ToastHost'
import { RouteProgress } from '@/components/ui/RouteProgress'
import { NumberWheelGuard } from '@/components/ui/NumberWheelGuard'

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edeae4' },
    { media: '(prefers-color-scheme: dark)', color: '#101011' },
  ],
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: 'PEM · Atelier',
  description: 'Outil d\'atelier interne — accès restreint',
  robots: { index: false, follow: false }, // never public
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
}

/**
 * DEV ONLY — unsticks « Chargement Atelier… » in Claude's in-app Browser pane.
 * React 19 reveals streamed Suspense content ($RV) and retries hydration (_reactRetry) on the next
 * requestAnimationFrame; a hidden pane paints no frames, so the page never leaves the fallback.
 * Memory note: reference_browser_pane_raf_hang.md. When no frame has fired for ~1 s (≤ 15 s after load)
 * this reveals pending boundaries and runs each revealed boundary's retry once. Every React internal is
 * typeof-guarded + try/catch so a React upgrade that renames them turns this into a no-op.
 * Visible browsers get frames, so it never acts there. Not rendered in production builds.
 */
const DEV_RAF_UNSTICK = `(function(){try{
  var t0=Date.now(),last=t0;
  (function f(){last=Date.now();if(Date.now()-t0<15000)requestAnimationFrame(f)})();
  var iv=setInterval(function(){try{
    if(Date.now()-t0>15000){clearInterval(iv);return}
    if(Date.now()-last<1000)return;
    var rb=window.$RB;
    if(rb&&rb.length&&typeof window.$RV==='function')window.$RV(rb);
    var it=document.createNodeIterator(document,NodeFilter.SHOW_COMMENT),n;
    while((n=it.nextNode())){
      if(n.data==='$'&&typeof n._reactRetry==='function'&&!n._pemRetried){n._pemRetried=1;try{n._reactRetry()}catch(e){}}
    }
  }catch(e){}},500);
}catch(e){}})();`

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
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/pwa-icon-180.png" sizes="180x180" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#edeae4" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#101011" media="(prefers-color-scheme: dark)" />
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
        {process.env.NODE_ENV === 'development' ? (
          <script dangerouslySetInnerHTML={{ __html: DEV_RAF_UNSTICK }} />
        ) : null}
      </head>
      <body style={{ minHeight: '100dvh' }} suppressHydrationWarning>
        <RouteProgress />
        <ThemePathSync />
        <I18nProvider>
          {children}
        </I18nProvider>
        <ToastHost />
        <NumberWheelGuard />
      </body>
    </html>
  )
}
