'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import {
  PAGES,
  type Block,
  type BlockKind,
  type BlockLayoutWidth,
  type Page,
  type PortfolioConfig,
} from '@/lib/portfolio-config-types'
import { getDescriptor, kindsAllowedOnPage } from '@/lib/site-blocks'

interface Props {
  config: PortfolioConfig
  setConfig: (next: PortfolioConfig) => void
}

const PAGE_LABEL_KEY: Record<Page, 'site_page_landing' | 'site_page_works' | 'site_page_about'> = {
  landing: 'site_page_landing',
  works: 'site_page_works',
  about: 'site_page_about',
}

const KIND_LABEL_KEY: Partial<Record<BlockKind,
  | 'site_block_kind_text'
  | 'site_block_kind_biographie'
  | 'site_block_kind_approach'
  | 'site_block_kind_themes'
  | 'site_block_kind_materials'
>> = {
  text: 'site_block_kind_text',
  biographie: 'site_block_kind_biographie',
  approach: 'site_block_kind_approach',
  themes: 'site_block_kind_themes',
  materials: 'site_block_kind_materials',
}

function makeUid(): string {
  if (typeof globalThis !== 'undefined'
    && globalThis.crypto
    && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Page-tabbed editor for the block-composition model. Wraps `config.pages`
 * with add/move/visibility/layout-width/remove + descriptor-driven editors.
 *
 * Coexists with the legacy section-by-kind UI in SiteEditorPanel for now —
 * authors can manage hero/identity/works_modes via the existing surface
 * and the new composition blocks here. Once every kind has a descriptor +
 * editor, the legacy surface can be retired.
 */
export default function PagesEditor({ config, setConfig }: Props) {
  const { t, lang } = useI18n()
  const [activePage, setActivePage] = useState<Page>('about')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const pages = config.pages ?? {}
  const rawBlocks = useMemo<Block[]>(
    () => (pages[activePage] ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [pages, activePage],
  )

  function commit(next: Block[]) {
    setConfig({ ...config, pages: { ...pages, [activePage]: next } })
  }

  function updateBlock(uid: string, patch: Partial<Block>) {
    commit(rawBlocks.map(b => b.uid === uid ? { ...b, ...patch } : b))
  }

  function updateFields(uid: string, patch: Record<string, unknown>) {
    commit(rawBlocks.map(b => b.uid === uid
      ? { ...b, fields: { ...b.fields, ...patch } }
      : b))
  }

  function removeBlock(uid: string) {
    commit(rawBlocks.filter(b => b.uid !== uid))
  }

  function moveBlock(uid: string, dir: -1 | 1) {
    const i = rawBlocks.findIndex(b => b.uid === uid)
    if (i < 0) return
    const j = i + dir
    if (j < 0 || j >= rawBlocks.length) return
    const next = rawBlocks.slice()
    const [moved] = next.splice(i, 1)
    next.splice(j, 0, moved)
    commit(next.map((b, k) => ({ ...b, sort_order: k * 10 })))
  }

  function addBlock(kind: BlockKind) {
    const desc = getDescriptor(kind)
    if (!desc) return
    const newBlock: Block = {
      uid: makeUid(),
      kind,
      page: activePage,
      visible: true,
      layout_width: 'full',
      fields: { ...(desc.defaultFields as Record<string, unknown>) },
      sort_order: (rawBlocks[rawBlocks.length - 1]?.sort_order ?? -10) + 10,
    }
    commit([...rawBlocks, newBlock])
    setExpanded(prev => {
      const n = new Set(prev)
      n.add(newBlock.uid)
      return n
    })
  }

  function toggleExpanded(uid: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(uid)) n.delete(uid)
      else n.add(uid)
      return n
    })
  }

  const addableKinds = useMemo(
    () => kindsAllowedOnPage(activePage),
    [activePage],
  )

  return (
    <div className="pe-root">
      <style>{`
        .pe-root {
          display: flex; flex-direction: column; gap: 12px;
          font-family: 'JetBrains Mono', monospace;
        }
        .pe-help {
          font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3);
          padding: 4px 0 8px;
          border-bottom: 1px dashed var(--bd2);
        }
        .pe-page-tabs {
          display: flex; gap: 2px;
          border-bottom: 1px solid var(--bd);
        }
        .pe-page-tab {
          flex: 1; padding: 8px 10px;
          background: transparent; color: var(--tx2);
          border: none; border-bottom: 2px solid transparent;
          font-family: inherit; font-size: 9px; letter-spacing: 2px;
          text-transform: uppercase; cursor: pointer;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .pe-page-tab:hover { color: var(--tx); }
        .pe-page-tab[aria-pressed="true"] {
          color: var(--ac); border-bottom-color: var(--ac);
        }
        .pe-block-list { display: flex; flex-direction: column; gap: 4px; }
        .pe-block-card {
          border: 1px solid var(--bd);
          background: var(--bg1);
        }
        .pe-block-card[data-hidden="1"] { opacity: 0.45; }
        .pe-block-header {
          display: flex; align-items: stretch; min-height: 32px;
        }
        .pe-block-handle {
          width: 18px; display: flex; align-items: center; justify-content: center;
          color: var(--bd3); border-right: 1px solid var(--bd);
          font-size: 14px;
        }
        .pe-block-kind {
          flex: 1; padding: 0 10px;
          display: flex; align-items: center;
          font-size: 8px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); gap: 8px;
        }
        .pe-block-kind strong { color: var(--tx); font-weight: 400; }
        .pe-icon-btn {
          border: none; background: transparent; cursor: pointer;
          width: 28px; display: flex; align-items: center; justify-content: center;
          color: var(--tx2); font-family: inherit; font-size: 10px;
          border-left: 1px solid var(--bd);
          transition: background 120ms ease, color 120ms ease;
        }
        .pe-icon-btn:hover { background: var(--bg2); color: var(--tx); }
        .pe-icon-btn:disabled { color: var(--bd3); cursor: not-allowed; }
        .pe-icon-btn[data-on="1"] { color: var(--ac); }
        .pe-icon-btn.danger:hover { color: var(--rust); }
        .pe-layout-group {
          display: flex; border-left: 1px solid var(--bd);
        }
        .pe-layout-btn {
          border: none; background: transparent; cursor: pointer;
          width: 22px; padding: 0;
          color: var(--tx3); font-family: inherit; font-size: 9px;
        }
        .pe-layout-btn[aria-pressed="true"] {
          color: var(--ac); background: var(--bg2);
        }
        .pe-layout-btn:hover { color: var(--tx); }
        .pe-block-body {
          padding: 10px 12px;
          border-top: 1px dashed var(--bd);
          font-size: 10px; color: var(--tx2);
        }
        .pe-no-desc {
          padding: 10px 12px;
          font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3); font-style: italic;
        }
        .pe-empty {
          padding: 16px; text-align: center;
          font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--tx3);
          border: 1px dashed var(--bd2);
        }
        .pe-add-row {
          display: flex; gap: 6px; align-items: center;
          padding-top: 6px;
        }
        .pe-add-select {
          flex: 1;
          font-family: inherit; font-size: 10px; padding: 6px 8px;
          background: var(--bg2); color: var(--tx);
          border: 1px solid var(--bd2); border-radius: 0;
        }
        .pe-add-select:focus { outline: none; border-color: var(--bd3); }
      `}</style>

      <div className="pe-help">{t('site_composition_help')}</div>

      <div className="pe-page-tabs" role="tablist">
        {PAGES.map(p => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-pressed={p === activePage}
            className="pe-page-tab"
            onClick={() => setActivePage(p)}
          >
            {t(PAGE_LABEL_KEY[p])}
          </button>
        ))}
      </div>

      <div className="pe-block-list">
        {rawBlocks.length === 0 && (
          <div className="pe-empty">{t('site_block_empty_page')}</div>
        )}
        {rawBlocks.map((block, i) => {
          const desc = getDescriptor(block.kind)
          const isExpanded = expanded.has(block.uid)
          const Editor = desc?.editor
          const kindKey = KIND_LABEL_KEY[block.kind]
          const kindLabel = kindKey ? t(kindKey) : block.kind
          const fields = desc?.migrateFields
            ? desc.migrateFields(block.fields)
            : (block.fields as Record<string, unknown>)
          return (
            <div
              key={block.uid}
              className="pe-block-card"
              data-hidden={block.visible ? '0' : '1'}
            >
              <div className="pe-block-header">
                <div className="pe-block-handle" aria-hidden>≡</div>
                <button
                  type="button"
                  className="pe-block-kind"
                  onClick={() => toggleExpanded(block.uid)}
                  aria-expanded={isExpanded}
                >
                  <strong>{kindLabel}</strong>
                  <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
                    {isExpanded ? '▾' : '▸'}
                  </span>
                </button>
                <div className="pe-layout-group" role="group" aria-label="layout width">
                  {(['full', 'half', 'third'] as BlockLayoutWidth[]).map(w => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={block.layout_width === w}
                      className="pe-layout-btn"
                      onClick={() => updateBlock(block.uid, { layout_width: w })}
                      title={t(
                        w === 'full' ? 'site_block_layout_full'
                          : w === 'half' ? 'site_block_layout_half'
                            : 'site_block_layout_third'
                      )}
                    >
                      {w === 'full' ? '▬' : w === 'half' ? '▬▬' : '▬▬▬'}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="pe-icon-btn"
                  onClick={() => moveBlock(block.uid, -1)}
                  disabled={i === 0}
                  title={t('site_block_action_move_up')}
                  aria-label={t('site_block_action_move_up')}
                >▴</button>
                <button
                  type="button"
                  className="pe-icon-btn"
                  onClick={() => moveBlock(block.uid, 1)}
                  disabled={i === rawBlocks.length - 1}
                  title={t('site_block_action_move_down')}
                  aria-label={t('site_block_action_move_down')}
                >▾</button>
                <button
                  type="button"
                  className="pe-icon-btn"
                  data-on={block.visible ? '1' : '0'}
                  onClick={() => updateBlock(block.uid, { visible: !block.visible })}
                  title={t(block.visible ? 'site_block_action_visible' : 'site_block_action_hidden')}
                  aria-label={t(block.visible ? 'site_block_action_visible' : 'site_block_action_hidden')}
                >{block.visible ? '●' : '○'}</button>
                <button
                  type="button"
                  className="pe-icon-btn danger"
                  onClick={() => removeBlock(block.uid)}
                  title={t('site_block_action_remove')}
                  aria-label={t('site_block_action_remove')}
                >×</button>
              </div>
              {isExpanded && Editor && (
                <div className="pe-block-body">
                  <Editor
                    block={block}
                    fields={fields}
                    onChange={patch => updateFields(block.uid, patch as Record<string, unknown>)}
                    ctx={{ page: activePage, lang }}
                  />
                </div>
              )}
              {isExpanded && !desc && (
                <div className="pe-no-desc">{t('site_block_no_descriptor')}</div>
              )}
            </div>
          )
        })}
      </div>

      <div className="pe-add-row">
        <select
          className="pe-add-select"
          value=""
          onChange={e => {
            const v = e.target.value
            if (v) addBlock(v as BlockKind)
            e.target.value = ''
          }}
        >
          <option value="">{t('site_block_add')}</option>
          {addableKinds.map(k => {
            const lk = KIND_LABEL_KEY[k]
            return (
              <option key={k} value={k}>{lk ? t(lk) : k}</option>
            )
          })}
        </select>
      </div>
    </div>
  )
}
