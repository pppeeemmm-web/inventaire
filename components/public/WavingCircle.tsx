'use client'

/**
 * One warped layer (`.waving-wave`): AVIF alpha + time-of-day drop-shadow + gloss.
 * Shadow uses `drop-shadow()` so it follows the alpha silhouette and warps with the same transform.
 * No circle clip-path — the file alpha is the shape.
 */
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
  /** Stacked drop-shadows; applied on `.waving-wave` (moves with warp). */
  heroDiscCastFilter?: string
  heroWhiteKey?: boolean
  heroBackdropCss?: string
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
  heroDiscCastFilter,
  heroWhiteKey = false,
  heroBackdropCss,
}: Props) {
  const whiteKey = heroWhiteKey && Boolean(heroBackdropCss?.trim())
  const castFilter =
    heroDiscCastFilter?.trim() ||
    'drop-shadow(0 16px 24px rgba(44, 42, 40, 0.28)) drop-shadow(0 40px 48px rgba(44, 42, 40, 0.12))'

  const paintStyle: CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'center',
    display: 'block',
    background: 'transparent',
    ...(whiteKey ? { mixBlendMode: 'multiply' } : {}),
  }

  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .waving-pendulum {
            animation-name: pendulum-y !important;
            animation-duration: 16s !important;
            animation-timing-function: ease-in-out !important;
            animation-iteration-count: infinite !important;
          }
          .waving-tilt-x {
            animation-name: pendulum-x !important;
            animation-duration: 13s !important;
            animation-timing-function: ease-in-out !important;
            animation-iteration-count: infinite !important;
          }
          .waving-wave {
            animation-name: wave !important;
            animation-duration: 21s !important;
            animation-timing-function: ease-in-out !important;
            animation-iteration-count: infinite !important;
          }
        }
        @keyframes pendulum-y {
          0%, 100% { transform: rotateY(-15deg); }
          50%      { transform: rotateY(15deg); }
        }
        @keyframes pendulum-x {
          0%, 100% { transform: rotateX(-5deg); }
          50%      { transform: rotateX(5deg); }
        }
        @keyframes wave {
          0%, 100% { transform: skewX(0deg) skewY(0deg); }
          35%      { transform: skewX(0.45deg) skewY(0.14deg); }
          70%      { transform: skewX(-0.4deg) skewY(-0.12deg); }
        }
        .waving-pendulum {
          position: relative;
          width: 100%;
          height: 100%;
          animation: pendulum-y 16s ease-in-out infinite;
          transform-origin: center center;
          transform-style: preserve-3d;
        }
        .waving-tilt-x {
          width: 100%;
          height: 100%;
          position: relative;
          animation: pendulum-x 13s ease-in-out infinite;
          transform-origin: center center;
          transform-style: preserve-3d;
        }
        .waving-wave {
          width: 100%;
          height: 100%;
          position: relative;
          animation: wave 21s ease-in-out infinite;
          transform-origin: center center;
          will-change: transform, filter;
        }
        .waving-backdrop {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .waving-gloss {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          z-index: 2;
        }
      `}</style>

      <div className={className} style={{ width: '100%', height: '100%', perspective: '900px' }}>
        <div className="waving-shadow" style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div className="waving-pendulum">
            <div className="waving-tilt-x">
            <div
              className="waving-wave"
              style={{ filter: castFilter }}
            >
              {whiteKey ? (
                <div
                  className="waving-backdrop"
                  aria-hidden
                  style={{ background: heroBackdropCss }}
                />
              ) : null}
              {unoptimized ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt={alt}
                  decoding="async"
                  fetchPriority={priority ? 'high' : 'auto'}
                  style={paintStyle}
                />
              ) : (
                <Image
                  src={src}
                  alt={alt}
                  fill
                  priority={priority}
                  sizes={sizes}
                  style={paintStyle}
                />
              )}
              {glossEnabled && glossBackground ? (
                <div
                  className="waving-gloss"
                  aria-hidden
                  style={{
                    background: glossBackground,
                    mixBlendMode: glossMixBlendMode,
                  }}
                />
              ) : null}
            </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
