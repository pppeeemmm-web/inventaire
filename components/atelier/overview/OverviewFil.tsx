'use client'

// R1 step 6 slice 4b — the Fil as Overview's main column on desktop (admin only;
// docs/design/2026-11-17/R1_InputsFeed.notes.md « Where the feed lives (agreed) », « Gestures »).
// Same items as /hub/fil (`listFil`), all three sections at once as a dense list: each row has
// ✕ Retirer / ✓ Garder (Refuser / Valider for work facts); ← / → act on the selected row, ↑ / ↓ move.
// Nothing is final at once: the row leaves, a toast offers « Annuler » for 6 s, then the decision is
// sent (`decideFil`) — the SwipeDeck rule. Leaving the tab sends what is still waiting.
// « Refroidies » (left alone > 14 days) is folded at the end, read only.

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { WorkRef } from '@/components/atelier/WorkRef'
import { thumbUrl } from '@/lib/data'
import { dismissToast, toast } from '@/lib/ui/toast'
import { PENDING_CHECKBOX_KEYS } from '@/lib/work-pending-keys'
import { decideFil, listFil, type FilDecision, type FilItem, type FilSection } from '@/app/atelier/fil/actions'

const UNDO_MS = 6000
const SECTIONS: FilSection[] = ['creation', 'fiches', 'kaizen']
const SECTION_LABEL = { creation: 'fil_tab_creation', fiches: 'fil_tab_fiches', kaizen: 'fil_tab_kaizen' } as const
const CHECKBOX_KEYS = new Set<string>(PENDING_CHECKBOX_KEYS)
const workHref = (id: number) => `/atelier/inventory?work=${id}`

type Pending = { item: FilItem; decision: FilDecision; timer: number; toastId: string }

const ELLIPSIS: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const HEAD: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tx2)' }

function changeValue(key: string, value: string | null): string {
  if (value == null || value === '') return '—'
  if (CHECKBOX_KEYS.has(key)) return value === '1' ? '✓' : '✗'
  return value.length > 60 ? `${value.slice(0, 60)}…` : value
}

export function OverviewFil() {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [items, setItems] = useState<FilItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  /** Keys decided here (waiting or sent): out of the list until the server agrees or refuses. */
  const [gone, setGone] = useState<Set<string>>(() => new Set())
  const [selKey, setSelKey] = useState<string | null>(null)
  const pending = useRef<Pending | null>(null)

  useEffect(() => {
    let cancelled = false
    void listFil()
      .then((res) => {
        if (cancelled) return
        if ('error' in res) setFailed(true)
        else setItems(res.items)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => (items ?? []).filter((i) => !gone.has(i.key)), [items, gone])
  const live = useMemo(() => visible.filter((i) => !i.cooled), [visible])
  const cooled = useMemo(() => visible.filter((i) => i.cooled), [visible])
  // Keyboard / reading order: Création, then Fiches, then Kaizen (flagged first inside each, from listFil).
  const ordered = useMemo(() => SECTIONS.flatMap((s) => live.filter((i) => i.section === s)), [live])
  const sel = ordered.find((i) => i.key === selKey) ?? ordered[0] ?? null

  const send = useCallback((p: Pending) => {
    void decideFil(p.item.kind, p.item.id, p.decision).then((res) => {
      if ('error' in res) {
        toast.error(res.error)
        setGone((g) => {
          const next = new Set(g)
          next.delete(p.item.key)
          return next
        })
      } else {
        setItems((prev) => (prev ? prev.filter((i) => i.key !== p.item.key) : prev))
      }
    })
  }, [])

  const flush = useCallback(() => {
    const p = pending.current
    if (!p) return
    pending.current = null
    window.clearTimeout(p.timer)
    dismissToast(p.toastId)
    send(p)
  }, [send])

  useEffect(() => {
    const onHide = () => flush()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      flush()
    }
  }, [flush])

  const decide = useCallback(
    (item: FilItem, decision: FilDecision) => {
      flush()
      const idx = ordered.findIndex((i) => i.key === item.key)
      const nextSel = ordered[idx + 1] ?? ordered[idx - 1] ?? null
      setGone((g) => new Set(g).add(item.key))
      setSelKey(nextSel?.key ?? null)
      const fiche = item.kind === 'pending_change'
      const label = t(decision === 'keep' ? (fiche ? 'fil_approve' : 'fil_keep') : fiche ? 'fil_reject' : 'fil_discard')
      const undo = () => {
        const p = pending.current
        if (!p || p.item.key !== item.key) return
        pending.current = null
        window.clearTimeout(p.timer)
        setGone((g) => {
          const next = new Set(g)
          next.delete(item.key)
          return next
        })
        setSelKey(item.key)
      }
      const toastId = toast.info(t('sd_done').replace('{action}', label), { ttlMs: UNDO_MS, action: { label: t('sd_undo'), onClick: undo } })
      const p: Pending = {
        item,
        decision,
        toastId,
        timer: window.setTimeout(() => {
          if (pending.current === p) {
            pending.current = null
            send(p)
          }
        }, UNDO_MS),
      }
      pending.current = p
    },
    [flush, ordered, send, t],
  )

  // ← discard · → keep the selected row; ↑ / ↓ move the selection. Not while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (!sel) return
      if (e.key === 'ArrowLeft') decide(sel, 'discard')
      else if (e.key === 'ArrowRight') decide(sel, 'keep')
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const idx = ordered.findIndex((i) => i.key === sel.key)
        const next = ordered[idx + (e.key === 'ArrowDown' ? 1 : -1)]
        if (!next) return
        e.preventDefault()
        setSelKey(next.key)
        document.getElementById(`ov-fil-${next.key}`)?.scrollIntoView({ block: 'nearest' })
      } else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide, ordered, sel])

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })

  const row = (item: FilItem, readOnly = false) => {
    const on = !readOnly && sel?.key === item.key
    const fiche = item.kind === 'pending_change'
    const kindLabel =
      item.kind === 'idea'
        ? t('fil_idea')
        : item.kind === 'kaizen_item'
          ? t('fil_kaizen')
          : fiche
            ? t(item.changeKind === 'create' ? 'fil_fiche_create' : item.changeKind === 'image_add' ? 'fil_fiche_image' : 'fil_fiche_change')
            : item.lineKind === 'proposal'
              ? t('fil_proposal')
              : null
    const thumb = thumbUrl(item.image ?? item.work?.thumb ?? null)
    return (
      <div
        key={item.key}
        id={`ov-fil-${item.key}`}
        data-testid={`overview-fil-row-${item.kind}`}
        aria-current={on ? 'true' : undefined}
        onClick={readOnly ? undefined : () => setSelKey(item.key)}
        style={{
          display: 'grid', gridTemplateColumns: readOnly ? '36px minmax(0, 1fr)' : '36px minmax(0, 1fr) auto', gap: 10, alignItems: 'start',
          padding: '7px 12px', borderBottom: '1px solid var(--bg2)', cursor: readOnly ? undefined : 'pointer',
          background: on ? 'color-mix(in srgb, var(--ac) 8%, transparent)' : undefined,
          boxShadow: on ? 'inset 3px 0 0 var(--ac)' : undefined,
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" width={36} height={36} loading="lazy" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, background: 'var(--bg2)' }} />
        ) : (
          <span style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--bg2)' }} />
        )}
        <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 8px', fontSize: 11, color: 'var(--tx3)' }}>
            {item.flagged ? <span style={{ color: 'var(--ac)' }}>{t('fil_flagged')}</span> : null}
            {kindLabel ? <span>{kindLabel}</span> : null}
            <span style={{ color: 'var(--tx2)' }}>{[item.author, date(item.at)].filter(Boolean).join(' · ')}</span>
            {item.work ? (
              // R4: hover = the picture with its caption (the row's thumbnail is already beside it).
              <WorkRef id={item.work.id} href={workHref(item.work.id)} thumb={false} stopPropagation style={{ color: 'var(--tx2)', ...ELLIPSIS, maxWidth: 260 }}>
                #{item.work.id}
                {item.work.title ? ` · ${item.work.title}` : ''}
              </WorkRef>
            ) : null}
            {item.newLines ? <span>{item.newLines === 1 ? t('fil_new_line_one') : t('fil_new_lines').replace('{n}', String(item.newLines))}</span> : null}
          </div>
          {item.title ? <div style={{ fontWeight: 600, fontSize: 13, ...ELLIPSIS }}>{item.title}</div> : null}
          {item.body.trim() ? (
            <div
              style={{
                fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                ...(on ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
              }}
            >
              {item.body.trim()}
            </div>
          ) : null}
          {item.changes?.length ? (
            <div style={{ display: 'grid', gap: 1, fontSize: 12 }}>
              {item.changes.map((c) => (
                <div key={c.key} style={ELLIPSIS}>
                  <span style={{ color: 'var(--tx3)' }}>{c.key}</span>
                  {' : '}
                  <span style={{ color: 'var(--tx3)', textDecoration: c.before ? 'line-through' : undefined }}>{changeValue(c.key, c.before)}</span>
                  {' → '}
                  {changeValue(c.key, c.after)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {readOnly ? null : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="btn ghost sm"
              data-testid="overview-fil-discard"
              title={`${t(fiche ? 'fil_reject' : 'fil_discard')} (←)`}
              aria-label={t(fiche ? 'fil_reject' : 'fil_discard')}
              onClick={(e) => {
                e.stopPropagation()
                decide(item, 'discard')
              }}
              style={{ minHeight: 32, minWidth: 32, color: 'var(--rust)' }}
            >
              ✕
            </button>
            <button
              type="button"
              className="btn sm"
              data-testid="overview-fil-keep"
              title={`${t(fiche ? 'fil_approve' : 'fil_keep')} (→)`}
              aria-label={t(fiche ? 'fil_approve' : 'fil_keep')}
              onClick={(e) => {
                e.stopPropagation()
                decide(item, 'keep')
              }}
              style={{ minHeight: 32, minWidth: 32 }}
            >
              ✓
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-testid="overview-fil" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', borderBottom: '1px solid var(--bd)', background: 'var(--bg1)' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-instrument-next), serif', fontWeight: 400, fontSize: 20 }}>{t('ofil_title')}</h2>
        <b data-testid="overview-fil-count">{items ? live.length : '…'}</b>
        <span style={{ fontSize: 12, color: 'var(--tx3)', flex: '1 1 200px', minWidth: 0 }}>{t('fil_intro')}</span>
        <span style={{ fontSize: 11, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>← {t('fil_discard')} · {t('fil_keep')} →</span>
        <Link href="/hub/fil" style={{ fontSize: 12, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>{t('ofil_open_phone')}</Link>
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
        {failed ? (
          <p style={{ margin: 0, padding: '10px 12px', color: 'var(--rust)', fontSize: 13 }}>{t('fil_load_error')}</p>
        ) : !items ? (
          <p style={{ margin: 0, padding: '10px 12px', color: 'var(--tx3)', fontSize: 13 }}>{t('fil_loading')}</p>
        ) : (
          <>
            {SECTIONS.map((s) => {
              const list = live.filter((i) => i.section === s)
              return (
                <section key={s} data-testid={`overview-fil-section-${s}`}>
                  <div style={{ ...HEAD, position: 'sticky', top: 0, zIndex: 1, height: 28, padding: '0 12px', background: 'var(--bg1)', borderBottom: '1px solid var(--bd)' }}>
                    {t(SECTION_LABEL[s])}
                    <b style={{ color: list.length ? 'var(--tx)' : 'var(--tx3)' }}>{list.length}</b>
                  </div>
                  {list.length ? list.map((i) => row(i)) : <p style={{ margin: 0, padding: '6px 12px', color: 'var(--tx3)', fontSize: 12 }}>{t('fil_empty')}</p>}
                </section>
              )
            })}
            {cooled.length ? (
              <details className="pem-fold" data-testid="overview-fil-cooled" style={{ borderTop: '1px solid var(--bd)' }}>
                <summary style={{ ...HEAD, minHeight: 32, padding: '0 12px', cursor: 'pointer' }}>
                  {t('fil_cooled')}
                  <b>{cooled.length}</b>
                </summary>
                <p style={{ margin: 0, padding: '0 12px 6px', color: 'var(--tx3)', fontSize: 12 }}>{t('fil_cooled_hint')}</p>
                {cooled.map((i) => row(i, true))}
              </details>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
