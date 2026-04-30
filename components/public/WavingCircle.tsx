'use client'

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
          0%   { transform: scale(1.06) skewX(0deg)   skewY(0deg);   }
          25%  { transform: scale(1.06) skewX(0.6deg)  skewY(0.3deg);  }
          50%  { transform: scale(1.06) skewX(0deg)   skewY(0.5deg);  }
          75%  { transform: scale(1.06) skewX(-0.6deg) skewY(0.3deg);  }
          100% { transform: scale(1.06) skewX(0deg)   skewY(0deg);   }
        }
      `}</style>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
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
