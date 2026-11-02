'use client'

// Kaizen — Création / Opérations & Stratégie (Site web, Business), plus "À valider" for
// entries moved from the System ledger. Ticked done or reopened, never deleted.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { toast } from '@/lib/ui/toast'
import { ReportLinkButton } from '@/components/atelier/ReportLinkButton'
import { KAIZEN_SECTIONS, type KaizenItem, type KaizenSection } from '@/lib/kaizen'
import {
  confirmKaizenSections,
  createKaizen,
  listKaizen,
  setKaizenDone,
  updateKaizen,
} from '@/app/atelier/(portal)/kaizen/actions'

type View = KaizenSection | 'review'

const SECTION_KEY = {
  creation: 'kaizen_section_creation',
  website: 'kaizen_section_website',
  business: 'kaizen_section_business',
} as const

function parseView(raw: string | null): View | null {
  return raw === 'review' || (KAIZEN_SECTIONS as readonly string[]).includes(raw ?? '') ? (raw as View) : null
}

export function Kaizen() {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const loc = lang === 'fr' ? 'fr-FR' : 'en-GB'

  const [items, setItems] = useState<KaizenItem[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [me, setMe] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [stack, setStack] = useState<'live' | 'done'>('live')
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ title: '', body: '' })
  const [reviewPick, setReviewPick] = useState<Record<number, KaizenSection>>({})

  const load = useCallback(async () => {
    setLoading(true)
    const res = await listKaizen()
    if ('error' in res) {
      setErr(true)
    } else {
      setErr(false)
      setItems(res.items)
      setNames(res.names)
      setMe(res.me)
      setIsAdmin(res.isAdmin)
    }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const pending = useMemo(() => items.filter((i) => i.section == null), [items])
  const view: View = parseView(searchParams.get('view')) ?? (pending.length > 0 && isAdmin ? 'review' : 'creation')
  const setView = (v: View) => {
    const p = new URLSearchParams(searchParams.toString())
    p.set('view', v)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  const replace = (it: KaizenItem) => setItems((prev) => prev.map((x) => (x.id === it.id ? it : x)))
  const errText = (code: string) => (code === 'forbidden' ? t('kaizen_forbidden') : `${t('error_prefix')} ${code}`)

  const visible = useMemo(() => {
    if (view === 'review') return pending
    const qq = q.trim().toLowerCase()
    const rows = items.filter((i) => {
      if (i.section !== view) return false
      if ((stack === 'done') !== !!i.done_at) return false
      if (!qq) return true
      return `${i.title} ${i.body ?? ''}`.toLowerCase().includes(qq)
    })
    // Live: newest idea first. Done: most recently ticked first.
    return stack === 'done' ? [...rows].sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')) : rows
  }, [items, pending, view, stack, q])
  const stackCount = (done: boolean) => items.filter((i) => i.section === view && !!i.done_at === done).length
  const countOf = (s: KaizenSection) => items.filter((i) => i.section === s && !i.done_at).length
  const opsView = view === 'website' || view === 'business'

  async function add() {
    if (!newTitle.trim() || view === 'review') return
    setBusy(true)
    const res = await createKaizen({ title: newTitle, body: newBody, section: view })
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    setItems((prev) => [res.item, ...prev])
    setNewTitle(''); setNewBody(''); setShowNew(false)
    toast.success(t('kaizen_added'))
  }

  async function toggleDone(it: KaizenItem) {
    const res = await setKaizenDone(it.id, !it.done_at)
    if ('error' in res) { toast.error(errText(res.error)); return }
    replace(res.item)
  }

  async function saveEdit(it: KaizenItem) {
    const res = await updateKaizen(it.id, { title: draft.title, body: draft.body })
    if ('error' in res) { toast.error(errText(res.error)); return }
    replace(res.item)
    setEditingId(null)
    toast.success(t('kaizen_saved'))
  }

  async function move(it: KaizenItem, section: KaizenSection) {
    const res = await updateKaizen(it.id, { section })
    if ('error' in res) { toast.error(errText(res.error)); return }
    replace(res.item)
  }

  async function confirm(rows: KaizenItem[]) {
    setBusy(true)
    const res = await confirmKaizenSections(
      rows.map((r) => ({ id: r.id, section: reviewPick[r.id] ?? r.suggested_section ?? 'creation' })),
    )
    setBusy(false)
    if ('error' in res) { toast.error(errText(res.error)); return }
    setItems((prev) => prev.map((x) => res.items.find((y) => y.id === x.id) ?? x))
    toast.success(t('kaizen_review_done'))
  }

  const canEdit = (it: KaizenItem) => isAdmin || it.author_id === me
  const who = (id: string | null) => (id ? names[id] ?? t('kaizen_unknown_author') : t('kaizen_unknown_author'))
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(loc)

  // Level 1: the two sections (serif, underlined). Level 2: Site web / Business inside
  // Opérations & Stratégie (small pills, only shown under it).
  const sectionTab = (id: string, active: boolean, label: string, count: number, onClick: () => void, rust = false) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={`kaizen-view-${id}`}
      onClick={onClick}
      className={rust ? undefined : 'serif'}
      style={{
        padding: '8px 4px 10px',
        marginRight: 20,
        minHeight: 44,
        fontSize: rust ? 12 : 17,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: 'transparent',
        color: rust ? 'var(--rust)' : active ? 'var(--tx)' : 'var(--tx3)',
        borderBottom: active ? '2px solid var(--ac)' : '2px solid transparent',
      }}
    >
      {label}
      {count > 0 ? <span className="t-mono-sm" style={{ fontSize: 11, marginLeft: 6, color: 'var(--tx3)' }}>{count}</span> : null}
    </button>
  )
  const subTab = (v: KaizenSection, label: string) => (
    <button
      key={v}
      type="button"
      role="tab"
      aria-selected={view === v}
      data-testid={`kaizen-view-${v}`}
      onClick={() => setView(v)}
      style={{
        padding: '6px 14px',
        minHeight: 36,
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        border: '1px solid var(--bd)',
        borderRadius: 18,
        background: view === v ? 'var(--tx)' : 'transparent',
        color: view === v ? 'var(--bg1)' : 'var(--tx2)',
      }}
    >
      {label}{countOf(v) > 0 ? ` · ${countOf(v)}` : ''}
    </button>
  )
  const stackBtn = (s: 'live' | 'done', label: string) => (
    <button
      key={s}
      type="button"
      aria-pressed={stack === s}
      data-testid={`kaizen-stack-${s}`}
      onClick={() => setStack(s)}
      style={{
        padding: '6px 12px',
        minHeight: 44,
        fontSize: 12,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: stack === s ? 'var(--bg2)' : 'transparent',
        color: stack === s ? 'var(--tx)' : 'var(--tx3)',
      }}
    >
      {label}
    </button>
  )

  const sectionSelect = (value: KaizenSection, onChange: (s: KaizenSection) => void, label: string) => (
    <select className="input" style={{ fontSize: 12 }} value={value} aria-label={label} onChange={(e) => onChange(e.target.value as KaizenSection)}>
      {KAIZEN_SECTIONS.map((s) => (
        <option key={s} value={s}>{t(SECTION_KEY[s])}</option>
      ))}
    </select>
  )

  return (
    <div data-testid="kaizen-tab-root" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <div style={{ padding: narrow ? '12px' : '16px 28px 0', borderBottom: '1px solid var(--bd)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="serif" style={{ fontSize: 22, flex: 1 }}>{t('tab_kaizen')}</div>
          <ReportLinkButton source="kaizen" />
        </div>
        <p style={{ fontSize: 12, color: 'var(--tx2)', margin: '4px 0 10px', maxWidth: 760 }}>{t('kaizen_intro')}</p>
        <div role="tablist" style={{ display: 'flex', alignItems: 'flex-end', overflowX: 'auto' }}>
          {sectionTab('creation', view === 'creation', t('kaizen_section_creation'), countOf('creation'), () => setView('creation'))}
          {sectionTab('ops', opsView, t('kaizen_group_ops'), countOf('website') + countOf('business'), () => { if (!opsView) setView('website') })}
          <span style={{ flex: 1 }} />
          {pending.length > 0
            ? sectionTab('review', view === 'review', t('kaizen_review_fmt').replace('{n}', String(pending.length)), 0, () => setView('review'), true)
            : null}
        </div>
      </div>
      {opsView ? (
        <div role="tablist" style={{ display: 'flex', gap: 8, padding: narrow ? '10px 12px 0' : '12px 28px 0', overflowX: 'auto' }}>
          {subTab('website', t('kaizen_section_website'))}
          {subTab('business', t('kaizen_section_business'))}
        </div>
      ) : null}

      <div style={{ flex: 1, overflow: 'auto', padding: narrow ? '12px' : '16px 28px' }}>
        {view === 'creation' ? (
          <p style={{ fontSize: 12, color: 'var(--tx3)', margin: '0 0 12px' }}>{t('kaizen_section_creation_hint')}</p>
        ) : null}

        {view === 'review' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: 'var(--tx2)', margin: 0, flex: 1, minWidth: 240 }}>
              {isAdmin ? t('kaizen_review_intro') : t('kaizen_review_admin_only')}
            </p>
            {isAdmin && pending.length > 0 ? (
              <button type="button" className="btn primary sm" disabled={busy} onClick={() => void confirm(pending)} data-testid="kaizen-confirm-all">
                {t('kaizen_review_confirm_all_fmt').replace('{n}', String(pending.length))}
              </button>
            ) : null}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <button type="button" className="btn sm" style={{ minHeight: 44 }} onClick={() => setShowNew((v) => !v)} data-testid="kaizen-new-toggle">
              {showNew ? t('kaizen_new_close') : t('kaizen_new')}
            </button>
            <input
              className="input"
              style={{ fontSize: 12, flex: 1, minWidth: 140, maxWidth: 320 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('kaizen_search_ph')}
              aria-label={t('kaizen_search_ph')}
            />
            <div role="group" style={{ display: 'inline-flex', border: '1px solid var(--bd)' }}>
              {stackBtn('live', t('kaizen_stack_live_fmt').replace('{n}', String(stackCount(false))))}
              {stackBtn('done', t('kaizen_stack_done_fmt').replace('{n}', String(stackCount(true))))}
            </div>
          </div>
        )}

        {showNew && view !== 'review' ? (
          <div data-testid="kaizen-new-form" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 720, marginBottom: 18, padding: 12, border: '1px solid var(--bd)', background: 'var(--bg1)' }}>
            <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('kaizen_title_ph')} aria-label={t('kaizen_title_ph')} />
            <textarea className="input" rows={4} value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder={t('kaizen_body_ph')} aria-label={t('kaizen_body_ph')} style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="t-label">{t('kaizen_section_label')}: {t(SECTION_KEY[view])}</span>
              <button type="button" className="btn primary sm" style={{ marginLeft: 'auto', minHeight: 44 }} disabled={busy || !newTitle.trim()} onClick={() => void add()}>
                {t('kaizen_add')}
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="t-mono-sm" style={{ opacity: 0.6 }}>{t('kaizen_loading')}</div>
        ) : err ? (
          <div className="t-mono-sm" style={{ color: 'var(--rust)' }}>{t('kaizen_load_error')}</div>
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{t('kaizen_empty')}</div>
        ) : (
          visible.map((it) => {
            const editing = editingId === it.id
            const done = !!it.done_at
            return (
              <article
                key={it.id}
                data-testid={`kaizen-item-${it.id}`}
                style={{ borderBottom: '1px solid var(--bd)', padding: '12px 0', opacity: done ? 0.6 : 1, maxWidth: 900 }}
              >
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label={t('kaizen_title_ph')} />
                    <textarea className="input" rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} aria-label={t('kaizen_body_ph')} style={{ resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn primary sm" onClick={() => void saveEdit(it)}>{t('kaizen_save')}</button>
                      <button type="button" className="btn ghost sm" onClick={() => setEditingId(null)}>{t('kaizen_cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, textDecoration: done ? 'line-through' : undefined }}>{it.title}</div>
                    {it.body ? (
                      <div style={{ fontSize: 12, color: 'var(--tx2)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: 4 }}>{it.body}</div>
                    ) : null}
                  </>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--tx3)' }}>
                    {fmtDate(it.created_at)} · {who(it.author_id)}
                  </span>
                  {it.work_ids.map((w) => (
                    <Link key={w} href={`/atelier/inventory?work=${w}`} className="t-mono-sm" style={{ fontSize: 10, color: 'var(--ac)' }}>
                      #{w}
                    </Link>
                  ))}
                  {done ? (
                    <span className="t-mono-sm" style={{ fontSize: 10, color: 'var(--sage)' }}>
                      {t('kaizen_done_fmt').replace('{date}', fmtDate(it.done_at!)).replace('{who}', who(it.done_by))}
                    </span>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  {view === 'review' ? (
                    isAdmin ? (
                      <>
                        {sectionSelect(reviewPick[it.id] ?? it.suggested_section ?? 'creation', (s) => setReviewPick((p) => ({ ...p, [it.id]: s })), t('kaizen_section_label'))}
                        <button type="button" className="btn sm" disabled={busy} onClick={() => void confirm([it])}>{t('kaizen_review_confirm')}</button>
                      </>
                    ) : (
                      <span className="t-mono-sm" style={{ fontSize: 10 }}>{t(SECTION_KEY[it.suggested_section ?? 'creation'])}</span>
                    )
                  ) : canEdit(it) && !editing ? (
                    <>
                      {sectionSelect(it.section ?? 'creation', (s) => void move(it, s), t('kaizen_move_aria'))}
                      <button type="button" className="btn ghost sm" onClick={() => { setEditingId(it.id); setDraft({ title: it.title, body: it.body ?? '' }) }}>
                        {t('kaizen_edit')}
                      </button>
                      <button type="button" className="btn sm" onClick={() => void toggleDone(it)} data-testid={`kaizen-done-${it.id}`}>
                        {done ? t('kaizen_reopen') : t('kaizen_mark_done')}
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
