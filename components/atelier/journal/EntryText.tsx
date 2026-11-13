'use client'

// Read-only display of a journal entry's text with light Markdown (headings, **bold**, *italic*,
// `code`, lists, tables, ---). The stored text is never changed (append-only, verbatim):
// this only decides how it looks. No HTML is injected — every piece is a React text node.

import type { ReactNode } from 'react'
import { WorkRef } from '@/components/atelier/WorkRef'

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = []
  // `#1234` = a work mention (not inside a word, not `##`): a link with hover / hold preview.
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|(?<![\w#])#\d{1,5}\b)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const k = `${key}-${i++}`
    if (tok.startsWith('#'))
      out.push(
        <WorkRef key={k} id={Number(tok.slice(1))} style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }} />,
      )
    else if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('`')) out.push(<code key={k} style={{ fontSize: '0.92em' }}>{tok.slice(1, -1)}</code>)
    else out.push(<em key={k}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())

export function EntryText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let i = 0

  const flush = () => {
    if (!para.length) return
    const k = `p${blocks.length}`
    blocks.push(
      <p key={k} style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>
        {inline(para.join('\n'), k)}
      </p>,
    )
    para = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const k = `b${blocks.length}`
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    if (h) {
      flush()
      const size = h[1].length <= 2 ? 17 : 15
      blocks.push(
        <p key={k} style={{ margin: '4px 0 8px', fontSize: size, fontWeight: 600, lineHeight: 1.35 }}>
          {inline(h[2], k)}
        </p>,
      )
      i++
      continue
    }
    if (/^\s*-{3,}\s*$/.test(line)) {
      flush()
      blocks.push(<hr key={k} style={{ border: 0, borderTop: '1px solid var(--bd)', margin: '10px 0' }} />)
      i++
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush()
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(cells(lines[i]))
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <table
          key={k}
          style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 12, lineHeight: 1.4, margin: '0 0 10px' }}
        >
          {head ? (
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} style={{ textAlign: 'left', borderBottom: '1px solid var(--bd)', padding: '4px 6px 4px 0', overflowWrap: 'anywhere', verticalAlign: 'top' }}>
                    {inline(c, `${k}h${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci} style={{ borderBottom: '1px solid var(--bd2)', padding: '4px 6px 4px 0', overflowWrap: 'anywhere', verticalAlign: 'top' }}>
                    {inline(c, `${k}r${ri}c${ci}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }
    const li = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/.exec(line)
    if (li) {
      flush()
      const ordered = !!li[1]
      const items: string[] = []
      while (i < lines.length) {
        const m = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(lines[i])
        if (!m) break
        items.push(m[1])
        i++
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag key={k} start={ordered ? Number(li[1]) : undefined} style={{ margin: '0 0 8px', paddingLeft: 20 }}>
          {items.map((it, ii) => (
            <li key={ii} style={{ marginBottom: 4 }}>
              {inline(it, `${k}i${ii}`)}
            </li>
          ))}
        </ListTag>,
      )
      continue
    }
    if (!line.trim()) {
      flush()
      i++
      continue
    }
    para.push(line)
    i++
  }
  flush()

  return <div style={{ fontSize: 15, lineHeight: 1.6, overflowWrap: 'anywhere' }}>{blocks}</div>
}
