'use client'

import type { MutableRefObject, RefObject, Dispatch, SetStateAction } from 'react'
import type { DictKey } from '@/lib/i18n/dictionary'
import { type Shape, type Tool } from './constellation-shared'

type ToolRow = { id: Tool; l: string; tipKey: DictKey }

export type ConstellationToolRailProps = {
  t: (key: DictKey) => string
  toolRailRef: RefObject<HTMLDivElement | null>
  toolbarTools: readonly ToolRow[]
  tool: Tool
  setTool: (tool: Tool) => void
  drawColor: string
  setDrawColor: (c: string) => void
  drawWidth: number
  setDrawWidth: (w: number) => void
  shapes: Shape[]
  setShapes: (s: Shape[]) => void
  toolShortcutsOpen: boolean
  setToolShortcutsOpen: Dispatch<SetStateAction<boolean>>
  shortcutsPanelId: string
}

export function ConstellationToolRail(props: ConstellationToolRailProps) {
  const {
    t, toolRailRef, toolbarTools, tool, setTool,
    drawColor, setDrawColor, drawWidth, setDrawWidth, shapes, setShapes,
    toolShortcutsOpen, setToolShortcutsOpen, shortcutsPanelId,
  } = props

  return (
            <div
              ref={toolRailRef}
              data-testid="constellation-tool-rail"
              style={{
                flexShrink: 0,
                width: 52,
                minWidth: 52,
                borderRight: '1px solid var(--bd)',
                background: 'var(--bg1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: '6px 4px',
                gap: 4,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <div className="t-label" style={{ textAlign: 'center', fontSize: 8, color: 'var(--tx3)', flexShrink: 0 }}>
                {t('const_tools')}
              </div>
              {toolbarTools.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={`btn ghost sm ${tool === row.id ? 'active' : ''}`}
                  title={t(row.tipKey)}
                  aria-label={t(row.tipKey)}
                  aria-pressed={tool === row.id}
                  style={{
                    flexShrink: 0,
                    minHeight: 44,
                    minWidth: 44,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    borderColor: tool === row.id ? 'var(--ac)' : undefined,
                    color: tool === row.id ? 'var(--ac)' : undefined,
                  }}
                  onClick={() => {
                    setTool(row.id)
                    setToolShortcutsOpen(false)
                  }}
                >
                  {row.l}
                </button>
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 44, flexShrink: 0 }}>
                <input
                  type="color"
                  value={drawColor}
                  onChange={e => setDrawColor(e.target.value)}
                  aria-label={t('const_drawColorTitle')}
                  title={t('const_drawColorTitle')}
                  style={{ width: 36, height: 36, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </div>
              <select
                value={drawWidth}
                onChange={e => setDrawWidth(Number(e.target.value))}
                aria-label={t('const_strokeWidthTitle')}
                style={{
                  fontSize: 9,
                  width: '100%',
                  minHeight: 44,
                  flexShrink: 0,
                  background: 'var(--bg0)',
                  border: '1px solid var(--bd)',
                  color: 'var(--tx)',
                  padding: '2px 4px',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
                title={t('const_strokeWidthTitle')}
              >
                <option value="1">1px</option>
                <option value="2">2px</option>
                <option value="4">4px</option>
                <option value="8">8px</option>
                <option value="16">16px</option>
              </select>
              {shapes.length > 0 && (
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => {
                    if (confirm(t('const_drawLayerClearAllConfirm'))) setShapes([])
                  }}
                  style={{
                    minHeight: 44,
                    width: '100%',
                    flexShrink: 0,
                    padding: '0 4px',
                    color: 'var(--rust)',
                    borderColor: 'var(--rust)',
                  }}
                  title={t('const_drawLayerClearAllTitle')}
                  aria-label={t('const_drawLayerClearAllTitle')}
                >
                  {t('clearSel')}
                </button>
              )}
              <div style={{ flex: 1, minHeight: 4 }} aria-hidden />
              <button
                type="button"
                className="btn ghost sm"
                aria-expanded={toolShortcutsOpen}
                aria-controls={shortcutsPanelId}
                aria-label={t('const_toolbarShortcutsToggle')}
                title={t('const_toolbarShortcutsToggle')}
                onClick={() => setToolShortcutsOpen(o => !o)}
                style={{
                  flexShrink: 0,
                  minHeight: 44,
                  width: '100%',
                  fontSize: 15,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ⓘ
              </button>
            </div>
  )
}
