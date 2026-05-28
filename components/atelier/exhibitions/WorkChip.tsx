'use client'

import type { DragEvent } from 'react'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumb } from '@/components/atelier/WorkThumb'

export function WorkChip({ oeuvre, onDragStart }: {
  oeuvre:      Oeuvre
  onDragStart: (id: number, e: DragEvent) => void
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(oeuvre.OeuvreID, e)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
        border: '1px solid var(--bd)', background: 'var(--bg1)',
        cursor: 'grab', marginBottom: 4, userSelect: 'none',
      }}
    >
      {oeuvre.txtImageNameLink && (
        <div style={{ width: 40, height: 40, position: 'relative', flexShrink: 0 }}>
          <WorkThumb file={oeuvre.txtImageNameLink} size={256} alt="" />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {oeuvre.Titre ?? 'S/T'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>#{oeuvre.OeuvreID}</div>
      </div>
    </div>
  )
}
