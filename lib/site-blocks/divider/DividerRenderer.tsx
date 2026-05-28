'use client'

import type { BlockRendererProps } from '@/lib/site-blocks/registry'

export type DividerStyle = 'rule' | 'spacer' | 'ornament'

export type DividerFields = {
  style: DividerStyle
}

export const DIVIDER_DEFAULTS: DividerFields = {
  style: 'rule',
}

/**
 * `divider` — three visual breaks: a thin hairline (`rule`), pure
 * whitespace (`spacer`), or a centered glyph ornament (`ornament`).
 * Universal block.
 */
export default function DividerRenderer({ fields }: BlockRendererProps<DividerFields>) {
  return (
    <div className="sb-div" data-block-kind="divider" data-style={fields.style}>
      <style>{`
        .sb-div { padding: 24px 0; }
        .sb-div[data-style="rule"] {
          height: 0;
          border-top: 1px solid currentColor;
          opacity: 0.18;
        }
        .sb-div[data-style="spacer"] { padding: 28px 0; }
        .sb-div[data-style="ornament"] {
          text-align: center;
          font-family: 'Instrument Serif', serif;
          font-size: 18px;
          letter-spacing: 0.6em;
          opacity: 0.4;
        }
      `}</style>
      {fields.style === 'ornament' && <span aria-hidden>· · ·</span>}
    </div>
  )
}
