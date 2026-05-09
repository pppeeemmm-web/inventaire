'use client'

import Image from 'next/image'

interface Props {
  src: string
  alt: string
  className?: string
}

export default function WavingCircle({ src, alt, className }: Props) {
  return (
    <>
      <style>{`
        @keyframes wave {
          0%   { transform: scale(1.06) skewX(0deg)    scaleX(1)    scaleY(1); }
          20%  { transform: scale(1.06) skewX(0.5deg)  scaleX(1.015) scaleY(0.985); }
          40%  { transform: scale(1.06) skewX(0deg)    scaleX(0.99) scaleY(1.015); }
          60%  { transform: scale(1.06) skewX(-0.5deg) scaleX(1.015) scaleY(0.99); }
          80%  { transform: scale(1.06) skewX(0deg)    scaleX(0.985) scaleY(1.01); }
          100% { transform: scale(1.06) skewX(0deg)    scaleX(1)    scaleY(1); }
        }
      `}</style>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', position: 'relative' }}>
        <Image
          src={src}
          alt={alt}
          fill
          style={{
            objectFit: 'cover',
            display: 'block',
            animation: 'wave 7s ease-in-out infinite',
            transformOrigin: 'center center',
          }}
        />
      </div>
    </>
  )
}
