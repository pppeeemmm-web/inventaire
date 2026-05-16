'use client'

import Image from 'next/image'

interface Props {
  src: string
  alt: string
  className?: string
  priority?: boolean
  sizes?: string
  unoptimized?: boolean
}

export default function WavingCircle({ src, alt, className, priority, sizes, unoptimized }: Props) {
  return (
    <>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .waving-shadow   { animation-duration: 12s !important; animation-iteration-count: infinite !important; }
          .waving-pendulum { animation-duration: 12s !important; animation-iteration-count: infinite !important; }
          .waving-wave     { animation-duration: 9s  !important; animation-iteration-count: infinite !important; }
        }
        /* True pendulum: 0 → right → 0 → left → 0, seamless loop */
        @keyframes pendulum {
          0%   { transform: rotateY(0deg); }
          25%  { transform: rotateY(5deg); }
          50%  { transform: rotateY(0deg); }
          75%  { transform: rotateY(-5deg); }
          100% { transform: rotateY(0deg); }
        }
        /* Shadow mirrors pendulum x shift */
        @keyframes pendulumShadow {
          0%   { filter: drop-shadow(0px   20px 18px rgba(0,0,0,0.22)); }
          25%  { filter: drop-shadow(12px  20px 18px rgba(0,0,0,0.26)); }
          50%  { filter: drop-shadow(0px   20px 18px rgba(0,0,0,0.22)); }
          75%  { filter: drop-shadow(-12px 20px 18px rgba(0,0,0,0.26)); }
          100% { filter: drop-shadow(0px   20px 18px rgba(0,0,0,0.22)); }
        }
        /* Wave distortion: organic, asymmetric, true loop */
        @keyframes wave {
          0%   { transform: scale(1.07) skewX(0deg)    skewY(0deg)    scaleX(1)     scaleY(1); }
          10%  { transform: scale(1.07) skewX(2deg)    skewY(0.5deg)  scaleX(1.025) scaleY(0.972); }
          22%  { transform: scale(1.07) skewX(-1deg)   skewY(-0.5deg) scaleX(0.978) scaleY(1.025); }
          35%  { transform: scale(1.07) skewX(1.8deg)  skewY(0.4deg)  scaleX(1.022) scaleY(0.976); }
          48%  { transform: scale(1.07) skewX(-1.8deg) skewY(-0.4deg) scaleX(0.975) scaleY(1.022); }
          60%  { transform: scale(1.07) skewX(1.2deg)  skewY(0.6deg)  scaleX(1.028) scaleY(0.970); }
          72%  { transform: scale(1.07) skewX(-0.8deg) skewY(-0.6deg) scaleX(0.972) scaleY(1.028); }
          85%  { transform: scale(1.07) skewX(1.5deg)  skewY(0.3deg)  scaleX(1.018) scaleY(0.980); }
          100% { transform: scale(1.07) skewX(0deg)    skewY(0deg)    scaleX(1)     scaleY(1); }
        }
      `}</style>

      {/* drop-shadow synced with pendulum */}
      <div className="waving-shadow" style={{ width: '100%', height: '100%', animation: 'pendulumShadow 12s ease-in-out infinite', perspective: '900px' }}>
        {/* circle clip + rotateY on same element: clip stays round in screen space, 3D tilt applies underneath */}
        <div className="waving-pendulum" style={{ width: '100%', height: '100%', clipPath: 'circle(50% at 50% 50%)', animation: 'pendulum 12s ease-in-out infinite', transformOrigin: 'center center' }}>
          {/* wave distortion — on container, image is static */}
          <div className="waving-wave" style={{ width: '100%', height: '100%', position: 'relative', animation: 'wave 9s ease-in-out infinite', transformOrigin: 'center center' }}>
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
      </div>
    </>
  )
}
