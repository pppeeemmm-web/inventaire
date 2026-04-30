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
        @keyframes drift {
          0%   { transform: scale(1.05) translate(0px, 0px); }
          25%  { transform: scale(1.05) translate(2px, 1px); }
          50%  { transform: scale(1.05) translate(0px, 2px); }
          75%  { transform: scale(1.05) translate(-2px, 1px); }
          100% { transform: scale(1.05) translate(0px, 0px); }
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
            animation: 'drift 10s ease-in-out infinite',
            transformOrigin: 'center center',
          }}
        />
      </div>
    </>
  )
}
