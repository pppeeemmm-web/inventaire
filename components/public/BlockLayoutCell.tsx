'use client'

import type { ReactNode } from 'react'
import type { BlockLayoutWidth } from '@/lib/portfolio-config-types'

interface Props {
  width: BlockLayoutWidth
  children: ReactNode
}

/**
 * Wraps a single block so a row of blocks lays out as
 * `full | half | third` widths via flex-basis. Stacks to full-width below
 * 768px regardless of declared width — half/third are desktop-only.
 *
 * Use inside a parent that has `display: flex; flex-wrap: wrap; gap: ...`
 * (typically `<BlockRow>` — to be added when the editor needs row grouping).
 * For a single column page, each `<BlockLayoutCell>` simply fills its row.
 */
export default function BlockLayoutCell({ width, children }: Props) {
  const cls = `bl-cell bl-cell-${width}`
  return (
    <div className={cls}>
      <style>{`
        .bl-cell {
          box-sizing: border-box;
          min-width: 0; /* allow children to shrink inside flex */
        }
        .bl-cell-full  { flex: 1 0 100%; }
        .bl-cell-half  { flex: 0 1 calc(50% - 8px); }
        .bl-cell-third { flex: 0 1 calc(33.333% - 11px); }
        @media (max-width: 768px) {
          .bl-cell-half, .bl-cell-third { flex: 1 0 100%; }
        }
      `}</style>
      {children}
    </div>
  )
}
