'use client'

import { htmlToPlain } from '@/components/atelier/RichEditor'

export function FlamePreview({ html }: { html: string }) {
  const plain = htmlToPlain(html)
  return (
    <div style={{
      border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
      background: '#f0ede8', fontFamily: 'var(--font-ui)',
      fontSize: 11, lineHeight: 2.0, letterSpacing: '0.15em',
      textTransform: 'uppercase', color: '#8a8680',
      textAlign: 'justify', wordSpacing: '0.3em',
      whiteSpace: 'pre-wrap', minHeight: 60,
    }}>
      {plain
        ? plain.replace(/\./g, ' /').replace(/\n/g, ' █ ')
        : <span style={{ opacity: 0.25 }}>—</span>
      }
    </div>
  )
}
