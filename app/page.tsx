import type { Metadata } from 'next'
import Link from 'next/link'
import WavingCircle from '@/components/public/WavingCircle'

export const metadata: Metadata = {
  title: 'Pierre Emmanuel Moulin — Atelier PEM',
  description: 'Peinture, dessin, sculpture, photographie. Paris.',
  robots: { index: true, follow: true },
}

export default function LandingPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        body { background: #edeae4; font-family: 'JetBrains Mono', monospace; color: #9a9690; }

        .stage {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          display: grid;
          place-items: center;
        }

        .wordmark {
          position: absolute; top: 28px; left: 32px;
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
        }

        .circle-wrap {
          position: relative;
          width: clamp(300px, 42vmin, 520px);
          height: clamp(300px, 42vmin, 520px);
          flex-shrink: 0;
        }

        .orb {
          position: absolute;
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
          display: flex; align-items: center; gap: 10px;
          white-space: nowrap;
          transition: color .25s;
        }
        .orb:hover { color: #5a5650; }

        .orb-top {
          bottom: 100%; left: 50%; transform: translateX(-50%);
          flex-direction: column; padding-bottom: 52px;
        }
        .orb-top::after {
          content: ''; display: block; width: 1px; height: 28px;
          background: currentColor; opacity: .4;
        }

        .orb-bottom {
          top: 100%; left: 50%; transform: translateX(-50%);
          flex-direction: column-reverse; padding-top: 52px;
        }
        .orb-bottom::after {
          content: ''; display: block; width: 1px; height: 28px;
          background: currentColor; opacity: .4;
        }

        .orb-left {
          right: 100%; top: 50%; transform: translateY(-50%);
          flex-direction: row; padding-right: 52px;
        }
        .orb-left::after {
          content: ''; display: block; height: 1px; width: 28px;
          background: currentColor; opacity: .4;
        }

        .orb-right {
          left: 100%; top: 50%; transform: translateY(-50%);
          flex-direction: row-reverse; padding-left: 52px;
        }
        .orb-right::after {
          content: ''; display: block; height: 1px; width: 28px;
          background: currentColor; opacity: .4;
        }
      `}</style>

      <div className="stage">
        <Link href="/" className="wordmark">Atelier PEM</Link>

        <div className="circle-wrap">
          <WavingCircle
            src="https://pub-a352e674a992412fa243598ffd6b659c.r2.dev/thumbs/W_2190_01_20260411-20260411-_PE16262_-_pe_moulin_-_pe_moulin.avif"
            alt="Pierre Emmanuel Moulin"
          />
          <Link href="/works"    className="orb orb-top">Works</Link>
          <Link href="/about"    className="orb orb-left">About</Link>
          <Link href="/practice" className="orb orb-right">Practice</Link>
          <a href="mailto:pppeeemmm@gmail.com" className="orb orb-bottom">Enquiry</a>
        </div>

        <Link href="/hub" style={{ 
          position: 'absolute', bottom: 20, right: 24, 
          fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', 
          color: '#b0aca6', textDecoration: 'none', opacity: 0.5 
        }}>•</Link>
      </div>
    </>
  )
}
