'use client'

import type { ThemeWork } from '@/lib/portfolio-config-types'
import { reorder } from '@/lib/portfolio-config-types'
import { WorkThumb } from '../../WorkThumb'
import { ReorderableThumb } from './ReorderableThumb'

export function WorksReorder({ privateWorks, orderIds, onReorder, onMakePublic }: {
  privateWorks: ThemeWork[]
  orderIds: number[]
  onReorder: (ids: number[]) => void
  onMakePublic?: (id: number) => void
}) {
  const visible = privateWorks.filter(w => w.isPublic)
  const hidden  = privateWorks.filter(w => !w.isPublic)

  const themeWorkIds = new Set(privateWorks.map(w => w.OeuvreID))
  const visibleMap = new Map(visible.map(w => [w.OeuvreID, w]))
  const seen = new Set<number>()
  const ordered: ThemeWork[] = []
  for (const id of orderIds) {
    if (!themeWorkIds.has(id)) continue
    const w = visibleMap.get(id)
    if (w && !seen.has(id)) { ordered.push(w); seen.add(id) }
  }
  for (const w of visible) if (!seen.has(w.OeuvreID)) ordered.push(w)

  const setOrder = (next: ThemeWork[]) => onReorder(next.map(w => w.OeuvreID))

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ordered.length) return
    setOrder(reorder(ordered, from, to))
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {ordered.length > 0 && (
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="t-mono-xs" style={{ color: 'var(--tx3)', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>
            PUBLIQUES ({ordered.length}) — glisser ou ↑↓ pour réordonner
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ordered.map((w, i) => (
              <ReorderableThumb key={w.OeuvreID} w={w} index={i} total={ordered.length} onMove={move}
                onDropFrom={(from, to) => setOrder(reorder(ordered, from, to))} />
            ))}
          </div>
        </div>
      )}
      {hidden.length > 0 && (
        <div>
          <div className="t-mono-xs" style={{ color: 'var(--rust)', fontSize: 10, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>
            ⚠ NON-PUBLIQUES ({hidden.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {hidden.map(w => (
              <div key={w.OeuvreID} style={{ width: 64, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: 64, height: 64, overflow: 'hidden', flexShrink: 0,
                  background: 'repeating-linear-gradient(45deg, var(--bg2), var(--bg2) 6px, var(--bg1) 6px, var(--bg1) 12px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid var(--rust)', boxSizing: 'border-box', position: 'relative',
                }}>
                  {w.txtImageNameLink
                    ? <WorkThumb file={w.txtImageNameLink} size={128} alt="" />
                    : <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--tx3)', opacity: 0.4, lineHeight: 1 }}>{w.OeuvreID}</span>
                  }
                </div>
                <div className="t-mono-xs" style={{ fontSize: 9, color: 'var(--rust)', fontWeight: 700 }}>#{w.OeuvreID}</div>
                {onMakePublic && (
                  <button onClick={() => onMakePublic(w.OeuvreID)} title={`Rendre #${w.OeuvreID} public`}
                    style={{
                      width: '100%', background: 'var(--rust)', color: '#fff',
                      border: 'none', borderRadius: 2, fontSize: 8, padding: '2px 0',
                      cursor: 'pointer', letterSpacing: 0.3, fontWeight: 600,
                    }}>→ publier</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
