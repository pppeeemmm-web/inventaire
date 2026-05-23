'use client'

import { useState, useRef } from 'react'
import { createConcept, uploadConceptSketch, type ConceptRow } from '@/app/atelier/(portal)/concepts/actions'
import { useI18n } from '@/lib/i18n/context'
import { stringifyError } from '@/lib/error'
import { toast } from '@/lib/ui/toast'
import { CATEGORY_IDS, CATEGORY_KEYS, MEDIUM_IDS, MEDIUM_KEY } from './concept-constants'
import { inputSt, labelSt } from './concept-form-styles'

export function NewConceptForm({ onCreated, onCancel, narrow }: {
  onCreated: (c: ConceptRow) => void
  onCancel:  () => void
  narrow: boolean
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [skBusy, setSkBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [imageNoteValue, setImageNoteValue] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setBusy(true); setErr('')
    const fd = new FormData(formRef.current)
    if (imageNoteValue) fd.set('image_note', imageNoteValue)
    const res = await createConcept(fd)
    setBusy(false)
    if ('error' in res) { setErr(stringifyError(res.error)); return }
    onCreated(res.concept)
  }

  async function onPickSketch(f: File | null) {
    if (!f) return
    setSkBusy(true); setErr('')
    const fd = new FormData()
    fd.set('sketch', f)
    const res = await uploadConceptSketch(fd)
    setSkBusy(false)
    if ('error' in res) {
      setErr(stringifyError(res.error))
      return
    }
    setImageNoteValue(res.storagePath)
    toast.success(t('concept_sketch_stored'))
  }

  const gridCols = narrow ? '1fr' : '1fr 1fr'

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{
      background: 'var(--bg1)', border: '1px solid var(--ac)',
      padding: narrow ? '14px max(12px, env(safe-area-inset-right)) 72px max(12px, env(safe-area-inset-left))' : 20,
      marginBottom: 16,
    }}>
      <div className="t-eyebrow" style={{ marginBottom: 16, color: 'var(--ac)' }}>{t('concept_new_heading')}</div>
      <input type="hidden" name="image_note" value={imageNoteValue} readOnly />

      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 12, marginBottom: 12 }}>
        <div style={{ gridColumn: narrow ? undefined : '1 / -1' }}>
          <label style={labelSt}>{t('concept_field_title')} *</label>
          <input name="titre" style={inputSt} placeholder={t('concept_ph_title')} autoFocus required />
        </div>
        <div>
          <label style={labelSt}>{t('concept_field_medium')}</label>
          <select name="medium" style={inputSt}>
            <option value="">—</option>
            {MEDIUM_IDS.map((id) => (
              <option key={id} value={id}>{t(MEDIUM_KEY[id] ?? 'concept_med_autre')}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelSt}>{t('concept_field_energy')}</label>
          <select name="energie" style={inputSt}>
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{t(`concept_en_${n}` as 'concept_en_1')}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: narrow ? undefined : '1 / -1' }}>
          <label style={labelSt}>{t('concept_field_category')}</label>
          <select name="category" style={inputSt} defaultValue="artistic">
            {CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>{t(CATEGORY_KEYS[id])}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>{t('concept_field_desc')}</label>
          <textarea name="description" style={{ ...inputSt, height: 72, resize: 'vertical' }}
            placeholder={t('concept_ph_desc')} />
        </div>
        <div style={{ gridColumn: narrow ? undefined : '1 / -1' }}>
          <label style={labelSt}>{t('concept_field_themes')}</label>
          <input name="themes" style={inputSt} placeholder={t('concept_ph_themes')} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>{t('concept_field_visual')}</label>
          <input style={{ ...inputSt, marginBottom: 8 }} placeholder={t('concept_ph_visual')}
            value={imageNoteValue}
            onChange={(e) => { setImageNoteValue(e.target.value.trim()) }} />
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
            onChange={(e) => { void onPickSketch(e.target.files?.[0] ?? null); e.target.value = '' }} />
          <button type="button" className="btn ghost sm" disabled={skBusy}
            style={{ minHeight: 44, width: narrow ? '100%' : 'auto' }}
            onClick={() => fileRef.current?.click()}>
            {skBusy ? t('concept_sketch_uploading') : t('concept_sketch_btn')}
          </button>
          {imageNoteValue.startsWith('concepts/') && (
            <div className="t-mono-sm" style={{ marginTop: 8, fontSize: 9, color: 'var(--sage)', wordBreak: 'break-all' }}>{imageNoteValue}</div>
          )}
          <div className="t-mono-sm" style={{ marginTop: 6, fontSize: 8, opacity: 0.55 }}>{t('concept_sketch_hint')}</div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelSt}>{t('concept_field_notes')}</label>
          <textarea name="notes" style={{ ...inputSt, height: 56, resize: 'vertical' }} />
        </div>
      </div>

      {err && <div style={{ color: 'var(--rust)', fontSize: 10, marginBottom: 8 }}>{err}</div>}

      <div className="row gap-sm" style={{
        ...(narrow ? {
          position: 'sticky',
          bottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          paddingTop: 10,
          background: 'var(--bg1)',
          borderTop: '1px solid var(--bd)',
          marginTop: 8,
          marginLeft: narrow ? -14 : 0,
          marginRight: narrow ? -14 : 0,
          paddingLeft: narrow ? 14 : 0,
          paddingRight: narrow ? 14 : 0,
        } : {}),
      }}>
        <button type="submit" className="btn sm" disabled={busy} style={{ minHeight: 44, flex: narrow ? 1 : undefined }}>
          {busy ? t('concept_btn_creating') : t('concept_btn_create')}
        </button>
        <button type="button" className="btn ghost sm" style={{ minHeight: 44 }} onClick={onCancel}>{t('concept_btn_cancel')}</button>
      </div>
    </form>
  )
}
