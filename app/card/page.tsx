// /card — printable business card for Pierre Emmanuel Moulin
// Two cards per sheet (front + back), print-optimised.
// QR code generated via free qrserver.com API — no key needed.

import type { Metadata } from 'next'
import Image from 'next/image'
import { dict } from '@/lib/i18n/dictionary'
import { routeMetadata } from '@/lib/i18n/route-metadata'

export const metadata: Metadata = routeMetadata('card', 'en')

const PUBLIC_WORKS_URL = 'https://pem-hub.vercel.app/works'  // update when deployed
const EMAIL = process.env.PUBLIC_CONTACT_EMAIL?.trim() ?? ''
const QR_URL        = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(PUBLIC_WORKS_URL)}&color=ece7da&bgcolor=0a0a0b&margin=8`

export default function CardPage() {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Sofia+Sans:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #f5f0e8;
            font-family: 'Sofia Sans', ui-sans-serif, system-ui, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 24px;
            padding: 40px;
          }
          .sheet {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            justify-content: center;
          }
          .card {
            width: 85mm;
            height: 55mm;
            position: relative;
            border-radius: 2px;
            overflow: hidden;
            flex-shrink: 0;
          }
          .card-front {
            background: #0a0a0b;
            color: #ece7da;
            padding: 7mm 8mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .card-back {
            background: #0a0a0b;
            color: #ece7da;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6mm;
            gap: 8mm;
          }
          .name {
            font-family: 'Instrument Serif', Georgia, serif;
            font-size: 18pt;
            line-height: 1.05;
            letter-spacing: -0.02em;
            color: #ece7da;
          }
          .discipline {
            font-size: 6pt;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: #706c62;
            margin-top: 3mm;
          }
          .details {
            display: flex;
            flex-direction: column;
            gap: 2mm;
          }
          .detail-row {
            font-size: 6pt;
            letter-spacing: 0.5px;
            color: #a8a397;
            display: flex;
            align-items: baseline;
            gap: 5px;
          }
          .detail-label {
            color: #4c4a44;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 5pt;
            width: 14mm;
            flex-shrink: 0;
          }
          .accent { color: #c8a86e; }
          .monogram {
            font-family: 'Instrument Serif', Georgia, serif;
            font-size: 28pt;
            color: #c8a86e;
            line-height: 1;
            letter-spacing: -0.02em;
          }
          .qr-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2mm;
          }
          .qr-label {
            font-size: 5pt;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #4c4a44;
          }
          .back-text {
            display: flex;
            flex-direction: column;
            gap: 3mm;
            flex: 1;
          }
          .back-name {
            font-family: 'Instrument Serif', serif;
            font-size: 13pt;
            color: #ece7da;
            line-height: 1.1;
          }
          .back-url {
            font-size: 5.5pt;
            color: #706c62;
            letter-spacing: 0.5px;
          }
          .no-social {
            font-size: 5pt;
            color: #4c4a44;
            font-style: italic;
            margin-top: 2mm;
          }
          .print-note {
            font-size: 10px;
            color: #888;
            text-align: center;
            letter-spacing: 1px;
          }
          @media print {
            body { background: white; padding: 0; justify-content: flex-start; gap: 0; }
            .sheet { gap: 6mm; padding: 10mm; }
            .print-note { display: none; }
            .card { box-shadow: none; }
          }
        `}</style>
      </head>
      <body>
        <div className="print-note">
          Print on 300 gsm card stock · Cut marks not shown · ⌘P or Ctrl+P to print
        </div>

        <div className="sheet">
          {/* FRONT */}
          <div className="card card-front">
            <div>
              <div className="name">Pierre Emmanuel<br />Moulin</div>
              <div className="discipline">Peintre · Dessinateur · Sculpteur</div>
            </div>
            <div className="details">
              {EMAIL ? (
                <div className="detail-row">
                  <span className="detail-label">Email</span>
                  <span className="accent">{EMAIL}</span>
                </div>
              ) : null}
              <div className="detail-row">
                <span className="detail-label">Web</span>
                <span>{PUBLIC_WORKS_URL.replace('https://', '')}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Base</span>
                <span>Marseille, France</span>
              </div>
              <div className="detail-row" style={{ marginTop: '1mm' }}>
                <span className="detail-label" style={{ color: '#4c4a44' }}>—</span>
                <span style={{ fontSize: '5pt', color: '#4c4a44', fontStyle: 'italic' }}>{dict.fr.card_print_no_social_fr}</span>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="card card-back">
            <div className="qr-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image src={QR_URL} alt="QR code — portfolio" width={80} height={80} unoptimized={true} />
              <div className="qr-label">Portfolio</div>
            </div>
            <div className="back-text">
              <div className="monogram">PEM</div>
              <div className="back-name">Pierre Emmanuel<br />Moulin</div>
              <div className="back-url">{PUBLIC_WORKS_URL.replace('https://', '')}</div>
              <div className="no-social">{dict.en.card_print_no_social_en}</div>
            </div>
          </div>
        </div>

        <div className="print-note" style={{ marginTop: 8 }}>
          Set PUBLIC_CONTACT_EMAIL and update PUBLIC_WORKS_URL in /app/card/page.tsx for production.
        </div>
      </body>
    </html>
  )
}
