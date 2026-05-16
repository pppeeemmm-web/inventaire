'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'
import type { Oeuvre } from '@/lib/types/database'
import { fuzzySearch } from '@/lib/fuzzy-search'

interface Contact { ContactID: number; Nom: string | null; Prénom: string | null; NomInstitution: string | null }

type TabEntry = { id: string; label: string }

interface Props {
  open: boolean
  onClose: () => void
  tabs: TabEntry[]
  oeuvres: Oeuvre[]
  contacts: Contact[]
  onGoTab: (tab: string) => void
  onGoWork: (id: number) => void
  onNewWork: () => void
  onExportXlsx: () => void
  onRegenBible: () => void
}

interface Item {
  id: string
  label: string
  group: string
  action: () => void
}

export function CommandPalette({
  open, onClose, tabs, oeuvres, contacts,
  onGoTab, onGoWork, onNewWork, onExportXlsx, onRegenBible,
}: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10) }
  }, [open])

  const items: Item[] = useMemo(() => {
    const result: Item[] = []
    const qTrim = q.trim()

    // Quick actions
    const actionDefs = [
      { id: 'act:new-work',    label: t('cmd_palette_action_new_work'),    action: () => { onNewWork(); onClose() } },
      { id: 'act:new-session', label: t('cmd_palette_action_new_session'), action: () => { router.push('/atelier/session/new'); onClose() } },
      { id: 'act:capture',     label: t('cmd_palette_action_capture'),     action: () => { router.push('/atelier/capture'); onClose() } },
      { id: 'act:new-issue',   label: t('cmd_palette_action_new_issue'),   action: () => { router.push('/atelier/issue/new'); onClose() } },
      { id: 'act:new-doc',     label: t('cmd_palette_action_new_document'), action: () => { router.push('/atelier/documents/new'); onClose() } },
      { id: 'act:triage',      label: t('cmd_palette_action_triage'),      action: () => { router.push('/atelier/triage'); onClose() } },
      { id: 'act:scan',        label: t('cmd_palette_action_scan'),        action: () => { router.push('/atelier/scan'); onClose() } },
      { id: 'act:export-xlsx', label: t('cmd_palette_action_export_xlsx'), action: () => { onExportXlsx(); onClose() } },
      { id: 'act:regen-bible', label: t('cmd_palette_action_regen_bible'), action: () => { onRegenBible(); onClose() } },
    ]
    const actionMatches = qTrim
      ? fuzzySearch(actionDefs, qTrim, { keys: ['label'] })
      : actionDefs
    for (const a of actionMatches) {
      result.push({ ...a, group: t('cmd_palette_group_actions') })
    }

    // Tabs
    const tabMatches = qTrim
      ? fuzzySearch(tabs, qTrim, { keys: [{ name: 'label', weight: 0.75 }, { name: 'id', weight: 0.25 }] })
      : tabs
    for (const tab of tabMatches) {
      result.push({ id: `tab:${tab.id}`, label: tab.label, group: t('cmd_palette_group_tabs'), action: () => { onGoTab(tab.id); onClose() } })
    }

    // Works (search by title, min 2 chars)
    if (qTrim.length >= 2) {
      const workDocs = oeuvres.map((work) => ({
        id: String(work.OeuvreID),
        title: work.Titre ?? '',
        work,
      }))
      for (const doc of fuzzySearch(workDocs, qTrim, {
        keys: [{ name: 'title', weight: 0.85 }, { name: 'id', weight: 0.15 }],
      }).slice(0, 6)) {
        const o = doc.work
        result.push({ id: `work:${o.OeuvreID}`, label: o.Titre ?? `#${o.OeuvreID}`, group: t('cmd_palette_group_works'), action: () => { onGoWork(o.OeuvreID); onClose() } })
      }
    }

    // Contacts (search by name, min 2 chars)
    if (qTrim.length >= 2) {
      const contactDocs = contacts.map((contact) => {
        const name = [contact.Prénom, contact.Nom, contact.NomInstitution].filter(Boolean).join(' ')
        return { id: String(contact.ContactID), name, contact }
      })
      for (const doc of fuzzySearch(contactDocs, qTrim, {
        keys: [{ name: 'name', weight: 0.85 }, { name: 'id', weight: 0.15 }],
      }).slice(0, 4)) {
        const c = doc.contact
        const name = [c.Prénom, c.Nom, c.NomInstitution].filter(Boolean).join(' ')
        result.push({ id: `contact:${c.ContactID}`, label: name || `#${c.ContactID}`, group: t('cmd_palette_group_contacts'), action: () => { onGoTab('contacts'); onClose() } })
      }
    }

    return result
  }, [q, tabs, oeuvres, contacts, t, router, onGoTab, onGoWork, onClose, onNewWork, onExportXlsx, onRegenBible])

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
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '9px 16px', fontSize: 13, cursor: 'pointer',
                        background: itemIdx === clampedIdx ? 'var(--bg2)' : 'transparent',
                        color: 'var(--tx)',
                        border: 'none',
                      }}
                    >
                      {item.label}
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
