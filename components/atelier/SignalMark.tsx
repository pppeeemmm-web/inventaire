// SignalMark — one state mark readable from 2 m: colour AND shape, never colour alone
// (design pass 2026-11-13, docs/HANDOFF_2026-11-13_DESIGN_BUILD.md §1).
// ■ square = wrong · ▲ triangle = needs attention · ● filled circle = OK · ○ outline circle = info.
// Decorative: the parent carries the text / aria-label.

import type { CSSProperties } from 'react'

export type SignalKind = 'wrong' | 'attention' | 'ok' | 'info'

export const SIGNAL_COLOR: Record<SignalKind, string> = {
  wrong: 'var(--rust)',
  attention: 'var(--yellow)',
  ok: 'var(--sage)',
  info: 'var(--tx2)',
}

/** Rank for "worst first" and the overall state of a set of signals. */
export const SIGNAL_RANK: Record<SignalKind, number> = { wrong: 0, attention: 1, ok: 2, info: 3 }

export function SignalMark({ kind, size = 10, style }: { kind: SignalKind; size?: number; style?: CSSProperties }) {
  const base: CSSProperties = { display: 'inline-block', flex: 'none', boxSizing: 'border-box', ...style }
  if (kind === 'wrong') return <span aria-hidden="true" style={{ ...base, width: size, height: size, background: SIGNAL_COLOR.wrong }} />
  if (kind === 'attention') {
    return (
      <span aria-hidden="true" style={{ ...base, width: size + 2, height: size + 1, background: SIGNAL_COLOR.attention, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
    )
  }
  if (kind === 'ok') return <span aria-hidden="true" style={{ ...base, width: size, height: size, borderRadius: '50%', background: SIGNAL_COLOR.ok }} />
  return <span aria-hidden="true" style={{ ...base, width: size, height: size, borderRadius: '50%', border: `1.5px solid ${SIGNAL_COLOR.info}` }} />
}
