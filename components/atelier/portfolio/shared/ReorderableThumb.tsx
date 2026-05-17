'use client'

import { useState } from 'react'
import type { ThemeWork } from '@/lib/portfolio-config-types'
import { WorkThumb } from '../../WorkThumb'
import { moveBtnStyle } from './moveBtnStyle'

export function ReorderableThumb({ w, index, total, onMove, onDropFrom }: {
  w: ThemeWork
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onDropFrom: (from: number, to: number) => void
}) {
  const [hover,    setHover]    = useState(false)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('text/x-work-from', String(index))
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDrop={e => {
        e.preventDefault()
        const from = Number(e.dataTransfer.getData('text/x-work-from'))
        if (Number.isFinite(from) && from !== index) onDropFrom(from, index)
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 80, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        opacity: dragging ? 0.4 : 1, cursor: 'grab', position: 'relative',
      }}
    >
      <div style={{
        width: 80, height: 80, overflow: 'hidden', position: 'relative',
        background: 'var(--bg2)',
        border: '2px solid transparent', boxSizing: 'border-box',
      }}>
        {w.txtImageNameLink
          ? <WorkThumb file={w.txtImageNameLink} size={160} alt="" />
          : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: 20, fontWeight: 900, color: 'var(--tx3)', opacity: 0.4 }}>{w.OeuvreID}</div>
        }
        <div className="t-mono-xs" style={{
          position: 'absolute', top: 2, left: 2,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          fontSize: 9, padding: '1px 4px', borderRadius: 2, letterSpacing: 0.5,
        }}>{index + 1}</div>
        {hover && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            display: 'flex', gap: 2,
          }}>
            <button onClick={e => { e.stopPropagation(); onMove(index, index - 1) }} disabled={index === 0}
              title="← précédent" style={{ ...moveBtnStyle(index === 0), width: 18, height: 18, fontSize: 9, background: 'rgba(255,255,255,0.9)' }}>←</button>
            <button onClick={e => { e.stopPropagation(); onMove(index, index + 1) }} disabled={index === total - 1}
              title="suivant →" style={{ ...moveBtnStyle(index === total - 1), width: 18, height: 18, fontSize: 9, background: 'rgba(255,255,255,0.9)' }}>→</button>
          </div>
        )}
      </div>
      <div className="t-mono-xs" style={{ fontSize: 9, color: 'var(--tx3)', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        #{w.OeuvreID}
      </div>
    </div>
  )
}
