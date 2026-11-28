'use client'

// Laboratoire — the book of a field / chapter: one read (GET /api/ideas?book=<id>), shown as one reading column
// (design 2026-11-28/Laboratoire.md, « book's order »). Read only; no writes.

import { useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { LabBookNode } from '@/lib/ideas/read'
import { LabGrid } from './LabPanel'

const small: CSSProperties = { fontSize: 13, color: 'var(--tx3)' }
const bodyText: CSSProperties = { fontSize: 16, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0 0' }
const h4: CSSProperties = { margin: '12px 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--tx2)' }

export function LabBook({ rootId, onOpen, onClose }: { rootId: string; onOpen: (id: string) => void; onClose: () => void }) {
  const { t } = useI18n()
  const tt = t as unknown as (k: string) => string
  const [root, setRoot] = useState<LabBookNode | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    fetch(`/api/ideas?book=${encodeURIComponent(rootId)}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = (await r.json()) as { root?: LabBookNode }
        if (!r.ok || !j.root) throw new Error('book')
        return j.root
      })
      .then((n) => {
        if (!alive) return
        setRoot(n)
        setState('ok')
      })
      .catch(() => {
        if (alive) setState('error')
      })
    return () => {
      alive = false
    }
  }, [rootId])

  function item(n: LabBookNode) {
    const graded = (n.role === 'recette' || n.role === 'conjecture') && n.assessments.length > 0
    return (
      <article key={n.id} style={{ margin: '18px 0', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...small, fontWeight: 600 }}>{tt(`lab_role_${n.role}`)}</span>
          <button
            type="button"
            aria-label={t('lab_book_open_item').replace('{title}', n.title)}
            onClick={() => onOpen(n.id)}
            style={{ minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', fontSize: 17, fontWeight: 600, textAlign: 'left', overflowWrap: 'anywhere', flex: 1, minWidth: 0 }}
          >
            {n.title}
          </button>
        </div>
        {n.text.trim() ? <p style={bodyText}>{n.text}</p> : null}
        {n.role === 'recette' ? (
          <div>
            {n.version != null ? <div style={{ ...small, fontWeight: 600, marginTop: 6 }}>{t('lab_version').replace('{n}', String(n.version))}</div> : null}
            {n.ingredients.length ? (
              <>
                <h4 style={h4}>{t('lab_ingredients')}</h4>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 2, fontSize: 16 }}>
                  {n.ingredients.map((r, i) => (
                    <li key={i} style={{ overflowWrap: 'anywhere' }}>
                      {r.stockName ?? r.label ?? '—'}
                      {r.amount != null ? ` · ${r.amount}${r.unit ? ` ${r.unit}` : ''}` : ''}
                      {r.ratioPct != null ? ` · ${r.ratioPct} %` : ''}
                      {r.note ? <span style={small}> — {r.note}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {n.steps.length ? (
              <>
                <h4 style={h4}>{t('lab_steps')}</h4>
                <ol style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 6, fontSize: 16 }}>
                  {n.steps.map((s, i) => (
                    <li key={i} style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                      {s.body}
                      {s.duration ? <span style={small}> · {s.duration}</span> : null}
                      {s.equipmentName ? <div style={small}>🛠 {s.equipmentName}</div> : null}
                      {s.warning ? <div style={{ ...small, color: 'var(--rust, var(--ko))' }}>⚠ {s.warning}</div> : null}
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
          </div>
        ) : null}
        {graded ? (
          <div>
            <h4 style={h4}>{t('lab_grid')}</h4>
            <LabGrid assessments={n.assessments} narrow />
          </div>
        ) : null}
      </article>
    )
  }

  function chapter(n: LabBookNode, label: string) {
    return (
      <section key={n.id} style={{ margin: '28px 0 0', minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 20, overflowWrap: 'anywhere' }}>
          <button
            type="button"
            aria-label={t('lab_book_open_item').replace('{title}', n.title)}
            onClick={() => onOpen(n.id)}
            style={{ minHeight: 44, padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left', overflowWrap: 'anywhere' }}
          >
            {label}{n.title}
          </button>
        </h2>
        {n.text.trim() ? <p style={bodyText}>{n.text}</p> : null}
        {n.children.map((k) => (k.role === 'chapitre' ? chapter(k, '') : item(k)))}
      </section>
    )
  }

  let chapNo = 0
  return (
    <section data-testid="lab-book" style={{ maxWidth: 720, margin: '10px auto', minWidth: 0 }}>
      <button type="button" className="btn ghost sm" onClick={onClose} data-testid="lab-book-back" style={{ minHeight: 44 }}>{t('lab_book_back')}</button>
      {state === 'loading' ? <p style={{ ...small, marginTop: 12 }}>{t('lab_book_loading')}</p> : null}
      {state === 'error' ? <p style={{ ...small, marginTop: 12 }}>{t('lab_book_error')}</p> : null}
      {state === 'ok' && root ? (
        <>
          <h1 style={{ margin: '14px 0 0', fontSize: 24, overflowWrap: 'anywhere' }}>{root.title}</h1>
          {root.text.trim() ? <p style={bodyText}>{root.text}</p> : null}
          {root.children.length ? root.children.map((k) => (k.role === 'chapitre' ? chapter(k, `${++chapNo}. `) : item(k))) : <p style={{ ...small, marginTop: 16 }}>{t('lab_book_empty')}</p>}
        </>
      ) : null}
    </section>
  )
}
