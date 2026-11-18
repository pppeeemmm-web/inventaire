'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { Oeuvre } from '@/lib/types/database'
import { WorkThumbLabel } from '@/components/atelier/WorkThumbLabel'
import { searchSemanticAtelier, type SemanticSearchHit } from '@/app/atelier/search/actions'
import { searchMenuWorks, type MenuWork } from '@/app/hub/menu-actions'
import { atelierTabHref } from '@/lib/atelier/tab-routes'
import { isSegmentedAtelierTab } from '@/lib/atelier/tab-routes'

interface Contact { ContactID: number; Nom: string | null; Prénom: string | null; NomInstitution: string | null }

type TabEntry = { id: string; label: string }

interface Props {
  open: boolean
  onClose: () => void
  tabs: TabEntry[]
  oeuvres: Oeuvre[]
  /** False while only part of the catalogue is loaded: titles are then searched on the server (TODO 18). */
  catalogueComplete?: boolean
  contacts: Contact[]
  onGoTab: (tab: string) => void
  onGoWork: (id: number) => void
  onCaptureSession?: () => void
  onScanQr: () => void
  onFieldNote: () => void
  onReminders: () => void
  onNewWork: () => void
  onNewSale: () => void
  onStockTake: () => void
  onPendingApprovals?: () => void
  onExportXlsx: () => void
}

interface Item {
  id: string
  label: string
  group: string
  action: () => void
  /** R4: a work row shows thumbnail (loupe) + `#id` title, never the title or number alone. */
  work?: { id: number; title?: string | null; image?: string | null }
}

export function CommandPalette({
  open, onClose, tabs, oeuvres, catalogueComplete = true, contacts,
  onGoTab, onGoWork, onCaptureSession, onScanQr, onFieldNote, onReminders,
  onNewWork, onNewSale, onStockTake, onPendingApprovals, onExportXlsx,
}: Props) {
  const { t } = useI18n()
  const tk = (key: string) => t(key as DictKey)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [semanticHits, setSemanticHits] = useState<SemanticSearchHit[]>([])
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [semanticUnavailable, setSemanticUnavailable] = useState(false)
  const [semanticPending, setSemanticPending] = useState(false)
  // A work number (« 2405 » or « #2405 ») opens that work directly — Pem 2026-11-18: ⌘K gave nothing for a
  // number (titles only, among the loaded works, then the meaning search). Looked up on the server, so a work
  // not in the loaded batch is found too.
  const numQ = /^#?(\d{1,6})$/.exec(q.trim())?.[1] ?? null
  const [numHit, setNumHit] = useState<MenuWork | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
      setSemanticHits([])
      setSemanticUnavailable(false)
      setSemanticPending(false)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    setNumHit(null)
    if (!open || !numQ) return
    let alive = true
    const local = oeuvres.find((o) => o.OeuvreID === Number(numQ))
    if (local) {
      setNumHit({ id: local.OeuvreID, title: local.Titre ?? null, thumb: local.txtImageNameLink ?? null })
      return
    }
    void searchMenuWorks(numQ).then((r) => {
      if (alive) setNumHit(r.find((w) => w.id === Number(numQ)) ?? null)
    })
    return () => {
      alive = false
    }
  }, [numQ, open, oeuvres])

  // Titles: among the loaded works when the whole catalogue is in; on the server while it is not
  // (TODO 18 — Overview and the tabs without works no longer load it), so ⌘K still finds every work.
  const [serverTitleHits, setServerTitleHits] = useState<MenuWork[]>([])
  useEffect(() => {
    const trimmed = q.trim()
    setServerTitleHits([])
    if (!open || catalogueComplete || trimmed.length < 2 || /^#?\d+$/.test(trimmed)) return
    let alive = true
    const timer = setTimeout(() => {
      void searchMenuWorks(trimmed).then((r) => {
        if (alive) setServerTitleHits(r)
      })
    }, 200)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q, open, catalogueComplete])

  useEffect(() => {
    const trimmed = q.trim()
    if (!open || trimmed.length < 3 || /^#?\d+$/.test(trimmed)) {
      setSemanticHits([])
      setSemanticLoading(false)
      setSemanticUnavailable(false)
      setSemanticPending(false)
      return
    }
    setSemanticLoading(true)
    const timer = setTimeout(() => {
      void searchSemanticAtelier(trimmed).then((res) => {
        if ('error' in res) {
          setSemanticHits([])
          setSemanticUnavailable(false)
          setSemanticPending(false)
        } else if (res.unavailable) {
          setSemanticHits([])
          setSemanticUnavailable(true)
          setSemanticPending(false)
        } else if (res.pending) {
          setSemanticHits([])
          setSemanticUnavailable(false)
          setSemanticPending(true)
        } else {
          setSemanticHits(res.hits)
          setSemanticUnavailable(false)
          setSemanticPending(false)
        }
        setSemanticLoading(false)
      })
    }, 350)
    return () => clearTimeout(timer)
  }, [q, open])

  const items: Item[] = useMemo(() => {
    const result: Item[] = []
    const qLow = q.toLowerCase()

    if (numHit) {
      const w = numHit
      result.push({
        id: `work:${w.id}`,
        label: w.title ?? `#${w.id}`,
        work: { id: w.id, title: w.title, image: w.thumb ?? null },
        group: t('cmd_palette_group_works'),
        action: () => { onGoWork(w.id); onClose() },
      })
    }

    // Quick actions first: navigation tabs already live in the left rail.
    const actionDefs = [
      ...(onCaptureSession
        ? [{ id: 'act:capture-session', label: t('cmd_palette_action_capture_session'), action: () => { onCaptureSession(); onClose() } }]
        : []),
      { id: 'act:scan-qr',         label: t('cmd_palette_action_scan_qr'),         action: () => { onScanQr(); onClose() } },
      { id: 'act:field-note',      label: t('cmd_palette_action_field_note'),      action: () => { onFieldNote(); onClose() } },
      { id: 'act:reminders',       label: t('cmd_palette_action_reminders'),       action: () => { onReminders(); onClose() } },
      { id: 'act:new-work',    label: t('cmd_palette_action_new_work'),    action: () => { onNewWork(); onClose() } },
      { id: 'act:new-sale',    label: t('cmd_palette_action_new_sale'),    action: () => { onNewSale(); onClose() } },
      { id: 'act:stock-take',  label: t('cmd_palette_action_stock_take'),  action: () => { onStockTake(); onClose() } },
      ...(onPendingApprovals
        ? [{ id: 'act:pending-approvals', label: t('cmd_palette_action_pending_approvals'), action: () => { onPendingApprovals(); onClose() } }]
        : []),
      { id: 'act:export-xlsx', label: t('cmd_palette_action_export_xlsx'), action: () => { onExportXlsx(); onClose() } },
    ]
    for (const a of actionDefs) {
      if (!q || a.label.toLowerCase().includes(qLow)) {
        result.push({ ...a, group: t('cmd_palette_group_actions') })
      }
    }

    // Tabs
    for (const tab of tabs) {
      if (!q || tab.label.toLowerCase().includes(qLow) || tab.id.toLowerCase().includes(qLow)) {
        result.push({ id: `tab:${tab.id}`, label: tab.label, group: t('cmd_palette_group_tabs'), action: () => { onGoTab(tab.id); onClose() } })
      }
    }

    // Works (search by title, min 2 chars)
    if (q.length >= 2 && !catalogueComplete) {
      let wCount = 0
      for (const w of serverTitleHits) {
        if (w.id === numHit?.id) continue
        result.push({ id: `work:${w.id}`, label: w.title ?? `#${w.id}`, work: { id: w.id, title: w.title, image: w.thumb ?? null }, group: t('cmd_palette_group_works'), action: () => { onGoWork(w.id); onClose() } })
        if (++wCount >= 6) break
      }
    } else if (q.length >= 2) {
      let wCount = 0
      for (const o of oeuvres) {
        if (o.OeuvreID !== numHit?.id && (o.Titre ?? '').toLowerCase().includes(qLow)) {
          result.push({ id: `work:${o.OeuvreID}`, label: o.Titre ?? `#${o.OeuvreID}`, work: { id: o.OeuvreID, title: o.Titre, image: o.txtImageNameLink ?? null }, group: t('cmd_palette_group_works'), action: () => { onGoWork(o.OeuvreID); onClose() } })
          if (++wCount >= 6) break
        }
      }
    }

    // Contacts (search by name, min 2 chars)
    if (q.length >= 2) {
      let cCount = 0
      for (const c of contacts) {
        const name = [c.Prénom, c.Nom, c.NomInstitution].filter(Boolean).join(' ')
        if (name.toLowerCase().includes(qLow)) {
          result.push({ id: `contact:${c.ContactID}`, label: name || `#${c.ContactID}`, group: t('cmd_palette_group_contacts'), action: () => { onGoTab('contacts'); onClose() } })
          if (++cCount >= 4) break
        }
      }
    }

    if (semanticLoading) {
      result.push({
        id: 'semantic:loading',
        label: tk('search_semantic_loading'),
        group: tk('search_semantic_group'),
        action: () => {},
      })
    } else if (semanticPending) {
      result.push({
        id: 'semantic:pending',
        label: tk('search_semantic_pending'),
        group: tk('search_semantic_group'),
        action: () => {},
      })
    } else if (semanticUnavailable) {
      result.push({
        id: 'semantic:unavailable',
        label: tk('search_semantic_unavailable'),
        group: tk('search_semantic_group'),
        action: () => {},
      })
    } else {
      for (const hit of semanticHits.slice(0, 8)) {
        result.push({
          id: `semantic:${hit.nodeId}`,
          label:
            hit.nodeType === 'journal_entry'
              ? `📓 ${hit.day ?? ''} · ${hit.label.replace(/[#*`|_>]+/g, ' ').replace(/\s+/g, ' ').trim()}`
              : `${hit.label} (${hit.nodeType})`,
          work: hit.nodeType === 'oeuvre' && hit.legacyIntId != null ? { id: hit.legacyIntId } : undefined,
          group: tk('search_semantic_group'),
          action: () => {
            if (hit.nodeType === 'journal_entry') {
              window.location.href = hit.day ? `/atelier/journal?day=${hit.day}` : '/atelier/journal'
            } else if (hit.nodeType === 'oeuvre' && hit.legacyIntId != null) {
              onGoWork(hit.legacyIntId)
            } else if (hit.nodeType === 'contact' && hit.legacyIntId != null) {
              sessionStorage.setItem('pem_open_contact', String(hit.legacyIntId))
              onGoTab('contacts')
            } else if (isSegmentedAtelierTab(hit.nodeType)) {
              window.location.href = atelierTabHref(hit.nodeType)
            }
            onClose()
          },
        })
      }
    }

    return result
  }, [
    q, tabs, oeuvres, contacts, t, tk, onGoTab, onGoWork, onClose,
    onCaptureSession, onScanQr, onFieldNote, onReminders, onNewWork, onNewSale,
    onStockTake, onPendingApprovals, onExportXlsx,
    semanticHits, semanticLoading, semanticUnavailable, semanticPending, numHit,
    catalogueComplete, serverTitleHits,
  ])

  const clampedIdx = Math.min(idx, Math.max(0, items.length - 1))

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && items[clampedIdx]) { items[clampedIdx].action() }
  }, [items, clampedIdx, onClose])

  useEffect(() => { setIdx(0) }, [q])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${clampedIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [clampedIdx])

  if (!open) return null

  // Group items
  const groups: string[] = []
  for (const item of items) { if (!groups.includes(item.group)) groups.push(item.group) }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ width: '100%', maxWidth: 560, background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '60vh' }}
        onKeyDown={handleKey}
      >
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('cmd_palette_placeholder')}
          className="input"
          style={{ border: 'none', borderBottom: '1px solid var(--bd)', borderRadius: 0, fontSize: 14, padding: '14px 16px', background: 'var(--bg0)' }}
        />
        <div ref={listRef} style={{ overflow: 'auto', flex: 1 }}>
          {items.length === 0 && (
            <div className="t-mono-sm" style={{ padding: '12px 16px', opacity: 0.5 }}>{t('cmd_palette_no_results')}</div>
          )}
          {groups.map(group => {
            const groupItems = items.filter(x => x.group === group)
            return (
              <div key={group}>
                <div className="t-mono-sm" style={{ padding: '8px 16px 4px', fontSize: 9, opacity: 0.4, letterSpacing: 1 }}>{group}</div>
                {groupItems.map(item => {
                  const itemIdx = items.indexOf(item)
                  return (
                    <button
                      key={item.id}
                      data-idx={itemIdx}
                      type="button"
                      onClick={item.action}
                      onMouseEnter={() => setIdx(itemIdx)}
                      style={{
                        display: item.work ? 'flex' : 'block', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                        padding: item.work ? '5px 16px' : '9px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        background: itemIdx === clampedIdx ? 'var(--bg2)' : 'transparent',
                        color: 'var(--tx)',
                        border: 'none',
                      }}
                    >
                      {item.work ? <WorkThumbLabel id={item.work.id} title={item.work.title} image={item.work.image} px={28} /> : item.label}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
