/**
 * The Aide's markdown subset (`types.ts`), parsed once for every reader: the in-app page (`AideMarkdown`), the
 * « ? » panel and the PDF guide (`lib/aide/pdf.ts`) — so the screen and the download always read the same text
 * the same way. Text only: no HTML is ever produced here.
 */

export type AideBlock =
  | { kind: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }

export type AideInline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string }

export function parseAideBlocks(md: string): AideBlock[] {
  const blocks: AideBlock[] = []
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

/** **bold** and [label](/path). A link to anything but an internal path stays plain text. */
export function parseAideInline(text: string): AideInline[] {
  const out: AideInline[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let at = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > at) out.push({ kind: 'text', text: text.slice(at, m.index) })
    if (m[1] != null) out.push({ kind: 'bold', text: m[1] })
    else if (m[3].startsWith('/')) out.push({ kind: 'link', text: m[2], href: m[3] })
    else out.push({ kind: 'text', text: m[2] })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

/** Plain text of a chapter (search in the « ? » panel). */
export function aidePlainText(md: string): string {
  return md.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/^[#>\-\d.\s]+/gm, '')
}
