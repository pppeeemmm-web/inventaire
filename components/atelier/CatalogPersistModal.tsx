'use client'

// Attach selection to catalog theme or working group (no export file — dock “Theme · group”).

import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { reloadAtelierAfterBatchSuccess } from '@/lib/atelier/reload-after-batch'
import { PemModalOverlay } from '@/components/shared/PemModalOverlay'
import {
  batchEdit,
  createTheme,
  createWorkingGroup,
} from '@/app/atelier/selection/actions'
import { stringifyError } from '@/lib/error'

type PersistMode = 'theme' | 'group'

interface Props {
  ids:             number[]
  catalogThemes:   { id: number; name: string }[]
  catalogGroups:   { id: string; name: string }[]
  onClose:         () => void
}

export function CatalogPersistModal({
  ids,
  catalogThemes: initialCatalogThemes,
  catalogGroups: initialCatalogGroups,
  onClose,
}: Props) {
  const { t } = useI18n()
  const [persistMode, setPersistMode] = useState<PersistMode>('theme')
  const [localCatalogThemes, setLocalCatalogThemes] = useState(initialCatalogThemes)
  const [selectedCatalogThemeId, setSelectedCatalogThemeId] = useState<number | ''>('')
  const [newCatalogThemeName, setNewCatalogThemeName] = useState('')
  const [creatingCatalogTheme, setCreatingCatalogTheme] = useState(false)

  const [localCatalogGroups, setLocalCatalogGroups] = useState(initialCatalogGroups)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [newWorkingGroupName, setNewWorkingGroupName] = useState('')
  const [creatingWorkingGroup, setCreatingWorkingGroup] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setLocalCatalogThemes(initialCatalogThemes)
  }, [initialCatalogThemes])

  useEffect(() => {
    setLocalCatalogGroups(initialCatalogGroups)
  }, [initialCatalogGroups])

  async function handleCreateCatalogTheme() {
    const name = newCatalogThemeName.trim()
    if (!name) return
    setCreatingCatalogTheme(true)
    const res = await createTheme(name)
    if (res.theme) {
      setLocalCatalogThemes((prev) =>
        [...prev, res.theme!].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      )
      setSelectedCatalogThemeId(res.theme.id)
      setNewCatalogThemeName('')
    } else if (res.error) {
      setError(res.error)
    }
    setCreatingCatalogTheme(false)
  }

  async function handleCreateWorkingGroup() {
    const name = newWorkingGroupName.trim()
    if (!name) return
    setCreatingWorkingGroup(true)
    const res = await createWorkingGroup(name)
    if (res.group) {
      setLocalCatalogGroups((prev) =>
        [...prev.filter((g) => g.id !== res.group!.id), res.group!].sort((a, b) =>
          a.name.localeCompare(b.name, 'fr'),
        ),
      )
      setSelectedGroupId(res.group.id)
      setNewWorkingGroupName('')
    } else if (res.error) {
      setError(res.error)
    }
    setCreatingWorkingGroup(false)
  }

  async function handleSubmit() {
    setError(null)
    if (persistMode === 'theme' && selectedCatalogThemeId === '') {
      setError(t('exportThemeRequired'))
      return
    }
    if (persistMode === 'group' && !selectedGroupId) {
      setError(t('exportGroupRequired'))
      return
    }
    setBusy(true)
    try {
      if (persistMode === 'theme' && selectedCatalogThemeId !== '') {
        const br = await batchEdit(ids, { addThemeIds: [selectedCatalogThemeId as number] })
        if ('error' in br) setError(br.error)
        else reloadAtelierAfterBatchSuccess()
        return
      }
      if (persistMode === 'group' && selectedGroupId) {
        const br = await batchEdit(ids, { addGroupIds: [selectedGroupId] })
        if ('error' in br) setError(br.error)
        else reloadAtelierAfterBatchSuccess()
      }
    } catch (e) {
      setError(stringifyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PemModalOverlay
      onClose={onClose}
      panelStyle={{
        maxWidth: 420,
        width: '100%',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div data-testid="catalog-persist-dialog">
        <div className="t-label">{t('exportSaveSelectionTitle')}</div>
        <div className="t-mono-sm" style={{ color: 'var(--tx3)', fontSize: 10, lineHeight: 1.45 }}>
          {t('catalogAttachBlurb')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="radio"
              name="catalogPersistMode"
              checked={persistMode === 'theme'}
              onChange={() => {
                setPersistMode('theme')
                setSelectedGroupId('')
                setNewWorkingGroupName('')
                setError(null)
              }}
              data-testid="catalog-persist-theme"
            />
            <span className="t-mono-sm">{t('exportSaveAsCatalogTheme')}</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="radio"
              name="catalogPersistMode"
              checked={persistMode === 'group'}
              onChange={() => {
                setPersistMode('group')
                setSelectedCatalogThemeId('')
                setNewCatalogThemeName('')
                setError(null)
              }}
              data-testid="catalog-persist-group"
            />
            <span className="t-mono-sm">{t('exportSaveAsWorkingGroup')}</span>
          </label>
        </div>

        {persistMode === 'theme' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="t-label">{t('exportPickCatalogTheme')}</span>
            <select
              className="input sm"
              style={{ width: '100%', fontSize: 11 }}
              value={selectedCatalogThemeId === '' ? '' : String(selectedCatalogThemeId)}
              onChange={(e) => setSelectedCatalogThemeId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">{t('exportPickCatalogTheme')}…</option>
              {[...localCatalogThemes]
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                .map((th) => (
                  <option key={th.id} value={th.id}>{th.name}</option>
                ))}
            </select>
            <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input sm"
                placeholder={t('exportNewCatalogThemePlaceholder')}
                value={newCatalogThemeName}
                onChange={(e) => setNewCatalogThemeName(e.target.value)}
                style={{ flex: 1, minWidth: 120, fontSize: 11 }}
              />
              <button
                type="button"
                className="btn sm"
                disabled={creatingCatalogTheme || !newCatalogThemeName.trim()}
                onClick={() => void handleCreateCatalogTheme()}
              >
                {creatingCatalogTheme ? '…' : t('exportCreateCatalogThemeBtn')}
              </button>
            </div>
          </div>
        )}

        {persistMode === 'group' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="t-label">{t('exportPickWorkingGroup')}</span>
            <select
              className="input sm"
              style={{ width: '100%', fontSize: 11 }}
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              data-testid="catalog-persist-pick-group"
            >
              <option value="">{t('exportPickWorkingGroup')}…</option>
              {[...localCatalogGroups]
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                .map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>
            <div className="row gap-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="input sm"
                placeholder={t('exportNewWorkingGroupPlaceholder')}
                value={newWorkingGroupName}
                onChange={(e) => setNewWorkingGroupName(e.target.value)}
                style={{ flex: 1, minWidth: 120, fontSize: 11 }}
              />
              <button
                type="button"
                className="btn sm"
                disabled={creatingWorkingGroup || !newWorkingGroupName.trim()}
                onClick={() => void handleCreateWorkingGroup()}
              >
                {creatingWorkingGroup ? '…' : t('exportCreateCatalogThemeBtn')}
              </button>
            </div>
          </div>
        )}

        {error && <div className="t-mono-sm" style={{ color: '#c0392b', fontSize: 10 }}>{error}</div>}

        <div className="row gap-sm" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            data-testid="catalog-persist-confirm"
            onClick={() => void handleSubmit()}
          >
            {busy ? '…' : t('exportContinue')}
          </button>
        </div>
      </div>
    </PemModalOverlay>
  )
}
