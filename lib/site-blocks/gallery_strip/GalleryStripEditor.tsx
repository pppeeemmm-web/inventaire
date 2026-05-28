'use client'

import { useI18n } from '@/lib/i18n/context'
import type { BlockEditorProps } from '@/lib/site-blocks/registry'
import type { GalleryStripFields, GalleryStripItem } from './GalleryStripRenderer'

export default function GalleryStripEditor({ fields, onChange }: BlockEditorProps<GalleryStripFields>) {
  const { t } = useI18n()
  const items: GalleryStripItem[] = fields.items ?? []

  function setItems(next: GalleryStripItem[]) {
    onChange({ items: next } as Partial<GalleryStripFields>)
  }

  function addItem() {
    setItems([...items, { url: '' }])
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i))
  }

  function setUrl(i: number, url: string) {
    setItems(items.map((it, idx) => idx === i ? { ...it, url } : it))
  }

  function moveItem(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    const [moved] = next.splice(i, 1)
    next.splice(j, 0, moved)
    setItems(next)
  }

  return (
    <div className="sb-gs-editor">
      <style>{`
        .sb-gs-editor { display: flex; flex-direction: column; gap: 10px; }
        .sb-gs-editor .row {
          display: grid; grid-template-columns: 60px 1fr; gap: 8px; align-items: start;
        }
        .sb-gs-editor label {
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); padding-top: 6px;
        }
        .sb-gs-editor input {
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
          width: 100%; box-sizing: border-box;
        }
        .sb-gs-editor input:focus { outline: none; border-color: var(--bd3); }

        .sb-gs-items { display: flex; flex-direction: column; gap: 4px; }
        .sb-gs-item-row {
          display: flex; gap: 4px; align-items: stretch;
        }
        .sb-gs-item-input {
          flex: 1;
          font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 7px 8px; background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
        }
        .sb-gs-item-input:focus { outline: none; border-color: var(--bd3); }
        .sb-gs-item-thumb {
          flex: 0 0 auto;
          width: 32px; height: 32px;
          object-fit: cover;
          border: 1px solid var(--bd);
        }
        .sb-gs-item-btn {
          flex: 0 0 auto;
          border: 1px solid var(--bd2); background: var(--bg2); cursor: pointer;
          width: 28px; min-height: 32px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--tx2);
          transition: background 120ms, color 120ms;
        }
        .sb-gs-item-btn:hover { background: var(--bg3); color: var(--tx); }
        .sb-gs-item-btn:disabled { color: var(--bd3); cursor: not-allowed; }
        .sb-gs-item-btn.danger:hover { color: var(--rust); }

        .sb-gs-add-btn {
          align-self: flex-start;
          border: 1px dashed var(--bd2); background: transparent; cursor: pointer;
          padding: 6px 12px;
          font-family: 'JetBrains Mono', monospace; font-size: 9px;
          letter-spacing: 1.5px; text-transform: uppercase; color: var(--tx3);
          transition: border-color 120ms, color 120ms;
        }
        .sb-gs-add-btn:hover { border-color: var(--bd3); color: var(--tx); }

        .sb-gs-divider {
          border: none; border-top: 1px dashed var(--bd2); margin: 2px 0;
        }
      `}</style>

      {/* Image list */}
      <div className="sb-gs-items">
        {items.length === 0 && (
          <div style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--tx3)' }}>
            {t('site_gallery_strip_empty')}
          </div>
        )}
        {items.map((item, i) => {
          const hasPreview = item.url && /^https?:\/\//i.test(item.url.trim())
          return (
            <div key={i} className="sb-gs-item-row">
              {hasPreview && (
                <img className="sb-gs-item-thumb" src={item.url} alt="" loading="lazy" />
              )}
              <input
                className="sb-gs-item-input"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="https://…"
                value={item.url}
                onChange={e => setUrl(i, e.target.value)}
                aria-label={t('site_gallery_strip_url_label')}
              />
              <button type="button" className="sb-gs-item-btn"
                onClick={() => moveItem(i, -1)}
                disabled={i === 0}
                title={t('site_block_action_move_up')}
                aria-label={t('site_block_action_move_up')}
              >▴</button>
              <button type="button" className="sb-gs-item-btn"
                onClick={() => moveItem(i, 1)}
                disabled={i === items.length - 1}
                title={t('site_block_action_move_down')}
                aria-label={t('site_block_action_move_down')}
              >▾</button>
              <button type="button" className="sb-gs-item-btn danger"
                onClick={() => removeItem(i)}
                title={t('site_block_action_remove')}
                aria-label={t('site_block_action_remove')}
              >×</button>
            </div>
          )
        })}
      </div>

      <button type="button" className="sb-gs-add-btn" onClick={addItem}>
        {t('site_gallery_strip_add')}
      </button>

      <hr className="sb-gs-divider" />

      {/* Block-level caption */}
      <div className="row">
        <label htmlFor="sb-gs-cap-fr">{t('site_image_caption_fr')}</label>
        <input id="sb-gs-cap-fr" type="text" value={fields.caption_fr}
          onChange={e => onChange({ caption_fr: e.target.value })} />
      </div>
      <div className="row">
        <label htmlFor="sb-gs-cap-en">{t('site_image_caption_en')}</label>
        <input id="sb-gs-cap-en" type="text" value={fields.caption_en}
          onChange={e => onChange({ caption_en: e.target.value })} />
      </div>
    </div>
  )
}
