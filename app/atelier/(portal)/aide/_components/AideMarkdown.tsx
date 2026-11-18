'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The small markdown subset the Aide chapters use (`lib/aide/types.ts`). Text only — no HTML is ever injected.
 * Links: internal paths only (`/…`); anything else stays plain text.
 */

type Block =
  | { kind: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: 'p', text: para.join(' ') })
    para = []
  }
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const ul = /^- (.*)$/.exec(line)
    const ol = /^\d+\. (.*)$/.exec(line)
    const last = blocks[blocks.length - 1]
    if (line.startsWith('### ')) {
      flush()
      blocks.push({ kind: 'h3', text: line.slice(4) })
    } else if (line.startsWith('## ')) {
      flush()
      blocks.push({ kind: 'h2', text: line.slice(3) })
    } else if (line.startsWith('> ')) {
      flush()
      blocks.push({ kind: 'quote', text: line.slice(2) })
    } else if (ul || ol) {
      flush()
      const kind = ul ? 'ul' : 'ol'
      const item = (ul ?? ol)![1]
      if (last && last.kind === kind) last.items.push(item)
      else blocks.push({ kind, items: [item] })
    } else {
      para.push(line)
    }
  }
  flush()
  return blocks
}

/** **bold** and [label](/path). */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let at = 0
  let n = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push(text.slice(at, m.index))
    const key = `${keyBase}-${n++}`
    if (m[1] != null) out.push(<strong key={key} style={{ color: 'var(--tx)', fontWeight: 600 }}>{m[1]}</strong>)
    else if (m[3].startsWith('/')) out.push(<Link key={key} href={m[3]} style={{ color: 'var(--ac)' }}>{m[2]}</Link>)
    else out.push(m[2])
    at = m.index + m[0].length
  }
  if (at < text.length) out.push(text.slice(at))
  return out
}

export function AideMarkdown({ md }: { md: string }) {
  const blocks = parseBlocks(md)
  return (
    <div style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--tx2)' }}>
      {blocks.map((b, i) => {
        const k = `b${i}`
        switch (b.kind) {
          case 'h2':
            return <h2 key={k} className="serif" style={{ fontSize: 20, fontWeight: 400, color: 'var(--tx)', margin: '28px 0 8px' }}>{inline(b.text, k)}</h2>
          case 'h3':
            return <h3 key={k} style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', margin: '20px 0 6px' }}>{inline(b.text, k)}</h3>
          case 'quote':
            return (
              <blockquote key={k} className="serif" style={{ margin: '12px 0', padding: '4px 0 4px 14px', borderLeft: '2px solid var(--ac)', borderRadius: 0, fontStyle: 'italic', color: 'var(--tx)' }}>
                {inline(b.text, k)}
              </blockquote>
            )
          case 'ul':
          case 'ol': {
            const Tag = b.kind
            return (
              <Tag key={k} style={{ margin: '6px 0 10px', paddingLeft: 22, listStyleType: b.kind === 'ol' ? 'decimal' : 'disc' }}>
                {b.items.map((it, j) => <li key={j} style={{ margin: '4px 0' }}>{inline(it, `${k}-${j}`)}</li>)}
              </Tag>
            )
          }
          default:
            return <p key={k} style={{ margin: '8px 0' }}>{inline(b.text, k)}</p>
        }
      })}
    </div>
  )
}
