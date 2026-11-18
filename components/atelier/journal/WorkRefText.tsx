'use client'

// Plain text where `#1234` becomes a work link with its preview (WorkRef: thumbnail, loupe on hover / hold).
// For one-line previews (Aujourd'hui, a card's voice notes); full entries use EntryText (light Markdown too).
// Same mention rule as EntryText: `#` + 1–5 digits, not inside a word, not `##`.

import { Fragment } from 'react'
import { WorkRef } from '@/components/atelier/WorkRef'

const MENTION = /(?<![\w#])#(\d{1,5})\b/g

export function WorkRefText({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(MENTION)) {
    const at = m.index ?? 0
    if (at > last) out.push(<Fragment key={`t${i}`}>{text.slice(last, at)}</Fragment>)
    out.push(
      <WorkRef key={`w${i}`} id={Number(m[1])} style={{ color: 'var(--ac)', textDecoration: 'underline', textUnderlineOffset: 2 }} />,
    )
    last = at + m[0].length
    i++
  }
  if (last < text.length) out.push(<Fragment key="end">{text.slice(last)}</Fragment>)
  return <>{out}</>
}
