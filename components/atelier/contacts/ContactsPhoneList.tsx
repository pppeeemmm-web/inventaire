'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { PhoneListToolbar, PhoneChip } from '@/components/shared/phone/PhoneListToolbar'
import { PhoneListRow } from '@/components/shared/phone/PhoneListRow'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'
import { ReportLinkButton } from '@/components/atelier/ReportLinkButton'

export type PhoneContactRow = { id: number; title: string; sub: string; badge: string }

const SEARCH_BY = [
  ['all', 'searchFieldAll'], ['name', 'searchFieldName'], ['city', 'searchFieldCity'], ['email', 'searchFieldEmail'], ['notes', 'searchFieldNotes'],
] as const

const eyebrow = { color: 'var(--tx3)', margin: '14px 0 6px' } as const
const chipsRow = { display: 'flex', flexWrap: 'wrap', gap: 6 } as const
const sheetBtn = { width: '100%', minHeight: 48, justifyContent: 'flex-start', display: 'flex', alignItems: 'center' } as const
const fieldStyle = { width: '100%', minHeight: 44, padding: '0 10px', fontSize: 16, background: 'var(--bg0)', border: '1px solid var(--bd)', color: 'var(--tx)' } as const

/**
 * Contacts on the phone (PhonePattern.md): count line + « … » + « + » (quick add), the shared search / chips toolbar,
 * the filter sheet, one row per contact (tap → the same page / editor as the desk). All state stays in ContactsTab.
 */
export function ContactsPhoneList({
  rows, total, search, onSearch, searchBy, onSearchBy, role, onRole, roleList, sphere, onSphere, sphereOptions, sphereCounts,
  archivedOnly, onArchived, archivedCount, privateOnly, onPrivate, privateCount, isAdmin, sortKey, sortDir, onSort, onClear,
  onOpen, onNewFull, onQuickAdd, quickBusy, onImportCsv, onImportUrl,
}: {
  rows: PhoneContactRow[]
  total: number
  search: string
  onSearch: (q: string) => void
  searchBy: string
  onSearchBy: (v: string) => void
  role: string
  onRole: (v: string) => void
  /** Every browsable contact's role (blank = none); the most frequent ones become one-tap chips. */
  roleList: string[]
  sphere: string
  onSphere: (key: string) => void
  sphereOptions: { key: string; label: string }[]
  sphereCounts: Record<string, number>
  archivedOnly: boolean
  onArchived: (v: boolean) => void
  archivedCount: number
  privateOnly: boolean
  onPrivate: (v: boolean) => void
  privateCount: number
  isAdmin: boolean
  sortKey: string
  sortDir: 'asc' | 'desc'
  onSort: (k: 'alpha' | 'role') => void
  onClear: () => void
  onOpen: (id: number) => void
  onNewFull: () => void
  onQuickAdd: (e: React.FormEvent<HTMLFormElement>) => void
  quickBusy: boolean
  onImportCsv: () => void
  onImportUrl: () => void
}) {
  const { t } = useI18n()
  const [sheet, setSheet] = useState<'filters' | 'more' | 'add' | null>(null)
  const sphereLabel = sphereOptions.find((s) => s.key === sphere)?.label ?? sphere
  const searchByLabel = t(SEARCH_BY.find(([v]) => v === searchBy)?.[1] ?? 'searchFieldAll')
  const active = (searchBy !== 'all' ? 1 : 0) + (role !== 'all' ? 1 : 0) + (sphere ? 1 : 0) + (archivedOnly ? 1 : 0) + (privateOnly ? 1 : 0)
  const counts = new Map<string, number>()
  for (const r of roleList) if (r) counts.set(r, (counts.get(r) ?? 0) + 1)
  const allRoles = [...counts.keys()].sort((a, b) => a.localeCompare(b))
  const quickRoles = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r)
  const countFmt = (n: string) => t('contacts_phone_count_fmt').replace('{n}', n)
  const close = () => setSheet(null)

  const chips = active ? (
    <>
      {searchBy !== 'all' ? <PhoneChip label={searchByLabel} active onClick={() => onSearchBy('all')} /> : null}
      {role !== 'all' ? <PhoneChip label={role} active onClick={() => onRole('all')} /> : null}
      {sphere ? <PhoneChip label={sphereLabel} active onClick={() => onSphere('')} /> : null}
      {archivedOnly ? <PhoneChip label={t('cs_archived_fmt').replace('{n}', String(archivedCount))} active onClick={() => onArchived(false)} /> : null}
      {privateOnly ? <PhoneChip label={t('contacts_private_chip')} active onClick={() => onPrivate(false)} /> : null}
    </>
  ) : quickRoles.map((r) => <PhoneChip key={r} label={r} onClick={() => onRole(r)} />)

  return (
    <div data-testid="contacts-phone-list" style={{ padding: '0 max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <div className="t-mono-sm" style={{ flex: 1, minWidth: 0, color: 'var(--tx3)' }}>{countFmt(`${rows.length}/${total}`)}</div>
        <button type="button" className="btn ghost sm" aria-label={t('phone_more_actions')} data-testid="contacts-phone-tools" onClick={() => setSheet('more')} style={{ minWidth: 44, minHeight: 44 }}>…</button>
        <button type="button" className="btn primary sm" aria-label={t('contacts_quick_title')} data-testid="contacts-quick-add" onClick={() => setSheet('add')} style={{ minWidth: 44, minHeight: 44, borderRadius: 22, fontSize: 20 }}>+</button>
      </div>

      <PhoneListToolbar
        query={search}
        onQuery={onSearch}
        placeholder={t('searchPlaceholderContacts')}
        activeCount={active}
        onOpenFilters={() => setSheet('filters')}
        chips={chips}
        testId="contacts-phone-toolbar"
      />

      {rows.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--tx3)' }}>
          <p className="t-mono-sm" style={{ margin: '0 0 8px' }}>{t('contacts_phone_empty')}</p>
          {active || search ? <button type="button" className="btn ghost sm" onClick={onClear} style={{ minHeight: 44 }}>{t('phone_filters_clear')}</button> : null}
        </div>
      ) : null}
      <ul style={{ margin: 0, padding: 0 }}>
        {rows.map((c) => (
          <PhoneListRow key={c.id} title={c.title} sub={c.sub} value={c.badge || undefined} onClick={() => onOpen(c.id)} testId="contacts-phone-row" />
        ))}
      </ul>

      {sheet === 'filters' ? (
        <PhoneSheet
          title={t('phone_filters')}
          onClose={close}
          testId="contacts-phone-filters"
          footer={<button type="button" className="btn primary" onClick={close} style={{ width: '100%', minHeight: 48 }}>{t('phone_filters_show_fmt').replace('{n}', countFmt(String(rows.length)))}</button>}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost sm" onClick={onClear} disabled={!active && !search} style={{ minHeight: 44 }}>{t('phone_filters_clear')}</button>
          </div>
          <h3 className="t-eyebrow" style={{ ...eyebrow, marginTop: 8 }}>{t('contacts_phone_search_in')}</h3>
          <div style={chipsRow}>
            {SEARCH_BY.map(([v, k]) => <PhoneChip key={v} label={t(k)} active={searchBy === v && v !== 'all'} onClick={() => onSearchBy(searchBy === v ? 'all' : v)} />)}
          </div>
          <h3 className="t-eyebrow" style={eyebrow}>{t('contactEditorRole')}</h3>
          <div style={chipsRow}>
            {allRoles.map((r) => <PhoneChip key={r} label={r} active={role === r} onClick={() => onRole(role === r ? 'all' : r)} />)}
          </div>
          {sphereOptions.length > 0 ? (
            <>
              <h3 className="t-eyebrow" style={eyebrow}>{t('contacts_phone_sphere')}</h3>
              <div style={chipsRow}>
                {sphereOptions.map((s) => (
                  <PhoneChip key={s.key} label={`${s.label} (${sphereCounts[s.key] ?? 0})`} active={sphere === s.key} onClick={() => onSphere(sphere === s.key ? '' : s.key)} />
                ))}
              </div>
            </>
          ) : null}
          <h3 className="t-eyebrow" style={eyebrow}>{t('contacts_phone_other')}</h3>
          <div style={chipsRow}>
            <PhoneChip label={t('cs_archived_fmt').replace('{n}', String(archivedCount))} active={archivedOnly} onClick={() => onArchived(!archivedOnly)} testId="contacts-archived-filter" />
            {isAdmin ? <PhoneChip label={t('contacts_private_filter_fmt').replace('{n}', String(privateCount))} active={privateOnly} onClick={() => onPrivate(!privateOnly)} testId="contacts-private-filter" /> : null}
          </div>
        </PhoneSheet>
      ) : null}

      {sheet === 'more' ? (
        <PhoneSheet title={t('phone_more_actions')} onClose={close} testId="contacts-phone-more">
          <h3 className="t-eyebrow" style={{ ...eyebrow, marginTop: 4 }}>{t('contacts_phone_sort')}</h3>
          <div style={chipsRow}>
            {(['alpha', 'role'] as const).map((s) => (
              <PhoneChip key={s} label={`${s === 'alpha' ? t('contacts_sort_alpha') : t('contactEditorRole')}${sortKey === s ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}`} onClick={() => onSort(s)} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            <button type="button" className="btn ghost" onClick={() => { close(); onNewFull() }} style={sheetBtn}>{t('contacts_new_btn')}</button>
            <button type="button" className="btn ghost" onClick={() => { close(); onImportCsv() }} style={sheetBtn}>{t('contacts_google_csv')}</button>
            <button type="button" className="btn ghost" onClick={() => { close(); onImportUrl() }} style={sheetBtn} title={t('contacts_url_tooltip')}>URL</button>
            <ReportLinkButton source="contacts" style={{ ...sheetBtn, minHeight: 48 }} />
          </div>
        </PhoneSheet>
      ) : null}

      {sheet === 'add' ? (
        <PhoneSheet title={t('contacts_quick_title')} onClose={close} testId="contacts-phone-quick-sheet">
          <form onSubmit={onQuickAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input name="institution" placeholder={t('contacts_quick_inst')} style={fieldStyle} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input name="prenom" placeholder={t('contacts_quick_first')} style={fieldStyle} />
              <input name="nom" placeholder={t('contacts_quick_last')} style={fieldStyle} />
            </div>
            <input name="email" type="email" placeholder={t('contacts_quick_email')} style={fieldStyle} />
            {isAdmin ? (
              <label className="t-mono-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--tx2)', minHeight: 44 }}>
                <input type="checkbox" name="is_private" value="true" style={{ width: 18, height: 18 }} />
                {t('contacts_quick_private')}
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" className="btn sm" disabled={quickBusy} style={{ minHeight: 44, flex: 1 }}>
                {quickBusy ? t('contacts_quick_saving') : t('contacts_quick_save')}
              </button>
              <Link href="/atelier/capture?mode=card#capture-card-live-text" className="btn ghost sm" style={{ minHeight: 44, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('contacts_quick_live_text')}
              </Link>
              <button type="button" className="btn ghost sm" style={{ minHeight: 44, flex: 1 }} onClick={() => { close(); onNewFull() }}>
                {t('contacts_quick_full')}
              </button>
            </div>
          </form>
        </PhoneSheet>
      ) : null}
    </div>
  )
}
