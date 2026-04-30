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
          width: 100vw; height: 100dvh;
          display: flex; align-items: center; justify-content: center;
          position: relative;
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
        }

        /* orbital nav labels */
        .orb {
          position: absolute;
          font-size: 9px; letter-spacing: 3px; text-transform: uppercase;
          color: #b0aca6; text-decoration: none;
          display: flex; align-items: center; gap: 10px;
          white-space: nowrap;
          transition: color .25s;
        }
        .orb:hover { color: #5a5650; }

        /* vertical connectors (top/bottom) */
        .orb-top {
          top: -52px; left: 50%; transform: translateX(-50%);
          flex-direction: column; gap: 10px;
        }
        .orb-top::after {
          content: ''; display: block; width: 1px; height: 28px;
          background: currentColor; opacity: .4;
          transition: height .2s;
        }
        .orb-top:hover::after { height: 40px; }

        .orb-bottom {
          bottom: -52px; left: 50%; transform: translateX(-50%);
          flex-direction: column-reverse; gap: 10px;
        }
        .orb-bottom::after {
          content: ''; display: block; width: 1px; height: 28px;
          background: currentColor; opacity: .4;
          transition: height .2s;
        }
        .orb-bottom:hover::after { height: 40px; }

        /* horizontal connectors (left/right) */
        .orb-left {
          left: -130px; top: 50%; transform: translateY(-50%);
        }
        .orb-left::after {
          content: ''; display: block; height: 1px; width: 36px;
          background: currentColor; opacity: .4;
          transition: width .2s;
        }
        .orb-left:hover::after { width: 52px; }

        .orb-right {
          right: -140px; top: 50%; transform: translateY(-50%);
          flex-direction: row-reverse;
        }
        .orb-right::after {
          content: ''; display: block; height: 1px; width: 36px;
          background: currentColor; opacity: .4;
          transition: width .2s;
        }
        .orb-right:hover::after { width: 52px; }
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
          <a href="mailto:studio@pierreemmanuel.com" className="orb orb-bottom">Enquiry</a>
        </div>
      </div>
    </>
  )
}
