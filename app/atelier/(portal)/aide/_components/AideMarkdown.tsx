'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'
import { parseAideBlocks, parseAideInline } from '@/lib/aide/markdown'

/**
 * The small markdown subset the Aide chapters use (`lib/aide/types.ts`), parsed by `lib/aide/markdown.ts` (shared
 * with the PDF guide). Text only — no HTML is ever injected. Links: internal paths only (`/…`).
 */

/** `onNavigate`: route links through the caller (the Atelier's unsaved-changes guard) instead of navigating directly. */
function inline(text: string, keyBase: string, onNavigate?: (href: string) => void): ReactNode[] {
  return parseAideInline(text).map((seg, n) => {
    const key = `${keyBase}-${n}`
    if (seg.kind === 'bold') return <strong key={key} style={{ color: 'var(--tx)', fontWeight: 600 }}>{seg.text}</strong>
    if (seg.kind === 'link') {
      const go = onNavigate
        ? (e: MouseEvent<HTMLAnchorElement>) => {
            e.preventDefault()
            onNavigate(seg.href)
          }
        : undefined
      return <Link key={key} href={seg.href} onClick={go} style={{ color: 'var(--ac)' }}>{seg.text}</Link>
    }
    return seg.text
  })
}

export function AideMarkdown({ md, onNavigate }: { md: string; onNavigate?: (href: string) => void }) {
  const blocks = parseAideBlocks(md)
  return (
    <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--tx2)' }}>
      {blocks.map((b, i) => {
        const k = `b${i}`
        switch (b.kind) {
          case 'h2':
            return <h2 key={k} className="serif" style={{ fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '28px 0 8px' }}>{inline(b.text, k, onNavigate)}</h2>
          case 'h3':
            return <h3 key={k} style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', margin: '20px 0 6px' }}>{inline(b.text, k, onNavigate)}</h3>
          case 'quote':
            return (
              <blockquote key={k} className="serif" style={{ margin: '12px 0', padding: '4px 0 4px 14px', borderLeft: '2px solid var(--ac)', borderRadius: 0, fontStyle: 'italic', color: 'var(--tx)' }}>
                {inline(b.text, k, onNavigate)}
              </blockquote>
            )
          case 'ul':
          case 'ol': {
            const Tag = b.kind
            return (
              <Tag key={k} style={{ margin: '6px 0 10px', paddingLeft: 22, listStyleType: b.kind === 'ol' ? 'decimal' : 'disc' }}>
                {b.items.map((it, j) => <li key={j} style={{ margin: '4px 0' }}>{inline(it, `${k}-${j}`, onNavigate)}</li>)}
              </Tag>
            )
          }
          default:
            return <p key={k} style={{ margin: '8px 0' }}>{inline(b.text, k, onNavigate)}</p>
        }
      })}
    </div>
  )
}
