'use client'

export function ProsePreview({ html }: { html: string }) {
  if (!html) return (
    <div style={{
      border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
      background: '#f0ede8', minHeight: 60, display: 'flex', alignItems: 'center',
    }}>
      <span style={{ opacity: 0.25, fontSize: 11 }}>—</span>
    </div>
  )
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        border: '1px solid var(--bd)', borderRadius: 4, padding: '16px 20px',
        background: '#f0ede8', fontSize: 12, lineHeight: 1.8,
        color: 'var(--tx2)', minHeight: 60,
      }}
    />
  )
}
