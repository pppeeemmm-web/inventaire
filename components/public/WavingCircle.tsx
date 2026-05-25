'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'

interface Props {
  src: string
  alt: string
  className?: string
  priority?: boolean
  sizes?: string
  unoptimized?: boolean
  glossEnabled?: boolean
  glossBackground?: string
  glossMixBlendMode?: CSSProperties['mixBlendMode']
  bevelEnabled?: boolean
  bevelBoxShadow?: string
}

export default function WavingCircle({
  src,
  alt,
  className,
  priority,
  sizes,
  unoptimized,
  glossEnabled = true,
  glossBackground,
  glossMixBlendMode = 'color-dodge',
  bevelEnabled = false,
  bevelBoxShadow,
}: Props) {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .waving-shadow   { animation-duration: 12s !important; animation-iteration-count: infinite !important; }
          .waving-pendulum { animation-duration: 12s !important; animation-iteration-count: infinite !important; }
          .waving-wave     { animation-duration: 15s !important; animation-iteration-count: infinite !important; }
        }
        @keyframes pendulum {
          0%   { transform: rotateY(0deg)   rotateX(3deg); }
          25%  { transform: rotateY(15deg)  rotateX(0deg); }
          50%  { transform: rotateY(0deg)   rotateX(-3deg); }
          75%  { transform: rotateY(-15deg) rotateX(0deg); }
          100% { transform: rotateY(0deg)   rotateX(3deg); }
        }
        @keyframes pendulumShadow {
          0%   { filter: drop-shadow(0px   20px 18px rgba(0,0,0,0.24)); }
          25%  { filter: drop-shadow(20px  20px 18px rgba(0,0,0,0.28)); }
          50%  { filter: drop-shadow(0px   20px 18px rgba(0,0,0,0.24)); }
          75%  { filter: drop-shadow(-20px 20px 18px rgba(0,0,0,0.28)); }
          100% { filter: drop-shadow(0px   20px 18px rgba(0,0,0,0.24)); }
        }
        @keyframes wave {
          0%   { transform: scale(1.07) skewX(0deg)     skewY(0deg)     scaleX(1)      scaleY(1); }
          5%   { transform: scale(1.07) skewX(0.69deg)  skewY(0.18deg)  scaleX(1.009)  scaleY(0.990); }
          14%  { transform: scale(1.07) skewX(0deg)     skewY(0deg)     scaleX(1)      scaleY(1); }
          30%  { transform: scale(1.07) skewX(0deg)     skewY(0deg)     scaleX(1)      scaleY(1); }
          35%  { transform: scale(1.07) skewX(-0.62deg) skewY(-0.14deg) scaleX(0.992)  scaleY(1.008); }
          44%  { transform: scale(1.07) skewX(0deg)     skewY(0deg)     scaleX(1)      scaleY(1); }
          60%  { transform: scale(1.07) skewX(0deg)     skewY(0deg)     scaleX(1)      scaleY(1); }
          65%  { transform: scale(1.07) skewX(0.52deg)  skewY(0.20deg)  scaleX(1.010)  scaleY(0.989); }
          74%  { transform: scale(1.07) skewX(0deg)     skewY(0deg)     scaleX(1)      scaleY(1); }
          100% { transform: scale(1.07) skewX(0deg)     skewY(0deg)     scaleX(1)      scaleY(1); }
        }
      `}</style>

      <div
        className={className}
        style={{ width: '100%', height: '100%', perspective: '900px' }}
      >
        <div className="waving-shadow" style={{ width: '100%', height: '100%' }}>
          <div
            className="waving-pendulum"
            style={{
              width: '100%',
              height: '100%',
              clipPath: 'circle(50% at 50% 50%)',
              animation: 'pendulum 12s ease-in-out infinite',
              transformOrigin: 'center center',
              isolation: 'isolate',
            }}
          >
            <div
              className="waving-wave"
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                animation: 'wave 15s linear infinite',
                transformOrigin: 'center center',
              }}
            >
              <div
                className="waving-drop-shadow"
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  animation: 'pendulumShadow 12s ease-in-out infinite',
                }}
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  priority={priority}
                  sizes={sizes}
                  unoptimized={unoptimized}
                  style={{ objectFit: 'cover', display: 'block' }}
                />
              </div>
            </div>
            {bevelEnabled && bevelBoxShadow ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  boxShadow: bevelBoxShadow,
                }}
              />
            ) : null}
            {glossEnabled && glossBackground ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background: glossBackground,
                  mixBlendMode: glossMixBlendMode,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
