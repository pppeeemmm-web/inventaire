'use client'

// Idées — the tree of ideas fed by the Journal (design docs/design/2026-11-23/IdeasDesign.md, approved by Pem
// 2026-11-23; mockup Ideas_Mockup.html). Desk: the tree on the left (trunks with their branches, most recently
// fed first), the selected idea's desk beside it. Phone: the list by last moment with a seed filter; tapping
// an idea opens its desk. The selected idea is in the address (`?concept=<id>`, as Journal chips link it).
// Reads: GET /api/ideas (not Server Actions — reads must not queue behind saves).

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { IdeaDesk } from '@/components/atelier/concepts/IdeaDesk'
import { PlantIdeaSheet } from '@/components/atelier/concepts/PlantIdeaSheet'
import { LooseReminders } from '@/components/atelier/concepts/LooseReminders'
import { SEED, STAGES, type Stage } from '@/components/atelier/concepts/idea-ui'
import type { IdeaListRow } from '@/lib/ideas/read'

function readSelected(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('concept')
}

const nodeSt: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', background: 'none', border: 0, borderRadius: 6, padding: '6px 6px', minHeight: 36, color: 'var(--tx2)', cursor: 'pointer', fontSize: 13.5 }

export function IdeasHome({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t, lang } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB'
  const [rows, setRows] = useState<IdeaListRow[] | null>(null)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [planting, setPlanting] = useState(false)

  // One page of 60, by last moment; « Voir plus » asks the next page (the list never comes whole).
  const load = useCallback(async (offset = 0) => {
    const r = await fetch(`/api/ideas?offset=${offset}`, { cache: 'no-store' }).catch(() => null)
    const j = r && r.ok ? ((await r.json()) as { rows: IdeaListRow[]; more: boolean }) : null
    if (!j) {
      setFailed(true)
      return
    }
    setFailed(false)
    setRows((prev) => (offset ? [...(prev ?? []), ...j.rows.filter((x) => !(prev ?? []).some((p) => p.id === x.id))] : j.rows))
    setMore(j.more)
  }, [])

  useEffect(() => {
    setSelected(readSelected())
    void load()
    const onPop = () => setSelected(readSelected())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [load])

  const open = useCallback((id: string | null) => {
    setSelected(id)
    const u = new URL(window.location.href)
    if (id) u.searchParams.set('concept', id)
    else u.searchParams.delete('concept')
    window.history.pushState(null, '', u)
  }, [])

  // Desk: open the most recently fed idea when none is chosen.
  useEffect(() => {
    if (!narrow && !selected && rows?.length) setSelected(rows[0].id)
  }, [narrow, selected, rows])

  const when = (iso: string) => new Date(iso).toLocaleDateString(locale, { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' })
  const q = search.trim().toLowerCase()
  const matches = (r: IdeaListRow) => (stage === 'all' || r.stage === stage) && (!q || r.title.toLowerCase().includes(q))
  const list = (rows ?? []).filter(matches)

  // The tree: trunks (no parent, or a parent not loaded), each with its branches, by last moment of the branch below.
  const tree = useMemo(() => {
    const all = rows ?? []
    const byParent = new Map<string, IdeaListRow[]>()
    const ids = new Set(all.map((r) => r.id))
    for (const r of all) if (r.parentId && ids.has(r.parentId)) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r])
    const last = new Map<string, string>()
    const lastOf = (r: IdeaListRow): string => {
      if (last.has(r.id)) return last.get(r.id)!
      let v = r.lastAt
      for (const k of byParent.get(r.id) ?? []) {
        const x = lastOf(k)
        if (x > v) v = x
      }
      last.set(r.id, v)
      return v
    }
    const sortKids = (xs: IdeaListRow[]) => [...xs].sort((a, b) => lastOf(b).localeCompare(lastOf(a)))
    const trunks = sortKids(all.filter((r) => !r.parentId || !ids.has(r.parentId)))
    return { trunks, kids: (id: string) => sortKids(byParent.get(id) ?? []) }
  }, [rows])

  const row = (r: IdeaListRow) => (
    <button
      key={r.id}
      type="button"
      onClick={() => open(r.id)}
      data-testid={`idea-row-${r.id}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 10, padding: '10px 12px', minHeight: 56, color: 'var(--tx)', cursor: 'pointer' }}
    >
      <span style={{ fontSize: 22 }}>{SEED[r.stage]}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', overflowWrap: 'anywhere' }}>{r.title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--tx3)' }}>
          {r.parentTitle ? `${t('it_branch_of').replace('{title}', r.parentTitle)} · ` : ''}
          {t('it_row_counts').replace('{m}', String(r.moments)).replace('{d}', String(r.days))} · {when(r.lastAt)}
          {r.branches ? ` · ${t('it_row_branches').replace('{n}', String(r.branches))}` : ''}
        </span>
      </span>
    </button>
  )

  const filterBar = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {(['all', ...STAGES] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={stage === s}
          onClick={() => setStage(s)}
          style={{ minHeight: 36, minWidth: 44, padding: '0 12px', borderRadius: 999, border: `1px solid ${stage === s ? 'var(--ac)' : 'var(--bd2)'}`, background: 'none', color: stage === s ? 'var(--ac)' : 'var(--tx2)', cursor: 'pointer', fontSize: 13 }}
        >
          {s === 'all' ? t('it_filter_all') : SEED[s]}
        </button>
      ))}
    </div>
  )

  const plant = planting ? (
    <PlantIdeaSheet
      parents={(rows ?? []).map((r) => ({ id: r.id, title: r.title, stage: r.stage })).sort((a, b) => a.title.localeCompare(b.title))}
      onClose={() => setPlanting(false)}
      onPlanted={(id) => {
        setPlanting(false)
        void load()
        open(id)
      }}
    />
  ) : null

  const empty = failed ? t('it_err_failed') : rows === null ? t('it_loading') : t('it_none')

  /* ── phone ── */
  if (narrow) {
    if (selected) return <IdeaDesk id={selected} wide={false} onOpen={open} onBack={() => open(null)} onChanged={() => void load()} />
    return (
      <div style={{ padding: '10px 12px 24px', display: 'grid', gap: 10 }} data-testid="concepts-tab-root">
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('it_search')} style={{ minHeight: 44, fontSize: 15 }} />
        {filterBar}
        {planting ? (
          plant
        ) : (
          <button type="button" className="btn sm" onClick={() => setPlanting(true)} data-testid="idea-plant-open" style={{ minHeight: 48, ...MAIN_ACTION_STYLE }}>
            {t('it_plant_open')}
          </button>
        )}
        {isAdmin ? <LooseReminders narrow onIdea={() => void load()} /> : null}
        <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx3)' }}>{t('it_by_last')}</div>
        {list.length ? list.map(row) : <p style={{ color: 'var(--tx3)' }}>{empty}</p>}
        {more ? (
          <button type="button" className="btn ghost sm" onClick={() => void load(rows?.length ?? 0)} style={{ minHeight: 44 }}>
            {t('it_more_load')}
          </button>
        ) : null}
      </div>
    )
  }

  /* ── desk ── */
  const walk = (r: IdeaListRow, depth: number): React.ReactNode[] => {
    const kids = tree.kids(r.id)
    const shown = matches(r)
    const below = kids.flatMap((k) => walk(k, depth + 1))
    if (!shown && !below.length) return []
    return [
      <button
        key={r.id}
        type="button"
        onClick={() => open(r.id)}
        data-testid={`idea-node-${r.id}`}
        style={{ ...nodeSt, paddingLeft: 6 + depth * 16, background: r.id === selected ? 'var(--bg3)' : 'none', color: r.id === selected ? 'var(--tx)' : shown ? 'var(--tx2)' : 'var(--tx3)' }}
      >
        <span>{SEED[r.stage]}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
        <span style={{ fontSize: 11, color: 'var(--tx3)', fontVariantNumeric: 'tabular-nums' }}>{r.moments}</span>
      </button>,
      ...below,
    ]
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0,1fr)', height: 'calc(100vh - 120px)', minHeight: 520, border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg1)' }} data-testid="concepts-tab-root">
      <nav aria-label={t('it_tree')} style={{ overflow: 'auto', padding: 10, borderRight: '1px solid var(--bd)', background: 'var(--bg0)', display: 'grid', alignContent: 'start', gap: 8 }}>
        <button type="button" className="btn sm" onClick={() => setPlanting((v) => !v)} data-testid="idea-plant-open" style={{ minHeight: 40, ...MAIN_ACTION_STYLE }}>
          {t('it_plant_open')}
        </button>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('it_search')} style={{ minHeight: 36 }} />
        {filterBar}
        <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--tx3)', margin: '6px 4px 0' }}>{t('it_tree')}</div>
        <div>{rows?.length ? tree.trunks.flatMap((r) => walk(r, 0)) : <p style={{ color: 'var(--tx3)', fontSize: 13 }}>{empty}</p>}</div>
        {more ? (
          <button type="button" className="btn ghost sm" onClick={() => void load(rows?.length ?? 0)} style={{ minHeight: 44 }}>
            {t('it_more_load')}
          </button>
        ) : null}
      </nav>
      <div style={{ minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {plant || (isAdmin && !selected) ? (
          <div style={{ padding: 14, display: 'grid', gap: 10, borderBottom: '1px solid var(--bd)' }}>
            {plant}
            {isAdmin ? <LooseReminders narrow={false} onIdea={() => void load()} /> : null}
          </div>
        ) : null}
        <div style={{ flex: 1, minHeight: 0 }}>
          {selected ? <IdeaDesk id={selected} wide onOpen={open} onChanged={() => void load()} /> : <p style={{ color: 'var(--tx3)', padding: 16 }}>{empty}</p>}
        </div>
      </div>
    </div>
  )
}
