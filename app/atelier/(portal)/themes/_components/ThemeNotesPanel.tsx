'use client'

import { useState } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { THEME_NOTES_MAX } from '@/lib/theme-notes'
import { saveThemeNotes } from '../theme-notes-actions'

/**
 * Theme notes (TODO 23) on Catalogue → Thèmes: under the mosaic on desktop, right under the tapped row on the
 * phone. Shows the selected theme's notes; « Modifier » opens a textarea bound to THAT theme (`editingId`, held
 * by Themes.tsx), so hovering / tapping another row while typing never moves or loses the text.
 * Only mounted when THEME_NOTES_SQL_LIVE is true.
 */
export function ThemeNotesPanel({
  themes,
  selectedId,
  notesById,
  narrow,
  editingId,
  onEditingChange,
  onSaved,
}: {
  themes: { id: number; name: string }[]
  selectedId: number | null
  notesById: Record<number, string>
  narrow: boolean
  editingId: number | null
  onEditingChange: (id: number | null) => void
  onSaved: (id: number, notes: string | null) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const shownId = editingId ?? selectedId
  const theme = shownId != null ? themes.find((x) => x.id === shownId) : undefined
  const current = shownId != null ? (notesById[shownId] ?? '') : ''
  const editing = editingId != null
  const tooLong = draft.trim().length > THEME_NOTES_MAX

  function startEdit() {
    if (shownId == null) return
    onEditingChange(shownId)
    setDraft(current)
    setErr(null)
  }

  function cancel() {
    onEditingChange(null)
    setDraft('')
    setErr(null)
  }

  async function save() {
    if (editingId == null || tooLong) return
    if (draft.trim() === current.trim()) {
      cancel()
      return
    }
    setSaving(true)
    const res = await saveThemeNotes(editingId, draft)
    setSaving(false)
    if ('error' in res) {
      setErr(
        res.error === 'too_long'
          ? t('thn_too_long_fmt').replace('{count}', String(THEME_NOTES_MAX))
          : t('thn_error_fmt').replace('{error}', res.error),
      )
      return
    }
    onSaved(editingId, res.notes)
    cancel()
  }

  return (
    <section
      data-testid="theme-notes-panel"
      style={{
        flexShrink: 0,
        background: 'var(--bg1)',
        border: '1px solid var(--bd)',
        borderRadius: 8,
        padding: narrow ? 12 : 16,
        maxHeight: editing ? 'none' : narrow ? 180 : 220,
        overflowY: editing ? 'visible' : 'auto',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div className="t-mono-sm" style={{ fontSize: 9, letterSpacing: 2, color: 'var(--tx3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(theme ? t('thn_editing_fmt').replace('{name}', theme.name) : t('thn_title')).toUpperCase()}
        </div>
        {theme && !editing && (
          <button type="button" className="btn sm" onClick={startEdit} style={{ minHeight: narrow ? 44 : 32, flexShrink: 0 }}>
            {current ? t('thn_edit') : t('thn_add')}
          </button>
        )}
      </header>

      {!theme ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--tx3)' }}>{t('thn_pick')}</p>
      ) : editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancel()
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
            }}
            placeholder={t('thn_placeholder')}
            rows={narrow ? 5 : 6}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontSize: narrow ? 16 : 13,
              lineHeight: 1.5,
              background: 'var(--bg0)',
              border: `1px solid ${tooLong ? 'var(--rust)' : 'var(--bd)'}`,
              color: 'var(--tx)',
              padding: '8px 10px',
              fontFamily: 'inherit',
            }}
          />
          {(err || tooLong) && (
            <div role="alert" style={{ fontSize: 12, color: 'var(--rust)' }}>
              {tooLong ? t('thn_too_long_fmt').replace('{count}', String(THEME_NOTES_MAX)) : err}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" onClick={cancel} disabled={saving} style={{ minHeight: 44 }}>
              {t('thn_cancel')}
            </button>
            <button type="button" className="btn sm primary" onClick={() => void save()} disabled={saving || tooLong} style={{ minHeight: 44 }}>
              {t('thn_save')}
            </button>
          </div>
        </div>
      ) : current ? (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--tx2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {current}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--tx3)' }}>{t('thn_empty')}</p>
      )}
    </section>
  )
}
