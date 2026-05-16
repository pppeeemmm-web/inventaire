'use client'

import { useState } from 'react'

import { thumbUrl, imageUrl } from '@/lib/data'
import { useI18n } from '@/lib/i18n/context'

export function WorkThumb({ 
  file, alt, size = 128, displaySize = "40px", className, style, priority 
}: { 
  file: string; alt: string; size?: number; displaySize?: string; className?: string; style?: React.CSSProperties; priority?: boolean 
}) {
  const [errorFile, setErrorFile] = useState<string | null>(null)

  const defaultSrc = (size > 400 ? imageUrl(file) : thumbUrl(file, size)) ?? ''
  const fullSrc = imageUrl(file) ?? ''
  
  const src = errorFile === file ? fullSrc : defaultSrc

  return (
    <img 
      src={src} 
      alt={alt} 
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => {
        setErrorFile(file)
      }}
    />
  )
}

export function SuggestionThumb({ file, alt }: { file: string; alt: string }) {
  return <WorkThumb file={file} alt={alt} size={48} displaySize="16px" />
}

export function MissingThumb({ id, onOpen }: { id: number; onOpen?: () => void }) {
  const { t } = useI18n()

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative', overflow: 'hidden',
      background: 'repeating-linear-gradient(45deg, var(--bg2), var(--bg2) 10px, var(--bg1) 10px, var(--bg1) 20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontSize: 22, fontWeight: 800, color: 'var(--tx)', opacity: 0.18,
        letterSpacing: -1, userSelect: 'none', lineHeight: 1,
      }}>{id}</span>
      {onOpen && (
        <button
          onClick={e => { e.stopPropagation(); onOpen() }}
          title={t('work_thumb_add_image')}
          style={{
            position: 'absolute', bottom: 2, right: 2,
            background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.8)',
            border: 'none', borderRadius: 3,
            fontSize: 8, padding: '1px 3px', cursor: 'pointer', lineHeight: 1.4,
          }}>⊕</button>
      )}
    </div>
  )
}
