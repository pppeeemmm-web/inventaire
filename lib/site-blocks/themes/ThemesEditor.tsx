'use client'

import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { ThemesFields } from './ThemesRenderer'

/**
 * Themes editor — one theme per line. Lightweight; a richer chip-input
 * UI can replace this without changing the descriptor.
 */
export default function ThemesEditor({ fields, onChange }: BlockEditorProps<ThemesFields>) {
  const value = (fields.themes ?? []).join('\n')
  return (
    <div className="sb-themes-editor">
      <style>{`
        .sb-themes-editor textarea {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
          min-height: 100px; resize: vertical; line-height: 1.6;
        }
        .sb-themes-editor textarea:focus { outline: none; border-color: var(--bd3); }
        .sb-themes-editor .hint {
          margin-top: 6px;
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3);
        }
      `}</style>
      <textarea
        value={value}
        rows={6}
        onChange={e => {
          const next = e.target.value
            .split(/\r?\n/)
            .map(s => s.trim())
            .filter(s => s.length > 0)
          onChange({ themes: next })
        }}
      />
      <div className="hint">one theme per line</div>
    </div>
  )
}
