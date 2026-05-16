'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { searchAtelierResearchSummaries, type AtelierResearchRemoteResult } from '@/app/atelier/research-actions'
import { useI18n } from '@/lib/i18n/context'
import type { DictKey } from '@/lib/i18n/dictionary'
import type { AtelierTabId } from '@/lib/atelier/tab-cache-policy'
import { useMediaQuery } from '@/lib/useMediaQuery'
import type { Oeuvre } from '@/lib/types/database'

type ContactLite = {
  ContactID: number
  Nom: string | null
  Prénom: string | null
  NomInstitution: string | null
}

type TabEntry = {
  id: AtelierTabId
  label: string
}

type ResearchItem = {
  id: string
  groupKey: DictKey
  label: string
  detail: string
  action: () => void
}

type Props = {
  tabs: TabEntry[]
  oeuvres: Oeuvre[]
  contacts: ContactLite[]
  selectionCount: number
  curationDockVisible: boolean
  onGoTab: (tab: AtelierTabId) => void
  onOpenWork: (id: number) => void
  onOpenContact: (id: number) => void
  onOpenExhibition: (id: string) => void
  onOpenProcess: (id: string) => void
  onOpenNotes: (noteId?: string) => void
  onOpenReports: () => void
}

function contactLabel(contact: ContactLite): string {
  return [contact.Prénom, contact.Nom, contact.NomInstitution].filter(Boolean).join(' ') || `#${contact.ContactID}`
}

function workLabel(work: Oeuvre): string {
  return (work.Titre ?? '').trim() || `#${work.OeuvreID}`
}

function groupItems(items: ResearchItem[]): { key: DictKey; items: ResearchItem[] }[] {
  const groups: { key: DictKey; items: ResearchItem[] }[] = []
  for (const item of items) {
    const group = groups.find((g) => g.key === item.groupKey)
    if (group) group.items.push(item)
    else groups.push({ key: item.groupKey, items: [item] })
  }
  return groups
}

export function AtelierResearchBar({
  tabs,
  oeuvres,
  contacts,
  selectionCount,
  curationDockVisible,
  onGoTab,
  onOpenWork,
  onOpenContact,
  onOpenExhibition,
  onOpenProcess,
  onOpenNotes,
  onOpenReports,
}: Props) {
  const { t } = useI18n()
  const narrow = useMediaQuery('(max-width: 767px)')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [remoteResults, setRemoteResults] = useState<AtelierResearchRemoteResult[]>([])
  const [remoteError, setRemoteError] = useState<string | null>(null)
  const [remotePending, startRemoteSearch] = useTransition()

  const close = useCallback(() => {
    setOpen(false)
    setQ('')
    setActiveIdx(0)
    setRemoteResults([])
    setRemoteError(null)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setRemoteResults([])
      setRemoteError(null)
      return
    }
    let active = true
    const id = window.setTimeout(() => {
      startRemoteSearch(() => {
        void searchAtelierResearchSummaries(trimmed, 6)
          .then((res) => {
            if (!active) return
            if ('error' in res) {
              setRemoteResults([])
              setRemoteError(res.error)
            } else {
              setRemoteResults(res.results)
              setRemoteError(null)
            }
          })
          .catch((err: unknown) => {
            if (!active) return
            setRemoteResults([])
            setRemoteError(err instanceof Error ? err.message : String(err))
          })
      })
    }, 220)
    return () => {
      active = false
      window.clearTimeout(id)
    }
  }, [q])

  useEffect(() => {
    setActiveIdx(0)
  }, [q, remoteResults])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [close, open])

  const quickItems = useMemo<ResearchItem[]>(
    () => [
      {
        id: 'quick:reports',
        groupKey: 'research_group_actions',
        label: selectionCount > 0
          ? t('research_quick_reports_selection').replace('{n}', String(selectionCount))
          : t('research_quick_reports'),
        detail: t('research_quick_reports_detail'),
        action: () => {
          onOpenReports()
          close()
        },
      },
      {
        id: 'quick:notes',
        groupKey: 'research_group_actions',
        label: t('research_quick_notes'),
        detail: t('research_quick_notes_detail'),
        action: () => {
          onOpenNotes()
          close()
        },
      },
      {
        id: 'quick:contacts',
        groupKey: 'research_group_actions',
        label: t('research_quick_contacts'),
        detail: t('research_quick_contacts_detail'),
        action: () => {
          onGoTab('contacts')
          close()
        },
      },
    ],
    [close, onGoTab, onOpenNotes, onOpenReports, selectionCount, t],
  )

  const items = useMemo<ResearchItem[]>(() => {
    const trimmed = q.trim()
    const query = trimmed.toLowerCase()
    const result: ResearchItem[] = trimmed.length < 2 ? [...quickItems] : []

    if (trimmed.length >= 2) {
      for (const tab of tabs) {
        if (tab.label.toLowerCase().includes(query) || tab.id.toLowerCase().includes(query)) {
          result.push({
            id: `tab:${tab.id}`,
            groupKey: 'research_group_tabs',
            label: tab.label,
            detail: t('research_detail_tab'),
            action: () => {
              onGoTab(tab.id)
              close()
            },
          })
        }
      }

      let workCount = 0
      for (const work of oeuvres) {
        const label = workLabel(work)
        const haystack = `${label} #${work.OeuvreID}`.toLowerCase()
        if (!haystack.includes(query)) continue
        result.push({
          id: `work:${work.OeuvreID}`,
          groupKey: 'research_group_works',
          label,
          detail: t('research_detail_work').replace('{id}', String(work.OeuvreID)),
          action: () => {
            onOpenWork(work.OeuvreID)
            close()
          },
        })
        workCount += 1
        if (workCount >= 8) break
      }

      let contactCount = 0
      for (const contact of contacts) {
        const label = contactLabel(contact)
        const haystack = `${label} #${contact.ContactID}`.toLowerCase()
        if (!haystack.includes(query)) continue
        result.push({
          id: `contact:${contact.ContactID}`,
          groupKey: 'research_group_contacts',
          label,
          detail: t('research_detail_contact').replace('{id}', String(contact.ContactID)),
          action: () => {
            onOpenContact(contact.ContactID)
            close()
          },
        })
        contactCount += 1
        if (contactCount >= 6) break
      }

      for (const row of remoteResults) {
        if (row.kind === 'process') {
          const isExhibition = row.processType === 'exposition'
          result.push({
            id: `process:${row.id}`,
            groupKey: isExhibition ? 'research_group_exhibitions' : 'research_group_processes',
            label: row.label,
            detail: row.detail ?? t('research_detail_process'),
            action: () => {
              if (isExhibition) onOpenExhibition(row.id)
              else onOpenProcess(row.id)
              close()
            },
          })
        } else {
          result.push({
            id: `voice:${row.id}`,
            groupKey: 'research_group_notes',
            label: row.label,
            detail: row.detail ?? t('research_detail_note'),
            action: () => {
              onOpenNotes(row.id)
              close()
            },
          })
        }
      }
    }

    return result.slice(0, 24)
  }, [
    close,
    contacts,
    oeuvres,
    onGoTab,
    onOpenContact,
    onOpenExhibition,
    onOpenNotes,
    onOpenProcess,
    onOpenWork,
    q,
    quickItems,
    remoteResults,
    tabs,
    t,
  ])

  const clampedIdx = Math.min(activeIdx, Math.max(0, items.length - 1))

  const runActive = useCallback(() => {
    const item = items[clampedIdx]
    if (item) item.action()
  }, [clampedIdx, items])

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, items.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      runActive()
    }
  }

  const panelStyle: CSSProperties = narrow
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 140,
        padding: '12px max(12px, env(safe-area-inset-right, 0px)) max(14px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))',
        background: 'var(--bg1)',
        borderTop: '1px solid var(--bd)',
        boxShadow: '0 -12px 36px rgba(0,0,0,0.35)',
      }
    : {
        position: 'fixed',
        right: 22,
        bottom: curationDockVisible ? 92 : 20,
        width: 380,
        zIndex: 74,
        padding: 10,
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
      }

  const listStyle: CSSProperties = narrow
    ? { maxHeight: '48vh', overflow: 'auto', paddingTop: 8 }
    : { maxHeight: 360, overflow: 'auto', paddingTop: 8 }

  const renderPanel = (
    <div ref={panelRef} data-testid="atelier-research-panel" role="dialog" aria-label={t('research_bar_aria')} style={panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          ref={inputRef}
          type="search"
          className="input"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t('research_placeholder')}
          aria-label={t('research_placeholder')}
          style={{ flex: 1, minHeight: 44, fontSize: 14 }}
        />
        <button type="button" className="btn ghost sm" aria-label={t('research_close')} onClick={close} style={{ minHeight: 44, minWidth: 44 }}>
          x
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8 }}>
        {quickItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="btn ghost sm"
            onClick={item.action}
            style={{ minHeight: 36, fontSize: 11 }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={listStyle}>
        {groupItems(items).map((group) => (
          <div key={group.key}>
            <div className="t-mono-sm" style={{ padding: '8px 4px 4px', fontSize: 9, opacity: 0.55, letterSpacing: 1 }}>
              {t(group.key)}
            </div>
            {group.items.map((item) => {
              const itemIdx = items.indexOf(item)
              const active = itemIdx === clampedIdx
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid="atelier-research-result"
                  onClick={item.action}
                  onMouseEnter={() => setActiveIdx(itemIdx)}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    padding: '8px 10px',
                    textAlign: 'left',
                    border: '1px solid transparent',
                    background: active ? 'var(--bg2)' : 'transparent',
                    color: 'var(--tx)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{item.label}</span>
                  <span className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10 }}>{item.detail}</span>
                </button>
              )
            })}
          </div>
        ))}
        {q.trim().length >= 2 && remotePending && (
          <div className="t-mono-sm" style={{ padding: 10, color: 'var(--tx3)' }}>{t('research_loading')}</div>
        )}
        {q.trim().length >= 2 && !remotePending && items.length === 0 && (
          <div className="t-mono-sm" style={{ padding: 10, color: 'var(--tx3)' }}>{t('cmd_palette_no_results')}</div>
        )}
        {remoteError && (
          <div className="t-mono-sm" style={{ padding: 10, color: 'var(--rust)' }}>{t('research_remote_error')}</div>
        )}
      </div>
    </div>
  )

  if (narrow) {
    return (
      <>
        {open && <div style={{ position: 'fixed', inset: 0, zIndex: 135, background: 'rgba(0,0,0,0.35)' }} />}
        {open ? renderPanel : (
          <button
            type="button"
            data-testid="atelier-research-pill"
            aria-label={t('research_bar_aria')}
            onClick={() => setOpen(true)}
            style={{
              position: 'fixed',
              right: 'max(12px, env(safe-area-inset-right, 0px))',
              bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
              zIndex: 130,
              width: 48,
              height: 48,
              borderRadius: 999,
              border: '1px solid var(--bd2)',
              background: 'var(--bg2)',
              color: 'var(--tx)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Q
          </button>
        )}
      </>
    )
  }

  return open ? renderPanel : (
    <button
      type="button"
      data-testid="atelier-research-pill"
      className="btn ghost sm"
      aria-label={t('research_bar_aria')}
      onClick={() => setOpen(true)}
      style={{
        position: 'fixed',
        right: 22,
        bottom: curationDockVisible ? 92 : 20,
        zIndex: 74,
        minHeight: 44,
        padding: '10px 14px',
        background: 'var(--bg1)',
        borderColor: 'var(--bd2)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
      }}
    >
      {t('research_pill_label')}
    </button>
  )
}
