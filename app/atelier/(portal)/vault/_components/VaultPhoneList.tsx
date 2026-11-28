'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import type { VaultDoc } from '@/app/atelier/(portal)/vault/actions'
import { PhoneListToolbar, PhoneChip } from '@/components/shared/phone/PhoneListToolbar'
import { PhoneListRow } from '@/components/shared/phone/PhoneListRow'
import { PhoneSheet } from '@/components/shared/phone/PhoneSheet'

/**
 * Coffre on the phone (PhonePattern.md step 1): count line + « … » + « + » (import), the shared search / chips
 * toolbar, sub-folders then documents as rows (tap a document → the same preview rail as the desk, in a sheet). State stays in Vault.
 */
export function VaultPhoneList({
  docs, folders, loading, hasAnyDoc, search, onSearch, currentPath, onGoToPath, kindFilter, kindLabel, onClearKind,
  mimeIcon, formatSize, onEnterFolder, onOpen, onImport, onNewFolder, onCoa,
}: {
  docs: VaultDoc[]
  folders: string[]
  loading: boolean
  hasAnyDoc: boolean
  search: string
  onSearch: (q: string) => void
  currentPath: string[]
  onGoToPath: (path: string[]) => void
  kindFilter: string | null
  kindLabel: string
  onClearKind: () => void
  mimeIcon: (mime: string | null) => string
  formatSize: (bytes: number) => string
  onEnterFolder: (name: string) => void
  onOpen: (doc: VaultDoc) => void
  onImport: () => void
  onNewFolder: () => void
  onCoa: () => void
}) {
  const { t, lang } = useI18n()
  const [sheet, setSheet] = useState<'more' | null>(null)
  const empty = folders.length === 0 && docs.length === 0

  const chips = (
    <>
      {currentPath.length > 0 ? (
        <PhoneChip label={t('vault_phone_up')} onClick={() => onGoToPath(currentPath.slice(0, -1))} testId="atelier-vault-phone-up" />
      ) : null}
      {currentPath.length > 0 ? (
        <PhoneChip label={currentPath[currentPath.length - 1]} active onClick={() => onGoToPath([])} />
      ) : null}
      {kindFilter ? <PhoneChip label={kindLabel} active onClick={onClearKind} /> : null}
    </>
  )

  return (
    <div data-testid="atelier-vault-phone" style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="t-mono-sm" style={{ flex: 1, minWidth: 0, color: 'var(--tx3)' }}>
          {t('vault_phone_count_fmt').replace(/\{n\}/g, String(docs.length))}
        </div>
        <button type="button" className="btn ghost sm" aria-label={t('phone_more_actions')} onClick={() => setSheet('more')} style={{ minWidth: 44, minHeight: 44 }}>…</button>
        <button type="button" className="btn primary sm" aria-label={t('import')} data-testid="atelier-vault-phone-import" onClick={onImport} style={{ minWidth: 44, minHeight: 44, borderRadius: 22, fontSize: 20 }}>+</button>
      </div>

      <PhoneListToolbar
        query={search}
        onQuery={onSearch}
        placeholder={t('vault_phone_search_ph')}
        chips={chips}
        testId="atelier-vault-phone-toolbar"
      />

      {loading ? <p className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '24px 0', textAlign: 'center' }}>{t('loading')}</p> : null}
      {!loading && empty ? (
        <p className="t-mono-sm" style={{ color: 'var(--tx3)', padding: '24px 0', textAlign: 'center' }}>{hasAnyDoc ? t('vault_phone_no_results') : t('vault_phone_empty')}</p>
      ) : null}
      <ul style={{ margin: 0, padding: 0 }}>
        {loading ? null : folders.map((f) => (
          <PhoneListRow
            key={`folder-${f}`}
            title={f}
            sub={t('vault_phone_folder')}
            leading={<span aria-hidden="true">📁</span>}
            value="›"
            onClick={() => onEnterFolder(f)}
            testId={`atelier-vault-phone-folder-${f}`}
          />
        ))}
        {loading ? null : docs.map((d) => (
          <PhoneListRow
            key={d.id}
            title={d.name}
            sub={[d.folder ?? '', new Date(d.doc_date || d.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')].filter(Boolean).join(' · ')}
            value={formatSize(d.file_size ?? 0)}
            leading={<span aria-hidden="true">{mimeIcon(d.mime_type)}</span>}
            onClick={() => onOpen(d)}
            testId={`atelier-vault-phone-row-${d.id}`}
          />
        ))}
      </ul>

      {sheet === 'more' ? (
        <PhoneSheet title={t('phone_more_actions')} onClose={() => setSheet(null)} testId="atelier-vault-phone-more">
          <button type="button" className="btn ghost" onClick={() => { setSheet(null); onNewFolder() }} style={{ width: '100%', minHeight: 48, justifyContent: 'flex-start' }}>📁 {t('newFolder')}</button>
          <button type="button" className="btn ghost" onClick={() => { setSheet(null); onCoa() }} style={{ width: '100%', minHeight: 48, justifyContent: 'flex-start' }}>✦ {t('vault_phone_coa')}</button>
          <Link href="/atelier/aide" className="btn ghost" data-testid="vault-aide" style={{ width: '100%', minHeight: 48, justifyContent: 'flex-start' }}>📕 {t('aide_vault_link')}</Link>
        </PhoneSheet>
      ) : null}
    </div>
  )
}
