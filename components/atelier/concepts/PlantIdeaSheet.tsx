'use client'

// « Planter une idée » — one sheet for every way in (design IdeasDesign.md §2): from a Journal card (the moment
// stays on its day and becomes the idea's first page), from the Idées tab (a moment is written on today), or as
// a branch of an idea. Calls the one door `plantIdea` (database `idea_plant`, all or nothing).

import { useEffect, useState, type CSSProperties } from 'react'
import { useI18n } from '@/lib/i18n/context'
import { toast } from '@/lib/ui/toast'
import { MAIN_ACTION_STYLE } from '@/lib/ui/main-action'
import { plantIdea } from '@/app/atelier/(portal)/concepts/idea-actions'
import { ideaErrorText, SEED } from '@/components/atelier/concepts/idea-ui'

export type PlantParentOption = { id: string; title: string; stage: 'graine' | 'pousse' | 'mure' }

const fieldSt: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 15, padding: 10, minHeight: 44 }

export function PlantIdeaSheet({
  fromEntry,
  parentId: initialParent = null,
  parents,
  onClose,
  onPlanted,
}: {
  /** Planting from a moment: its id and text (the title is prefilled from its first words). */
  fromEntry?: { id: number; text: string } | null
  parentId?: string | null
  /** Ideas it can grow on; loaded by the sheet when not given. */
  parents?: PlantParentOption[]
  onClose: () => void
  onPlanted: (conceptId: string) => void
}) {
  const { t } = useI18n()
  const firstWords = fromEntry ? fromEntry.text.replace(/\s+/g, ' ').trim().split(/[.!?\n]/)[0].slice(0, 60) : ''
  const [title, setTitle] = useState(firstWords)
  const [body, setBody] = useState('')
  const [parent, setParent] = useState<string>(initialParent ?? '')
  const [options, setOptions] = useState<PlantParentOption[]>(parents ?? [])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (parents) return
    let gone = false
    void fetch('/api/ideas?offset=0', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows?: Array<{ id: string; title: string; stage: PlantParentOption['stage'] }> } | null) => {
        if (!gone && j?.rows) setOptions(j.rows.map((r) => ({ id: r.id, title: r.title, stage: r.stage })).sort((a, b) => a.title.localeCompare(b.title)))
      })
      .catch(() => {})
    return () => {
      gone = true
    }
  }, [parents])

  async function go() {
    if (!title.trim() || busy) return
    setBusy(true)
    const res = await plantIdea({ title, body: fromEntry ? null : body, fromEntryId: fromEntry?.id ?? null, parentId: parent || null })
    setBusy(false)
    if ('error' in res) {
      toast.error(ideaErrorText(res.error, t))
      return
    }
    toast.success(t('it_planted').replace('{title}', title.trim()))
    onPlanted(res.conceptId)
  }

  return (
    <div role="dialog" aria-label={t('it_plant_title')} data-testid="idea-plant-sheet" style={{ display: 'grid', gap: 10, padding: 14, border: '1px solid var(--bd2)', borderRadius: 12, background: 'var(--bg1)' }}>
      <div style={{ fontWeight: 600 }}>{t('it_plant_title')}</div>
      <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{t(fromEntry ? 'it_plant_hint_entry' : 'it_plant_hint_new')}</div>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
        {t('it_field_title')}
        <input className="input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} maxLength={200} style={fieldSt} data-testid="idea-plant-title" />
      </label>
      {fromEntry ? null : (
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
          {t('it_field_first_lines')}
          <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={fieldSt} />
        </label>
      )}
      <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--tx3)' }}>
        {t('it_field_grows_on')}
        <select className="input" value={parent} onChange={(e) => setParent(e.target.value)} style={fieldSt}>
          <option value="">{t('it_trunk_option')}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {SEED[o.stage]} {o.title}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn ghost sm" onClick={onClose} style={{ minHeight: 44 }}>
          {t('it_cancel')}
        </button>
        <button type="button" className="btn sm" disabled={busy || !title.trim()} onClick={() => void go()} data-testid="idea-plant-go" style={{ minHeight: 44, ...MAIN_ACTION_STYLE }}>
          {t('it_plant_go')}
        </button>
      </div>
    </div>
  )
}
